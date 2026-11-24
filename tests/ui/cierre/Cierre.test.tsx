import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  // Marta fió 90.000 y abonó 100.000 (cubre su fiado); Pedro fió 32.000 y no ha pagado.
  expect(await screen.findByText('Quedó debiendo hoy')).toBeInTheDocument();
  expect(screen.getByLabelText('Quedó debiendo hoy')).toHaveTextContent('$32.000');
  expect(screen.getAllByText('$100.000').length).toBeGreaterThan(0);
  expect(screen.getByText('Pagado')).toBeInTheDocument();
  expect(screen.getByText('Debe $32.000')).toBeInTheDocument();
  expect(within(screen.getByLabelText('Fiados del día')).getByText('Doña Marta · 2 canast. mango criollo')).toBeInTheDocument();
  const fila = screen.getByRole('row', { name: /mango criollo/ });
  expect(within(fila).getAllByRole('cell').map((c) => c.textContent)).toEqual(['mango criollo', '50', '45', '0', '5']);
});

it('sin línea de prestadas y con productos sin entrada', async () => {
  const p = await crear<Producto>('productos', { nombre: 'criollo', nombreNormalizado: '' }, 'u1');
  await crear<Venta>('ventas', {
    grupoId: 'z', loteId: null, unidad: 'canastilla', precioUnitario: 60000, clienteId: null, productoId: p.id, cantidad: 3, estado: 'pago', prestada: false,
  }, 'u1');
  render(<Cierre />);
  const fila = await screen.findByRole('row', { name: /^criollo/ });
  expect(within(fila).getAllByRole('cell').map((c) => c.textContent)).toEqual(['criollo', '0', '3', '0', '—']);
  expect(screen.getByText(/Falta anotar la mercancía que entró de: criollo/)).toBeInTheDocument();
  expect(screen.queryByText('Canastillas prestadas hoy')).not.toBeInTheDocument();
});

it('muestra las listas Pagaron hoy y Quedaron debiendo', async () => {
  render(<Cierre />);
  const pagaron = await screen.findByLabelText('Pagaron hoy');
  expect(within(pagaron).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Doña Marta$100.000']);
  const deben = screen.getByLabelText('Quedaron debiendo');
  expect(within(deben).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Don Pedro$32.000']);
  expect(within(deben).queryByText('Doña Marta')).not.toBeInTheDocument();
});

it('Ventas del día: se puede abrir cualquier venta y borrarla', async () => {
  const usuario = { id: 'u1', nombre: 'Carlos' } as never;
  render(<Cierre usuario={usuario} />);
  const lista = await screen.findByLabelText('Ventas y abonos del día');
  await userEvent.click(within(lista).getByRole('button', { name: /Cliente de paso · 43 canast\. mango criollo/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
  const despues = await screen.findByLabelText('Ventas y abonos del día');
  await waitFor(() => expect(within(despues).queryByRole('button', { name: /43 canast/ })).not.toBeInTheDocument());
});

it('los abonos del día también se pueden abrir y borrar', async () => {
  const usuario = { id: 'u1', nombre: 'Carlos' } as never;
  render(<Cierre usuario={usuario} />);
  const lista = await screen.findByLabelText('Ventas y abonos del día');
  await userEvent.click(within(lista).getByRole('button', { name: /Abono · Doña Marta/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
  const despues = await screen.findByLabelText('Ventas y abonos del día');
  await waitFor(() => expect(within(despues).queryByRole('button', { name: /Abono · Doña Marta/ })).not.toBeInTheDocument());
});
