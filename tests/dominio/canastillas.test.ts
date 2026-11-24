import { cuentaCanastillas, prestadasCliente, validarDevolucion } from '../../src/dominio/canastillas';
import { datosVacios, devolucion, venta } from '../fabrica';

it('suma prestadas y resta devoluciones', () => {
  const d = datosVacios();
  d.ventas.push(
    venta({ clienteId: 'm', productoId: 'mango', cantidad: 1, precioUnitario: 45000, prestada: true }),
    venta({ clienteId: 'm', productoId: 'zapote', cantidad: 1, precioUnitario: 50000, prestada: true }),
    venta({ clienteId: 'm', productoId: 'mango', cantidad: 1, precioUnitario: 45000, prestada: false }),
    venta({ clienteId: 'm', productoId: 'mandarina', unidad: 'kilo', cantidad: 5, precioUnitario: 4000, prestada: true }),
  );
  d.devoluciones.push(devolucion('m', 1));
  const r = prestadasCliente('m', d);
  expect(r.total).toBe(1);
  expect(r.detalle).toHaveLength(2);
});

it('no deja devolver más de las prestadas', () => {
  expect(validarDevolucion(3, 1)).toBe('Solo tiene 1 canastillas prestadas');
  expect(validarDevolucion(1, 1)).toBeNull();
});

describe('cuenta de canastillas (fiado de canastillas)', () => {
  it('pagar la plata no borra lo que se debe en canastillas', () => {
    const d = datosVacios();
    d.ventas.push(venta({ clienteId: 'g', productoId: 'cri', cantidad: 3, precioUnitario: 60000, estado: 'debe', prestada: true, creadoEn: '2026-11-17T14:00:00Z' }));
    const c = cuentaCanastillas('g', d);
    expect(c).toMatchObject({ debe: 3 });
    expect(c.lineas.map((l) => [l.tipo, l.cantidad, l.pendiente])).toEqual([['prestamo', 3, 3]]);
  });
  it('las devoluciones descuentan del préstamo más viejo', () => {
    const d = datosVacios();
    d.ventas.push(
      venta({ clienteId: 'g', productoId: 'cri', cantidad: 2, precioUnitario: 1, prestada: true, creadoEn: '2026-11-15T14:00:00Z' }),
      venta({ clienteId: 'g', productoId: 'zap', cantidad: 3, precioUnitario: 1, prestada: true, creadoEn: '2026-11-16T14:00:00Z' }),
    );
    d.devoluciones.push(devolucion('g', 3, '2026-11-17T14:00:00Z'));
    const c = cuentaCanastillas('g', d);
    expect(c.debe).toBe(2);
    expect(c.lineas.map((l) => [l.tipo, l.cantidad, l.pendiente])).toEqual([['prestamo', 2, 0], ['prestamo', 3, 2], ['devolucion', 3, 0]]);
  });
});
