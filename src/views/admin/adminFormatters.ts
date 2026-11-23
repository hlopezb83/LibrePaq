import type { PlatformRole } from '../../shared/admin-types';
import { MEXICO_TIMEZONE } from '../../shared/date-utils';

export const ADMIN_ROLE_OPTIONS: Array<{ value: PlatformRole; label: string }> = [
  { value: 'NONE', label: 'Sin privilegios' },
  { value: 'SUPPORT_READONLY', label: 'Soporte (Solo lectura)' },
  { value: 'BILLING_OPS', label: 'Operaciones y Cuotas' },
  { value: 'SUPERADMIN', label: 'Dueño de Plataforma' }
];

export function formatAdminDate(value?: string | null, fallback = 'Sin registro'): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('es-MX', {
    timeZone: MEXICO_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function formatAdminDateTime(iso?: string | null, withSeconds = false): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-MX', {
    timeZone: MEXICO_TIMEZONE,
    dateStyle: withSeconds ? 'short' : 'medium',
    timeStyle: withSeconds ? 'medium' : 'short'
  });
}

export function formatAdminTime(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-MX', {
    timeZone: MEXICO_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function toIsoOrNull(localValue: string): string | null {
  const trimmed = localValue.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
