import type { Datos, Venta } from './tipos';
import { formatoCOP, pesos } from './texto';
import { cuentaCanastillas } from './canastillas';

export interface LineaCuenta {
  tipo: 'venta' | 'saldoInicial' | 'abono';
  id: string;
  fecha: string;
  creadoPor: string;
  venta?: Venta;
  total: number;
  pendiente: number;
  debe: boolean;
}

export interface EstadoCuenta {
  debe: boolean;
  saldo: number;
  lineas: LineaCuenta[];
  todas: LineaCuenta[];
}

export function estadoCuenta(clienteId: string, datos: Datos): EstadoCuenta {
  const saldos: LineaCuenta[] = datos.saldosIniciales
    .filter((s) => !s.borrado && s.clienteId === clienteId)
    .map((s) => ({ tipo: 'saldoInicial', id: s.id, fecha: s.creadoEn, creadoPor: s.creadoPor, total: s.valor, pendiente: s.valor, debe: true }));
  const ventas: LineaCuenta[] = datos.ventas
    .filter((v) => !v.borrado && v.clienteId === clienteId && v.estado === 'debe')
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
    .map((v) => {
      const total = pesos(v.cantidad * v.precioUnitario);
      return { tipo: 'venta', id: v.id, fecha: v.creadoEn, creadoPor: v.creadoPor, venta: v, total, pendiente: total, debe: true };
    });
  const abonos: LineaCuenta[] = datos.abonos
    .filter((a) => !a.borrado && a.clienteId === clienteId)
    .map((a) => ({ tipo: 'abono', id: a.id, fecha: a.creadoEn, creadoPor: a.creadoPor, total: a.valor, pendiente: 0, debe: false }));

  // Los abonos cubren de la deuda más vieja a la más nueva; el saldo de la libreta va primero.
  let restante = abonos.reduce((s, a) => s + a.total, 0);
  for (const deuda of [...saldos, ...ventas]) {
    const cubre = Math.min(restante, deuda.total);
    restante -= cubre;
    deuda.pendiente = deuda.total - cubre;
    deuda.debe = deuda.pendiente > 0;
  }

  const todas = [...saldos, ...ventas, ...abonos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const saldo = [...saldos, ...ventas].reduce((s, d) => s + d.pendiente, 0);

  let acumulado = 0;
  let desde = 0;
  todas.forEach((l, i) => {
    acumulado += l.tipo === 'abono' ? -l.total : l.total;
    if (acumulado <= 0) desde = i + 1;
  });

  return { debe: saldo > 0, saldo, lineas: todas.slice(desde), todas };
}

export function validarAbono(valor: number, saldo: number): string | null {
  if (valor <= 0) return 'El abono debe ser mayor que cero';
  if (valor > saldo) return `El abono es mayor que la deuda. Debe ${formatoCOP(saldo)}`;
  return null;
}

export interface Deudor { clienteId: string; nombre: string; saldo: number; canastillas: number; desde: string }

/** Clientes que deben plata o canastillas. "desde" es la fecha de su deuda pendiente más vieja (de cualquiera de las dos). */
export function deudores(datos: Datos, orden: 'monto' | 'antiguedad'): Deudor[] {
  const lista: Deudor[] = [];
  for (const c of datos.clientes) {
    if (c.borrado) continue;
    const cuenta = estadoCuenta(c.id, datos);
    const canastas = cuentaCanastillas(c.id, datos);
    if (!cuenta.debe && canastas.debe <= 0) continue;
    const fechas = [
      cuenta.todas.find((l) => l.tipo !== 'abono' && l.debe)?.fecha,
      canastas.todas.find((l) => l.tipo === 'prestamo' && l.pendiente > 0)?.fecha,
    ].filter((f): f is string => !!f).sort();
    lista.push({ clienteId: c.id, nombre: c.nombre, saldo: cuenta.saldo, canastillas: Math.max(0, canastas.debe), desde: fechas[0] ?? '' });
  }
  return lista.sort((a, b) => (orden === 'monto'
    ? b.saldo - a.saldo || b.canastillas - a.canastillas
    : a.desde.localeCompare(b.desde)));
}
