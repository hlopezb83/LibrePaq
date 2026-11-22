import { supabaseDiot } from './supabase-diot';
import { supabaseBank } from './supabase-bank';

export { supabaseDiot } from './supabase-diot';
export { supabaseBank } from './supabase-bank';

export const supabaseDiotAndBank = {
  ...supabaseDiot,
  ...supabaseBank
};

export default supabaseDiotAndBank;
