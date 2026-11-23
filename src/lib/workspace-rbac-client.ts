import { isSupabaseConfigured } from './supabase';
import { workspaceMembersApi } from './api/workspace-members.api';
import { supabaseWorkspaceMembers } from './supabase/supabase-workspace-members';

const shouldUseSupabase =
  typeof window !== 'undefined' &&
  isSupabaseConfigured &&
  (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'));

/** Dispatcher de RBAC del despacho y bitácora contable (Supabase Cloud vs servidor local). */
export const workspaceRbacClient = shouldUseSupabase ? supabaseWorkspaceMembers : workspaceMembersApi;
