import type { Datos, Estado } from './tipos';
import type { Intencion, ItemFrase } from './parser';
import { buscarCoincidencia, type Coincidencia } from './coincidencias';
import { elegirLotes, estadoLotes } from './lotes';
import { estadoCuenta, validarAbono } from './fiados';
import { prestadasCliente, validarDevolucion } from './canastillas';

export interface LineaBorrador {
  item: ItemFrase;
  producto: Coincidencia;
  partes: { loteId: string | null; cantidad: number }[];
  total: number;
}

export interface Borrador {
  intencion: Intencion;
  cliente: Coincidencia | null;
  productos: Coincidencia[];
  lineas: LineaBorrador[];
  total: number;
  pide: { estado: boolean; prestada: number[]; canastillasDeEntrada: boolean };
  avisos: string[];
  valorCalculado?: number;
}

/** Lo que la persona elige en la pantalla de confirmación. Claves de `resolver`: 'cliente' y 'producto:<índice>'. */
export interface Elecciones {
  estado?: Estado;
  prestada: Record<number, boolean>;
  canastillasDeEntrada?: number;
  resolver: Record<string, 'usarParecido' | 'crearNuevo'>;
}

export type ResultadoBorrador = { ok: true; borrador: Borrador } | { ok: false; error: string };

export const ERROR_FIAR = 'Para fiar necesito el nombre del cliente';
export const ERROR_PRESTAR = 'Para prestar canastillas necesito el nombre del cliente';
export const ERROR_KILO_PAGO = 'Las ventas por kilo pagadas no hace falta anotarlas';

const fallo = (error: string): ResultadoBorrador => ({ ok: false, error });

function vivos<T extends { borrado: boolean }>(xs: T[]): T[] {
  return xs.filter((x) => !x.borrado);
}

function idDe(c: Coincidencia): string | null {
  return c.tipo === 'nueva' ? null : c.id;
}

function nombreDe(c: Coincidencia): string {
  return c.tipo === 'nueva' ? c.escrito : c.nombre;
}

function vacio(intencion: Intencion): Borrador {
  return {
    intencion, cliente: null, productos: [], lineas: [], total: 0,
    pide: { estado: false, prestada: [], canastillasDeEntrada: false }, avisos: [],
  };
}

export function prepararBorrador(intencion: Intencion, datos: Datos): ResultadoBorrador {
  const clientes = vivos(datos.clientes);
  const productos = vivos(datos.productos);
  const b = vacio(intencion);

  switch (intencion.tipo) {
    case 'venta': {
      b.cliente = intencion.cliente === null ? null : buscarCoincidencia(intencion.cliente, clientes);
      b.lineas = intencion.items.map((item) => {
        const producto = buscarCoincidencia(item.producto, productos);
        const id = idDe(producto);
        let partes: LineaBorrador['partes'] = [{ loteId: null, cantidad: item.cantidad }];
        if (item.unidad === 'canastilla' && id) {
          const r = elegirLotes(id, item.cantidad, datos);
          partes = r.partes;
          if (r.excede) b.avisos.push(`Solo quedan ${disponibles(id, datos)} canastillas de ${nombreDe(producto)}`);
        }
        return { item, producto, partes, total: Math.round(item.cantidad * item.precioUnitario) };
      });
      b.total = b.lineas.reduce((s, l) => s + l.total, 0);
      b.pide.estado = intencion.estado === null;
      b.pide.prestada = b.lineas.flatMap((l, i) => (l.item.unidad === 'canastilla' && l.item.prestada === null ? [i] : []));
      const error = revisarElecciones(b, { prestada: {}, resolver: {} });
      return error ? fallo(error) : { ok: true, borrador: b };
    }

    case 'abono':
    case 'pagoTotal':
    case 'devolucion': {
      const c = buscarCoincidencia(intencion.cliente, clientes);
      if (c.tipo === 'nueva') return fallo(`No conozco a "${c.escrito}"`);
      b.cliente = c;
      if (intencion.tipo === 'devolucion') {
        const error = validarDevolucion(intencion.cantidad, prestadasCliente(c.id, datos).total);
        return error ? fallo(error) : { ok: true, borrador: b };
      }
      const saldo = estadoCuenta(c.id, datos).saldo;
      if (intencion.tipo === 'pagoTotal') {
        if (saldo <= 0) return fallo(`${c.nombre} no debe nada`);
        b.valorCalculado = saldo;
        b.total = saldo;
        return { ok: true, borrador: b };
      }
      const error = validarAbono(intencion.valor, saldo);
      b.total = intencion.valor;
      return error ? fallo(error) : { ok: true, borrador: b };
    }

    case 'saldoInicial': {
      const c = buscarCoincidencia(intencion.cliente, clientes);
      const id = idDe(c);
      if (id && vivos(datos.saldosIniciales).some((s) => s.clienteId === id)) return fallo('Este cliente ya tiene saldo de la libreta');
      b.cliente = c;
      b.total = intencion.valor;
      return { ok: true, borrador: b };
    }

    case 'entrada': {
      b.productos = [buscarCoincidencia(intencion.producto, productos)];
      b.pide.canastillasDeEntrada = intencion.unidad === 'kilo';
      return { ok: true, borrador: b };
    }

    case 'vaciado': {
      const p = buscarCoincidencia(intencion.producto, productos);
      if (p.tipo === 'nueva') return fallo(`No conozco el producto "${p.escrito}"`);
      b.productos = [p];
      const r = elegirLotes(p.id, intencion.cantidad, datos);
      if (r.excede) b.avisos.push(`Solo quedan ${disponibles(p.id, datos)} canastillas de ${p.nombre}`);
      return { ok: true, borrador: b };
    }
  }
}

