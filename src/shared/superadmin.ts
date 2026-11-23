import type { PlatformRole } from './admin-types';

export const DEFAULT_SUPERADMIN_EMAILS = ['hlopezb@gmail.com'] as const;

/**
 * Resuelve la lista canonica de correos SuperAdmin desde entorno cliente/servidor.
 */
export function getSuperAdminEmails(): string[] {
  const envClient =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_SUPERADMIN_EMAILS === 'string'
      ? import.meta.env.VITE_SUPERADMIN_EMAILS
      : '';
  const envServer =
    typeof process !== 'undefined' && process.env
      ? process.env.SUPERADMIN_EMAILS || process.env.VITE_SUPERADMIN_EMAILS || ''
      : '';
  const raw = envClient || envServer;
  if (!raw.trim()) return [...DEFAULT_SUPERADMIN_EMAILS];
  const parsed = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [...DEFAULT_SUPERADMIN_EMAILS];
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getSuperAdminEmails().includes(email.trim().toLowerCase());
}

export function normalizePlatformRole(
  rawRole?: string | null,
  isSuperAdminFlag?: boolean | null,
  email?: string | null
): PlatformRole {
  if (isSuperAdminEmail(email)) return 'SUPERADMIN';
  const upper = String(rawRole || '').trim().toUpperCase();
  if (upper === 'SUPERADMIN' || upper === 'SUPPORT_READONLY' || upper === 'BILLING_OPS' || upper === 'NONE') {
    return upper;
  }
  return isSuperAdminFlag ? 'SUPERADMIN' : 'NONE';
}

export function hasPlatformAdminAccess(role?: PlatformRole | null): boolean {
  return role === 'SUPERADMIN' || role === 'SUPPORT_READONLY' || role === 'BILLING_OPS';
}

export function canManagePlatformRoles(role?: PlatformRole | null): boolean {
  return role === 'SUPERADMIN';
}

export function canManageBillingAndQuotas(role?: PlatformRole | null): boolean {
  return role === 'SUPERADMIN' || role === 'BILLING_OPS';
}

export function canDeletePlatformTenants(role?: PlatformRole | null): boolean {
  return role === 'SUPERADMIN';
}

export function canPublishPlatformBroadcast(role?: PlatformRole | null): boolean {
  return role === 'SUPERADMIN';
}
