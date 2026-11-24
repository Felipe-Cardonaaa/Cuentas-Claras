import type { Ajuste } from '../dominio/tipos';
import { db } from '../datos/db';
import { crear, editar } from '../datos/repositorio';
import { hashPin, verificarPin } from './pin';

// Id fijo (en formato uuid, como las demás tablas) para que todos los celulares usen el mismo registro.
const ID = '00000000-0000-4000-8000-000000000001';
interface ValorClave { hash: string; sal: string }

async function actual(): Promise<Ajuste | undefined> {
  const a = await db.ajustes.get(ID);
  return a && !a.borrado ? a : undefined;
}

export async function hayClaveCierre(): Promise<boolean> {
  return (await actual()) !== undefined;
}

function revisar(clave: string) {
  if (clave.trim().length < 4) throw new Error('La clave debe tener al menos 4 caracteres');
}

export async function crearClaveCierre(clave: string, usuarioId: string): Promise<void> {
  revisar(clave);
  const valor: ValorClave = await hashPin(clave);
  const existente = await db.ajustes.get(ID);
  if (existente) await editar<Ajuste>('ajustes', ID, { valor, borrado: false }, usuarioId);
  else await crear<Ajuste>('ajustes', { id: ID, valor }, usuarioId);
}

export async function verificarClaveCierre(clave: string): Promise<boolean> {
  const a = await actual();
  if (!a) return false;
  const { hash, sal } = a.valor as ValorClave;
  return verificarPin(clave, hash, sal);
}

/** Devuelve un mensaje de error, o null si se cambió. */
export async function cambiarClaveCierre(actualClave: string, nueva: string, usuarioId: string): Promise<string | null> {
  if (!(await verificarClaveCierre(actualClave))) return 'La clave actual no es correcta';
  try {
    revisar(nueva);
  } catch (e) {
    return (e as Error).message;
  }
  await editar<Ajuste>('ajustes', ID, { valor: await hashPin(nueva) }, usuarioId);
  return null;
}
