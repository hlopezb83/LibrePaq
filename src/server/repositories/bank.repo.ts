import { db, type BankLineDbRow } from '../connection';
import {
  fromCents,
  sumCents,
  toCents
} from '../../shared/accounting-engine';
import { findBankReconciliationMatches } from '../../shared/engine/bank-and-closing.engine';
import { SAFETY_BOUNDS } from '../../shared/sat-constants';
import { getDefaultDateForPeriod } from '../../shared/date-utils';
import type {
  BankReconciliationResponse,
  BankStatementLine,
  Company
} from '../../shared/types';
import { computeTrialBalance } from './trial-balance.repo';
import { getCompanyById } from './companies.repo';
import { assertPeriodOpen } from './period-locks.repo';
import { ensureBankN1MatchesTable } from './bank-n1.repo';
import {
  bankLineDedupKey,
  buildSqliteReconRows,
  collectAllMatchedMovementIdsSqlite,
  executeManualBankMatchSqlite,
  type SqliteBookRow
} from './bank-reconciliation-helpers';

export function getBankReconciliation(
  companyId: string,
  accountId: string,
  ejercicio: number,
  periodo: number
): BankReconciliationResponse | null {
  const trialBalance = computeTrialBalance(companyId, ejercicio, periodo);
  const account = trialBalance.find((a) => a.id === accountId);
  if (!account) return null;

  ensureBankN1MatchesTable(db);

  const statementRows = db
    .query(`
      SELECT b.*, (p.tipo || ' #' || p.folio) as matched_poliza_folio
      FROM bank_statement_lines b
      LEFT JOIN poliza_movements m ON b.matched_movement_id = m.id
      LEFT JOIN polizas p ON m.poliza_id = p.id
      WHERE b.company_id = ? AND b.account_id = ?
        AND (b.ejercicio < ? OR (b.ejercicio = ? AND b.periodo <= ?))
      ORDER BY b.fecha ASC, b.id ASC
    `)
    .all(companyId, accountId, ejercicio, ejercicio, periodo) as BankLineDbRow[];

  const allMappedLines: BankStatementLine[] = statementRows.map((r) => ({
    id: r.id,
    companyId: r.company_id,
    accountId: r.account_id,
    fecha: r.fecha,
    ejercicio: Number(r.ejercicio),
    periodo: Number(r.periodo),
    referencia: r.referencia,
    descripcion: r.descripcion,
    cargoBanco: Number(r.cargo_banco),
    abonoBanco: Number(r.abono_banco),
    matchedMovementId: r.matched_movement_id || null,
    matchedPolizaFolio: r.matched_poliza_folio || null
  }));

  const n1Rows = db
    .query(`
      SELECT m.bank_line_id, m.movement_id
      FROM bank_statement_matches m
      INNER JOIN bank_statement_lines b ON b.id = m.bank_line_id
      WHERE m.company_id = ? AND b.account_id = ? AND b.matched_movement_id IS NOT NULL
        AND (b.ejercicio < ? OR (b.ejercicio = ? AND b.periodo <= ?))
    `)
    .all(companyId, accountId, ejercicio, ejercicio, periodo) as Array<{
    bank_line_id: string;
    movement_id: string;
  }>;

  const matchedMovementIds = new Set<string>(
    allMappedLines.map((s) => s.matchedMovementId).filter((v): v is string => Boolean(v))
  );
  const n1MovsByLineId = new Map<string, string[]>();
  for (const r of n1Rows) {
    matchedMovementIds.add(r.movement_id);
    const list = n1MovsByLineId.get(r.bank_line_id) ?? [];
    list.push(r.movement_id);
    n1MovsByLineId.set(r.bank_line_id, list);
  }

  const bookRows = db
    .query(`
      SELECT m.id as movement_id, m.poliza_id, (p.tipo || ' #' || p.folio) as poliza_folio,
             p.fecha, p.ejercicio, p.periodo, m.referencia, m.concepto, m.cargo, m.abono
      FROM poliza_movements m
      INNER JOIN polizas p ON m.poliza_id = p.id
      WHERE p.company_id = ? AND m.account_id = ?
        AND (p.ejercicio < ? OR (p.ejercicio = ? AND p.periodo <= ?))
      ORDER BY p.fecha ASC, p.folio ASC
    `)
    .all(companyId, accountId, ejercicio, ejercicio, periodo) as SqliteBookRow[];

  const { statementLines, bookMovements } = buildSqliteReconRows({
    allMappedLines,
    bookRows,
    matchedMovementIds,
    n1MovsByLineId,
    ejercicio,
    periodo
  });

  const totalDepositosBanco = fromCents(sumCents(statementLines.map((l) => l.abonoBanco)));
  const totalRetirosBanco = fromCents(sumCents(statementLines.map((l) => l.cargoBanco)));

  return {
    account,
    ejercicio,
    periodo,
    statementLines,
    bookMovements,
    summary: {
      saldoInicialLibros: account.initialBalanceComputed,
      saldoFinalLibros: account.finalBalance,
      totalDepositosBanco,
      totalRetirosBanco,
      movimientosConciliados: statementLines.filter((s) => s.matchedMovementId).length,
      movimientosPendientesBanco: statementLines.filter((s) => !s.matchedMovementId).length,
      movimientosPendientesLibros: bookMovements.filter((b) => !b.isMatched).length
    }
  };
}

