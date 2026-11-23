import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Anotar from '../../../src/ui/anotar/Anotar';
import { db } from '../../../src/datos/db';
import { crear, cargarDatos } from '../../../src/datos/repositorio';
import type { Cliente, Lote, Producto, Usuario } from '../../../src/dominio/tipos';

const usuario = { id: 'u1', nombre: 'Carlos' } as Usuario;

beforeEach(async () => {
  await db.delete();
  await db.open();
  await crear<Cliente>('clientes', { nombre: 'Doña Marta', nombreNormalizado: '' }, 'u1');
  const p = await crear<Producto>('productos', { nombre: 'mango criollo', nombreNormalizado: '' }, 'u1');
  await crear<Lote>('lotes', { productoId: p.id, canastillas: 50, costoTotal: null, costoDetalle: null }, 'u1');
});

async function escribirYRevisar(frase: string) {
  render(<Anotar usuario={usuario} />);
  const caja = screen.getByLabelText('¿Qué vendiste?');
  await userEvent.clear(caja);
  await userEvent.type(caja, frase);
  await userEvent.click(screen.getByRole('button', { name: 'Revisar' }));
}

it('confirma, exige elegir canastillas y guarda', async () => {
  await escribirYRevisar('Marta compró 2 canastillas de mango criollo a 45.000 debe');
  expect(await screen.findByText('Doña Marta')).toBeInTheDocument();
  expect(screen.getAllByText('$90.000').length).toBeGreaterThan(0);
  expect(screen.getByText('DEBE')).toBeInTheDocument();
  const guardar = screen.getByRole('button', { name: 'Guardar' });
  expect(guardar).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Sí, prestadas' }));
  expect(guardar).toBeEnabled();
  await userEvent.click(guardar);
  expect(await screen.findByText('Guardado')).toBeInTheDocument();
  const { ventas } = await cargarDatos();
  expect(ventas).toHaveLength(1);
  expect(ventas[0]).toMatchObject({ cantidad: 2, estado: 'debe', prestada: true, creadoPor: 'u1' });
});

it('cliente de paso no puede fiar', async () => {
  await escribirYRevisar('vendí 2 canastillas de mango criollo a 45.000 debe');
  expect(await screen.findByText('Para fiar necesito el nombre del cliente')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
});

it('pregunta por el nombre parecido', async () => {
  await escribirYRevisar('Martha compró 1 canastilla de mango criollo a 45.000 pagó empacado');
  expect(await screen.findByText(/¿Quisiste decir/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Sí, es Doña Marta' }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(async () => expect((await cargarDatos()).clientes).toHaveLength(1));
});

it('propone la palabra correcta si hay un error de escritura', async () => {
  await escribirYRevisar('Marta compró 3 kilos de mandarna a 4.000 debe');
  expect(await screen.findByText(/¿Quisiste decir/)).toHaveTextContent('mandarina');
  await userEvent.click(screen.getByRole('button', { name: 'Sí, mandarina' }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(async () => expect((await cargarDatos()).productos.map((p) => p.nombre)).toContain('mandarina'));
});
