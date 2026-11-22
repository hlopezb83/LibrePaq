import { db, mapAccountRow, type AccountDbRow } from '../connection';
import { seedAccountsForCompanyOnDb } from '../seed-data';
import { assertPeriodOpen } from './period-locks.repo';
import {
  assertAccountingInvariant,
  fromCents,
  toCents,
  validateAccountHierarchy
} from '../../shared/accounting-engine';
import { SAFETY_BOUNDS } from '../../shared/sat-catalog';
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

export function deleteAccountRecord(id: string): { deleted: boolean; hasMovements: boolean } {
  const hasMovs = db
    .query('SELECT COUNT(*) as c FROM poliza_movements WHERE account_id = ?')
    .get(id) as { c: number } | null;
  if (hasMovs && hasMovs.c > 0) {
    return { deleted: false, hasMovements: true };
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
      sat_group_code = excluded.sat_group_code,
      initial_balance = excluded.initial_balance
  `);

  const existingCodes = new Set(getAccounts(companyId).map((a) => a.code));

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
      const level = code.endsWith('-00-000') ? 1 : code.endsWith('-000') ? 2 : 3;
      const isAffectable = r.isAffectable !== undefined ? r.isAffectable : level >= 3;
      const satGroupCode = r.satGroupCode || code.slice(0, 3);

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
        fromCents(toCents(r.initialBalance ?? 0))
      );

      if (existingCodes.has(code)) {
        updatedCount += 1;
      } else {
        importedCount += 1;
        existingCodes.add(code);
      }
    }
  });

  tx();
  return { importedCount, updatedCount };
}
