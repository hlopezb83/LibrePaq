import { accountingRulesApi } from './api/accounting-rules.api';
import { isSupabaseConfigured } from './supabase';
import { supabaseAccountingRules } from './supabase/supabase-accounting-rules';
import { withGuestDemoClient } from './sandbox/guest-demo-api';
import { createReadOnlyGuardedClient } from './support-impersonation';

const shouldUseSupabase =
  typeof window !== 'undefined' &&
  isSupabaseConfigured &&
  (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'));

const rawClient = shouldUseSupabase ? supabaseAccountingRules : accountingRulesApi;

const WRITE_METHODS = new Set(['upsertAccountingRule', 'deleteAccountingRule']);

export const accountingRulesClient: typeof rawClient = withGuestDemoClient(
  createReadOnlyGuardedClient(rawClient, WRITE_METHODS)
);
