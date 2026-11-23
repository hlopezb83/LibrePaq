import { isSupabaseConfigured } from './supabase';
import { workspaceMembersApi } from './api/workspace-members.api';
import { supabaseWorkspaceMembers } from './supabase/supabase-workspace-members';
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

/** Dispatcher de RBAC del despacho y bitácora contable (Supabase Cloud vs servidor local). */
export const workspaceRbacClient: typeof rawClient = createReadOnlyGuardedClient(
  rawClient,
  WRITE_METHODS
);
