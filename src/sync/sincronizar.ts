import { db, TABLAS, type FilaSalida, type Tabla } from '../datos/db';
import { aFila, deFila, tablaRemota } from './mapeo';

interface ErrorRemoto { code?: string; message: string }
type Respuesta<T> = PromiseLike<{ data?: T | null; error: ErrorRemoto | null }>;
type Filas = Record<string, unknown>[];

/** Lo mínimo del cliente de Supabase que usa la sincronización. */
export interface ClienteSync {
  from(tabla: string): {
    upsert(fila: Record<string, unknown>): Respuesta<unknown>;
    select(columnas: string): {
      gt(columna: string, valor: string): { order(columna: string, opciones?: { ascending: boolean }): { range(desde: number, hasta: number): Respuesta<Filas> } };
      eq(columna: string, valor: unknown): Respuesta<Filas>;
    };
  };
}

export interface Conflicto { tabla: string; registro: object; mensaje: string }

const DESDE_SIEMPRE = '1970-01-01T00:00:00.000Z';
const PAGINA = 1000;
/** Se vuelve a pedir un poco hacia atrás: en el servidor las escrituras pueden confirmarse fuera de orden. */
const SOLAPE_MS = 5000;

/** Tablas y campos que apuntan a un cliente o a un producto. */
const REFERENCIAS: Record<'clientes' | 'productos', { tabla: Tabla; campo: string }[]> = {
  clientes: [
    { tabla: 'ventas', campo: 'clienteId' }, { tabla: 'abonos', campo: 'clienteId' },
    { tabla: 'saldosIniciales', campo: 'clienteId' }, { tabla: 'devoluciones', campo: 'clienteId' },
  ],
  productos: [{ tabla: 'ventas', campo: 'productoId' }, { tabla: 'lotes', campo: 'productoId' }],
};

async function leerMeta<T>(clave: string, porDefecto: T): Promise<T> {
  return ((await db.meta.get(clave))?.valor as T | undefined) ?? porDefecto;
}

async function apartar(clave: 'rechazados' | 'conflictos', fila: FilaSalida, error: ErrorRemoto) {
  const lista = await leerMeta<Conflicto[]>(clave, []);
  await db.meta.put({ clave, valor: [...lista, { tabla: fila.tabla, registro: fila.registro, mensaje: error.message }] });
}

/**
 * El mismo nombre se creó sin señal en otro celular y ya está en el servidor:
 * todo lo que apuntaba al registro local pasa a apuntar al del servidor, y el local se quita.
 */
async function unirDuplicado(cliente: ClienteSync, fila: FilaSalida): Promise<boolean> {
  const tabla = fila.tabla as 'clientes' | 'productos';
  const local = fila.registro as { id: string; nombreNormalizado: string };
  let respuesta;
  try {
    respuesta = await cliente.from(tablaRemota(tabla)).select('*').eq('nombre_normalizado', local.nombreNormalizado);
  } catch {
    return false;
  }
  const remoto = (respuesta.data ?? []).map((f) => deFila(f) as { id: string; borrado: boolean }).find((r) => !r.borrado && r.id !== local.id);
  if (!remoto) return false;

  const tablasTocadas = [db.table(tabla), db.salida, ...REFERENCIAS[tabla].map((r) => db.table(r.tabla))];
  await db.transaction('rw', tablasTocadas, async () => {
    for (const { tabla: t, campo } of REFERENCIAS[tabla]) {
      await db.table(t).where(campo).equals(local.id).modify({ [campo]: remoto.id });
    }
    for (const f of await db.salida.toArray()) {
      if (f.tabla === tabla && (f.registro as { id: string }).id === local.id) {
        await db.salida.delete(f.orden!);
        continue;
      }
      const ref = REFERENCIAS[tabla].find((r) => r.tabla === f.tabla);
      const registro = f.registro as Record<string, unknown>;
      if (ref && registro[ref.campo] === local.id) await db.salida.update(f.orden!, { registro: { ...registro, [ref.campo]: remoto.id } });
    }
    await db.table(tabla).delete(local.id);
    await db.table(tabla).put(remoto);
  });
  return true;
}

