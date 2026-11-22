import { supabasePolizas } from './supabase-polizas';
import { supabaseCfdi } from './supabase-cfdi';

export { mapSupabasePoliza } from './supabase-polizas';
export { mapSupabaseCfdi } from './supabase-cfdi';

export const supabasePolizasAndCfdi = {
  ...supabasePolizas,
  ...supabaseCfdi
};

export default supabasePolizasAndCfdi;
