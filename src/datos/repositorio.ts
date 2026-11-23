import type { Base, Datos, Historial } from '../dominio/tipos';
import { normalizarNombre } from '../dominio/texto';
import { db, type Tabla } from './db';

let ultimo = 0;
/** Hora ISO estrictamente creciente, para que el orden de creación sea estable. */
export function ahora(): string {
  ultimo = Math.max(Date.now(), ultimo + 1);
  return new Date(ultimo).toISOString();
}

const CON_NOMBRE: Tabla[] = ['clientes', 'productos'];

async function revisarNombre(tabla: Tabla, registro: { id: string; nombre: string; nombreNormalizado: string }) {
  const iguales = await db.table(tabla).where('nombreNormalizado').equals(registro.nombreNormalizado).toArray();
  if (iguales.some((x: Base) => !x.borrado && x.id !== registro.id)) {
    throw new Error(tabla === 'clientes'
      ? `Ya existe un cliente llamado "${registro.nombre}". Usa otro nombre, por ejemplo "${registro.nombre} Pérez"`
      : 'Ya existe un producto con ese nombre');
  }
}

async function escribir(tabla: Tabla, registro: Base, h: Omit<Historial, 'id' | 'tabla' | 'registroId' | 'fecha'>) {
  const historial: Historial = { id: crypto.randomUUID(), tabla, registroId: registro.id, fecha: registro.actualizadoEn, ...h };
  await db.transaction('rw', [db.table(tabla), db.historial, db.salida], async () => {
    await db.table(tabla).put(registro);
    await db.historial.put(historial);
    await db.salida.add({ tabla, registro });
    await db.salida.add({ tabla: 'historial', registro: historial });
  });
}

export async function crear<T extends Base>(tabla: Tabla, datos: Omit<T, keyof Base> & { id?: string }, usuarioId: string): Promise<T> {
  const fecha = ahora();
  const registro = { ...datos, id: datos.id ?? crypto.randomUUID(), creadoPor: usuarioId, creadoEn: fecha, actualizadoEn: fecha, borrado: false } as unknown as T;
  if (CON_NOMBRE.includes(tabla)) {
    const r = registro as unknown as { id: string; nombre: string; nombreNormalizado: string };
    r.nombreNormalizado = normalizarNombre(r.nombre);
    await revisarNombre(tabla, r);
  }
  await escribir(tabla, registro, { usuarioId, accion: 'crear', antes: null, despues: registro });
  return registro;
}

async function cambiar<T extends Base>(tabla: Tabla, id: string, cambios: Partial<T>, usuarioId: string, accion: 'editar' | 'borrar'): Promise<T> {
  const actual = (await db.table(tabla).get(id)) as T | undefined;
  if (!actual) throw new Error('No encontré ese registro');
  const nuevo = { ...actual, ...cambios, id, actualizadoEn: ahora() } as T;
  if (CON_NOMBRE.includes(tabla) && 'nombre' in cambios) {
    const r = nuevo as unknown as { id: string; nombre: string; nombreNormalizado: string };
    r.nombreNormalizado = normalizarNombre(r.nombre);
    await revisarNombre(tabla, r);
  }
  const antes: Record<string, unknown> = {};
  const despues: Record<string, unknown> = {};
  for (const k of Object.keys(cambios)) {
    antes[k] = (actual as Record<string, unknown>)[k];
    despues[k] = (nuevo as Record<string, unknown>)[k];
  }
  await escribir(tabla, nuevo, { usuarioId, accion, antes, despues });
  return nuevo;
}

export function editar<T extends Base>(tabla: Tabla, id: string, cambios: Partial<T>, usuarioId: string): Promise<T> {
  return cambiar<T>(tabla, id, cambios, usuarioId, 'editar');
}

export async function borrar(tabla: Tabla, id: string, usuarioId: string): Promise<void> {
  await cambiar<Base>(tabla, id, { borrado: true }, usuarioId, 'borrar');
}

const porCreacion = <T extends Base>(xs: T[]) => xs.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));

export async function cargarDatos(): Promise<Datos> {
  const [clientes, productos, lotes, ventas, vaciados, abonos, saldosIniciales, devoluciones] = await Promise.all([
    db.clientes.toArray(), db.productos.toArray(), db.lotes.toArray(), db.ventas.toArray(), db.vaciados.toArray(),
    db.abonos.toArray(), db.saldosIniciales.toArray(), db.devoluciones.toArray(),
  ]);
  return {
    clientes: porCreacion(clientes), productos: porCreacion(productos), lotes: porCreacion(lotes), ventas: porCreacion(ventas),
    vaciados: porCreacion(vaciados), abonos: porCreacion(abonos), saldosIniciales: porCreacion(saldosIniciales),
    devoluciones: porCreacion(devoluciones),
  };
}

export async function historialDe(registroId: string): Promise<Historial[]> {
  const h = await db.historial.where('registroId').equals(registroId).toArray();
  return h.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
