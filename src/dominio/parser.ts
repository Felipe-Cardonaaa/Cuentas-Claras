import type { Estado, Unidad } from './tipos';
import { aNumero, nombrePropio, parsearPrecio } from './texto';

export interface ItemFrase {
  cantidad: number;
  unidad: Unidad;
  producto: string;
  precioUnitario: number;
  prestada: boolean | null;
}

export type Intencion =
  | { tipo: 'venta'; cliente: string | null; items: ItemFrase[]; estado: Estado | null }
  | { tipo: 'abono'; cliente: string; valor: number }
  | { tipo: 'pagoTotal'; cliente: string }
  | { tipo: 'entrada'; producto: string; cantidad: number; unidad: Unidad; costo: { tipo: 'unitario' | 'total'; valor: number } | null }
  | { tipo: 'vaciado'; producto: string; cantidad: number }
  | { tipo: 'devolucion'; cliente: string; cantidad: number }
  | { tipo: 'saldoInicial'; cliente: string; valor: number };

export type ResultadoFrase = { ok: true; intencion: Intencion } | { ok: false; error: string };

export const ERROR_FRASE = 'No entendí la frase. Ejemplo: "Marta compró 2 canastillas de mango criollo a 45.000 debe"';
const ERROR_CANTIDAD = 'No entendí la cantidad';
const ERROR_PRECIO = 'No entendí el precio';

const UNIDAD = '(canastillas?|canastas?|kilos?|kg)';

function aUnidad(s: string | undefined): Unidad | null {
  if (!s) return null;
  return /^(kilos?|kg)$/i.test(s) ? 'kilo' : 'canastilla';
}

const producto = (s: string) => s.trim().toLowerCase();
const fallo = (error: string): ResultadoFrase => ({ ok: false, error });
const bien = (intencion: Intencion): ResultadoFrase => ({ ok: true, intencion });

export function parsearFrase(texto: string): ResultadoFrase {
  const t = texto.trim().replace(/\s+/g, ' ').replace(/[.,;!?]+$/, '');
  let m: RegExpMatchArray | null;

  if ((m = t.match(/^(.+?) pag[oó] todo$/i))) return bien({ tipo: 'pagoTotal', cliente: nombrePropio(m[1]) });

  if ((m = t.match(/^(.+?) abon[oó] (.+)$/i))) {
    const valor = parsearPrecio(m[2]);
    return valor === null ? fallo(ERROR_PRECIO) : bien({ tipo: 'abono', cliente: nombrePropio(m[1]), valor });
  }

  if ((m = t.match(/^(.+?) deb[ií]a (.+)$/i))) {
    const valor = parsearPrecio(m[2]);
    return valor === null ? fallo(ERROR_PRECIO) : bien({ tipo: 'saldoInicial', cliente: nombrePropio(m[1]), valor });
  }

  if ((m = t.match(/^(.+?) devolvi[oó] (.+?) canast(?:illa|a)s?$/i))) {
    const cantidad = aNumero(m[2]);
    return cantidad === null ? fallo(ERROR_CANTIDAD) : bien({ tipo: 'devolucion', cliente: nombrePropio(m[1]), cantidad });
  }

  if ((m = t.match(new RegExp(`^entr(?:aron|[oó]) (.+?) ${UNIDAD} de (.+?)(?: (a|por) (.+))?$`, 'i')))) {
    const cantidad = aNumero(m[1]);
    if (cantidad === null) return fallo(ERROR_CANTIDAD);
    let costo: { tipo: 'unitario' | 'total'; valor: number } | null = null;
    if (m[4]) {
      const valor = parsearPrecio(m[5]);
      if (valor === null) return fallo(ERROR_PRECIO);
      costo = { tipo: m[4].toLowerCase() === 'por' ? 'total' : 'unitario', valor };
    }
    return bien({ tipo: 'entrada', producto: producto(m[3]), cantidad, unidad: aUnidad(m[2])!, costo });
  }

  if ((m = t.match(/^(?:se vaci(?:aron|[oó])|vaci[eé]) (.+?) canast(?:illa|a)s? de (.+)$/i))) {
    const cantidad = aNumero(m[1]);
    return cantidad === null ? fallo(ERROR_CANTIDAD) : bien({ tipo: 'vaciado', producto: producto(m[2]), cantidad });
  }

  return parsearVenta(t);
}

function parsearVenta(frase: string): ResultadoFrase {
  let t = frase;
  let estado: Estado | null = null;
  let prestada: boolean | null = null;
  for (let cambio = true; cambio; ) {
    cambio = false;
    let m = t.match(/ (empacad[oa]|con canastillas?)$/i);
    if (m) {
      prestada = !/^empacad/i.test(m[1]);
      t = t.slice(0, m.index);
      cambio = true;
    }
    m = t.match(/ (debe|fiado|qued[oó] debiendo|pag[oó]|de contado)$/i);
    if (m) {
      estado = /^(pag|de contado)/i.test(m[1]) ? 'pago' : 'debe';
      t = t.slice(0, m.index);
      cambio = true;
    }
  }

  const m = t.match(/^(?:(.+?) )?(compr[oó]|se llev[oó]|vend[ií]) (.+)$/i);
  if (!m) return fallo(ERROR_FRASE);
  const esPaso = /^vend/i.test(m[2]);
  if (!esPaso && !m[1]) return fallo(ERROR_FRASE);
  const cliente = esPaso ? null : nombrePropio(m[1]);

  const items: ItemFrase[] = [];
  let unidadAnterior: Unidad = 'canastilla';
  for (const trozo of dividirItems(m[3])) {
    const it = trozo.match(new RegExp(`^(.+?) (?:${UNIDAD} )?de (.+?) a (.+)$`, 'i'));
    if (!it) return fallo(ERROR_FRASE);
    const cantidad = aNumero(it[1]);
    if (cantidad === null) return fallo(ERROR_CANTIDAD);
    const precio = parsearPrecio(it[4]);
    if (precio === null) return fallo(ERROR_PRECIO);
    const unidad: Unidad = aUnidad(it[2]) ?? unidadAnterior;
    unidadAnterior = unidad;
    items.push({ cantidad, unidad, producto: producto(it[3]), precioUnitario: precio, prestada: unidad === 'canastilla' ? prestada : null });
  }
  return bien({ tipo: 'venta', cliente, items, estado });
}

/** Divide "1 de mango a 45.000 y 1 de zapote a 50.000" sin partir precios como "cuarenta y cinco mil". */
function dividirItems(s: string): string[] {
  const trozos = s.split(/ y /i);
  const items: string[] = [];
  for (const trozo of trozos) {
    const pareceItem = / de .+ a /i.test(` ${trozo}`) || /^\S+ de /i.test(trozo);
    if (items.length === 0 || pareceItem) items.push(trozo);
    else items[items.length - 1] += ` y ${trozo}`;
  }
  return items;
}
