import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Lotes from '../../../src/ui/lotes/Lotes';
import { db } from '../../../src/datos/db';
import { crear } from '../../../src/datos/repositorio';
import type { Lote, Producto, Usuario, Venta } from '../../../src/dominio/tipos';

const usuario = { id: 'u1', nombre: 'Carlos' } as Usuario;

beforeEach(async () => {
  await db.delete();
  await db.open();
  const p = await crear<Producto>('productos', { nombre: 'mango criollo', nombreNormalizado: '' }, 'u1');
  const l1 = await crear<Lote>('lotes', { productoId: p.id, canastillas: 50, costoTotal: 1800000, costoDetalle: '50 canast. × $36.000' }, 'u1');
  await crear<Lote>('lotes', { productoId: p.id, canastillas: 30, costoTotal: null, costoDetalle: null }, 'u1');
  await crear<Venta>('ventas', {
    grupoId: 'g', clienteId: null, productoId: p.id, loteId: l1.id, unidad: 'canastilla', cantidad: 45, precioUnitario: 45000, estado: 'pago', prestada: false,
  }, 'u1');
});

it('muestra avance, ganancia y permite agregar costo después', async () => {
  render(<Lotes usuario={usuario} anotarCon={() => {}} />);
  expect(await screen.findByText('45 de 50 vendidas')).toBeInTheDocument();
  expect(screen.getByText('+$225.000')).toBeInTheDocument();
  expect(screen.getByText('35')).toBeInTheDocument();
  const sinCosto = screen.getByLabelText(/Lote .* 30 canastillas/);
  await userEvent.click(within(sinCosto).getByRole('button', { name: 'Agregar costo' }));
  await userEvent.type(within(sinCosto).getByLabelText('Costo'), '1.200.000');
  await userEvent.click(within(sinCosto).getByRole('button', { name: 'Guardar costo' }));
  expect(await within(sinCosto).findByText('-$1.200.000')).toBeInTheDocument();
});

it('muestra a quién se vendió', async () => {
  render(<Lotes usuario={usuario} anotarCon={() => {}} />);
  await userEvent.click((await screen.findAllByRole('button', { name: 'Ver a quién se vendió cada una' }))[0]);
  expect(await screen.findByText('Cliente de paso · 45')).toBeInTheDocument();
});

it('I8: se puede corregir una venta de contado desde el lote', async () => {
  render(<Lotes usuario={usuario} anotarCon={() => {}} />);
  await userEvent.click((await screen.findAllByRole('button', { name: 'Ver a quién se vendió cada una' }))[0]);
  await userEvent.click(await screen.findByRole('button', { name: /Cliente de paso · 45/ }));
  const cantidad = await screen.findByLabelText('Cantidad');
  await userEvent.clear(cantidad);
  await userEvent.type(cantidad, '40');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
  expect(await screen.findByText('40 de 50 vendidas')).toBeInTheDocument();
});

it('I8: se puede corregir el lote', async () => {
  render(<Lotes usuario={usuario} anotarCon={() => {}} />);
  await userEvent.click((await screen.findAllByRole('button', { name: 'Corregir lote' }))[0]);
  const c = await screen.findByLabelText('Canastillas');
  await userEvent.clear(c);
  await userEvent.type(c, '60');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
  expect(await screen.findByText('45 de 60 vendidas')).toBeInTheDocument();
});

describe('formulario Entró mercancía', () => {
  it('registra un lote en canastillas con costo total', async () => {
    render(<Lotes usuario={usuario} anotarCon={() => { throw new Error('no debe ir a Anotar'); }} />);
    await userEvent.click(await screen.findByRole('button', { name: '+ Entró mercancía' }));
    const form = screen.getByRole('form', { name: 'Entró mercancía' });
    await userEvent.type(within(form).getByLabelText('Producto'), 'mango tommy');
    await userEvent.type(within(form).getByLabelText('Cantidad'), '40');
    await userEvent.type(within(form).getByLabelText('Costo (opcional)'), '1.200.000');
    await userEvent.click(within(form).getByRole('button', { name: 'Revisar' }));
    expect(await screen.findByText('¿Guardar la mercancía que entró?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('0 de 40 vendidas')).toBeInTheDocument();
    const d = await db.lotes.toArray();
    expect(d.find((l) => l.canastillas === 40)).toMatchObject({ costoTotal: 1200000 });
  });

  it('en kilos pregunta en cuántas canastillas llegó', async () => {
    render(<Lotes usuario={usuario} anotarCon={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: '+ Entró mercancía' }));
    const form = screen.getByRole('form', { name: 'Entró mercancía' });
    await userEvent.type(within(form).getByLabelText('Producto'), 'mandarina');
    await userEvent.type(within(form).getByLabelText('Cantidad'), '200');
    await userEvent.click(within(form).getByRole('button', { name: 'Kilos' }));
    await userEvent.click(within(form).getByRole('button', { name: 'Revisar' }));
    await userEvent.type(await screen.findByLabelText('¿En cuántas canastillas llegó?'), '8');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('0 de 8 vendidas')).toBeInTheDocument();
  });

  it('avisa si la cantidad no sirve', async () => {
    render(<Lotes usuario={usuario} anotarCon={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: '+ Entró mercancía' }));
    const form = screen.getByRole('form', { name: 'Entró mercancía' });
    await userEvent.type(within(form).getByLabelText('Producto'), 'zapote');
    await userEvent.type(within(form).getByLabelText('Cantidad'), '2,5');
    await userEvent.click(within(form).getByRole('button', { name: 'Revisar' }));
    expect(await screen.findByText('Las canastillas se cuentan enteras')).toBeInTheDocument();
  });
});

describe('botón Vaciar canastillas', () => {
  it('vacía canastillas de un producto desde Lotes', async () => {
    render(<Lotes usuario={usuario} anotarCon={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Vaciar canastillas de mango criollo' }));
    const form = screen.getByRole('form', { name: 'Vaciar canastillas' });
    await userEvent.type(within(form).getByLabelText('¿Cuántas canastillas se vaciaron?'), '2');
    await userEvent.click(within(form).getByRole('button', { name: 'Revisar' }));
    expect(await screen.findByText('¿Guardar las canastillas vaciadas?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Vaciadas: 2')).toBeInTheDocument();
    expect(await db.vaciados.count()).toBe(1);
  });

  it('no deja vaciar media canastilla', async () => {
    render(<Lotes usuario={usuario} anotarCon={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Vaciar canastillas de mango criollo' }));
    const form = screen.getByRole('form', { name: 'Vaciar canastillas' });
    await userEvent.type(within(form).getByLabelText('¿Cuántas canastillas se vaciaron?'), '1,5');
    await userEvent.click(within(form).getByRole('button', { name: 'Revisar' }));
    expect(await screen.findByText('Las canastillas se cuentan enteras')).toBeInTheDocument();
  });
});
