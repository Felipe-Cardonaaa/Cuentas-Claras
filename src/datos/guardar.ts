import type { Abono, Cliente, Devolucion, Lote, Producto, SaldoInicial, Vaciado, Venta } from '../dominio/tipos';
import { listoParaGuardar, revisarElecciones, type Borrador, type Elecciones } from '../dominio/borrador';
import type { Coincidencia } from '../dominio/coincidencias';
import { elegirLotes } from '../dominio/lotes';
import { formatoCOP } from '../dominio/texto';
import { cargarDatos, crear } from './repositorio';

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

async function resolver(c: Coincidencia, clave: string, e: Elecciones, tabla: 'clientes' | 'productos', usuarioId: string): Promise<string> {
  if (c.tipo === 'exacta') return c.id;
  if (c.tipo === 'parecida' && e.resolver[clave] === 'usarParecido') return c.id;
  const nombre = c.escrito;
  const nuevo = await crear<Cliente | Producto>(tabla, { nombre, nombreNormalizado: '' }, usuarioId);
  return nuevo.id;
}

async function guardar(b: Borrador, e: Elecciones, usuarioId: string): Promise<void> {
  if (!listoParaGuardar(b, e)) throw new Error(revisarElecciones(b, e) ?? 'Faltan datos por confirmar');
  const i = b.intencion;
  const clienteId = b.cliente ? await resolver(b.cliente, 'cliente', e, 'clientes', usuarioId) : null;

  switch (i.tipo) {
    case 'venta': {
      const grupoId = crypto.randomUUID();
      const estado = i.estado ?? e.estado!;
      for (const [n, linea] of b.lineas.entries()) {
        const productoId = await resolver(linea.producto, `producto:${n}`, e, 'productos', usuarioId);
        const { item } = linea;
        const partes = item.unidad === 'canastilla'
          ? elegirLotes(productoId, item.cantidad, await cargarDatos()).partes
          : [{ loteId: null, cantidad: item.cantidad }];
        const prestada = item.unidad === 'canastilla' ? (item.prestada ?? e.prestada[n]) : null;
        for (const parte of partes) {
          await crear<Venta>('ventas', {
            grupoId, clienteId, productoId, loteId: parte.loteId, unidad: item.unidad, cantidad: parte.cantidad,
            precioUnitario: item.precioUnitario, estado, prestada,
          }, usuarioId);
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
      const productoId = await resolver(b.productos[0], 'producto:0', e, 'productos', usuarioId);
      const canastillas = i.unidad === 'canastilla' ? i.cantidad : e.canastillasDeEntrada!;
      const { costoTotal, costoDetalle } = costoDeEntrada(i.cantidad, i.unidad, i.costo);
      await crear<Lote>('lotes', { productoId, canastillas, costoTotal, costoDetalle }, usuarioId);
      return;
    }
    case 'vaciado': {
      const productoId = await resolver(b.productos[0], 'producto:0', e, 'productos', usuarioId);
      const { partes } = elegirLotes(productoId, i.cantidad, await cargarDatos());
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
    return { costoTotal: cantidad * costo.valor, costoDetalle: `${medida} × ${formatoCOP(costo.valor)}` };
  }
  return { costoTotal: costo.valor, costoDetalle: `${medida} por ${formatoCOP(costo.valor)}` };
}
