import type { Usuario } from '../dominio/tipos';
import { db } from '../datos/db';
import { crear } from '../datos/repositorio';
import { supabase } from '../sync/supabase';
import { hashPin, pinValido, verificarPin } from './pin';

const CLAVE_USUARIO = 'cuentas-claras:usuario';

function leer(): string | null {
  try { return localStorage.getItem(CLAVE_USUARIO); } catch { return null; }
}
function escribir(valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(CLAVE_USUARIO);
    else localStorage.setItem(CLAVE_USUARIO, valor);
  } catch { /* sin almacenamiento: la sesión dura lo que dure la pestaña */ }
}

/** True si este celular ya entró con la cuenta del negocio (o la app no usa nube). */
export async function negocioListo(): Promise<boolean> {
  if (!supabase) return true;
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}

export async function entrarNegocio(correo: string, clave: string): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
  return error ? 'Correo o clave incorrectos' : null;
}

export async function usuariosDisponibles(): Promise<Usuario[]> {
  return (await db.usuarios.toArray()).filter((u) => !u.borrado).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function crearUsuario(nombre: string, pin: string, creadoPor?: string): Promise<Usuario> {
  if (!nombre.trim()) throw new Error('Escribe el nombre');
  if (!pinValido(pin)) throw new Error('El PIN debe tener 4 números');
  const existentes = await usuariosDisponibles();
  if (existentes.some((u) => u.nombre.toLowerCase() === nombre.trim().toLowerCase())) throw new Error('Ya hay un usuario con ese nombre');
  const { hash, sal } = await hashPin(pin);
  const id = crypto.randomUUID();
  return crear<Usuario>('usuarios', { id, nombre: nombre.trim(), pinHash: hash, pinSal: sal }, creadoPor ?? id);
}

export function usuarioActivo(): Usuario | null {
  const v = leer();
  if (!v) return null;
  try { return JSON.parse(v) as Usuario; } catch { return null; }
}

export async function elegirUsuario(u: Usuario, pin: string): Promise<boolean> {
  if (!(await verificarPin(pin, u.pinHash, u.pinSal))) return false;
  escribir(JSON.stringify(u));
  return true;
}

export function salir(): void {
  escribir(null);
}
