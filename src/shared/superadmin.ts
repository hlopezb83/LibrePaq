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
