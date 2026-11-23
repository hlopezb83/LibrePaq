import { inventoryApi } from './api/inventory.api';
import { isSupabaseConfigured } from './supabase';
import { supabaseInventory } from './supabase/supabase-inventory';
import { isReadOnlySupportMode } from './support-impersonation';

const shouldUseSupabase =
  typeof window !== 'undefined' &&
  isSupabaseConfigured &&
  (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'));

const rawClient = shouldUseSupabase ? supabaseInventory : inventoryApi;

export const inventoryClient: typeof rawClient = {
  getInventoryPeriod: (companyId, ejercicio, periodo) =>
    rawClient.getInventoryPeriod(companyId, ejercicio, periodo),
  saveInventoryPeriod: (companyId, payload) => {
    if (isReadOnlySupportMode()) {
      throw new Error('Modo Soporte (solo lectura): las escrituras están bloqueadas.');
    }
    return rawClient.saveInventoryPeriod(companyId, payload);
  }
};
