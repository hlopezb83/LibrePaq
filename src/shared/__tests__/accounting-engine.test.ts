import { describe, expect, test } from 'bun:test';
import {
  AccountingInvariantError,
  fromCents,
  sumCents,
  toCents,
  validateAccountHierarchy,
  validateDoubleEntryMovements
} from '../accounting-engine';
import type { Account } from '../types';
import { createMockCatalog } from './test-helpers';

describe('Power of 10 Fiscal Rules — Integer Cents Arithmetic', () => {
  test('eliminates IEEE-754 floating point drift on classic monetary additions', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    const totalCents = sumCents([0.1, 0.2]);
    expect(totalCents).toBe(30);
    expect(fromCents(totalCents)).toBe(0.3);
  });

  test('rounds edge decimals deterministically to integer cents', () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(184260)).toBe(18426000);
    expect(fromCents(toCents(21576.48))).toBe(21576.48);
  });
});

describe('Power of 10 Fiscal Rules — Double-Entry & Affectable Invariants', () => {
  const { byId } = createMockCatalog();

  test('accepts balanced movements on affectable accounts', () => {
    const res = validateDoubleEntryMovements(
      [
        { accountId: 'acc-bancos', cargo: 1160, abono: 0 },
        { accountId: 'acc-ventas', cargo: 0, abono: 1000 },
        { accountId: 'acc-iva-trasladado', cargo: 0, abono: 160 }
      ],
      byId
    );
    expect(res.totalCargo).toBe(1160);
    expect(res.totalAbono).toBe(1160);
  });

  test('rejects unbalanced movements even by 1 cent', () => {
    expect(() =>
      validateDoubleEntryMovements(
        [
          { accountId: 'acc-bancos', cargo: 1160.01, abono: 0 },
          { accountId: 'acc-ventas', cargo: 0, abono: 1000 },
          { accountId: 'acc-iva-trasladado', cargo: 0, abono: 160 }
        ],
        byId
      )
    ).toThrow(AccountingInvariantError);
  });

  test('rejects movements targeting non-affectable accumulator accounts', () => {
    expect(() =>
      validateDoubleEntryMovements(
        [
          { accountId: 'acc-100', cargo: 1000, abono: 0 },
          { accountId: 'acc-ventas', cargo: 0, abono: 1000 }
        ],
        byId
      )
    ).toThrow(/es acumulativa/);
  });

  test('rejects simultaneous cargo and abono on the same line', () => {
    expect(() =>
      validateDoubleEntryMovements(
        [
          { accountId: 'acc-bancos', cargo: 500, abono: 500 },
          { accountId: 'acc-ventas', cargo: 500, abono: 500 }
        ],
        byId
      )
    ).toThrow(/simultáneamente/);
  });
});

describe('Power of 10 Fiscal Rules — Account Hierarchy Cycle & Depth Protection', () => {
  const { accounts } = createMockCatalog();

  test('rejects self-referential parentCode', () => {
    expect(() =>
      validateAccountHierarchy(accounts, '102-01-001', '102-01-001')
    ).toThrow(AccountingInvariantError);
  });

  test('rejects circular parentCode chains', () => {
    const chainAccounts: Account[] = [
      {
        ...accounts[0]!,
        code: 'A',
        parentCode: 'C',
        level: 2
      },
      {
        ...accounts[0]!,
        code: 'B',
        parentCode: 'A',
        level: 3
      },
      {
        ...accounts[0]!,
        code: 'C',
        parentCode: 'B',
        level: 4
      }
    ];
    expect(() =>
      validateAccountHierarchy(chainAccounts, 'C', 'A')
    ).toThrow(/subcuenta de sí misma o de sus descendientes/);
  });

  test('rejects account depth exceeding MAX_ACCOUNT_LEVEL (5)', () => {
    const deepChain: Account[] = [
      { ...accounts[0]!, code: 'L1', parentCode: null, level: 1 },
      { ...accounts[0]!, code: 'L2', parentCode: 'L1', level: 2 },
      { ...accounts[0]!, code: 'L3', parentCode: 'L2', level: 3 },
      { ...accounts[0]!, code: 'L4', parentCode: 'L3', level: 4 },
      { ...accounts[0]!, code: 'L5', parentCode: 'L4', level: 5 }
    ];
    expect(() =>
      validateAccountHierarchy(deepChain, 'L5', 'L6')
    ).toThrow(/más de 5 niveles de profundidad/);
  });
});
