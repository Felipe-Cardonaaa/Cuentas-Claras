import { db } from '../../src/datos/db';
import { crear } from '../../src/datos/repositorio';
import { aFila, deFila } from '../../src/sync/mapeo';
import { sincronizar, type ClienteSync } from '../../src/sync/sincronizar';
import type { Cliente, Venta } from '../../src/dominio/tipos';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

/** Servidor falso en memoria con la forma mínima del cliente de Supabase. */
function servidorFalso(opciones: { fallarSubida?: boolean } = {}) {
  const tablas: Record<string, Map<string, Record<string, unknown>>> = {};
  let reloj = 0;
  const llamadas: string[] = [];
  const cliente: ClienteSync = {
    from(tabla: string) {
      tablas[tabla] ??= new Map();
      return {
        async upsert(fila: Record<string, unknown>) {
          llamadas.push(tabla);
          if (opciones.fallarSubida) throw new TypeError('Failed to fetch');
          reloj += 1;
          tablas[tabla].set(fila.id as string, { ...fila, recibido_en: `2026-01-01T00:00:${String(reloj).padStart(2, '0')}Z` });
          return { error: null };
        },
        select() {
          return {
            async gt(_col: string, desde: string) {
              return { data: [...tablas[tabla].values()].filter((f) => (f.recibido_en as string) > desde), error: null };
            },
          };
        },
      };
    },
  };
  return { cliente, tablas, llamadas };
}

it('mapeo ida y vuelta', () => {
  const v = { id: 'x', grupoId: 'g', clienteId: null, precioUnitario: 1, creadoEn: 'a', actualizadoEn: 'a', borrado: false };
  expect(aFila(v)).toMatchObject({ grupo_id: 'g', cliente_id: null, precio_unitario: 1, actualizado_en: 'a' });
  expect(deFila({ ...aFila(v), recibido_en: 'z' })).toEqual(v);
});

it('sube la cola y la deja vacía', async () => {
  const s = servidorFalso();
  await crear<Cliente>('clientes', { nombre: 'Marta', nombreNormalizado: '' }, 'u1');
  const r = await sincronizar(s.cliente);
  expect(r.subidos).toBe(2);
  expect(await db.salida.count()).toBe(0);
  expect(s.tablas.clientes.size).toBe(1);
  expect(s.tablas.historial.size).toBe(1);
});

it('foco 2: reintentar la misma fila no duplica', async () => {
  const s = servidorFalso();
  const c = await crear<Cliente>('clientes', { nombre: 'Marta', nombreNormalizado: '' }, 'u1');
  await db.salida.add({ tabla: 'clientes', registro: c });
  await sincronizar(s.cliente);
  expect(s.tablas.clientes.size).toBe(1);
});

it('foco 5: sin señal la venta queda en cola, sobrevive a reabrir y sube después', async () => {
  const caido = servidorFalso({ fallarSubida: true });
  await crear<Venta>('ventas', {
    grupoId: 'g', clienteId: null, productoId: 'p', loteId: null, unidad: 'canastilla', cantidad: 1, precioUnitario: 45000, estado: 'pago', prestada: false,
  }, 'u1');
  await sincronizar(caido.cliente);
  expect(await db.salida.count()).toBe(2);
  db.close();
  await db.open();
  expect(await db.salida.count()).toBe(2);
  const arriba = servidorFalso();
  await sincronizar(arriba.cliente);
  expect(await db.salida.count()).toBe(0);
  expect(arriba.tablas.ventas.size).toBe(1);
});

it('baja lo nuevo, pero no pisa un cambio local más reciente', async () => {
  const s = servidorFalso();
  const c = await crear<Cliente>('clientes', { nombre: 'Marta', nombreNormalizado: '' }, 'u1');
  await sincronizar(s.cliente);
  // Otro celular sube un cliente nuevo y una versión vieja de Marta.
  await s.cliente.from('clientes').upsert(aFila({ ...c, id: 'otro', nombre: 'Pedro', nombreNormalizado: 'pedro' }));
  await s.cliente.from('clientes').upsert(aFila({ ...c, nombre: 'Marta vieja', actualizadoEn: '2000-01-01T00:00:00Z' }));
  const r = await sincronizar(s.cliente);
  expect(r.bajados).toBeGreaterThanOrEqual(1);
  expect((await db.clientes.get('otro'))?.nombre).toBe('Pedro');
  expect((await db.clientes.get(c.id))?.nombre).toBe('Marta');
});
