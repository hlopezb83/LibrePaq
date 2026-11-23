import { useSyncExternalStore } from 'react';
import type { SupportImpersonationSession } from '../shared/admin-types';

const SUPPORT_SESSION_KEY = 'librepaq_support_session';

const ALLOWED_EXACT_METHODS = new Set<string>([
  'recordAdminAuditLog',
  'runAdminHealthScan',
  'updateAdminPlatformAlertStatus',
  'getActiveBroadcast',
  'getBroadcastMessage'
]);

const ALLOWED_READ_PREFIXES = ['get', 'list', 'fetch', 'query', 'verify', 'export', 'download'] as const;

const BLOCKED_MUTATION_PREFIXES = [
  'create', 'update', 'upsert', 'save', 'delete', 'remove', 'import', 'sync',
  'set', 'publish', 'clear', 'close', 'reopen', 'reconcile', 'match', 'unmatch',
  'generate', 'restore', 'post', 'apply', 'upload'
] as const;

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedSession: SupportImpersonationSession | null = null;

function getStorage(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

export function getSupportSession(): SupportImpersonationSession | null {
  const storage = getStorage();
  if (!storage) return cachedSession;
  try {
    const raw = storage.getItem(SUPPORT_SESSION_KEY);
    if (raw === cachedRaw) return cachedSession;
    cachedRaw = raw;
    if (!raw) return (cachedSession = null);
    const parsed = JSON.parse(raw) as Partial<SupportImpersonationSession>;
    if (!parsed || typeof parsed.companyId !== 'string' || typeof parsed.companyName !== 'string') {
      return (cachedSession = null);
    }
    return (cachedSession = parsed as SupportImpersonationSession);
  } catch {
    return (cachedSession = null);
  }
}

export function startSupportSession(
  session: Omit<SupportImpersonationSession, 'startedAt'> & { startedAt?: string }
): SupportImpersonationSession {
  const next: SupportImpersonationSession = {
    ...session,
    startedAt: session.startedAt ?? new Date().toISOString()
  };
  const serialized = JSON.stringify(next);
  cachedRaw = serialized;
  cachedSession = next;
  getStorage()?.setItem(SUPPORT_SESSION_KEY, serialized);
  notifyListeners();
  return next;
}

export function endSupportSession(): void {
  cachedRaw = null;
  cachedSession = null;
  getStorage()?.removeItem(SUPPORT_SESSION_KEY);
  notifyListeners();
}

export function isReadOnlySupportMode(): boolean {
  return getSupportSession() !== null;
}

export function subscribeSupportSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSupportSession(): SupportImpersonationSession | null {
  return useSyncExternalStore(subscribeSupportSession, getSupportSession, () => null);
}

export function isReadOnlyBlockedMethod(methodName: string): boolean {
  if (!methodName) return true;
  if (ALLOWED_EXACT_METHODS.has(methodName)) return false;
  if (BLOCKED_MUTATION_PREFIXES.some((prefix) => methodName.startsWith(prefix))) return true;
  return !ALLOWED_READ_PREFIXES.some((prefix) => methodName.startsWith(prefix));
}
