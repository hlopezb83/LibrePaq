import { beforeEach, describe, expect, test } from 'bun:test';
import {
  endSupportSession,
  getSupportSession,
  isReadOnlyBlockedMethod,
  isReadOnlySupportMode,
  startSupportSession,
  subscribeSupportSession
} from '../../lib/support-impersonation';

function installSessionStorageMock(): void {
  if (typeof globalThis.sessionStorage !== 'undefined') return;
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => { store.delete(key); },
    setItem: (key: string, value: string) => { store.set(key, value); }
  };
  Object.defineProperty(globalThis, 'sessionStorage', { value: mockStorage, configurable: true });
}

describe('Support Impersonation (Read-Only Mode)', () => {
  beforeEach(() => {
    installSessionStorageMock();
    endSupportSession();
  });

  test('isReadOnlyBlockedMethod allows reads and safe admin audit/health methods', () => {
    const allowed = [
      'getPolizas', 'listAdminPlatformAlerts', 'fetchAccounts', 'querySatCfdi',
      'exportCompanyBackup', 'downloadDiot', 'recordAdminAuditLog',
      'runAdminHealthScan', 'updateAdminPlatformAlertStatus', 'getActiveBroadcast', 'getBroadcastMessage'
    ];
    for (const method of allowed) expect(isReadOnlyBlockedMethod(method)).toBe(false);
  });

  test('isReadOnlyBlockedMethod blocks tenant mutations, verify* writers, and unknown methods by default', () => {
    const blocked = [
      'createPoliza', 'updateCompany', 'upsertWorkspaceQuota', 'saveFiscalParameters',
      'deletePoliza', 'importAccounts', 'setAdminUserStatus', 'reconcileBankLines',
      'restoreCompanyBackup', 'verifyCfdiSatStatus', 'verifyPendingSatRequests',
      'verifyPendingSat', 'unknownDangerousOperation', ''
    ];
    for (const method of blocked) expect(isReadOnlyBlockedMethod(method)).toBe(true);
  });

  test('startSupportSession, isReadOnlySupportMode, subscribeSupportSession and endSupportSession lifecycle', () => {
    expect(isReadOnlySupportMode()).toBe(false);
    expect(getSupportSession()).toBeNull();

    let notifications = 0;
    const unsubscribe = subscribeSupportSession(() => { notifications += 1; });

    const started = startSupportSession({
      companyId: 'comp_123',
      companyName: 'Despacho Demo SA de CV',
      companyRfc: 'DDE210101AAA',
      ownerEmail: 'cliente@demo.mx'
    });

    expect(started.companyId).toBe('comp_123');
    expect(typeof started.startedAt).toBe('string');
    expect(isReadOnlySupportMode()).toBe(true);
    expect(getSupportSession()?.companyRfc).toBe('DDE210101AAA');
    expect(notifications).toBe(1);

    endSupportSession();
    expect(isReadOnlySupportMode()).toBe(false);
    expect(getSupportSession()).toBeNull();
    expect(notifications).toBe(2);
    unsubscribe();
  });
});
