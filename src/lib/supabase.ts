import { createClient } from '@supabase/supabase-js';
import { setCsfEdgeFunctionInvoker } from '../shared/gemini-csf-extractor';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  'https://utrtmhdoknthuitknfro.supabase.co';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  '';

/**
 * Cliente de Supabase para LibrePaq Pro.
 * Si no se ha configurado VITE_SUPABASE_ANON_KEY, opera en modo de gracia
 * permitiendo la ejecución local con SQLite sin romper la aplicación.
 */
export const supabase = supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (supabase) {
  setCsfEdgeFunctionInvoker((name, opts) => supabase.functions.invoke(name, opts));
}

export const isSupabaseConfigured = Boolean(supabaseAnonKey && supabaseAnonKey.trim().length > 10);

export function getRequiredSupabase() {
  if (!supabase) {
    throw new Error('Supabase no está configurado. Configure VITE_SUPABASE_ANON_KEY para operar en modo Cloud.');
  }
  return supabase;
}
