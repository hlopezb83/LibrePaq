import { bankN1Api } from './api/bank-n1.api';
import { isSupabaseConfigured } from './supabase';
import { supabaseBankN1 } from './supabase/supabase-bank-n1';
import { createReadOnlyGuardedClient } from './support-impersonation';

const shouldUseSupabase =
  typeof window !== 'undefined' &&
  isSupabaseConfigured &&
  (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'));

const rawClient = shouldUseSupabase ? supabaseBankN1 : bankN1Api;

const WRITE_METHODS = new Set(['applyBankN1Matches', 'importBankPdfLines']);

export const bankN1Client: typeof rawClient = createReadOnlyGuardedClient(rawClient, WRITE_METHODS);