async function subir(cliente: ClienteSync): Promise<number> {
  let subidos = 0;
  // Filas de tablas que el servidor todavía no tiene (falta correr un SQL nuevo): se dejan para después sin trabar lo demás.
  const saltadas = new Set<number>();
  for (;;) {
    const fila = await db.salida.orderBy('orden').filter((f) => !saltadas.has(f.orden!)).first();
    if (!fila) break;
    let error: ErrorRemoto | null;
    try {
      ({ error } = await cliente.from(tablaRemota(fila.tabla)).upsert(aFila(fila.registro)));
    } catch {
      break; // sin señal: se reintenta después
    }
    if (error) {
      const codigo = error.code ?? '';
      if (codigo === 'PGRST205' || codigo === '42P01') {
        saltadas.add(fila.orden!);
        continue;
      }
      if (codigo === '23505' && (fila.tabla === 'clientes' || fila.tabla === 'productos')) {
        if (await unirDuplicado(cliente, fila)) continue;
        await apartar('conflictos', fila, error);
      } else if (/^2[23]/.test(codigo)) {
        // Datos que el servidor nunca va a aceptar: se apartan para que no traben lo demás.
        await apartar('rechazados', fila, error);
      } else {
        break; // permisos, sesión vencida, servidor caído: se reintenta después
      }
    } else {
      subidos += 1;
    }
    await db.salida.delete(fila.orden!);
  }
  return subidos;
}

async function bajarTabla(cliente: ClienteSync, tabla: Tabla | 'historial'): Promise<number> {
  const cursor = await leerMeta(`cursor:${tabla}`, DESDE_SIEMPRE);
  const desde = new Date(Math.max(0, Date.parse(cursor) - SOLAPE_MS)).toISOString();
  let maximo = cursor;
  let bajados = 0;
  for (let inicio = 0; ; inicio += PAGINA) {
    let respuesta;
    try {
      respuesta = await cliente.from(tablaRemota(tabla)).select('*').gt('recibido_en', desde)
        .order('recibido_en', { ascending: true }).range(inicio, inicio + PAGINA - 1);
    } catch {
      break;
    }
    if (respuesta.error || !respuesta.data) break;
    for (const fila of respuesta.data) {
      const recibido = new Date(fila.recibido_en as string).toISOString();
      if (recibido > maximo) maximo = recibido;
      const registro = deFila(fila) as { id: string; actualizadoEn?: string };
      const local = (await db.table(tabla).get(registro.id)) as { actualizadoEn?: string } | undefined;
      if (local?.actualizadoEn && registro.actualizadoEn && local.actualizadoEn >= registro.actualizadoEn) continue;
      await db.table(tabla).put(registro);
      bajados += 1;
    }
    // El cursor solo avanza con páginas leídas completas.
    await db.meta.put({ clave: `cursor:${tabla}`, valor: maximo });
    if (respuesta.data.length < PAGINA) break;
  }
  return bajados;
}

export async function sincronizar(cliente: ClienteSync): Promise<{ subidos: number; bajados: number }> {
  const subidos = await subir(cliente);
  let bajados = 0;
  for (const tabla of [...TABLAS, 'historial'] as (Tabla | 'historial')[]) bajados += await bajarTabla(cliente, tabla);
  return { subidos, bajados };
}

/** Sincroniza al abrir, al volver la señal y cada 30 s. Devuelve la función para detener. */
export function iniciarSincronizacion(cliente: ClienteSync, alTerminar?: () => void): () => void {
  let corriendo = false;
  const correr = async () => {
    if (corriendo) return;
    corriendo = true;
    try {
      await sincronizar(cliente);
      alTerminar?.();
    } finally {
      corriendo = false;
    }
  };
  void correr();
  window.addEventListener('online', correr);
  const intervalo = window.setInterval(correr, 30_000);
  return () => {
    window.removeEventListener('online', correr);
    window.clearInterval(intervalo);
  };
}
