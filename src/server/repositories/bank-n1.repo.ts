import type { Database } from 'bun:sqlite';
import { db } from '../connection';
import { fromCents, toCents } from '../../shared/accounting-engine';
import { findManyToOneBankMatches } from '../../shared/engine/bank-n1-matcher';
import type {
  BankN1ApplyItem,
  BankN1ApplyResponse,
  BankN1MatchProposal,
  BankN1MatchRecord,
  BankN1ProposeResponse
} from '../../shared/types/bank-n1.types';
import { getBankReconciliation } from './bank.repo';
import { getCompanyById } from './companies.repo';
import { assertPeriodOpen } from './period-locks.repo';

interface BankN1MatchDbRow {
  id: string;
  company_id: string;
  bank_line_id: string;
  movement_id: string;
  poliza_id: string;
  matched_amount: number;
  created_at: string;
}

function mapMatchRow(r: BankN1MatchDbRow): BankN1MatchRecord {
  return {
    id: r.id,
    companyId: r.company_id,
    bankLineId: r.bank_line_id,
    movementId: r.movement_id,
    polizaId: r.poliza_id,
    matchedAmount: Number(r.matched_amount),
    createdAt: r.created_at
  };
}

export function ensureBankN1MatchesTable(database: Database = db): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS bank_statement_matches (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      bank_line_id TEXT NOT NULL REFERENCES bank_statement_lines(id) ON DELETE CASCADE,
      movement_id TEXT NOT NULL,
      poliza_id TEXT NOT NULL,
      matched_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_statement_matches_pair
      ON bank_statement_matches(bank_line_id, movement_id);
    CREATE INDEX IF NOT EXISTS idx_bank_statement_matches_company
      ON bank_statement_matches(company_id, bank_line_id);
  `);
}

export function listBankN1MatchesRepo(companyId: string, bankLineId?: string): BankN1MatchRecord[] {
  ensureBankN1MatchesTable(db);
  const sql = bankLineId
    ? 'SELECT * FROM bank_statement_matches WHERE company_id = ? AND bank_line_id = ? ORDER BY created_at DESC, id ASC'
    : 'SELECT * FROM bank_statement_matches WHERE company_id = ? ORDER BY created_at DESC, id ASC';
  const rows = (bankLineId ? db.query(sql).all(companyId, bankLineId) : db.query(sql).all(companyId)) as BankN1MatchDbRow[];
  return rows.map(mapMatchRow);
}

export function proposeManyToOneMatchesRepo(
  companyId: string,
  accountId: string,
  year?: number,
  period?: number,
  maxGroupSize = 5,
  toleranceCents = 5
): BankN1ProposeResponse | null {
  ensureBankN1MatchesTable(db);
  const company = getCompanyById(companyId);
  if (!company) return null;

  const effectiveYear = year || company.currentYear;
  const effectivePeriod = period || company.currentPeriod;
  const recon = getBankReconciliation(companyId, accountId, effectiveYear, effectivePeriod);
  if (!recon) return null;

  const activeRows = db
    .query(`
      SELECT m.*
      FROM bank_statement_matches m
      INNER JOIN bank_statement_lines b ON b.id = m.bank_line_id
      WHERE m.company_id = ? AND b.matched_movement_id IS NOT NULL
    `)
    .all(companyId) as BankN1MatchDbRow[];

  const matches = listBankN1MatchesRepo(companyId);
  const matchedLineMap = new Map<string, string>();
  const matchedMovSet = new Set<string>();
  for (const r of activeRows) {
    if (!matchedLineMap.has(r.bank_line_id)) {
      matchedLineMap.set(r.bank_line_id, r.movement_id);
    }
    matchedMovSet.add(r.movement_id);
  }

  const statementLines = recon.statementLines.map((l) => ({
    ...l,
    matchedMovementId: l.matchedMovementId ?? matchedLineMap.get(l.id) ?? null
  }));
  const bookMovements = recon.bookMovements.map((bm) => ({
    ...bm,
    isMatched: bm.isMatched || matchedMovSet.has(bm.movementId)
  }));

  const proposals = findManyToOneBankMatches(
    statementLines,
    bookMovements,
    maxGroupSize,
    toleranceCents
  );

  return { proposals, matches };
}

export function applyManyToOneMatchesRepo(
  companyId: string,
  accountId: string,
  items: ReadonlyArray<BankN1ApplyItem | BankN1MatchProposal>,
  year?: number,
  period?: number
): BankN1ApplyResponse | null {
  ensureBankN1MatchesTable(db);
  const company = getCompanyById(companyId);
  if (!company) return null;

  const effectiveYear = year || company.currentYear;
  const effectivePeriod = period || company.currentPeriod;
  assertPeriodOpen(companyId, effectiveYear, effectivePeriod);

  const selectLineStmt = db.prepare(
    'SELECT id, matched_movement_id FROM bank_statement_lines WHERE id = ? AND company_id = ?'
  );
  const selectMovStmt = db.prepare(`
    SELECT m.id as movement_id, m.poliza_id, m.cargo, m.abono
    FROM poliza_movements m
    INNER JOIN polizas p ON p.id = m.poliza_id
    WHERE m.id = ? AND p.company_id = ?
  `);
  const insertMatchStmt = db.prepare(`
    INSERT OR IGNORE INTO bank_statement_matches (
      id, company_id, bank_line_id, movement_id, poliza_id, matched_amount
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const updateLineStmt = db.prepare(
    'UPDATE bank_statement_lines SET matched_movement_id = ? WHERE id = ? AND company_id = ?'
  );

  const matchedLineIds: string[] = [];

  const tx = db.transaction(() => {
    for (const item of items) {
      const movementIds =
        'movementIds' in item ? item.movementIds : item.movements.map((m) => m.movementId);
      const uniqueIds = [...new Set(movementIds.filter(Boolean))];
      if (uniqueIds.length < 2) continue;

      const lineRow = selectLineStmt.get(item.bankLineId, companyId) as {
        id: string;
        matched_movement_id: string | null;
      } | null;
      if (!lineRow || lineRow.matched_movement_id) continue;

      const resolvedMovs: Array<{ movementId: string; polizaId: string; amount: number }> = [];
      for (const movId of uniqueIds) {
        const movRow = selectMovStmt.get(movId, companyId) as {
          movement_id: string;
          poliza_id: string;
          cargo: number;
          abono: number;
        } | null;
        if (!movRow) continue;
        const cents = toCents(movRow.cargo) > 0 ? toCents(movRow.cargo) : toCents(movRow.abono);
        if (cents <= 0) continue;
        resolvedMovs.push({
          movementId: movRow.movement_id,
          polizaId: movRow.poliza_id,
          amount: fromCents(cents)
        });
      }

      if (resolvedMovs.length < 2) continue;

      for (const mov of resolvedMovs) {
        insertMatchStmt.run(
          `bsm_${crypto.randomUUID().slice(0, 12)}`,
          companyId,
          item.bankLineId,
          mov.movementId,
          mov.polizaId,
          mov.amount
        );
      }
      updateLineStmt.run(resolvedMovs[0]?.movementId ?? null, item.bankLineId, companyId);
      matchedLineIds.push(item.bankLineId);
    }
  });

  tx();

  return {
    appliedCount: matchedLineIds.length,
    matchedLineIds,
    matches: listBankN1MatchesRepo(companyId),
    reconciliation: getBankReconciliation(companyId, accountId, effectiveYear, effectivePeriod)
  };
}
