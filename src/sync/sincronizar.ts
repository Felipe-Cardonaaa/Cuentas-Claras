import { db, TABLAS, type Tabla } from '../datos/db';
import { aFila, deFila, tablaRemota } from './mapeo';

type Respuesta<T> = PromiseLike<{ data?: T | null; error: { code?: string; message: string } | null }>;

/** Lo mínimo del cliente de Supabase que usa la sincronización. */
export interface ClienteSync {
  from(tabla: string): {
    upsert(fila: Record<string, unknown>): Respuesta<unknown>;
    select(columnas: string): { gt(columna: string, valor: string): Respuesta<Record<string, unknown>[]> };
  };
}

export interface Conflicto { tabla: string; registro: object; mensaje: string }

const DESDE_SIEMPRE = '1970-01-01T00:00:00Z';

async function leerMeta<T>(clave: string, porDefecto: T): Promise<T> {
  return ((await db.meta.get(clave))?.valor as T | undefined) ?? porDefecto;
}

async function subir(cliente: ClienteSync): Promise<number> {
  let subidos = 0;
  const cola = await db.salida.orderBy('orden').toArray();
  for (const fila of cola) {
    let error: { code?: string; message: string } | null;
    try {
      ({ error } = await cliente.from(tablaRemota(fila.tabla)).upsert(aFila(fila.registro)));
    } catch {
      break; // sin señal: se reintenta después
    }
    if (error) {
      if (error.code !== '23505') break;
      // Nombre repetido creado en dos celulares sin señal: se guarda para que alguien lo renombre.
      const conflictos = await leerMeta<Conflicto[]>('conflictos', []);
      await db.meta.put({ clave: 'conflictos', valor: [...conflictos, { tabla: fila.tabla, registro: fila.registro, mensaje: error.message }] });
    }
    await db.salida.delete(fila.orden!);
    subidos += 1;
  }
  return subidos;
}

async function bajar(cliente: ClienteSync): Promise<number> {
  const desde = await leerMeta('ultimaBajada', DESDE_SIEMPRE);
  let maximo = desde;
  let bajados = 0;
  for (const tabla of [...TABLAS, 'historial'] as (Tabla | 'historial')[]) {
    let respuesta;
    try {
      respuesta = await cliente.from(tablaRemota(tabla)).select('*').gt('recibido_en', desde);
    } catch {
      return bajados;
    }
    if (respuesta.error || !respuesta.data) return bajados;
    for (const fila of respuesta.data) {
      const recibido = fila.recibido_en as string;
      if (recibido > maximo) maximo = recibido;
      const registro = deFila(fila) as { id: string; actualizadoEn?: string };
      const local = (await db.table(tabla).get(registro.id)) as { actualizadoEn?: string } | undefined;
      if (local?.actualizadoEn && registro.actualizadoEn && local.actualizadoEn > registro.actualizadoEn) continue;
      await db.table(tabla).put(registro);
      bajados += 1;
    }
  }
  await db.meta.put({ clave: 'ultimaBajada', valor: maximo });
  return bajados;
}

export async function sincronizar(cliente: ClienteSync): Promise<{ subidos: number; bajados: number }> {
  const subidos = await subir(cliente);
  const bajados = await bajar(cliente);
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
