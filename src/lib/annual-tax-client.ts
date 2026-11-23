import { annualTaxApi } from './api/annual-tax.api';
import { isSupabaseConfigured } from './supabase';
import { supabaseAnnualTax } from './supabase/supabase-annual-tax';
import { createReadOnlyGuardedClient } from './support-impersonation';

const shouldUseSupabase =
  typeof window !== 'undefined' &&
  isSupabaseConfigured &&
  (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'));

const rawClient = shouldUseSupabase ? supabaseAnnualTax : annualTaxApi;

export const annualTaxClient: typeof rawClient = createReadOnlyGuardedClient(
  rawClient,
  new Set(['saveAnnualTaxInputs'])
);
