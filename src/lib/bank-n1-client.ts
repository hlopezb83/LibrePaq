import { bankN1Api } from './api/bank-n1.api';
import { isSupabaseConfigured } from './supabase';
import { supabaseBankN1 } from './supabase/supabase-bank-n1';
import { isReadOnlySupportMode } from './support-impersonation';

const shouldUseSupabase =
  typeof window !== 'undefined' &&
  isSupabaseConfigured &&
  (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'));

const rawClient = shouldUseSupabase ? supabaseBankN1 : bankN1Api;

const WRITE_METHODS = new Set(['applyBankN1Matches', 'importBankPdfLines']);

export const bankN1Client: typeof rawClient = new Proxy(rawClient, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof prop === 'string' && typeof value === 'function') {
      return (...args: unknown[]) => {
        if (isReadOnlySupportMode() && WRITE_METHODS.has(prop)) {
          throw new Error(
            'Modo Soporte (solo lectura): las escrituras están bloqueadas para proteger los datos del cliente.'
          );
        }
        return (value as (...fnArgs: unknown[]) => unknown).apply(target, args);
      };
    }
    return value;
  }
});
