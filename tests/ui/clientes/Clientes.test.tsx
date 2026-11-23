import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Clientes from '../../../src/ui/clientes/Clientes';
import { db } from '../../../src/datos/db';
import { crear } from '../../../src/datos/repositorio';
import type { Abono, Cliente, Producto, Usuario, Venta } from '../../../src/dominio/tipos';

const usuario = { id: 'u1', nombre: 'Carlos' } as Usuario;

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.usuarios.put({ ...usuario, pinHash: '', pinSal: '', creadoPor: 'u1', creadoEn: '2026-01-01T00:00:00Z', actualizadoEn: '2026-01-01T00:00:00Z', borrado: false });
  const m = await crear<Cliente>('clientes', { nombre: 'Doña Marta', nombreNormalizado: '' }, 'u1');
  const p = await crear<Producto>('productos', { nombre: 'mango criollo', nombreNormalizado: '' }, 'u1');
  const z = await crear<Producto>('productos', { nombre: 'zapote', nombreNormalizado: '' }, 'u1');
  const base = { grupoId: 'g', clienteId: m.id, loteId: null, unidad: 'canastilla' as const, estado: 'debe' as const };
  await crear<Venta>('ventas', { ...base, productoId: p.id, cantidad: 2, precioUnitario: 45000, prestada: true }, 'u1');
  await crear<Venta>('ventas', { ...base, grupoId: 'h', productoId: z.id, cantidad: 1, precioUnitario: 60000, prestada: false }, 'u1');
  await crear<Abono>('abonos', { clienteId: m.id, valor: 100000 }, 'u1');
});

it('buscar el nombre muestra si debe, cuánto y de dónde sale', async () => {
  render(<Clientes usuario={usuario} anotarCon={() => {}} />);
  await userEvent.type(screen.getByLabelText('Buscar por nombre'), 'marta');
  expect(await screen.findByText('DEBE: SÍ')).toBeInTheDocument();
  const resumen = screen.getByLabelText('Resumen del cliente');
  expect(within(resumen).getByText('$50.000')).toBeInTheDocument();
  expect(within(resumen).getByText('2')).toBeInTheDocument();
  expect(screen.getByText('Pagada')).toBeInTheDocument();
  expect(screen.getByText('Debe $50.000')).toBeInTheDocument();
});

it('corregir la cantidad desde el historial cambia el saldo', async () => {
  render(<Clientes usuario={usuario} anotarCon={() => {}} />);
  await userEvent.type(screen.getByLabelText('Buscar por nombre'), 'marta');
  await userEvent.click(await screen.findByRole('button', { name: /2 canast\. mango criollo/ }));
  const cantidad = await screen.findByLabelText('Cantidad');
  await userEvent.clear(cantidad);
  await userEvent.type(cantidad, '3');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
  const resumen = await screen.findByLabelText('Resumen del cliente');
  expect(await within(resumen).findByText('$95.000')).toBeInTheDocument();
  await userEvent.click(await screen.findByRole('button', { name: /3 canast\. mango criollo/ }));
  expect(await screen.findByText('Carlos cambió cantidad: 2 → 3')).toBeInTheDocument();
});

it('I8: las devoluciones se pueden ver y corregir', async () => {
  const m = (await db.clientes.toArray())[0];
  await crear('devoluciones', { clienteId: m.id, cantidad: 1 } as never, 'u1');
  render(<Clientes usuario={usuario} anotarCon={() => {}} />);
  await userEvent.type(screen.getByLabelText('Buscar por nombre'), 'marta');
  await userEvent.click(await screen.findByRole('button', { name: /Devolvió 1 canastilla/ }));
  expect(await screen.findByLabelText('Cantidad')).toHaveValue('1');
});
