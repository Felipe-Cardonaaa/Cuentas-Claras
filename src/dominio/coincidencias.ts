import { normalizarNombre } from './texto';

export type Coincidencia =
  | { tipo: 'exacta'; id: string; nombre: string }
  | { tipo: 'parecida'; id: string; nombre: string; escrito: string }
  | { tipo: 'nueva'; escrito: string };

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

/**
 * Para productos: si lo escrito son palabras completas de un solo producto ("criollo" → "mango criollo",
 * o "mango criollo" → "criollo"), se toma ese producto sin preguntar. Si coincide con varios, se pregunta.
 */
export function buscarProducto(escrito: string, catalogo: Entrada[]): Coincidencia {
  const n = normalizarNombre(escrito);
  const exacta = catalogo.find((c) => c.nombreNormalizado === n);
  if (exacta) return { tipo: 'exacta', id: exacta.id, nombre: exacta.nombre };
  const palabras = n.split(' ');
  const contiene = (a: string[], b: string[]) => a.every((p) => b.includes(p));
  const candidatos = catalogo.filter((c) => {
    const otras = c.nombreNormalizado.split(' ');
    return contiene(palabras, otras) || contiene(otras, palabras);
  });
  if (candidatos.length === 1) return { tipo: 'exacta', id: candidatos[0].id, nombre: candidatos[0].nombre };
  return buscarCoincidencia(escrito, catalogo);
}
