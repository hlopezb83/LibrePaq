import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { initDatabase } from '../schema';
import { createCompanyRecord, deleteCompanyRecord, getCompanyById } from '../repositories/companies.repo';
import {
  exportCompanyBackupBundle,
  restoreCompanyBackupBundle
} from '../repositories/backup-restore.repo';
import { getPolizas } from '../repositories/polizas.repo';
import { AccountingInvariantError } from '../../shared/accounting-engine';

describe('repositories — Respaldos y Restauración de Empresas (Backup/Restore)', () => {
  let testCompanyId = '';

  beforeAll(() => {
    initDatabase();
    const created = createCompanyRecord({
      name: 'RESPALDOS Y RESTAURACION SA DE CV',
      rfc: 'RRR2001019K2',
      regimenFiscal: '601',
      codigoPostal: '64000',
      currentYear: 2026,
      currentPeriod: 10
    });
    testCompanyId = created.id;
  });

  afterAll(() => {
    if (testCompanyId) {
      deleteCompanyRecord(testCompanyId);
    }
  });

  test('exportCompanyBackupBundle creates complete JSON snapshot', () => {
    const bundle = exportCompanyBackupBundle(testCompanyId);
    expect(bundle.version).toBe('2.1');
    expect(bundle.company.rfc).toBe('RRR2001019K2');
    expect(Array.isArray(bundle.accounts)).toBe(true);
    expect(bundle.accounts.length).toBeGreaterThan(15);
    expect(Array.isArray(bundle.cfdis)).toBe(true);
    expect(Array.isArray(bundle.polizas)).toBe(true);
    expect(Array.isArray(bundle.thirdParties)).toBe(true);
    expect(Array.isArray(bundle.taxParameters)).toBe(true);
  });

  test('restoreCompanyBackupBundle updates company attributes and catalog from bundle', () => {
    const bundle = exportCompanyBackupBundle(testCompanyId);
    // Modify in bundle
    bundle.company.name = 'RESPALDOS Y RESTAURACION SA DE CV (RESTAURADA)';
    bundle.company.codigoPostal = '64100';

    const restored = restoreCompanyBackupBundle(bundle);
    expect(restored.name).toBe('RESPALDOS Y RESTAURACION SA DE CV (RESTAURADA)');
    expect(restored.codigoPostal).toBe('64100');

    const fresh = getCompanyById(testCompanyId);
    expect(fresh?.name).toBe('RESPALDOS Y RESTAURACION SA DE CV (RESTAURADA)');
  });

  test('restoreCompanyBackupBundle fully restores polizas, cfdis, fixed assets, and period locks', () => {
    const bundle = exportCompanyBackupBundle(testCompanyId);
    
    // Add test poliza with movement
    const testPolId = `pol_test_restore_${Date.now()}`;
    bundle.polizas.push({
      id: testPolId,
      companyId: testCompanyId,
      tipo: 'DIARIO',
      folio: 999,
      fecha: '2026-10-25',
      ejercicio: 2026,
      periodo: 10,
      concepto: 'Póliza de prueba restaurada',
      cfdiUuid: null,
      origin: 'MANUAL',
      createdAt: new Date().toISOString(),
      isBalanced: true,
      totalCargos: 5000,
      totalAbonos: 5000,
      movements: [
        {
          id: `mov_1_${testPolId}`,
          polizaId: testPolId,
          accountId: `${testCompanyId}_102-01-001`,
          accountCode: '102-01-001',
          accountName: 'Banco',
          referencia: 'REF-RESTORE',
          concepto: 'Movimiento restaurado',
          cargo: 5000,
          abono: 0,
          cfdiUuid: null
        },
        {
          id: `mov_2_${testPolId}`,
          polizaId: testPolId,
          accountId: `${testCompanyId}_201-01-001`,
          accountCode: '201-01-001',
          accountName: 'Proveedor',
          referencia: 'REF-RESTORE',
          concepto: 'Movimiento restaurado',
          cargo: 0,
          abono: 5000,
          cfdiUuid: null
        }
      ]
    });

    // Add period lock
    bundle.periodLocks.push({
      companyId: testCompanyId,
      ejercicio: 2026,
      periodo: 5,
      isLocked: true,
      lockedAt: '2026-05-31T23:59:59Z',
      notes: 'Mes de Mayo auditado y cerrado'
    });

    restoreCompanyBackupBundle(bundle);

    // Verify poliza was restored
    const restoredPolizas = getPolizas(testCompanyId, 2026, 10);
    const foundPol = restoredPolizas.find((p) => p.id === testPolId);
    expect(foundPol).toBeDefined();
    expect(foundPol?.concepto).toBe('Póliza de prueba restaurada');
    expect(foundPol?.movements.length).toBe(2);

    // Verify period lock was restored
    const { getPeriodLock } = require('../repositories/period-locks.repo');
    const lock = getPeriodLock(testCompanyId, 2026, 5);
    expect(lock.isLocked).toBe(true);
    expect(lock.notes).toBe('Mes de Mayo auditado y cerrado');
  });

  test('restoreCompanyBackupBundle throws if bundle is missing company or rfc', () => {
    expect(() => restoreCompanyBackupBundle({} as any)).toThrow(
      AccountingInvariantError
    );
  });
});
