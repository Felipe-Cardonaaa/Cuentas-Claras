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
  // Vendido hoy: 90.000 (Marta, ya pagado) + 32.000 (Pedro, debe) + 43 × 45.000 de contado.
  expect(await screen.findByLabelText('Quedó fiado')).toHaveTextContent('$32.000');
  expect(screen.getByLabelText('Quedó pago')).toHaveTextContent('$2.025.000');
  expect(screen.queryByText(/fiados hoy/)).not.toBeInTheDocument();
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

it('muestra Pagaron hoy y Quedaron debiendo con lo que falta de cada fiado', async () => {
  render(<Cierre />);
  const pagaron = await screen.findByLabelText('Pagaron hoy');
  expect(within(pagaron).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Doña Marta$100.000']);
  const deben = screen.getByLabelText('Quedaron debiendo');
  expect(within(deben).getByText('Don Pedro')).toBeInTheDocument();
  expect(within(deben).getByText('8 kg mandarina · debe $32.000')).toBeInTheDocument();
  expect(within(deben).queryByText(/Doña Marta/)).not.toBeInTheDocument();
});

it('movimientos separados: el fiado pagado desaparece y el pendiente muestra lo que falta', async () => {
  render(<Cierre usuario={{ id: 'u1', nombre: 'Carlos' } as never} />);
  const contado = await screen.findByLabelText('Ventas de contado');
  expect(within(contado).getByRole('button', { name: /Cliente de paso · 43 canast\. mango criollo/ })).toBeInTheDocument();
  const fiados = screen.getByLabelText('Fiados pendientes');
  expect(within(fiados).queryByRole('button', { name: /Doña Marta/ })).not.toBeInTheDocument();
  expect(within(fiados).getByRole('button', { name: /Don Pedro · 8 kg mandarina/ })).toHaveTextContent('Debe $32.000');
  expect(within(screen.getByLabelText('Abonos de plata')).getByRole('button', { name: /Doña Marta/ })).toHaveTextContent('$100.000');
});

it('se puede abrir una venta de contado y borrarla', async () => {
  render(<Cierre usuario={{ id: 'u1', nombre: 'Carlos' } as never} />);
  const lista = await screen.findByLabelText('Ventas de contado');
  await userEvent.click(within(lista).getByRole('button', { name: /Cliente de paso · 43 canast\. mango criollo/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: /43 canast/ })).not.toBeInTheDocument());
});

it('los abonos del día se pueden abrir y borrar', async () => {
  render(<Cierre usuario={{ id: 'u1', nombre: 'Carlos' } as never} />);
  const lista = await screen.findByLabelText('Abonos de plata');
  await userEvent.click(within(lista).getByRole('button', { name: /Doña Marta/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
  await waitFor(() => expect(screen.queryByLabelText('Abonos de plata')).not.toBeInTheDocument());
});

it('las devoluciones de canastillas del día aparecen aparte y se pueden corregir', async () => {
  const m = (await db.clientes.toArray()).find((c) => c.nombre === 'Doña Marta')!;
  await crear('devoluciones', { clienteId: m.id, cantidad: 2 } as never, 'u1');
  render(<Cierre usuario={{ id: 'u1', nombre: 'Carlos' } as never} />);
  const lista = await screen.findByLabelText('Devoluciones de canastillas');
  await userEvent.click(within(lista).getByRole('button', { name: /Doña Marta · 2 canastillas/ }));
  expect(await screen.findByLabelText('Cantidad')).toHaveValue('2');
});

it('las devoluciones de canastillas no llevan signo menos', async () => {
  const m = (await db.clientes.toArray()).find((c) => c.nombre === 'Doña Marta')!;
  await crear('devoluciones', { clienteId: m.id, cantidad: 2 } as never, 'u1');
  render(<Cierre usuario={{ id: 'u1', nombre: 'Carlos' } as never} />);
  const lista = await screen.findByLabelText('Devoluciones de canastillas');
  expect(lista.textContent).not.toMatch(/[−-]\s?2/);
  expect(within(lista).getByText('2 canast.')).toBeInTheDocument();
});
