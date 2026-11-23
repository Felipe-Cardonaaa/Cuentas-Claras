import { db } from '../../src/datos/db';
import { crear, editar, borrar, cargarDatos, historialDe } from '../../src/datos/repositorio';
import { estadoCuenta } from '../../src/dominio/fiados';
import { estadoLotes } from '../../src/dominio/lotes';
import type { Cliente, Lote, Venta } from '../../src/dominio/tipos';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('crear deja historial y una fila en la cola de salida', async () => {
  const c = await crear<Cliente>('clientes', { nombre: 'Doña Marta', nombreNormalizado: '' }, 'u1');
  expect(c.nombreNormalizado).toBe('marta');
  expect(c.creadoPor).toBe('u1');
  expect(await historialDe(c.id)).toMatchObject([{ accion: 'crear', usuarioId: 'u1' }]);
  const salida = await db.salida.toArray();
  expect(salida.map((s) => s.tabla)).toEqual(['clientes', 'historial']);
});

it('editar guarda el antes y el después', async () => {
  const c = await crear<Cliente>('clientes', { nombre: 'Marta', nombreNormalizado: '' }, 'u1');
  await editar<Cliente>('clientes', c.id, { nombre: 'Marta Ruiz' }, 'u2');
  const h = await historialDe(c.id);
  expect(h[1]).toMatchObject({ accion: 'editar', usuarioId: 'u2', antes: { nombre: 'Marta' }, despues: { nombre: 'Marta Ruiz' } });
});

it('no permite clientes con el mismo nombre', async () => {
  await crear<Cliente>('clientes', { nombre: 'Pedro', nombreNormalizado: '' }, 'u1');
  await expect(crear<Cliente>('clientes', { nombre: 'Don Pedro', nombreNormalizado: '' }, 'u1'))
    .rejects.toThrow('Ya existe un cliente llamado "Don Pedro". Usa otro nombre, por ejemplo "Don Pedro Pérez"');
});

it('borrar es lógico y deja de contar en la deuda', async () => {
  const v = await crear<Venta>('ventas', {
    grupoId: 'g', clienteId: 'm', productoId: 'p', loteId: null, unidad: 'canastilla', cantidad: 1, precioUnitario: 45000, estado: 'debe', prestada: false,
  }, 'u1');
  await borrar('ventas', v.id, 'u1');
  const d = await cargarDatos();
  expect(d.ventas[0].borrado).toBe(true);
  expect(estadoCuenta('m', d).saldo).toBe(0);
  expect((await historialDe(v.id)).map((h) => h.accion)).toEqual(['crear', 'borrar']);
});

it('foco 4: corregir la cantidad recalcula deuda y lote', async () => {
  const l = await crear<Lote>('lotes', { productoId: 'p', canastillas: 50, costoTotal: null, costoDetalle: null }, 'u1');
  const v = await crear<Venta>('ventas', {
    grupoId: 'g', clienteId: 'm', productoId: 'p', loteId: l.id, unidad: 'canastilla', cantidad: 2, precioUnitario: 45000, estado: 'debe', prestada: false,
  }, 'u1');
  expect(estadoLotes('p', await cargarDatos())[0].quedan).toBe(48);
  await editar<Venta>('ventas', v.id, { cantidad: 3 }, 'u2');
  const d = await cargarDatos();
  expect(estadoCuenta('m', d).saldo).toBe(135000);
  expect(estadoLotes('p', d)[0].quedan).toBe(47);
});
