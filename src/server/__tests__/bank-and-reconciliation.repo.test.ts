import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { initDatabase } from '../schema';
import { createCompanyRecord, deleteCompanyRecord } from '../repositories/companies.repo';
import {
  addBankStatementLinesTransaction,
  autoMatchBankLinesTransaction,
  getBankReconciliation,
  unmatchBankLineTransaction
} from '../repositories/bank.repo';
import { createPolizaFromBankLineTransaction } from '../repositories/bank-poliza.repo';
import { createPolizaTransaction } from '../repositories/polizas.repo';

describe('repositories — Conciliación Bancaria & Movimientos de Banco', () => {
  let testCompanyId = '';
  let companyRef: any = null;
  let bankAccountId = '';

  beforeAll(() => {
    initDatabase();
    companyRef = createCompanyRecord({
      name: 'BANCOS CONCILIACION SA DE CV',
      rfc: 'BCN2001019K2',
      regimenFiscal: '601',
      codigoPostal: '64000',
      currentYear: 2026,
      currentPeriod: 10,
      initialBankName: 'BBVA Empresarial',
      initialBankAccount: '01948271',
      initialBankBalance: 100000,
      createOpeningEntry: true
    });
    testCompanyId = companyRef.id;
    bankAccountId = `${testCompanyId}_102-01-001`;
  });

  afterAll(() => {
    if (testCompanyId) {
      deleteCompanyRecord(testCompanyId);
    }
  });

  test('addBankStatementLinesTransaction imports statement lines into bank ledger', () => {
    const recon = addBankStatementLinesTransaction(companyRef, bankAccountId, [
      {
        fecha: '2026-10-05',
        referencia: 'DEP-101',
        descripcion: 'Depósito en firme cliente',
        cargoBanco: 0,
        abonoBanco: 23200
      },
      {
        fecha: '2026-10-08',
        referencia: 'RET-202',
        descripcion: 'Retiro nómina quincenal',
        cargoBanco: 15000,
        abonoBanco: 0
      }
    ]);

    expect(recon).not.toBeNull();
    expect(recon?.statementLines).toHaveLength(2);
    expect(recon?.summary.totalDepositosBanco).toBe(23200);
    expect(recon?.summary.totalRetirosBanco).toBe(15000);
    expect(recon?.summary.movimientosPendientesBanco).toBe(2);

    // Re-importing identical lines should NOT duplicate them (idempotency/deduplication)
    const reconReimport = addBankStatementLinesTransaction(companyRef, bankAccountId, [
      {
        fecha: '2026-10-05',
        referencia: 'DEP-101',
        descripcion: 'Depósito en firme cliente',
        cargoBanco: 0,
        abonoBanco: 23200
      }
    ]);
    expect(reconReimport?.statementLines).toHaveLength(2);
  });

  test('autoMatchBankLinesTransaction matches bank deposits with book charges', () => {
    // Record the corresponding book movement (Cargo 23,200 en Banco)
    createPolizaTransaction({
      companyId: testCompanyId,
      ejercicio: 2026,
      periodo: 10,
      tipo: 'INGRESO',
      fecha: '2026-10-05',
      concepto: 'Registro contable cobro cliente',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: bankAccountId, cargo: 23200, abono: 0, referencia: 'DEP-101' },
        { accountId: `${testCompanyId}_401-01-001`, cargo: 0, abono: 20000 },
        { accountId: `${testCompanyId}_208-01-001`, cargo: 0, abono: 3200 }
      ]
    });

    const matchRes = autoMatchBankLinesTransaction(companyRef, bankAccountId);
    expect(matchRes).not.toBeNull();
    expect(matchRes?.matchedCount).toBe(1);

    const recon = getBankReconciliation(testCompanyId, bankAccountId, 2026, 10);
    expect(recon?.summary.movimientosConciliados).toBe(1);
    expect(recon?.summary.movimientosPendientesBanco).toBe(1);
  });

  test('unmatchBankLineTransaction unlinks a matched statement line', () => {
    const reconBefore = getBankReconciliation(testCompanyId, bankAccountId, 2026, 10);
    const matchedLine = reconBefore?.statementLines.find((s) => s.matchedMovementId);
    expect(matchedLine).toBeDefined();

    const unmatchRes = unmatchBankLineTransaction(matchedLine!.id);
    expect(unmatchRes.found).toBe(true);

    const reconAfter = getBankReconciliation(testCompanyId, bankAccountId, 2026, 10);
    const lineAfter = reconAfter?.statementLines.find((s) => s.id === matchedLine!.id);
    expect(lineAfter?.matchedMovementId).toBeNull();
    expect(reconAfter?.summary.movimientosConciliados).toBe(0);
  });

  test('createPolizaFromBankLineTransaction creates journal entry and reconciles line', () => {
    const reconBefore = getBankReconciliation(testCompanyId, bankAccountId, 2026, 10);
    const withdrawalLine = reconBefore?.statementLines.find(
      (s) => s.cargoBanco === 15000 && !s.matchedMovementId
    );
    expect(withdrawalLine).toBeDefined();

    const res = createPolizaFromBankLineTransaction(withdrawalLine!.id, {
      counterAccountCode: '601-01-001', // Sueldos y Salarios
      desglosarIva: false
    });

    expect(res.status).toBe('OK');
    expect(res.createdPolizaId).toBeDefined();

    // Verify it is now marked as matched
    const reconAfter = getBankReconciliation(testCompanyId, bankAccountId, 2026, 10);
    const updatedLine = reconAfter?.statementLines.find((s) => s.id === withdrawalLine!.id);
    expect(updatedLine?.matchedMovementId).toBeDefined();
    expect(updatedLine?.matchedPolizaFolio).toContain('EGRESO #');
  });

  test('createPolizaFromBankLineTransaction returns ALREADY_MATCHED if called again', () => {
    const recon = getBankReconciliation(testCompanyId, bankAccountId, 2026, 10);
    const matchedLine = recon?.statementLines.find((s) => s.matchedMovementId);
    expect(matchedLine).toBeDefined();

    const res = createPolizaFromBankLineTransaction(matchedLine!.id);
    expect(res.status).toBe('ALREADY_MATCHED');
  });

  test('createPolizaFromBankLineTransaction throws PERIOD_LOCKED if period is closed', () => {
    const { setPeriodLock } = require('../repositories/period-locks.repo');

    // Create an un-matched line in period 9
    addBankStatementLinesTransaction(companyRef, bankAccountId, [
      {
        fecha: '2026-09-15',
        referencia: 'LOCK-TEST',
        descripcion: 'Gasto en periodo cerrado',
        cargoBanco: 5000,
        abonoBanco: 0
      }
    ]);

    const recon = getBankReconciliation(testCompanyId, bankAccountId, 2026, 9);
    const lineInSep = recon?.statementLines.find((s) => s.referencia === 'LOCK-TEST');
    expect(lineInSep).toBeDefined();

    // Lock period 9
    setPeriodLock(testCompanyId, 2026, 9, true, 'Auditoría SAT');

    // Attempting to create poliza from bank line in locked period must throw PERIOD_LOCKED
    expect(() => {
      createPolizaFromBankLineTransaction(lineInSep!.id);
    }).toThrow('CERRADO con candado fiscal');

    // Clean up lock
    setPeriodLock(testCompanyId, 2026, 9, false);
  });
});
