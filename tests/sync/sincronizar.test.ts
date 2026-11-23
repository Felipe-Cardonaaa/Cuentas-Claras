import { db } from '../../src/datos/db';
import { crear, cargarDatos } from '../../src/datos/repositorio';
import { aFila, deFila } from '../../src/sync/mapeo';
import { sincronizar, type ClienteSync } from '../../src/sync/sincronizar';
import type { Cliente, Venta } from '../../src/dominio/tipos';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

type Fila = Record<string, unknown>;
interface Opciones {
  fallarSubida?: boolean;
  errorSubida?: (tabla: string, fila: Fila) => { code: string; message: string } | null;
  alLeer?: (tabla: string) => void;
}

/** Servidor falso en memoria con la forma mínima del cliente de Supabase. */
function servidorFalso(opciones: Opciones = {}) {
  const tablas: Record<string, Map<string, Fila>> = {};
  let reloj = 0;
  const marca = () => {
    reloj += 1;
    return new Date(Date.UTC(2026, 0, 1, 0, 0, reloj)).toISOString();
  };
  const tabla = (t: string) => (tablas[t] ??= new Map());
  const insertar = (t: string, fila: Fila) => tabla(t).set(fila.id as string, { ...fila, recibido_en: marca() });
  const cliente: ClienteSync = {
    from(t: string) {
      return {
        async upsert(fila: Fila) {
          if (opciones.fallarSubida) throw new TypeError('Failed to fetch');
          const error = opciones.errorSubida?.(t, fila) ?? null;
          if (error) return { error };
          insertar(t, fila);
          return { error: null };
        },
        select() {
          return {
            gt(_c: string, desde: string) {
              return {
                order() {
                  return {
                    async range(a: number, b: number) {
                      opciones.alLeer?.(t);
                      const filas = [...tabla(t).values()]
                        .filter((f) => (f.recibido_en as string) > desde)
                        .sort((x, y) => (x.recibido_en as string).localeCompare(y.recibido_en as string));
                      return { data: filas.slice(a, b + 1), error: null };
                    },
                  };
                },
              };
            },
            async eq(col: string, valor: unknown) {
              return { data: [...tabla(t).values()].filter((f) => f[col] === valor), error: null };
            },
          };
        },
      };
    },
  };
  return { cliente, tablas, insertar };
}

const venta = (extra: Partial<Venta> = {}) => ({
  grupoId: 'g', clienteId: null, productoId: 'p', loteId: null, unidad: 'canastilla' as const, cantidad: 1, precioUnitario: 45000,
  estado: 'pago' as const, prestada: false, ...extra,
});

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
  await crear<Venta>('ventas', venta(), 'u1');
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
  s.insertar('clientes', aFila({ ...c, id: 'otro', nombre: 'Pedro', nombreNormalizado: 'pedro' }));
  s.insertar('clientes', aFila({ ...c, nombre: 'Marta vieja', actualizadoEn: '2000-01-01T00:00:00Z' }));
  const r = await sincronizar(s.cliente);
  expect(r.bajados).toBeGreaterThanOrEqual(1);
  expect((await db.clientes.get('otro'))?.nombre).toBe('Pedro');
  expect((await db.clientes.get(c.id))?.nombre).toBe('Marta');
});

it('C1: una venta que llega mientras se leen otras tablas no se pierde', async () => {
  let yaPaso = false;
  const s = servidorFalso({
    alLeer: (t) => {
      // Otro celular sube una venta y su historial justo después de que este leyó "ventas".
      if (t === 'historial' && !yaPaso) {
        yaPaso = true;
        s.insertar('ventas', aFila({ id: 'v-otro', ...venta(), creadoPor: 'u2', creadoEn: '2026-11-17T14:00:00Z', actualizadoEn: '2026-11-17T14:00:00Z', borrado: false }));
        s.insertar('historial', { id: 'h-otro', tabla: 'ventas', registro_id: 'v-otro' });
      }
    },
  });
  await sincronizar(s.cliente);
  await sincronizar(s.cliente);
  expect(await db.ventas.get('v-otro')).toBeDefined();
});

it('C1: baja por páginas todo lo que hay, aunque sean miles de filas', async () => {
  const s = servidorFalso();
  for (let i = 0; i < 2500; i++) s.insertar('historial', { id: `h${i}`, tabla: 'ventas', registro_id: 'x' });
  await sincronizar(s.cliente);
  expect(await db.historial.count()).toBe(2500);
});

it('C2: una fila que el servidor rechaza por datos no traba la cola', async () => {
  const s = servidorFalso({ errorSubida: (t, f) => (t === 'ventas' && f.cantidad === 0.5 ? { code: '22P02', message: 'invalid input syntax for type integer' } : null) });
  await crear<Venta>('ventas', venta({ cantidad: 0.5 }), 'u1');
  await crear<Venta>('ventas', venta({ cantidad: 2 }), 'u1');
  await sincronizar(s.cliente);
  expect(await db.salida.count()).toBe(0);
  expect(s.tablas.ventas.size).toBe(1);
  const rechazados = (await db.meta.get('rechazados'))?.valor as unknown[];
  expect(rechazados).toHaveLength(1);
});

it('C2: un error de permisos no bota la fila (se reintenta)', async () => {
  const s = servidorFalso({ errorSubida: () => ({ code: 'PGRST301', message: 'JWT expired' }) });
  await crear<Venta>('ventas', venta(), 'u1');
  await sincronizar(s.cliente);
  expect(await db.salida.count()).toBe(2);
});

it('I3: el mismo cliente creado sin señal en dos celulares se une en uno solo', async () => {
  const s = servidorFalso({
    errorSubida: (t, f) => (t === 'clientes' && f.id !== 'srv-marta' && f.nombre_normalizado === 'marta'
      ? { code: '23505', message: 'duplicate key value violates unique constraint' } : null),
  });
  s.insertar('clientes', aFila({ id: 'srv-marta', nombre: 'Marta', nombreNormalizado: 'marta', creadoPor: 'u2', creadoEn: '2026-11-17T13:00:00Z', actualizadoEn: '2026-11-17T13:00:00Z', borrado: false }));
  const local = await crear<Cliente>('clientes', { nombre: 'Marta', nombreNormalizado: '' }, 'u1');
  await crear<Venta>('ventas', venta({ clienteId: local.id, estado: 'debe' }), 'u1');
  await sincronizar(s.cliente);
  const d = await cargarDatos();
  expect(d.clientes.filter((c) => !c.borrado).map((c) => c.id)).toEqual(['srv-marta']);
  expect(d.ventas[0].clienteId).toBe('srv-marta');
  expect([...s.tablas.ventas.values()][0].cliente_id).toBe('srv-marta');
  expect(await db.salida.count()).toBe(0);
});
