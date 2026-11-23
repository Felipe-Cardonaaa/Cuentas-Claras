import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Historial from '../../../src/ui/comun/Historial';
import { db } from '../../../src/datos/db';
import { crear } from '../../../src/datos/repositorio';
import type { Usuario, Venta } from '../../../src/dominio/tipos';

const usuario = { id: 'u1', nombre: 'Carlos' } as Usuario;

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const nueva = (extra: Partial<Venta>) => crear<Venta>('ventas', {
  grupoId: 'g', clienteId: 'm', productoId: 'p', loteId: null, unidad: 'canastilla', cantidad: 2, precioUnitario: 45000, estado: 'debe', prestada: false, ...extra,
}, 'u1');

it('C3: cambiar solo el precio no toca una cantidad con decimales', async () => {
  const v = await nueva({ unidad: 'kilo', cantidad: 2.5, precioUnitario: 4000, prestada: null });
  render(<Historial tabla="ventas" registro={v as never} titulo="x" usuario={usuario} nombres={{}} alCerrar={() => {}} />);
  expect(screen.getByLabelText('Cantidad')).toHaveValue('2,5');
  const precio = screen.getByLabelText('Precio');
  await userEvent.clear(precio);
  await userEvent.type(precio, '5.000');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
  await waitFor(async () => expect(await db.ventas.get(v.id)).toMatchObject({ cantidad: 2.5, precioUnitario: 5000 }));
});

it('rechaza media canastilla al corregir', async () => {
  const v = await nueva({});
  render(<Historial tabla="ventas" registro={v as never} titulo="x" usuario={usuario} nombres={{}} alCerrar={() => {}} />);
  const cantidad = screen.getByLabelText('Cantidad');
  await userEvent.clear(cantidad);
  await userEvent.type(cantidad, '1,5');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
  expect(await screen.findByText('Cantidad: las canastillas se cuentan enteras')).toBeInTheDocument();
});

it('I8: corregir si pagó o debe y si se llevó la canastilla', async () => {
  const v = await nueva({});
  render(<Historial tabla="ventas" registro={v as never} titulo="x" usuario={usuario} nombres={{}} alCerrar={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: 'Pagó' }));
  await userEvent.click(screen.getByRole('button', { name: 'Sí, prestadas' }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
  await waitFor(async () => expect(await db.ventas.get(v.id)).toMatchObject({ estado: 'pago', prestada: true }));
});

it('I8: un cliente de paso no puede quedar debiendo', async () => {
  const v = await nueva({ clienteId: null, estado: 'pago' });
  render(<Historial tabla="ventas" registro={v as never} titulo="x" usuario={usuario} nombres={{}} alCerrar={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: 'Debe' }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
  expect(await screen.findByText('Para fiar necesito el nombre del cliente')).toBeInTheDocument();
});
