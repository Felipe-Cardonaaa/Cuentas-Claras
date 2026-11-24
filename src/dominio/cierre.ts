import type { Datos, Venta } from './tipos';
import { fechaBogota } from './texto';
import { estadoLotes } from './lotes';
import { estadoCuenta, type EstadoCuenta } from './fiados';

export interface Cierre {
  fecha: string;
  /** pendiente: lo que aún falta pagar de ese fiado hoy mismo (0 = ya pagado). */
  fiados: { clienteId: string; descripcion: string; total: number; pendiente: number }[];
  totalFiado: number;
  /** Lo que sigue debiéndose de los fiados del día. */
  totalPendiente: number;
  /** De lo vendido en el día: lo que todavía se debe. */
  quedoFiado: number;
  /** De lo vendido en el día: lo que ya está pagado (de contado o fiados ya cubiertos). */
  quedoPago: number;
  /** Abonos del día por cliente, de mayor a menor. */
  pagaron: { clienteId: string; valor: number }[];
  /** Lo que cada cliente quedó debiendo de los fiados del día, de mayor a menor. */
  deben: { clienteId: string; pendiente: number }[];
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
  const grupos = new Map<string, { venta: Venta; ids: string[] }>();
  for (const v of ventas.filter((x) => x.estado === 'debe' && x.clienteId)) {
    const clave = `${v.grupoId}|${v.productoId}`;
    const g = grupos.get(clave);
    if (g) {
      g.venta.cantidad += v.cantidad;
      g.ids.push(v.id);
    } else grupos.set(clave, { venta: { ...v }, ids: [v.id] });
  }
  const cuentas = new Map<string, EstadoCuenta>();
  const cuentaDe = (id: string) => {
    if (!cuentas.has(id)) cuentas.set(id, estadoCuenta(id, datos));
    return cuentas.get(id)!;
  };
  const fiados = [...grupos.values()].map(({ venta: v, ids }) => {
    const lineas = cuentaDe(v.clienteId!).todas;
    const pendiente = ids.reduce((s, id) => s + (lineas.find((l) => l.id === id)?.pendiente ?? 0), 0);
    return {
      clienteId: v.clienteId!,
      descripcion: describirVenta(v, nombre(v.productoId)),
      total: Math.round(v.cantidad * v.precioUnitario),
      pendiente,
    };
  });

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

  const sumarPor = <T>(xs: T[], clave: (x: T) => string, valor: (x: T) => number) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(clave(x), (m.get(clave(x)) ?? 0) + valor(x));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const pagaron = sumarPor(delDia(datos.abonos), (a) => a.clienteId, (a) => a.valor).map(([clienteId, valor]) => ({ clienteId, valor }));
  const deben = sumarPor(fiados, (f) => f.clienteId, (f) => f.pendiente)
    .filter(([, pendiente]) => pendiente > 0)
    .map(([clienteId, pendiente]) => ({ clienteId, pendiente }));

  const vendido = ventas.reduce((s, v) => s + Math.round(v.cantidad * v.precioUnitario), 0);
  const quedoFiado = fiados.reduce((s, f) => s + f.pendiente, 0);

  return {
    fecha,
    quedoFiado,
    quedoPago: vendido - quedoFiado,
    pagaron,
    deben,
    fiados,
    totalFiado: fiados.reduce((s, f) => s + f.total, 0),
    totalPendiente: fiados.reduce((s, f) => s + f.pendiente, 0),
    abonos: delDia(datos.abonos).reduce((s, a) => s + a.valor, 0),
    productos,
    prestadasHoy: ventas.filter((v) => v.unidad === 'canastilla' && v.prestada === true).reduce((s, v) => s + v.cantidad, 0),
    contado: ventas.filter((v) => v.unidad === 'canastilla' && v.estado === 'pago').reduce((s, v) => s + Math.round(v.cantidad * v.precioUnitario), 0),
  };
}
