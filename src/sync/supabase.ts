import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Cliente de Supabase, o null si la app no está configurada (funciona solo en este celular). */
export const supabase: SupabaseClient | null = url && clave ? createClient(url, clave) : null;
