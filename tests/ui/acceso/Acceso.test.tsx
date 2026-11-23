import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Acceso from '../../../src/ui/acceso/Acceso';
import { db } from '../../../src/datos/db';
import { crearUsuario } from '../../../src/auth/sesion';

beforeEach(async () => {
  await db.delete();
  await db.open();
  localStorage.clear();
});

async function teclear(pin: string) {
  for (const d of pin) await userEvent.click(screen.getByRole('button', { name: d }));
}

it('entra con el nombre y el PIN', async () => {
  await crearUsuario('Carlos', '1234');
  const alEntrar = vi.fn();
  render(<Acceso alEntrar={alEntrar} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Carlos' }));
  await teclear('1234');
  await waitFor(() => expect(alEntrar).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Carlos' })));
});

it('muestra PIN incorrecto', async () => {
  await crearUsuario('Carlos', '1234');
  const alEntrar = vi.fn();
  render(<Acceso alEntrar={alEntrar} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Carlos' }));
  await teclear('9999');
  expect(await screen.findByText('PIN incorrecto')).toBeInTheDocument();
  expect(alEntrar).not.toHaveBeenCalled();
});

it('sin usuarios ofrece crear el primero', async () => {
  const alEntrar = vi.fn();
  render(<Acceso alEntrar={alEntrar} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Crear el primer usuario' }));
  await userEvent.type(screen.getByLabelText('Nombre'), 'Luz');
  await userEvent.type(screen.getByLabelText('PIN de 4 números'), '4321');
  await userEvent.type(screen.getByLabelText('Repite el PIN'), '4321');
  await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
  await waitFor(() => expect(alEntrar).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Luz' })));
});