let _insertBankLineStmt: ReturnType<typeof db.prepare> | null = null;
const insertBankLineStmt = {
  run: (...args: unknown[]) => {
    if (!_insertBankLineStmt) {
      _insertBankLineStmt = db.prepare(`
        INSERT INTO bank_statement_lines (
          id, company_id, account_id, fecha, ejercicio, periodo, referencia, descripcion, cargo_banco, abono_banco, matched_movement_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `);
    }
    return (_insertBankLineStmt as { run: (...a: unknown[]) => unknown }).run(...args);
  }
};

export function addBankStatementLinesTransaction(
  company: Company,
  accountId: string,
  lines: ReadonlyArray<{
    fecha?: string;
    referencia?: string;
    descripcion?: string;
    cargoBanco?: number;
    abonoBanco?: number;
  }>
): BankReconciliationResponse | null {
  const defaultDate = getDefaultDateForPeriod(company.currentYear, company.currentPeriod);
  const bound = Math.min(lines.length, SAFETY_BOUNDS.MAX_CSV_ROWS);

  const periodPairs = new Set<string>();
  for (let i = 0; i < bound; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const lFecha = line.fecha || defaultDate;
    const lYear = parseInt(lFecha.slice(0, 4), 10) || company.currentYear;
    const lPeriod = parseInt(lFecha.slice(5, 7), 10) || company.currentPeriod;
    periodPairs.add(`${lYear}:${lPeriod}`);
  }
  if (periodPairs.size === 0) {
    assertPeriodOpen(company.id, company.currentYear, company.currentPeriod);
  } else {
    for (const pair of periodPairs) {
      const [y, p] = pair.split(':').map((v) => parseInt(v, 10));
      if (y && p) assertPeriodOpen(company.id, y, p);
    }
  }

  const tx = db.transaction(() => {
    const existingRows = db
      .query(
        'SELECT fecha, referencia, descripcion, cargo_banco, abono_banco FROM bank_statement_lines WHERE company_id = ? AND account_id = ?'
      )
      .all(company.id, accountId) as Array<{
      fecha: string;
      referencia: string;
      descripcion: string;
      cargo_banco: number;
      abono_banco: number;
    }>;

    const existingCounts = new Map<string, number>();
    for (const row of existingRows) {
      const key = bankLineDedupKey({
        fecha: row.fecha,
        referencia: row.referencia,
        descripcion: row.descripcion,
        cargoBanco: row.cargo_banco,
        abonoBanco: row.abono_banco
      });
      existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
    }

    for (let i = 0; i < bound; i += 1) {
      const line = lines[i];
      if (!line) continue;
      const lFecha = line.fecha || defaultDate;
      const lYear = parseInt(lFecha.slice(0, 4), 10) || company.currentYear;
      const lPeriod = parseInt(lFecha.slice(5, 7), 10) || company.currentPeriod;
      const ref = line.referencia || 'MOV-BANCO';
      const desc = line.descripcion || 'Movimiento en estado de cuenta bancario';
      const cargo = fromCents(toCents(line.cargoBanco));
      const abono = fromCents(toCents(line.abonoBanco));

      const sigKey = bankLineDedupKey({
        fecha: lFecha,
        referencia: ref,
        descripcion: desc,
        cargoBanco: cargo,
        abonoBanco: abono
      });
      const remaining = existingCounts.get(sigKey) ?? 0;
      if (remaining > 0) {
        existingCounts.set(sigKey, remaining - 1);
        continue;
      }

      const id = `bsl_${crypto.randomUUID().slice(0, 8)}`;
      insertBankLineStmt.run(id, company.id, accountId, lFecha, lYear, lPeriod, ref, desc, cargo, abono);
    }
  });

  tx();
  return getBankReconciliation(company.id, accountId, company.currentYear, company.currentPeriod);
}

