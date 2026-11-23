import { normalizarNombre } from './texto';

export type Coincidencia =
  | { tipo: 'exacta'; id: string; nombre: string }
  | { tipo: 'parecida'; id: string; nombre: string; escrito: string }
  | { tipo: 'nueva'; escrito: string; sugerencia?: string };

interface Entrada { id: string; nombre: string; nombreNormalizado: string }

export function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const arriba = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = arriba;
    }
  }
  return fila[b.length];
}

export function buscarCoincidencia(escrito: string, catalogo: Entrada[]): Coincidencia {
  const n = normalizarNombre(escrito);
  const exacta = catalogo.find((c) => c.nombreNormalizado === n);
  if (exacta) return { tipo: 'exacta', id: exacta.id, nombre: exacta.nombre };

  let mejor: { entrada: Entrada; d: number } | null = null;
  for (const c of catalogo) {
    const otro = c.nombreNormalizado;
    const limite = Math.min(n.length, otro.length) <= 4 ? 1 : 2;
    const d = distancia(n, otro);
    const palabrasN = n.split(' ');
    const palabrasOtro = otro.split(' ');
    const contiene = (a: string[], b: string[]) => a.every((p) => b.includes(p));
    const prefijo = n.length >= 3 && otro.length >= 3
      && (otro.startsWith(n) || n.startsWith(otro) || contiene(palabrasN, palabrasOtro) || contiene(palabrasOtro, palabrasN));
    if (d <= limite || prefijo) {
      const puntaje = prefijo ? Math.min(d, limite) : d;
      if (!mejor || puntaje < mejor.d) mejor = { entrada: c, d: puntaje };
    }
  }
  if (mejor) return { tipo: 'parecida', id: mejor.entrada.id, nombre: mejor.entrada.nombre, escrito };
  return { tipo: 'nueva', escrito };
}

export function nombreDisponible(nombre: string, catalogo: { nombreNormalizado: string }[]): boolean {
  const n = normalizarNombre(nombre);
  return !catalogo.some((c) => c.nombreNormalizado === n);
}

/** Palabras comunes de productos de la plaza, para detectar errores de escritura desde el primer día. */
const DICCIONARIO = [
  'mango', 'criollo', 'tommy', 'farchin', 'keitt', 'kent', 'azucar', 'hilacha', 'mandarina', 'naranja', 'limon', 'tahiti',
  'zapote', 'aguacate', 'hass', 'papaya', 'maradol', 'pina', 'oro', 'guayaba', 'maracuya', 'granadilla', 'gulupa', 'lulo',
  'mora', 'fresa', 'uchuva', 'tomate', 'arbol', 'chonto', 'cebolla', 'cabezona', 'larga', 'papa', 'criolla', 'pastusa',
  'sabanera', 'platano', 'banano', 'guineo', 'pera', 'manzana', 'uva', 'sandia', 'melon', 'coco', 'pitahaya', 'curuba',
  'tamarillo', 'mamey', 'borojo', 'feijoa', 'ciruela', 'durazno', 'yuca', 'arracacha', 'zanahoria', 'pepino', 'pimenton',
  'cilantro', 'ahuyama', 'habichuela', 'arveja', 'frijol', 'mazorca', 'repollo', 'lechuga', 'remolacha', 'aji', 'ajo',
  'jengibre', 'roja', 'rojo', 'verde', 'amarilla', 'amarillo', 'grande', 'pequeno', 'maduro', 'madura', 'biche', 'tierno',
];

const contiene = (a: string[], b: string[]) => a.every((p) => b.includes(p));

function buscarPorPalabras(n: string, catalogo: Entrada[]): Coincidencia | null {
  const exacta = catalogo.find((c) => c.nombreNormalizado === n);
  if (exacta) return { tipo: 'exacta', id: exacta.id, nombre: exacta.nombre };
  const palabras = n.split(' ');
  const candidatos = catalogo.filter((c) => {
    const otras = c.nombreNormalizado.split(' ');
    return contiene(palabras, otras) || contiene(otras, palabras);
  });
  if (candidatos.length === 1) return { tipo: 'exacta', id: candidatos[0].id, nombre: candidatos[0].nombre };
  return null;
}

/** Cambia cada palabra mal escrita por la palabra conocida más cercana. Devuelve el texto igual si no hay nada que corregir. */
export function corregirPalabras(n: string, vocabulario: Set<string>): string {
  return n.split(' ').map((p) => {
    if (p.length < 4 || vocabulario.has(p)) return p;
    let mejor: { palabra: string; d: number } | null = null;
    for (const v of vocabulario) {
      const d = distancia(p, v);
      if (d <= Math.floor(p.length / 2) && d <= 2 && (!mejor || d < mejor.d)) mejor = { palabra: v, d };
    }
    return mejor?.palabra ?? p;
  }).join(' ');
}

/**
 * Para productos:
 * - si lo escrito son palabras completas de un solo producto ("criollo" → "mango criollo", o al revés), se toma sin preguntar;
 * - si tiene un error de escritura ("mayo criollo", "mandarna"), propone la corrección (¿Quisiste decir…?);
 * - si coincide con varios, se pregunta.
 */
export function buscarProducto(escrito: string, catalogo: Entrada[]): Coincidencia {
  const n = normalizarNombre(escrito);
  const directa = buscarPorPalabras(n, catalogo);
  if (directa) return directa;

  const vocabulario = new Set([...DICCIONARIO, ...catalogo.flatMap((c) => c.nombreNormalizado.split(' '))]);
  const corregido = corregirPalabras(n, vocabulario);
  if (corregido !== n) {
    const conocida = buscarPorPalabras(corregido, catalogo) ?? buscarCoincidencia(corregido, catalogo);
    if (conocida.tipo !== 'nueva') return { tipo: 'parecida', id: conocida.id, nombre: conocida.nombre, escrito };
    const parecida = buscarCoincidencia(escrito, catalogo);
    if (parecida.tipo === 'parecida') return parecida;
    return { tipo: 'nueva', escrito, sugerencia: corregido };
  }
  return buscarCoincidencia(escrito, catalogo);
}
