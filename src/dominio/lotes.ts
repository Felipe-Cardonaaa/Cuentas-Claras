import type { Datos, Lote } from './tipos';

export interface EstadoLote {
  lote: Lote;
  vendidas: number;
  vaciadas: number;
  quedan: number;
  ingreso: number;
  ganancia: number | null;
}

const porFecha = (a: { creadoEn: string }, b: { creadoEn: string }) => a.creadoEn.localeCompare(b.creadoEn);

/** Lotes vivos del producto, del más viejo al más nuevo. */
export function estadoLotes(productoId: string, datos: Datos): EstadoLote[] {
  return datos.lotes
    .filter((l) => l.productoId === productoId && !l.borrado)
    .sort(porFecha)
    .map((lote) => {
      let vendidas = 0;
      let ingreso = 0;
      for (const v of datos.ventas) {
        if (v.borrado || v.loteId !== lote.id || v.unidad !== 'canastilla') continue;
        vendidas += v.cantidad;
        ingreso += Math.round(v.cantidad * v.precioUnitario);
      }
      const vaciadas = datos.vaciados.filter((x) => !x.borrado && x.loteId === lote.id).reduce((s, x) => s + x.cantidad, 0);
      return {
        lote,
        vendidas,
        vaciadas,
        quedan: lote.canastillas - vendidas - vaciadas,
        ingreso,
        ganancia: lote.costoTotal === null ? null : ingreso - lote.costoTotal,
      };
    });
}

/** Reparte una cantidad de canastillas desde el lote más viejo con disponibles. */
export function elegirLotes(
  productoId: string,
  cantidad: number,
  datos: Datos,
): { partes: { loteId: string | null; cantidad: number }[]; excede: boolean } {
  const estados = estadoLotes(productoId, datos);
  if (estados.length === 0) return { partes: [{ loteId: null, cantidad }], excede: true };
  const partes: { loteId: string | null; cantidad: number }[] = [];
  let falta = cantidad;
  for (const e of estados) {
    if (falta <= 0) break;
    if (e.quedan <= 0) continue;
    const toma = Math.min(e.quedan, falta);
    partes.push({ loteId: e.lote.id, cantidad: toma });
    falta -= toma;
  }
  if (falta <= 0) return { partes, excede: false };
  const ultimo = estados[estados.length - 1].lote.id;
  const existente = partes.find((p) => p.loteId === ultimo);
  if (existente) existente.cantidad += falta;
  else partes.push({ loteId: ultimo, cantidad: falta });
  return { partes, excede: true };
}