export function autoMatchBankLinesTransaction(
  company: Company,
  accountId: string,
  year?: number,
  period?: number
): { matchedCount: number; reconciliation: BankReconciliationResponse | null } | null {
  const effectiveYear = year || company.currentYear;
  const effectivePeriod = period || company.currentPeriod;
  assertPeriodOpen(company.id, effectiveYear, effectivePeriod);
  ensureBankN1MatchesTable(db);
  const current = getBankReconciliation(company.id, accountId, effectiveYear, effectivePeriod);
  if (!current) return null;

  const globallyMatchedIds = collectAllMatchedMovementIdsSqlite(db, company.id);
  const bookMovementsWithGlobal = current.bookMovements.map((bm) => ({
    ...bm,
    isMatched: bm.isMatched || globallyMatchedIds.has(bm.movementId)
  }));

  const pairs = findBankReconciliationMatches(current.statementLines, bookMovementsWithGlobal);
  const updateStmt = db.prepare(
    'UPDATE bank_statement_lines SET matched_movement_id = ? WHERE id = ? AND matched_movement_id IS NULL'
  );

  let applied = 0;
  const tx = db.transaction(() => {
    for (const pair of pairs) {
      if (globallyMatchedIds.has(pair.movementId)) continue;
      const res = updateStmt.run(pair.movementId, pair.statementLineId);
      if (res.changes > 0) {
        globallyMatchedIds.add(pair.movementId);
        applied += 1;
      }
    }
  });

  tx();
  return {
    matchedCount: applied,
    reconciliation: getBankReconciliation(company.id, accountId, effectiveYear, effectivePeriod)
  };
}

export function manualMatchBankLineTransaction(
  lineId: string,
  movementId: string
): { matched: boolean; reconciliation: BankReconciliationResponse | null } {
  ensureBankN1MatchesTable(db);
  const { companyId, accountId, lineYear, linePeriod } = executeManualBankMatchSqlite(
    db,
    lineId,
    movementId
  );
  return {
    matched: true,
    reconciliation: getBankReconciliation(companyId, accountId, lineYear, linePeriod)
  };
}

export function unmatchBankLineTransaction(lineId: string): {
  found: boolean;
  reconciliation?: BankReconciliationResponse | null;
} {
  const bLine = db.query('SELECT * FROM bank_statement_lines WHERE id = ?').get(lineId) as BankLineDbRow | null;
  if (!bLine) return { found: false };

  assertPeriodOpen(bLine.company_id, Number(bLine.ejercicio), Number(bLine.periodo));
  ensureBankN1MatchesTable(db);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM bank_statement_matches WHERE bank_line_id = ?').run(lineId);
    db.prepare('UPDATE bank_statement_lines SET matched_movement_id = NULL WHERE id = ?').run(lineId);
  });
  tx();
  const company = getCompanyById(bLine.company_id);
  if (!company) return { found: true, reconciliation: null };

  return {
    found: true,
    reconciliation: getBankReconciliation(company.id, bLine.account_id, company.currentYear, company.currentPeriod)
  };
}
