import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  getSuperAdminEmails,
  isSuperAdminEmail,
  normalizePlatformRole
} from '../shared/superadmin';
import type { PlatformRole } from '../shared/admin-types';

export const SUPERADMIN_EMAILS = getSuperAdminEmails();
export const GUEST_DEMO_KEY = 'librepaq_guest_demo_active';

export const GUEST_DEMO_USER: User = {
  id: 'usr_guest_demo',
  app_metadata: { provider: 'guest_demo' },
  user_metadata: {
    full_name: 'Demostración en Vivo',
    workspace_name: 'Despacho Contable (Demo)',
    workspace_id: 'ws_demo',
    is_guest: true
  },
  aud: 'authenticated',
  role: 'authenticated',
  email: 'demo@librepaq.com',
  created_at: new Date().toISOString()
};

export function checkIsSuperAdmin(user: User | null): boolean {
  if (!user || user.user_metadata?.is_guest) return false;
  if (isSuperAdminEmail(user.email)) return true;
  return user.app_metadata?.role === 'superadmin';
}

export interface UserAccessCheck {
  suspended: boolean;
  platformRole: PlatformRole;
}

export async function fetchUserAccessCheck(sessionUser: User): Promise<UserAccessCheck> {
  const fallbackRole = normalizePlatformRole(
    String(sessionUser.app_metadata?.platform_role || ''),
    sessionUser.app_metadata?.role === 'superadmin',
    sessionUser.email
  );
  if (sessionUser.user_metadata?.is_guest) return { suspended: false, platformRole: 'NONE' };
  if (!supabase || !isSupabaseConfigured || typeof supabase.from !== 'function') {
    return { suspended: false, platformRole: fallbackRole };
  }

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('status, platform_role, is_superadmin')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (error || !data) return { suspended: false, platformRole: fallbackRole };
    const row = data as { status?: unknown; platform_role?: unknown; is_superadmin?: unknown };
    const role = normalizePlatformRole(
      row.platform_role ? String(row.platform_role) : null,
      Boolean(row.is_superadmin) || sessionUser.app_metadata?.role === 'superadmin',
      sessionUser.email
    );
    return {
      suspended: role !== 'SUPERADMIN' && String(row.status ?? '').toUpperCase() === 'SUSPENDIDO',
      platformRole: role
    };
  } catch {
    return { suspended: false, platformRole: fallbackRole };
  }
}
