const TRATAMIENTOS = ['dona', 'don', 'senora', 'senor', 'sra', 'sr'];

export function sinTildes(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizarNombre(s: string): string {
  const palabras = sinTildes(s.toLowerCase()).replace(/\./g, ' ').split(/\s+/).filter(Boolean);
  while (palabras.length > 1 && TRATAMIENTOS.includes(palabras[0])) palabras.shift();
  return palabras.join(' ');
}

const UNIDADES: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
  noventa: 90, medio: 0.5, media: 0.5, cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400,
  quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
};

/** Número en dígitos o en palabras (hasta 999), o "medio"/"media" = 0,5. */
export function aNumero(s: string): number | null {
  const t = sinTildes(s.trim().toLowerCase());
  if (/^\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  if (t === 'medio' || t === 'media') return 0.5;
  const palabras = t.split(/\s+/).filter((p) => p !== 'y');
  if (palabras.length === 0) return null;
  let total = 0;
  for (const p of palabras) {
    const v = /^\d+([.,]\d+)?$/.test(p) ? Number(p.replace(',', '.')) : UNIDADES[p];
    if (v === undefined) return null;
    total += v;
  }
  return total;
}

/** Total en pesos enteros (evita centavos fantasma como 3300,0000000001). */
export const pesos = (n: number) => Math.round(n);

/** Precio en pesos enteros y mayor que cero: "45.000", "45,000", "45000", "$45.000", "45 mil", "cuarenta y cinco mil pesos". */
export function parsearPrecio(s: string): number | null {
  const v = leerPrecio(s);
  return v !== null && Number.isInteger(v) && v > 0 ? v : null;
}

function leerPrecio(s: string): number | null {
  const t = sinTildes(s.toLowerCase())
    .replace(/\$/g, '')
    .replace(/\s+(cada una|cada uno|c\/u|la canastilla|el kilo|por canastilla|por kilo)$/, '')
    .replace(/\s+pesos?$/, '')
    .replace(/(\d)\s*(mil|k)\b/g, '$1 $2')
    .replace(/\bk$/, 'mil')
    .trim()
    // Centavos en cero que agrega el dictado: "60.000,00" o "60,000.00".
    .replace(/^(\d{1,3}(?:[.,]\d{3})+|\d{4,})[.,]00$/, '$1');
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ''));
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(.*?)\s*\bmil\b\s*(.*)$/);
  if (m) {
    const miles = m[1] === '' ? 1 : aNumero(m[1]);
    const resto = m[2] === '' ? 0 : aNumero(m[2]);
    if (miles === null || resto === null) return null;
    return Math.round(miles * 1000 + resto);
  }
  return aNumero(t);
}

export function formatoCOP(n: number): string {
  const signo = n < 0 ? '-' : '';
  const entero = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}$${entero}`;
}

const ZONA = 'America/Bogota';

function partes(iso: string): Record<string, string> {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return Object.fromEntries(f.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
}

/** Fecha YYYY-MM-DD en hora de Colombia. */
export function fechaBogota(iso: string): string {
  const p = partes(iso);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Hora tipo "9:42 a. m." en hora de Colombia. */
export function horaBogota(iso: string): string {
  const p = partes(iso);
  const h24 = Number(p.hour) % 24;
  const sufijo = h24 < 12 ? 'a. m.' : 'p. m.';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${p.minute} ${sufijo}`;
}

export function nombrePropio(s: string): string {
  return s.trim().split(/\s+/).map((p) => p.charAt(0).toLocaleUpperCase('es-CO') + p.slice(1)).join(' ');
}
