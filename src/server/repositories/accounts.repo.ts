import { db, mapAccountRow, type AccountDbRow } from '../connection';
import { seedAccountsForCompanyOnDb } from '../seed-data';
import { assertPeriodOpen } from './period-locks.repo';
import {
  assertAccountingInvariant,
  fromCents,
  toCents,
  validateAccountHierarchy
} from '../../shared/accounting-engine';
import { SAFETY_BOUNDS } from '../../shared/sat-constants';
import type {
  Account,
  AccountNature,
  AccountType
} from '../../shared/types';

export function seedAccountsForCompany(companyId: string, scale = 1): Map<string, string> {
  return seedAccountsForCompanyOnDb(db, companyId, scale);
}

export function getAccounts(companyId: string): Account[] {
  const rows = db
    .query('SELECT * FROM accounts WHERE company_id = ? ORDER BY code ASC')
    .all(companyId) as AccountDbRow[];
  return rows.map(mapAccountRow);
}

export function createAccountRecord(input: {
  companyId: string;
  code: string;
  name: string;
  parentCode: string | null;
  type: AccountType;
  nature: AccountNature;
  level: number;
  isAffectable: boolean;
  satGroupCode: string;
  initialBalance: number;
}): { id: string; code: string; name: string } {
  const accounts = getAccounts(input.companyId);
  const duplicate = accounts.find((a) => a.code === input.code);
  assertAccountingInvariant(
    duplicate === undefined,
    'DUPLICATE_ACCOUNT_CODE',
    `Ya existe una cuenta con el código ${input.code}.`
  );

  // NASA Power of 10 - Reglas 1 y 2 (H-11): Verificar jerarquía sin ciclos y <= 5 niveles
  const hierarchy = validateAccountHierarchy(accounts, input.parentCode, input.code);
  const resolvedLevel = input.parentCode ? hierarchy.level : input.level;

  if (input.parentCode) {
    const parentAcc = accounts.find((a) => a.code === input.parentCode);
    if (parentAcc && parentAcc.isAffectable) {
      const movCountRow = db
        .query('SELECT COUNT(*) as c FROM poliza_movements WHERE account_id = ?')
        .get(parentAcc.id) as { c: number } | null;
      const hasMovs = (movCountRow?.c ?? 0) > 0 || toCents(parentAcc.initialBalance) !== 0;
      assertAccountingInvariant(
        !hasMovs,
        'PARENT_ACCOUNT_HAS_MOVEMENTS',
        `La cuenta padre ${parentAcc.code} es afectable y ya tiene movimientos o saldo inicial. Conviértela en acumuladora no afectable o elige otra cuenta padre.`
      );
      db.prepare('UPDATE accounts SET is_affectable = 0 WHERE id = ?').run(parentAcc.id);
    }
  }

  const id = `${input.companyId}_${input.code}`;
  db.prepare(`
    INSERT INTO accounts (
      id, company_id, code, name, parent_code, type, nature, level, is_affectable, sat_group_code, currency, initial_balance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MXN', ?)
  `).run(
    id,
    input.companyId,
    input.code,
    input.name,
    input.parentCode,
    input.type,
    input.nature,
    resolvedLevel,
    input.isAffectable ? 1 : 0,
    input.satGroupCode,
    fromCents(toCents(input.initialBalance))
  );

  return { id, code: input.code, name: input.name };
}

export function updateAccountRecord(
  id: string,
  input: {
    name: string;
    satGroupCode: string;
    nature: AccountNature;
    type: AccountType;
    initialBalance: number;
  }
): boolean {
  const existing = db
    .prepare('SELECT company_id, initial_balance, nature FROM accounts WHERE id = ?')
    .get(id) as { company_id: string; initial_balance: number; nature: string } | undefined;
  if (existing) {
    const isBalanceDiff = toCents(existing.initial_balance) !== toCents(input.initialBalance);
    const isNatureDiff = existing.nature !== input.nature;
    if (isBalanceDiff || isNatureDiff) {
      const comp = db
        .prepare('SELECT id, current_year FROM companies WHERE id = ?')
        .get(existing.company_id) as { id: string; current_year: number } | undefined;
      if (comp) assertPeriodOpen(comp.id, comp.current_year, 1);
    }
  }

  const tx = db.transaction(() => {
    const res = db
      .prepare(`
        UPDATE accounts
        SET name = ?, sat_group_code = ?, nature = ?, type = ?, initial_balance = ?
        WHERE id = ?
      `)
      .run(
        input.name,
        input.satGroupCode,
        input.nature,
        input.type,
        fromCents(toCents(input.initialBalance)),
        id
      );
    if (res.changes === 0) return false;
    db.prepare('UPDATE poliza_movements SET account_name = ? WHERE account_id = ?').run(
      input.name,
      id
    );
    return true;
  });
  return tx();
}

