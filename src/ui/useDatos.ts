import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import type { Datos, Usuario } from '../dominio/tipos';
import { db } from '../datos/db';
import { cargarDatos } from '../datos/repositorio';

/** Datos locales que se actualizan solos cuando algo cambia (en este celular o por sincronización). */
export function useDatos(): Datos | null {
  const [datos, setDatos] = useState<Datos | null>(null);
  useEffect(() => {
    const sub = liveQuery(() => cargarDatos()).subscribe({ next: setDatos, error: () => {} });
    return () => sub.unsubscribe();
  }, []);
  return datos;
}

/** Nombres de los usuarios por id, para mostrar "anotó Carlos". */
export function useNombresUsuarios(): Record<string, string> {
  const [nombres, setNombres] = useState<Record<string, string>>({});
  useEffect(() => {
    const sub = liveQuery(() => db.usuarios.toArray()).subscribe({
      next: (us: Usuario[]) => setNombres(Object.fromEntries(us.map((u) => [u.id, u.nombre]))),
      error: () => {},
    });
    return () => sub.unsubscribe();
  }, []);
  return nombres;
}
