import { inventoryApi } from './api/inventory.api';
import { isSupabaseConfigured } from './supabase';
import { supabaseInventory } from './supabase/supabase-inventory';
import { withGuestDemoClient } from './sandbox/guest-demo-api';
import { createReadOnlyGuardedClient } from './support-impersonation';

const shouldUseSupabase =
  typeof window !== 'undefined' &&
  isSupabaseConfigured &&
  (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'));

const rawClient = shouldUseSupabase ? supabaseInventory : inventoryApi;

export const inventoryClient: typeof rawClient = withGuestDemoClient(
  createReadOnlyGuardedClient(rawClient, new Set(['saveInventoryPeriod']))
);
