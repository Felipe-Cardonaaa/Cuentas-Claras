import { render, screen, within } from '@testing-library/react';
import Cierre from '../../../src/ui/cierre/Cierre';
import { db } from '../../../src/datos/db';
import { crear } from '../../../src/datos/repositorio';
import type { Abono, Cliente, Lote, Producto, Venta } from '../../../src/dominio/tipos';

beforeEach(async () => {
  await db.delete();
  await db.open();
  const m = await crear<Cliente>('clientes', { nombre: 'Doña Marta', nombreNormalizado: '' }, 'u1');
  const pe = await crear<Cliente>('clientes', { nombre: 'Don Pedro', nombreNormalizado: '' }, 'u1');
  const mango = await crear<Producto>('productos', { nombre: 'mango criollo', nombreNormalizado: '' }, 'u1');
  const mand = await crear<Producto>('productos', { nombre: 'mandarina', nombreNormalizado: '' }, 'u1');
  const l1 = await crear<Lote>('lotes', { productoId: mango.id, canastillas: 50, costoTotal: null, costoDetalle: null }, 'u1');
  await crear<Lote>('lotes', { productoId: mand.id, canastillas: 8, costoTotal: null, costoDetalle: null }, 'u1');
  const v = { grupoId: 'g', loteId: l1.id, unidad: 'canastilla' as const, precioUnitario: 45000 };
  await crear<Venta>('ventas', { ...v, clienteId: m.id, productoId: mango.id, cantidad: 2, estado: 'debe', prestada: true }, 'u1');
  await crear<Venta>('ventas', { ...v, grupoId: 'h', clienteId: null, productoId: mango.id, cantidad: 43, estado: 'pago', prestada: false }, 'u1');
  await crear<Venta>('ventas', {
    grupoId: 'k', loteId: null, unidad: 'kilo', precioUnitario: 4000, clienteId: pe.id, productoId: mand.id, cantidad: 8, estado: 'debe', prestada: null,
  }, 'u1');
  await crear<Abono>('abonos', { clienteId: m.id, valor: 100000 }, 'u1');
});

it('resume el día', async () => {
  render(<Cierre />);
  expect(await screen.findByText('$122.000')).toBeInTheDocument();
  expect(screen.getByText('$100.000')).toBeInTheDocument();
  expect(screen.getByText('Doña Marta · 2 canast. mango criollo')).toBeInTheDocument();
  const fila = screen.getByRole('row', { name: /mango criollo/ });
  expect(within(fila).getAllByRole('cell').map((c) => c.textContent)).toEqual(['mango criollo', '50', '45', '0', '5']);
});
