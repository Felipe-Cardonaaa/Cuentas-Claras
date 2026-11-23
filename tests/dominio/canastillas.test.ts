import { prestadasCliente, validarDevolucion } from '../../src/dominio/canastillas';
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
