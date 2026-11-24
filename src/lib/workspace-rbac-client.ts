import { isSupabaseConfigured } from './supabase';
import { workspaceMembersApi } from './api/workspace-members.api';
import { supabaseWorkspaceMembers } from './supabase/supabase-workspace-members';
import { isGuestDemoMode } from './sandbox/guest-demo-mode';
import { guestDemoRbac } from './sandbox/guest-demo-rbac';
import { createReadOnlyGuardedClient } from './support-impersonation';

const shouldUseSupabase =
  typeof window !== 'undefined' &&
  isSupabaseConfigured &&
  (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'));

const rawClient = shouldUseSupabase ? supabaseWorkspaceMembers : workspaceMembersApi;

const WRITE_METHODS = new Set([
  'inviteWorkspaceMember',
  'updateWorkspaceMemberRole',
  'revokeWorkspaceMember',
  'assignCompanyAccess',
  'recordCompanyAuditLog'
]);

const guardedClient: typeof rawClient = createReadOnlyGuardedClient(
  rawClient,
  WRITE_METHODS
);

/** Dispatcher de RBAC del despacho y bitácora contable (Demo Sandbox vs Supabase Cloud vs servidor local). */
export const workspaceRbacClient: typeof rawClient = new Proxy(guardedClient, {
  get(target, prop, receiver) {
    if (typeof prop === 'string' && isGuestDemoMode()) {
      const demoFn = Reflect.get(guestDemoRbac, prop, guestDemoRbac);
      if (typeof demoFn === 'function') {
        return (...args: unknown[]) => (demoFn as (...a: unknown[]) => unknown).apply(guestDemoRbac, args);
      }
    }
    return Reflect.get(target, prop, receiver);
  }
});
