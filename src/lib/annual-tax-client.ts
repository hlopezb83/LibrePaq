import { annualTaxApi } from './api/annual-tax.api';
import { isSupabaseConfigured } from './supabase';
import { supabaseAnnualTax } from './supabase/supabase-annual-tax';
import { isReadOnlySupportMode } from './support-impersonation';

const shouldUseSupabase =
  typeof window !== 'undefined' &&
  isSupabaseConfigured &&
  (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'));

const rawClient = shouldUseSupabase ? supabaseAnnualTax : annualTaxApi;

export const annualTaxClient: typeof rawClient = {
  getAnnualTaxSummary: (companyId, ejercicio) => rawClient.getAnnualTaxSummary(companyId, ejercicio),
  saveAnnualTaxInputs: (companyId, payload) => {
    if (isReadOnlySupportMode()) {
      throw new Error('Modo Soporte (solo lectura): las escrituras están bloqueadas.');
    }
    return rawClient.saveAnnualTaxInputs(companyId, payload);
  }
};
