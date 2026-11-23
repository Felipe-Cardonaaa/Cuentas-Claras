const aSnake = (k: string) => k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
const aCamel = (k: string) => k.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase());

/** Nombre de la tabla en Postgres. */
export const tablaRemota = (tabla: string) => aSnake(tabla);

export function aFila(registro: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(registro).map(([k, v]) => [aSnake(k), v]));
}

/** Convierte una fila de Postgres al registro local; descarta columnas solo del servidor. */
export function deFila(fila: Record<string, unknown>): object {
  return Object.fromEntries(Object.entries(fila).filter(([k]) => k !== 'recibido_en').map(([k, v]) => [aCamel(k), v]));
}
