import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { initDatabase } from '../schema';
import { createCompanyRecord, deleteCompanyRecord } from '../repositories/companies.repo';
import {
  createPolizaTransaction,
  deletePolizaTransaction,
  getPolizas
} from '../repositories/polizas.repo';
import { getPeriodLock, setPeriodLock } from '../repositories/period-locks.repo';
import { AccountingInvariantError } from '../../shared/accounting-engine';

describe('repositories — Pólizas Contables & Candados de Periodo', () => {
  let testCompanyId = '';

  beforeAll(() => {
    initDatabase();
    const created = createCompanyRecord({
      name: 'POLIZAS TEST SA DE CV',
      rfc: 'POL2001019K2',
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

  test('creates balanced journal entry and automatically assigns folio 1', () => {
    const poliza = createPolizaTransaction({
      companyId: testCompanyId,
      ejercicio: 2026,
      periodo: 10,
      tipo: 'INGRESO',
      fecha: '2026-10-05',
      concepto: 'Cobro de factura cliente SPEI',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        {
          accountId: `${testCompanyId}_102-01-001`,
          cargo: 11600,
          abono: 0,
          concepto: 'Entrada en bancos'
        },
        {
          accountId: `${testCompanyId}_401-01-001`,
          cargo: 0,
          abono: 10000,
          concepto: 'Venta gravada 16%'
        },
        {
          accountId: `${testCompanyId}_208-01-001`,
          cargo: 0,
          abono: 1600,
          concepto: 'IVA cobrado 16%'
        }
      ]
    });

    expect(poliza.folio).toBe(1);
    expect(poliza.isBalanced).toBe(true);
    expect(poliza.totalCargos).toBe(11600);
    expect(poliza.totalAbonos).toBe(11600);
  });

  test('increments folio sequentially for the same type, period and company', () => {
    const poliza2 = createPolizaTransaction({
      companyId: testCompanyId,
      ejercicio: 2026,
      periodo: 10,
      tipo: 'INGRESO',
      fecha: '2026-10-06',
      concepto: 'Segundo cobro de factura',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: `${testCompanyId}_102-01-001`, cargo: 5000, abono: 0 },
        { accountId: `${testCompanyId}_401-01-001`, cargo: 0, abono: 5000 }
      ]
    });

    expect(poliza2.folio).toBe(2);
  });

  test('uses independent folio counter for different poliza types', () => {
    const egreso = createPolizaTransaction({
      companyId: testCompanyId,
      ejercicio: 2026,
      periodo: 10,
      tipo: 'EGRESO',
      fecha: '2026-10-07',
      concepto: 'Pago de servicios cloud',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: `${testCompanyId}_501-01-001`, cargo: 3000, abono: 0 },
        { accountId: `${testCompanyId}_102-01-001`, cargo: 0, abono: 3000 }
      ]
    });

    expect(egreso.folio).toBe(1);
  });

  test('rejects unbalanced poliza even by $0.01', () => {
    expect(() =>
      createPolizaTransaction({
        companyId: testCompanyId,
        ejercicio: 2026,
        periodo: 10,
        tipo: 'DIARIO',
        fecha: '2026-10-08',
        concepto: 'Descuadrada',
        cfdiUuid: null,
        origin: 'MANUAL',
        movements: [
          { accountId: `${testCompanyId}_102-01-001`, cargo: 1000.01, abono: 0 },
          { accountId: `${testCompanyId}_401-01-001`, cargo: 0, abono: 1000 }
        ]
      })
    ).toThrow(AccountingInvariantError);
  });

  test('getPeriodLock returns default unlocked status', () => {
    const lock = getPeriodLock(testCompanyId, 2026, 10);
    expect(lock.isLocked).toBe(false);
  });

  test('setPeriodLock locks period and prevents creating new polizas', () => {
    setPeriodLock(testCompanyId, 2026, 10, true, 'Cierre contable definitivo');
    const lock = getPeriodLock(testCompanyId, 2026, 10);
    expect(lock.isLocked).toBe(true);
    expect(lock.notes).toBe('Cierre contable definitivo');

    // Attempting to create poliza throws PERIOD_LOCKED
    expect(() =>
      createPolizaTransaction({
        companyId: testCompanyId,
        ejercicio: 2026,
        periodo: 10,
        tipo: 'DIARIO',
        fecha: '2026-10-10',
        concepto: 'Intento en periodo cerrado',
        cfdiUuid: null,
        origin: 'MANUAL',
        movements: [
          { accountId: `${testCompanyId}_102-01-001`, cargo: 100, abono: 0 },
          { accountId: `${testCompanyId}_401-01-001`, cargo: 0, abono: 100 }
        ]
      })
    ).toThrow(/CERRADO con candado fiscal/);
  });

  test('unlocking period allows poliza creation and deletion', () => {
    setPeriodLock(testCompanyId, 2026, 10, false, 'Reabierto para ajustes');
    expect(getPeriodLock(testCompanyId, 2026, 10).isLocked).toBe(false);

    const poliza = createPolizaTransaction({
      companyId: testCompanyId,
      ejercicio: 2026,
      periodo: 10,
      tipo: 'DIARIO',
      fecha: '2026-10-11',
      concepto: 'Poliza temporal para borrar',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: `${testCompanyId}_102-01-001`, cargo: 500, abono: 0 },
        { accountId: `${testCompanyId}_401-01-001`, cargo: 0, abono: 500 }
      ]
    });

    const deleted = deletePolizaTransaction(poliza.id);
    expect(deleted).toBe(true);

    const polizas = getPolizas(testCompanyId, 2026, 10);
    expect(polizas.some((p) => p.id === poliza.id)).toBe(false);
  });

  test('getPolizas filters accurately by ejercicio and periodo', () => {
    const list = getPolizas(testCompanyId, 2026, 10);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.every((p) => p.ejercicio === 2026 && p.periodo === 10)).toBe(true);
  });
});
