import type { Base, Datos, Lote, Venta, Vaciado, Abono, SaldoInicial, Devolucion, Cliente, Producto } from '../src/dominio/tipos';

let n = 0;
export function base(creadoEn = '2026-11-17T14:00:00Z', creadoPor = 'u1'): Base {
  n += 1;
  return { id: `id${n}`, creadoPor, creadoEn, actualizadoEn: creadoEn, borrado: false };
}

export function datosVacios(): Datos {
  return { clientes: [], productos: [], lotes: [], ventas: [], vaciados: [], abonos: [], saldosIniciales: [], devoluciones: [] };
}

export const cliente = (id: string, nombre: string, nombreNormalizado: string): Cliente =>
  ({ ...base(), id, nombre, nombreNormalizado });
export const producto = (id: string, nombre: string): Producto =>
  ({ ...base(), id, nombre, nombreNormalizado: nombre });
export const lote = (id: string, productoId: string, canastillas: number, costoTotal: number | null, creadoEn: string): Lote =>
  ({ ...base(creadoEn), id, productoId, canastillas, costoTotal, costoDetalle: null });
export function venta(v: Partial<Venta> & Pick<Venta, 'productoId' | 'cantidad' | 'precioUnitario'>): Venta {
  const b = base(v.creadoEn);
  return { ...b, grupoId: b.id, clienteId: null, loteId: null, unidad: 'canastilla', estado: 'pago', prestada: null, ...v };
}
export const vaciado = (loteId: string, cantidad: number, creadoEn?: string): Vaciado => ({ ...base(creadoEn), loteId, cantidad });
export const abono = (clienteId: string, valor: number, creadoEn: string): Abono => ({ ...base(creadoEn), clienteId, valor });
export const saldoInicial = (clienteId: string, valor: number, creadoEn: string): SaldoInicial =>
  ({ ...base(creadoEn), clienteId, valor });
export const devolucion = (clienteId: string, cantidad: number, creadoEn?: string): Devolucion =>
  ({ ...base(creadoEn), clienteId, cantidad });
