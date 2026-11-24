import { bankN1Api } from './api/bank-n1.api';
import { isSupabaseConfigured } from './supabase';
import { supabaseBankN1 } from './supabase/supabase-bank-n1';
import { withGuestDemoClient } from './sandbox/guest-demo-api';
import { isGuestDemoMode } from './sandbox/guest-demo-mode';
import { createReadOnlyGuardedClient } from './support-impersonation';

const shouldUseSupabase =
  typeof window !== 'undefined' &&
  isSupabaseConfigured &&
  (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'));

const rawClient = shouldUseSupabase ? supabaseBankN1 : bankN1Api;

const WRITE_METHODS = new Set(['applyBankN1Matches', 'importBankPdfLines']);

const guardedClient = createReadOnlyGuardedClient(rawClient, WRITE_METHODS);

export const bankN1Client: typeof rawClient = withGuestDemoClient(
  new Proxy(guardedClient, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && isGuestDemoMode()) {
        const val = Reflect.get(target, prop, receiver);
        if (typeof val === 'function') {
          return () =>
            Promise.reject(
              new Error(`DEMO_SANDBOX_UNSUPPORTED: "${prop}" no disponible en modo Demo interactivo.`)
            );
        }
        return undefined;
      }
      return Reflect.get(target, prop, receiver);
    }
  })
);
