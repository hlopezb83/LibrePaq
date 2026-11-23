import { accountingRulesApi } from './api/accounting-rules.api';
import { isSupabaseConfigured } from './supabase';
import { supabaseAccountingRules } from './supabase/supabase-accounting-rules';

const shouldUseSupabase =
  typeof window !== 'undefined' &&
  isSupabaseConfigured &&
  (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'));

export const accountingRulesClient = shouldUseSupabase
  ? supabaseAccountingRules
  : accountingRulesApi;
