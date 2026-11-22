import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { initDatabase } from '../schema';
import {
  createCompanyRecord,
  deleteCompanyRecord,
  getCompanies,
  getCompanyById,
  updateCompanyPeriodRecord,
  updateCompanyRecord
} from '../repositories/companies.repo';
import {
  batchImportAccountsCatalog,
  createAccountRecord,
  deleteAccountRecord,
  getAccounts,
  updateAccountRecord
} from '../repositories/accounts.repo';
import { getAccountLedger } from '../repositories/account-ledger.repo';
import { computeMonthlyTrendFast, computeTrialBalance } from '../repositories/trial-balance.repo';
import { AccountingInvariantError } from '../../shared/accounting-engine';

describe('repositories — Companies & Accounts Catalog', () => {
  let testCompanyId = '';

  beforeAll(() => {
    initDatabase();
    const created = createCompanyRecord({
      name: 'TEST HOLDING CONTABLE SA DE CV',
      rfc: 'THC2001019K2',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '64000',
      currentYear: 2026,
      currentPeriod: 10,
      initialBankName: 'Santander Select',
      initialBankAccount: '998877',
      initialBankBalance: 0,
      createOpeningEntry: false
    });
    testCompanyId = created.id;
  });

  afterAll(() => {
    if (testCompanyId) {
      deleteCompanyRecord(testCompanyId);
    }
  });

  test('creates company and auto-seeds standard SAT accounts catalog', () => {
    const comp = getCompanyById(testCompanyId);
    expect(comp).not.toBeNull();
    expect(comp?.rfc).toBe('THC2001019K2');

    const accounts = getAccounts(testCompanyId);
    expect(accounts.length).toBeGreaterThan(15);
    const bankAcc = accounts.find((a) => a.code === '102-01-001');
    expect(bankAcc).toBeDefined();
    expect(bankAcc?.name).toContain('Santander Select');
  });

  test('getCompanies lists registered companies including test holding', () => {
    const list = getCompanies();
    expect(list.some((c) => c.id === testCompanyId)).toBe(true);
  });

  test('updateCompanyRecord modifies company attributes', () => {
    const updated = updateCompanyRecord(testCompanyId, {
      name: 'TEST HOLDING RENOMBRADA SA DE CV',
      rfc: 'THC2001019K2',
      regimenFiscal: '601',
      codigoPostal: '64001'
    });
    expect(updated?.name).toBe('TEST HOLDING RENOMBRADA SA DE CV');
    expect(updated?.codigoPostal).toBe('64001');
  });

  test('updateCompanyPeriodRecord updates active year and period', () => {
    const updated = updateCompanyPeriodRecord(testCompanyId, 2026, 11);
    expect(updated?.currentPeriod).toBe(11);
    // Restore back to 10
    updateCompanyPeriodRecord(testCompanyId, 2026, 10);
  });

  test('createAccountRecord adds subaccount with valid hierarchy', () => {
    const created = createAccountRecord({
      companyId: testCompanyId,
      code: '102-01-009',
      name: 'Cuenta Especial USD',
      parentCode: '102-00-000',
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 3,
      isAffectable: true,
      satGroupCode: '102.02',
      initialBalance: 5000
    });
    expect(created.code).toBe('102-01-009');

    const accounts = getAccounts(testCompanyId);
    const found = accounts.find((a) => a.code === '102-01-009');
    expect(found).toBeDefined();
    expect(found?.name).toBe('Cuenta Especial USD');
  });

  test('createAccountRecord rejects duplicate account code', () => {
    expect(() =>
      createAccountRecord({
        companyId: testCompanyId,
        code: '102-01-009',
        name: 'Duplicado',
        parentCode: '102-00-000',
        type: 'ACTIVO',
        nature: 'DEUDORA',
        level: 3,
        isAffectable: true,
        satGroupCode: '102.02',
        initialBalance: 0
      })
    ).toThrow(AccountingInvariantError);
  });

  test('updateAccountRecord modifies account name and sat group', () => {
    const accId = `${testCompanyId}_102-01-009`;
    const ok = updateAccountRecord(accId, {
      name: 'Cuenta Especial USD (Modificada)',
      satGroupCode: '102.02',
      nature: 'DEUDORA',
      type: 'ACTIVO',
      initialBalance: 7500
    });
    expect(ok).toBe(true);

    const accounts = getAccounts(testCompanyId);
    const acc = accounts.find((a) => a.id === accId);
    expect(acc?.name).toBe('Cuenta Especial USD (Modificada)');
    expect(acc?.initialBalance).toBe(7500);
  });

  test('deleteAccountRecord deletes unused account', () => {
    const accId = `${testCompanyId}_102-01-009`;
    const res = deleteAccountRecord(accId);
    expect(res.deleted).toBe(true);
    expect(res.hasMovements).toBe(false);

    const accounts = getAccounts(testCompanyId);
    expect(accounts.find((a) => a.id === accId)).toBeUndefined();
  });

  test('computeTrialBalance computes hierarchical roll-up balances', () => {
    const balanza = computeTrialBalance(testCompanyId, 2026, 10);
    expect(balanza.length).toBeGreaterThan(15);
    const activoNode = balanza.find((a) => a.code === '100-00-000');
    expect(activoNode).toBeDefined();
    expect(activoNode?.level).toBe(1);
    expect(activoNode?.isAffectable).toBe(false);
  });

  test('getAccountLedger returns entries structure for account', () => {
    const ledger = getAccountLedger(testCompanyId, `${testCompanyId}_102-01-001`, 2026, 10);
    expect(ledger).not.toBeNull();
    expect(ledger?.account.code).toBe('102-01-001');
    expect(Array.isArray(ledger?.entries)).toBe(true);
  });

  test('computeMonthlyTrendFast aggregates monthly income and expenses across months', () => {
    const trend = computeMonthlyTrendFast(testCompanyId, 2026, [8, 9, 10]);
    expect(trend).toHaveLength(3);
    expect(trend[0]?.periodo).toBe(8);
    expect(trend[2]?.periodo).toBe(10);
    expect(typeof trend[0]?.ingresos).toBe('number');
  });

  test('batchImportAccountsCatalog imports multiple accounts with upsert', () => {
    const result = batchImportAccountsCatalog(testCompanyId, [
      {
        code: '107-01-001',
        name: 'Deudor Diverso Lic. Gomez',
        parentCode: '100-00-000',
        initialBalance: 12000
      },
      {
        code: '107-01-002',
        name: 'Deudor Diverso Ing. Perez',
        parentCode: '100-00-000',
        initialBalance: 8500
      }
    ]);

    expect(result.importedCount).toBe(2);
    const accounts = getAccounts(testCompanyId);
    expect(accounts.some((a) => a.code === '107-01-001')).toBe(true);
    expect(accounts.some((a) => a.code === '107-01-002')).toBe(true);
  });
});
