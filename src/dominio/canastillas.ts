import type { Datos, Venta } from './tipos';

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
