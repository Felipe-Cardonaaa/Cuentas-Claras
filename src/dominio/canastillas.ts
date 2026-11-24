import type { Datos, Devolucion, Venta } from './tipos';

export function prestadasCliente(clienteId: string, datos: Datos): { total: number; detalle: { venta: Venta; cantidad: number }[] } {
  const detalle = datos.ventas
    .filter((v) => !v.borrado && v.clienteId === clienteId && v.unidad === 'canastilla' && v.prestada === true)
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
    .map((venta) => ({ venta, cantidad: venta.cantidad }));
  const prestadas = detalle.reduce((s, d) => s + d.cantidad, 0);
  const devueltas = datos.devoluciones.filter((d) => !d.borrado && d.clienteId === clienteId).reduce((s, d) => s + d.cantidad, 0);
  return { total: prestadas - devueltas, detalle };
}

export function validarDevolucion(cantidad: number, prestadas: number): string | null {
  if (cantidad > prestadas) return `Solo tiene ${prestadas} canastillas prestadas`;
  return null;
}

export interface LineaCanastillas {
  tipo: 'prestamo' | 'devolucion';
  id: string;
  fecha: string;
  creadoPor: string;
  venta?: Venta;
  devolucion?: Devolucion;
  cantidad: number;
  /** En préstamos: cuántas de ese préstamo faltan por devolver. En devoluciones: 0. */
  pendiente: number;
}

/**
 * Fiado de canastillas: lo que el cliente debe en canastillas, aparte de la plata.
 * Las devoluciones descuentan del préstamo más viejo. "lineas" va desde la última vez que no debía ninguna.
 */
export function cuentaCanastillas(clienteId: string, datos: Datos): { debe: number; lineas: LineaCanastillas[]; todas: LineaCanastillas[] } {
  const prestamos: LineaCanastillas[] = prestadasCliente(clienteId, datos).detalle.map(({ venta, cantidad }) => ({
    tipo: 'prestamo', id: venta.id, fecha: venta.creadoEn, creadoPor: venta.creadoPor, venta, cantidad, pendiente: cantidad,
  }));
  const devoluciones: LineaCanastillas[] = datos.devoluciones
    .filter((d) => !d.borrado && d.clienteId === clienteId)
    .map((d) => ({ tipo: 'devolucion', id: d.id, fecha: d.creadoEn, creadoPor: d.creadoPor, devolucion: d, cantidad: d.cantidad, pendiente: 0 }));
  let restante = devoluciones.reduce((s, d) => s + d.cantidad, 0);
  for (const p of prestamos) {
    const cubre = Math.min(restante, p.cantidad);
    restante -= cubre;
    p.pendiente = p.cantidad - cubre;
  }
  const todas = [...prestamos, ...devoluciones].sort((a, b) => a.fecha.localeCompare(b.fecha));
  let acumulado = 0;
  let desde = 0;
  todas.forEach((l, i) => {
    acumulado += l.tipo === 'devolucion' ? -l.cantidad : l.cantidad;
    if (acumulado <= 0) desde = i + 1;
  });
  return { debe: prestamos.reduce((s, p) => s + p.pendiente, 0), lineas: todas.slice(desde), todas };
}
