import type { Database } from 'bun:sqlite';
import type { BankLineDbRow } from '../connection';
import { assertAccountingInvariant, fromCents, toCents } from '../../shared/accounting-engine';
import type { BankReconciliationResponse, BankStatementLine } from '../../shared/types';
import { assertPeriodOpen } from './period-locks.repo';

export function isSyntheticBankRef(ref: string | null | undefined): boolean {
  const clean = (ref ?? '').trim().toUpperCase();
  return !clean || clean === 'MOV-BANCO' || /^CSV-\d+$/.test(clean);
}

export function bankLineDedupKey(params: {
  fecha: string;
  referencia?: string | null;
  descripcion?: string | null;
  cargoBanco?: number;
  abonoBanco?: number;
}): string {
  const fecha = params.fecha.slice(0, 10);
  const normDesc = (params.descripcion ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const cargo = fromCents(toCents(params.cargoBanco)).toFixed(2);
  const abono = fromCents(toCents(params.abonoBanco)).toFixed(2);
  const refPart = isSyntheticBankRef(params.referencia)
    ? '__SYNTHETIC__'
    : (params.referencia ?? '').trim().toUpperCase();
  return `${fecha}|${refPart}|${normDesc}|${cargo}|${abono}`;
}

export function isCompatibleBankMovementSign(params: {
  cargoBanco: number;
  abonoBanco: number;
  cargoContable: number;
  abonoContable: number;
}): { compatible: boolean; direction: 'DEPOSIT' | 'WITHDRAWAL' | null; bankAmountCents: number; bookAmountCents: number } {
  const bankCargoCents = toCents(params.cargoBanco);
  const bankAbonoCents = toCents(params.abonoBanco);
  const bookCargoCents = toCents(params.cargoContable);
  const bookAbonoCents = toCents(params.abonoContable);

  if (bankAbonoCents > 0 && bankCargoCents === 0) {
    return {
      compatible: bookCargoCents > 0 && bookAbonoCents === 0,
      direction: 'DEPOSIT',
      bankAmountCents: bankAbonoCents,
      bookAmountCents: bookCargoCents
    };
  }
  if (bankCargoCents > 0 && bankAbonoCents === 0) {
    return {
      compatible: bookAbonoCents > 0 && bookCargoCents === 0,
      direction: 'WITHDRAWAL',
      bankAmountCents: bankCargoCents,
      bookAmountCents: bookAbonoCents
    };
  }
  return { compatible: false, direction: null, bankAmountCents: 0, bookAmountCents: 0 };
}

export function collectAllMatchedMovementIdsSqlite(database: Database, companyId: string): Set<string> {
  const matched = new Set<string>();
  const directRows = database
    .query(
      'SELECT matched_movement_id as mid FROM bank_statement_lines WHERE company_id = ? AND matched_movement_id IS NOT NULL'
    )
    .all(companyId) as Array<{ mid: string }>;
  for (const r of directRows) {
    if (r.mid) matched.add(r.mid);
  }

  const n1Rows = database
    .query(`
      SELECT m.movement_id as mid
      FROM bank_statement_matches m
      INNER JOIN bank_statement_lines b ON b.id = m.bank_line_id
      WHERE m.company_id = ? AND b.matched_movement_id IS NOT NULL
    `)
    .all(companyId) as Array<{ mid: string }>;
  for (const r of n1Rows) {
    if (r.mid) matched.add(r.mid);
  }
  return matched;
}

export interface SqliteBookRow {
  movement_id: string;
  poliza_id: string;
  poliza_folio: string;
  fecha: string;
  ejercicio: number;
  periodo: number;
  referencia: string;
  concepto: string;
  cargo: number;
  abono: number;
}

export function buildSqliteReconRows(params: {
  allMappedLines: BankStatementLine[];
  bookRows: readonly SqliteBookRow[];
  matchedMovementIds: ReadonlySet<string>;
  n1MovsByLineId: ReadonlyMap<string, string[]>;
  ejercicio: number;
  periodo: number;
}): {
  statementLines: BankStatementLine[];
  bookMovements: BankReconciliationResponse['bookMovements'];
} {
  const { allMappedLines, bookRows, matchedMovementIds, n1MovsByLineId, ejercicio, periodo } = params;
  const isCurrent = (y: number, p: number) => y === ejercicio && p === periodo;
  const currentPeriodMovIds = new Set(
    bookRows.filter((b) => isCurrent(Number(b.ejercicio), Number(b.periodo))).map((b) => b.movement_id)
  );

  const statementLines = allMappedLines.filter(
    (l) =>
      isCurrent(l.ejercicio, l.periodo) ||
      !l.matchedMovementId ||
      currentPeriodMovIds.has(l.matchedMovementId) ||
      (n1MovsByLineId.get(l.id) ?? []).some((mid) => currentPeriodMovIds.has(mid))
  );

  const matchedInCurrentLineMovIds = new Set<string>();
  for (const l of statementLines) {
    if (!isCurrent(l.ejercicio, l.periodo) || !l.matchedMovementId) continue;
    matchedInCurrentLineMovIds.add(l.matchedMovementId);
    for (const mid of n1MovsByLineId.get(l.id) ?? []) matchedInCurrentLineMovIds.add(mid);
  }

  const bookMovements: BankReconciliationResponse['bookMovements'] = [];
  for (const b of bookRows) {
    const inCurrent = isCurrent(Number(b.ejercicio), Number(b.periodo));
    const isMatched = matchedMovementIds.has(b.movement_id);
    if (!inCurrent && isMatched && !matchedInCurrentLineMovIds.has(b.movement_id)) continue;
    bookMovements.push({
      movementId: b.movement_id,
      polizaId: b.poliza_id,
      polizaFolio: b.poliza_folio,
      fecha: b.fecha,
      referencia: b.referencia,
      concepto: b.concepto,
      cargoContable: Number(b.cargo),
      abonoContable: Number(b.abono),
      isMatched
    });
  }
  return { statementLines, bookMovements };
}

export function executeManualBankMatchSqlite(
  database: Database,
  lineId: string,
  movementId: string
): { companyId: string; accountId: string; lineYear: number; linePeriod: number } {
  const bLine = database.query('SELECT * FROM bank_statement_lines WHERE id = ?').get(lineId) as BankLineDbRow | null;
  assertAccountingInvariant(bLine !== null, 'BANK_LINE_NOT_FOUND', 'Movimiento bancario no encontrado.');
  assertAccountingInvariant(!bLine.matched_movement_id, 'ALREADY_MATCHED', 'La línea bancaria ya está conciliada.');

  const lineYear = Number(bLine.ejercicio);
  const linePeriod = Number(bLine.periodo);
  assertPeriodOpen(bLine.company_id, lineYear, linePeriod);

  const globallyMatchedIds = collectAllMatchedMovementIdsSqlite(database, bLine.company_id);
  assertAccountingInvariant(
    !globallyMatchedIds.has(movementId),
    'MOVEMENT_ALREADY_MATCHED',
    'Este movimiento contable ya está conciliado con otra línea bancaria.'
  );

  const movRow = database
    .query(`
      SELECT m.id, m.account_id, m.cargo, m.abono, p.company_id
      FROM poliza_movements m
      INNER JOIN polizas p ON p.id = m.poliza_id
      WHERE m.id = ?
    `)
    .get(movementId) as { id: string; account_id: string; cargo: number; abono: number; company_id: string } | null;

  assertAccountingInvariant(
    movRow !== null && movRow.company_id === bLine.company_id,
    'MOVEMENT_NOT_FOUND',
    'El movimiento contable no existe o no pertenece a la empresa activa.'
  );
  assertAccountingInvariant(
    movRow.account_id === bLine.account_id,
    'BANK_ACCOUNT_MISMATCH',
    'El movimiento contable no pertenece a la cuenta bancaria seleccionada.'
  );

  const signCheck = isCompatibleBankMovementSign({
    cargoBanco: Number(bLine.cargo_banco),
    abonoBanco: Number(bLine.abono_banco),
    cargoContable: Number(movRow.cargo),
    abonoContable: Number(movRow.abono)
  });
  assertAccountingInvariant(
    signCheck.compatible,
    'INCOMPATIBLE_BANK_SIGN',
    'El signo del movimiento contable no corresponde con el cargo/abono bancario.'
  );
  assertAccountingInvariant(
    Math.abs(signCheck.bankAmountCents - signCheck.bookAmountCents) <= 5,
    'BANK_AMOUNT_MISMATCH',
    'El importe bancario y el movimiento contable deben coincidir (tolerancia ±$0.05).'
  );

  database
    .prepare('UPDATE bank_statement_lines SET matched_movement_id = ? WHERE id = ? AND matched_movement_id IS NULL')
    .run(movementId, lineId);

  return { companyId: bLine.company_id, accountId: bLine.account_id, lineYear, linePeriod };
}

export function ensureBankClosuresTable(database: Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS bank_reconciliation_closures (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL,
      ejercicio INTEGER NOT NULL,
      periodo INTEGER NOT NULL,
      saldo_banco_cierre REAL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(company_id, account_id, ejercicio, periodo)
    );
  `);
}

export function getBankClosureBalanceSqlite(
  database: Database,
  companyId: string,
  accountId: string,
  ejercicio: number,
  periodo: number
): number | null {
  ensureBankClosuresTable(database);
  const row = database
    .query(
      'SELECT saldo_banco_cierre FROM bank_reconciliation_closures WHERE company_id = ? AND account_id = ? AND ejercicio = ? AND periodo = ?'
    )
    .get(companyId, accountId, ejercicio, periodo) as { saldo_banco_cierre: number | null } | null;
  if (!row || row.saldo_banco_cierre == null) return null;
  const n = Number(row.saldo_banco_cierre);
  return Number.isFinite(n) ? n : null;
}

export function upsertBankClosureBalanceSqlite(
  database: Database,
  companyId: string,
  accountId: string,
  ejercicio: number,
  periodo: number,
  saldoBancoCierre: number | null
): void {
  ensureBankClosuresTable(database);
  assertPeriodOpen(companyId, ejercicio, periodo);
  if (saldoBancoCierre === null) {
    database
      .prepare(
        'DELETE FROM bank_reconciliation_closures WHERE company_id = ? AND account_id = ? AND ejercicio = ? AND periodo = ?'
      )
      .run(companyId, accountId, ejercicio, periodo);
    return;
  }
  database
    .prepare(`
      INSERT INTO bank_reconciliation_closures (
        id, company_id, account_id, ejercicio, periodo, saldo_banco_cierre, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(company_id, account_id, ejercicio, periodo) DO UPDATE SET
        saldo_banco_cierre = excluded.saldo_banco_cierre,
        updated_at = excluded.updated_at
    `)
    .run(
      `bclose_${companyId}_${accountId}_${ejercicio}_${periodo}`,
      companyId,
      accountId,
      ejercicio,
      periodo,
      saldoBancoCierre,
      new Date().toISOString()
    );
}
