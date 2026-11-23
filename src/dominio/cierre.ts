import type { Datos, Venta } from './tipos';
import { fechaBogota } from './texto';
import { estadoLotes } from './lotes';

export interface Cierre {
  fecha: string;
  fiados: { clienteId: string; descripcion: string; total: number }[];
  totalFiado: number;
  abonos: number;
  /** quedan = null cuando el producto no tiene ninguna entrada de mercancía anotada. */
  productos: { productoId: string; nombre: string; entraron: number; vendidas: number; vaciadas: number; quedan: number | null }[];
  prestadasHoy: number;
  contado: number;
}

export function describirVenta(v: Pick<Venta, 'cantidad' | 'unidad'>, nombreProducto: string): string {
  return v.unidad === 'kilo' ? `${v.cantidad} kg ${nombreProducto}` : `${v.cantidad} canast. ${nombreProducto}`;
}

export function resumenDia(fecha: string, datos: Datos): Cierre {
  const delDia = <T extends { creadoEn: string; borrado: boolean }>(xs: T[]) => xs.filter((x) => !x.borrado && fechaBogota(x.creadoEn) === fecha);
  const nombre = (id: string) => datos.productos.find((p) => p.id === id)?.nombre ?? '';
  const ventas = delDia(datos.ventas);

  // Una venta repartida en varios lotes se muestra como una sola línea.
  const grupos = new Map<string, Venta>();
  for (const v of ventas.filter((x) => x.estado === 'debe' && x.clienteId)) {
    const clave = `${v.grupoId}|${v.productoId}`;
    const g = grupos.get(clave);
    if (g) g.cantidad += v.cantidad;
    else grupos.set(clave, { ...v });
  }
  const fiados = [...grupos.values()].map((v) => ({
    clienteId: v.clienteId!,
    descripcion: describirVenta(v, nombre(v.productoId)),
    total: Math.round(v.cantidad * v.precioUnitario),
  }));

  const vaciadosHoy = delDia(datos.vaciados);
  const productoIds = [...new Set([
    ...datos.lotes.filter((l) => !l.borrado).map((l) => l.productoId),
    ...ventas.filter((v) => v.unidad === 'canastilla').map((v) => v.productoId),
  ])];
  const productos = productoIds.map((productoId) => {
    const estados = estadoLotes(productoId, datos);
    const lotesIds = new Set(estados.map((e) => e.lote.id));
    return {
      productoId,
      nombre: nombre(productoId),
      entraron: estados.filter((e) => fechaBogota(e.lote.creadoEn) === fecha).reduce((s, e) => s + e.lote.canastillas, 0),
      vendidas: ventas.filter((v) => v.productoId === productoId && v.unidad === 'canastilla').reduce((s, v) => s + v.cantidad, 0),
      vaciadas: vaciadosHoy.filter((x) => lotesIds.has(x.loteId)).reduce((s, x) => s + x.cantidad, 0),
      quedan: estados.length === 0 ? null : estados.reduce((s, e) => s + e.quedan, 0),
    };
  });

  return {
    fecha,
    fiados,
    totalFiado: fiados.reduce((s, f) => s + f.total, 0),
    abonos: delDia(datos.abonos).reduce((s, a) => s + a.valor, 0),
    productos,
    prestadasHoy: ventas.filter((v) => v.unidad === 'canastilla' && v.prestada === true).reduce((s, v) => s + v.cantidad, 0),
    contado: ventas.filter((v) => v.unidad === 'canastilla' && v.estado === 'pago').reduce((s, v) => s + Math.round(v.cantidad * v.precioUnitario), 0),
  };
}
