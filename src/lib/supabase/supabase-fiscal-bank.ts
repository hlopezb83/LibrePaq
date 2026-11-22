import { supabaseDiotAndBank } from './supabase-diot-bank';
import { supabaseFiscalAndAssets } from './supabase-fiscal-assets';
import { supabaseFiscalWorkpaper } from './supabase-fiscal-workpaper';

export { supabaseDiotAndBank } from './supabase-diot-bank';
export { supabaseFiscalAndAssets } from './supabase-fiscal-assets';
export { supabaseFiscalWorkpaper } from './supabase-fiscal-workpaper';

export const supabaseFiscalAndBank = {
  ...supabaseDiotAndBank,
  ...supabaseFiscalAndAssets,
  ...supabaseFiscalWorkpaper
};

export default supabaseFiscalAndBank;
