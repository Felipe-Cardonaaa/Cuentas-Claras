import { db } from '../../src/datos/db';
import { crear, cargarDatos } from '../../src/datos/repositorio';
import { guardarBorrador } from '../../src/datos/guardar';
import { prepararBorrador, type Elecciones } from '../../src/dominio/borrador';
import { parsearFrase } from '../../src/dominio/parser';
import type { Cliente, Lote, Producto } from '../../src/dominio/tipos';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function borradorDe(frase: string) {
  const p = parsearFrase(frase);
  if (!p.ok) throw new Error(p.error);
  const r = prepararBorrador(p.intencion, await cargarDatos());
  if (!r.ok) throw new Error(r.error);
  return r.borrador;
}

async function sembrar() {
  const m = await crear<Cliente>('clientes', { nombre: 'Doña Marta', nombreNormalizado: '' }, 'u1');
  const p = await crear<Producto>('productos', { nombre: 'mango criollo', nombreNormalizado: '' }, 'u1');
  const l1 = await crear<Lote>('lotes', { productoId: p.id, canastillas: 5, costoTotal: null, costoDetalle: null }, 'u1');
  const l2 = await crear<Lote>('lotes', { productoId: p.id, canastillas: 30, costoTotal: null, costoDetalle: null }, 'u1');
  return { m, p, l1, l2 };
}

const elegir = (e: Partial<Elecciones> = {}): Elecciones => ({ prestada: {}, resolver: {}, ...e });

it('una venta que no cabe en un lote se reparte con el mismo grupo', async () => {
  const { l1, l2 } = await sembrar();
  const b = await borradorDe('Marta compró 8 canastillas de mango criollo a 45.000 debe empacado');
  await guardarBorrador(b, elegir(), 'u1');
  const { ventas } = await cargarDatos();
  expect(ventas.map((v) => [v.loteId, v.cantidad])).toEqual([[l1.id, 5], [l2.id, 3]]);
  expect(new Set(ventas.map((v) => v.grupoId)).size).toBe(1);
  expect(ventas[0]).toMatchObject({ estado: 'debe', prestada: false, precioUnitario: 45000 });
});

it('foco 2: dos toques seguidos en Guardar no duplican', async () => {
  await sembrar();
  const b = await borradorDe('Marta compró 1 canastilla de mango criollo a 45.000 pagó empacado');
  await Promise.all([guardarBorrador(b, elegir(), 'u1'), guardarBorrador(b, elegir(), 'u1')]);
  await guardarBorrador(b, elegir(), 'u1');
  expect((await cargarDatos()).ventas).toHaveLength(1);
});

it('crea el cliente nuevo cuando la persona lo confirma', async () => {
  await sembrar();
  const b = await borradorDe('Martha compró 1 canastilla de mango criollo a 45.000 debe con canastilla');
  await guardarBorrador(b, elegir({ resolver: { cliente: 'crearNuevo' } }), 'u1');
  const d = await cargarDatos();
  expect(d.clientes.map((c) => c.nombre).sort()).toEqual(['Doña Marta', 'Martha']);
  expect(d.ventas[0].prestada).toBe(true);
});

it('entrada en kilos guarda canastillas y costo', async () => {
  const b = await borradorDe('entraron 200 kilos de mandarina a 4.500');
  await guardarBorrador(b, elegir({ canastillasDeEntrada: 8 }), 'u1');
  const d = await cargarDatos();
  expect(d.productos[0].nombre).toBe('mandarina');
  expect(d.lotes[0]).toMatchObject({ canastillas: 8, costoTotal: 900000, costoDetalle: '200 kg × $4.500' });
});

it('pago total se guarda como abono por el saldo', async () => {
  await sembrar();
  await guardarBorrador(await borradorDe('Marta compró 2 canastillas de mango criollo a 45.000 debe empacado'), elegir(), 'u1');
  await guardarBorrador(await borradorDe('Marta pagó todo'), elegir(), 'u1');
  expect((await cargarDatos()).abonos.map((a) => a.valor)).toEqual([90000]);
});

it('rechaza guardar si falta elegir', async () => {
  await sembrar();
  const b = await borradorDe('Marta compró 1 canastilla de mango criollo a 45.000 debe');
  await expect(guardarBorrador(b, elegir(), 'u1')).rejects.toThrow('Faltan datos por confirmar');
});
