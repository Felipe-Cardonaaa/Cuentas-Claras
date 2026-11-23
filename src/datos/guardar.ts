import type { Abono, Cliente, Datos, Devolucion, Lote, Producto, SaldoInicial, Vaciado, Venta } from '../dominio/tipos';
import { listoParaGuardar, revisarElecciones, type Borrador, type Elecciones } from '../dominio/borrador';
import type { Coincidencia } from '../dominio/coincidencias';
import { elegirLotes } from '../dominio/lotes';
import { formatoCOP, normalizarNombre } from '../dominio/texto';
import { db, TABLAS } from './db';
import { cargarDatos, crear, editar } from './repositorio';

const enCurso = new WeakMap<Borrador, Promise<void>>();

/** Guarda un borrador confirmado. Llamarlo otra vez con el mismo borrador no vuelve a guardar. */
export function guardarBorrador(b: Borrador, e: Elecciones, usuarioId: string): Promise<void> {
  const previo = enCurso.get(b);
  if (previo) return previo;
  const p = guardar(b, e, usuarioId);
  enCurso.set(b, p);
  p.catch(() => enCurso.delete(b));
  return p;
}

/** Nombres nuevos ya creados en este mismo guardado, para no crear dos veces "piña". */
type Creados = Map<string, string>;

/** Id ya existente que eligió la persona, o null si hay que crear el nombre. */
function existente(c: Coincidencia, clave: string, e: Elecciones): string | null {
  if (c.tipo === 'exacta') return c.id;
  if (c.tipo === 'parecida' && e.resolver[clave] === 'usarParecido') return c.id;
  return null;
}

/**
 * Devuelve el id ya existente sin esperar nada (una espera sin escribir haría que la base cierre la transacción),
 * o una promesa que crea el nombre nuevo una sola vez.
 */
function resolver(c: Coincidencia, clave: string, e: Elecciones, tabla: 'clientes' | 'productos', usuarioId: string, creados: Creados): string | Promise<string> {
  const id = existente(c, clave, e);
  if (id) return id;
  const nombre = (c as { escrito: string }).escrito;
  const llave = `${tabla}|${normalizarNombre(nombre)}`;
  const previo = creados.get(llave);
  if (previo) return previo;
  return crear<Cliente | Producto>(tabla, { nombre, nombreNormalizado: '' }, usuarioId).then((nuevo) => {
    creados.set(llave, nuevo.id);
    return nuevo.id;
  });
}

async function guardar(b: Borrador, e: Elecciones, usuarioId: string): Promise<void> {
  if (!listoParaGuardar(b, e)) throw new Error(revisarElecciones(b, e) ?? 'Faltan datos por confirmar');
  // Todo o nada: si una parte falla, no queda guardada ninguna.
  // Se lee antes de abrir la transacción; dentro solo se escribe (y se anotan aquí las ventas nuevas para repartir lotes).
  const datos = await cargarDatos();
  const tablas = [...TABLAS.map((t) => db.table(t)), db.historial, db.salida];
  await db.transaction('rw', tablas, () => guardarDentro(b, e, usuarioId, datos));
}

async function guardarDentro(b: Borrador, e: Elecciones, usuarioId: string, datos: Datos): Promise<void> {
  const i = b.intencion;
  const creados: Creados = new Map();
  const rc = b.cliente ? resolver(b.cliente, 'cliente', e, 'clientes', usuarioId, creados) : null;
  const clienteId = typeof rc === 'object' && rc !== null ? await rc : rc;

  switch (i.tipo) {
    case 'venta': {
      const grupoId = crypto.randomUUID();
      const estado = i.estado ?? e.estado!;
      for (const [n, linea] of b.lineas.entries()) {
        const rp = resolver(linea.producto, `producto:${n}`, e, 'productos', usuarioId, creados);
        const productoId = typeof rp === 'string' ? rp : await rp;
        const { item } = linea;
        const partes = item.unidad === 'canastilla'
          ? elegirLotes(productoId, item.cantidad, datos).partes
          : [{ loteId: null, cantidad: item.cantidad }];
        const prestada = item.unidad === 'canastilla' ? (item.prestada ?? e.prestada[n]) : null;
        for (const parte of partes) {
          const v = await crear<Venta>('ventas', {
            grupoId, clienteId, productoId, loteId: parte.loteId, unidad: item.unidad, cantidad: parte.cantidad,
            precioUnitario: item.precioUnitario, estado, prestada,
          }, usuarioId);
          datos.ventas.push(v);
        }
      }
      return;
    }
    case 'abono':
      await crear<Abono>('abonos', { clienteId: clienteId!, valor: i.valor }, usuarioId);
      return;
    case 'pagoTotal':
      await crear<Abono>('abonos', { clienteId: clienteId!, valor: b.valorCalculado! }, usuarioId);
      return;
    case 'devolucion':
      await crear<Devolucion>('devoluciones', { clienteId: clienteId!, cantidad: i.cantidad }, usuarioId);
      return;
    case 'saldoInicial':
      await crear<SaldoInicial>('saldosIniciales', { clienteId: clienteId!, valor: i.valor }, usuarioId);
      return;
    case 'entrada': {
      const rp = resolver(b.productos[0], 'producto:0', e, 'productos', usuarioId, creados);
      const productoId = typeof rp === 'string' ? rp : await rp;
      const canastillas = i.unidad === 'canastilla' ? i.cantidad : e.canastillasDeEntrada!;
      const { costoTotal, costoDetalle } = costoDeEntrada(i.cantidad, i.unidad, i.costo);
      const lote = await crear<Lote>('lotes', { productoId, canastillas, costoTotal, costoDetalle }, usuarioId);
      // Canastillas de este producto vendidas antes de anotar la entrada: pasan a este lote.
      for (const v of datos.ventas) {
        if (!v.borrado && v.productoId === productoId && v.unidad === 'canastilla' && v.loteId === null) {
          await editar<Venta>('ventas', v.id, { loteId: lote.id }, usuarioId);
        }
      }
      return;
    }
    case 'vaciado': {
      const rp = resolver(b.productos[0], 'producto:0', e, 'productos', usuarioId, creados);
      const productoId = typeof rp === 'string' ? rp : await rp;
      const { partes } = elegirLotes(productoId, i.cantidad, datos);
      for (const parte of partes) {
        if (!parte.loteId) throw new Error('No hay lotes de ese producto');
        await crear<Vaciado>('vaciados', { loteId: parte.loteId, cantidad: parte.cantidad }, usuarioId);
      }
    }
  }
}

export function costoDeEntrada(
  cantidad: number,
  unidad: 'canastilla' | 'kilo',
  costo: { tipo: 'unitario' | 'total'; valor: number } | null,
): { costoTotal: number | null; costoDetalle: string | null } {
  if (!costo) return { costoTotal: null, costoDetalle: null };
  const medida = unidad === 'kilo' ? `${cantidad} kg` : `${cantidad} canast.`;
  if (costo.tipo === 'unitario') {
    return { costoTotal: Math.round(cantidad * costo.valor), costoDetalle: `${medida} × ${formatoCOP(costo.valor)}` };
  }
  return { costoTotal: costo.valor, costoDetalle: `${medida} por ${formatoCOP(costo.valor)}` };
}