export function deleteAccountRecord(
  id: string
): { deleted: boolean; hasMovements: boolean; hasChildren?: boolean; hasInitialBalance?: boolean } {
  const hasMovs = db
    .query('SELECT COUNT(*) as c FROM poliza_movements WHERE account_id = ?')
    .get(id) as { c: number } | null;
  if (hasMovs && hasMovs.c > 0) {
    return { deleted: false, hasMovements: true };
  }
  const accRow = db
    .query('SELECT company_id, code, initial_balance FROM accounts WHERE id = ?')
    .get(id) as { company_id: string; code: string; initial_balance: number } | null;
  if (accRow) {
    if (toCents(accRow.initial_balance) !== 0) {
      return { deleted: false, hasMovements: true, hasInitialBalance: true };
    }
    const childRow = db
      .query('SELECT COUNT(*) as c FROM accounts WHERE company_id = ? AND parent_code = ?')
      .get(accRow.company_id, accRow.code) as { c: number } | null;
    if (childRow && childRow.c > 0) {
      return { deleted: false, hasMovements: false, hasChildren: true };
    }
  }
  const res = db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  return { deleted: res.changes > 0, hasMovements: false };
}

export function batchImportAccountsCatalog(
  companyId: string,
  rows: ReadonlyArray<{
    code: string;
    name: string;
    parentCode?: string | null;
    type?: AccountType;
    nature?: AccountNature;
    level?: number;
    satGroupCode?: string;
    isAffectable?: boolean;
    initialBalance?: number;
  }>
): { importedCount: number; updatedCount: number } {
  const bound = Math.min(rows.length, SAFETY_BOUNDS.MAX_CSV_ROWS);
  let importedCount = 0;
  let updatedCount = 0;

  const upsertAcc = db.prepare(`
    INSERT INTO accounts (
      id, company_id, code, name, parent_code, type, nature, level, is_affectable, sat_group_code, currency, initial_balance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MXN', ?)
    ON CONFLICT(company_id, code) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      nature = excluded.nature,
      level = excluded.level,
      sat_group_code = excluded.sat_group_code,
      initial_balance = excluded.initial_balance
  `);

  const existingAccounts = getAccounts(companyId);
  const existingByCode = new Map(existingAccounts.map((a) => [a.code, a]));
  const compRow = db
    .prepare('SELECT current_year FROM companies WHERE id = ?')
    .get(companyId) as { current_year: number } | undefined;
  let checkedPeriod1Lock = false;

  const tx = db.transaction(() => {
    for (let i = 0; i < bound; i += 1) {
      const r = rows[i];
      if (!r || !r.code || !r.name) continue;
      const code = r.code.trim();
      const firstDigit = code.charAt(0);
      const inferredType: AccountType =
        r.type ||
        (firstDigit === '1'
          ? 'ACTIVO'
          : firstDigit === '2'
            ? 'PASIVO'
            : firstDigit === '3'
              ? 'CAPITAL'
              : firstDigit === '4'
                ? 'INGRESOS'
                : firstDigit === '5'
                  ? 'COSTOS'
                  : 'GASTOS');
      const inferredNature: AccountNature =
        r.nature ||
        (inferredType === 'PASIVO' || inferredType === 'CAPITAL' || inferredType === 'INGRESOS'
          ? 'ACREEDORA'
          : 'DEUDORA');
      const segments = code.split('-');
      const inferredLevel =
        segments.length <= 1
          ? 1
          : Math.max(
              1,
              Math.min(
                SAFETY_BOUNDS.MAX_ACCOUNT_LEVEL,
                segments.filter((seg) => !/^0+$/.test(seg)).length
              )
            );
      const level =
        r.level !== undefined && Number.isInteger(r.level) && r.level >= 1 && r.level <= SAFETY_BOUNDS.MAX_ACCOUNT_LEVEL
          ? r.level
          : inferredLevel;
      const isAffectable = r.isAffectable !== undefined ? r.isAffectable : level >= 3;
      const satGroupCode = r.satGroupCode || code.slice(0, 3);
      const nextBalCents = toCents(r.initialBalance ?? 0);

      const prev = existingByCode.get(code);
      if (prev && !checkedPeriod1Lock) {
        const diffBal = toCents(prev.initialBalance) !== nextBalCents;
        const diffNat = prev.nature !== inferredNature;
        if ((diffBal || diffNat) && compRow) {
          assertPeriodOpen(companyId, compRow.current_year, 1);
          checkedPeriod1Lock = true;
        }
      }

      upsertAcc.run(
        `${companyId}_${code}`,
        companyId,
        code,
        r.name.trim(),
        r.parentCode ?? null,
        inferredType,
        inferredNature,
        level,
        isAffectable ? 1 : 0,
        satGroupCode,
        fromCents(nextBalCents)
      );

      if (prev) {
        updatedCount += 1;
      } else {
        importedCount += 1;
        existingByCode.set(code, {
          id: `${companyId}_${code}`,
          companyId,
          code,
          name: r.name.trim(),
          parentCode: r.parentCode ?? null,
          type: inferredType,
          nature: inferredNature,
          level,
          isAffectable,
          satGroupCode,
          currency: 'MXN',
          initialBalance: fromCents(nextBalCents)
        });
      }
    }
  });

  tx();
  return { importedCount, updatedCount };
}