/** Canastillas disponibles sumando los lotes del producto. */
function disponibles(productoId: string, datos: Datos): number {
  return estadoLotes(productoId, datos).reduce((s, e) => s + Math.max(0, e.quedan), 0);
}

/** Errores que dependen de lo elegido en la confirmación (o ya dicho en la frase). Null si todo está bien. */
export function revisarElecciones(b: Borrador, e: Elecciones): string | null {
  const i = b.intencion;
  if (i.tipo === 'venta') {
    const estado = i.estado ?? e.estado;
    const sinCliente = b.cliente === null;
    if (estado === 'debe' && sinCliente) return ERROR_FIAR;
    const algunaPrestada = b.lineas.some((l, n) => l.item.unidad === 'canastilla' && (l.item.prestada ?? e.prestada[n]) === true);
    if (algunaPrestada && sinCliente) return ERROR_PRESTAR;
    if (estado === 'pago' && b.lineas.some((l) => l.item.unidad === 'kilo')) return ERROR_KILO_PAGO;
  }
  if ((i.tipo === 'abono' || i.tipo === 'pagoTotal' || i.tipo === 'devolucion') && b.cliente?.tipo === 'parecida'
    && e.resolver.cliente === 'crearNuevo') {
    return `No conozco a "${b.cliente.escrito}"`;
  }
  if (b.pide.canastillasDeEntrada && e.canastillasDeEntrada !== undefined && !(e.canastillasDeEntrada > 0)) {
    return 'Escribe en cuántas canastillas llegó';
  }
  return null;
}

/** Todo lo que hay que elegir está elegido y no hay errores. */
export function listoParaGuardar(b: Borrador, e: Elecciones): boolean {
  if (b.pide.estado && !e.estado) return false;
  if (b.pide.prestada.some((n) => e.prestada[n] === undefined)) return false;
  if (b.pide.canastillasDeEntrada && !(e.canastillasDeEntrada && e.canastillasDeEntrada > 0)) return false;
  if (b.cliente?.tipo === 'parecida' && !e.resolver.cliente) return false;
  const coincidenciasProducto = b.intencion.tipo === 'venta' ? b.lineas.map((l) => l.producto) : b.productos;
  if (coincidenciasProducto.some((c, n) => c.tipo === 'parecida' && !e.resolver[`producto:${n}`])) return false;
  return revisarElecciones(b, e) === null;
}
