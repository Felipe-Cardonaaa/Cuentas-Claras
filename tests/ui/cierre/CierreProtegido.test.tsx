import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CierreProtegido from '../../../src/ui/cierre/CierreProtegido';
import { db } from '../../../src/datos/db';
import { crearClaveCierre } from '../../../src/auth/claveCierre';

const usuario = { id: 'u1', nombre: 'Felipe' } as never;

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('la primera vez pide crear la clave y luego muestra el cierre', async () => {
  render(<CierreProtegido usuario={usuario} />);
  await userEvent.type(await screen.findByLabelText('Nueva clave del cierre'), 'plaza2026');
  await userEvent.type(screen.getByLabelText('Repite la clave'), 'plaza2026');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar clave' }));
  expect(await screen.findByText('Cierre del día')).toBeInTheDocument();
});

it('pide la clave y no muestra nada con una clave equivocada', async () => {
  await crearClaveCierre('plaza2026', 'u1');
  render(<CierreProtegido usuario={usuario} />);
  await userEvent.type(await screen.findByLabelText('Clave del cierre'), 'otra');
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  expect(await screen.findByText('Clave incorrecta')).toBeInTheDocument();
  expect(screen.queryByText('Cierre del día')).not.toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText('Clave del cierre'));
  await userEvent.type(screen.getByLabelText('Clave del cierre'), 'plaza2026');
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  expect(await screen.findByText('Cierre del día')).toBeInTheDocument();
});
