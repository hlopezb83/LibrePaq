import { db, type BankLineDbRow } from '../connection';
import {
  fromCents,
  sumCents,
  toCents
} from '../../shared/accounting-engine';
import { SAFETY_BOUNDS } from '../../shared/sat-catalog';
import { getDefaultDateForPeriod } from '../../shared/date-utils';
import type {
  BankReconciliationResponse,
  BankStatementLine,
  Company
} from '../../shared/types';
import { computeTrialBalance } from './trial-balance.repo';
import { getCompanyById } from './companies.repo';
import { assertPeriodOpen } from './period-locks.repo';

export function getBankReconciliation(
  companyId: string,
  accountId: string,
  ejercicio: number,
  periodo: number
): BankReconciliationResponse | null {
  const trialBalance = computeTrialBalance(companyId, ejercicio, periodo);
  const account = trialBalance.find((a) => a.id === accountId);
  if (!account) return null;

  const statementRows = db
    .query(`
      SELECT b.*, (p.tipo || ' #' || p.folio) as matched_poliza_folio
      FROM bank_statement_lines b
      LEFT JOIN poliza_movements m ON b.matched_movement_id = m.id
      LEFT JOIN polizas p ON m.poliza_id = p.id
      WHERE b.company_id = ? AND b.account_id = ? AND b.ejercicio = ? AND b.periodo = ?
      ORDER BY b.fecha ASC, b.id ASC
    `)
    .all(companyId, accountId, ejercicio, periodo) as BankLineDbRow[];

  const statementLines: BankStatementLine[] = statementRows.map((r) => ({
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

  const matchedMovementIds = new Set(
    statementLines.map((s) => s.matchedMovementId).filter(Boolean)
  );

  const bookRows = db
    .query(`
      SELECT m.id as movement_id, m.poliza_id, (p.tipo || ' #' || p.folio) as poliza_folio,
             p.fecha, m.referencia, m.concepto, m.cargo, m.abono
      FROM poliza_movements m
      INNER JOIN polizas p ON m.poliza_id = p.id
      WHERE p.company_id = ? AND m.account_id = ? AND p.ejercicio = ? AND p.periodo = ?
      ORDER BY p.fecha ASC, p.folio ASC
    `)
    .all(companyId, accountId, ejercicio, periodo) as Array<{
    movement_id: string;
    poliza_id: string;
    poliza_folio: string;
    fecha: string;
    referencia: string;
    concepto: string;
    cargo: number;
    abono: number;
  }>;

  const bookMovements = bookRows.map((b) => ({
    movementId: b.movement_id,
    polizaId: b.poliza_id,
    polizaFolio: b.poliza_folio,
    fecha: b.fecha,
    referencia: b.referencia,
    concepto: b.concepto,
    cargoContable: Number(b.cargo),
    abonoContable: Number(b.abono),
    isMatched: matchedMovementIds.has(b.movement_id)
  }));

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
    return (_insertBankLineStmt as any).run(...args);
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
    const countExistingStmt = db.prepare(`
      SELECT COUNT(*) as count FROM bank_statement_lines
      WHERE company_id = ? AND account_id = ? AND fecha = ? AND referencia = ? AND descripcion = ?
        AND ABS(cargo_banco - ?) < 0.001 AND ABS(abono_banco - ?) < 0.001
    `);

    const batchOccurrenceCount = new Map<string, number>();

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

      const sigKey = `${lFecha}|${ref}|${desc}|${cargo}|${abono}`;
      const curCount = (batchOccurrenceCount.get(sigKey) || 0) + 1;
      batchOccurrenceCount.set(sigKey, curCount);

      const existingRow = countExistingStmt.get(
        company.id,
        accountId,
        lFecha,
        ref,
        desc,
        cargo,
        abono
      ) as { count: number } | null;
      const existingInDb = existingRow?.count ?? 0;

      if (curCount <= existingInDb) continue;

      const id = `bsl_${crypto.randomUUID().slice(0, 8)}`;
      insertBankLineStmt.run(
        id,
        company.id,
        accountId,
        lFecha,
        lYear,
        lPeriod,
        ref,
        desc,
        cargo,
        abono
      );
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
  const current = getBankReconciliation(
    company.id,
    accountId,
    effectiveYear,
    effectivePeriod
  );
  if (!current) return null;

  const unmatchedBank = current.statementLines.filter((s) => !s.matchedMovementId);
  const unmatchedBooks = [...current.bookMovements.filter((b) => !b.isMatched)];

  let matchedCount = 0;
  const updateStmt = db.prepare(
    'UPDATE bank_statement_lines SET matched_movement_id = ? WHERE id = ?'
  );

  const tx = db.transaction(() => {
    for (const bLine of unmatchedBank) {
      const matchIdx = unmatchedBooks.findIndex(
        (bm) =>
          toCents(bm.cargoContable) === toCents(bLine.abonoBanco) &&
          toCents(bm.abonoContable) === toCents(bLine.cargoBanco)
      );
      if (matchIdx !== -1) {
        const matchedBook = unmatchedBooks[matchIdx];
        if (matchedBook) {
          updateStmt.run(matchedBook.movementId, bLine.id);
          unmatchedBooks.splice(matchIdx, 1);
          matchedCount += 1;
        }
      }
    }
  });

  tx();

  return {
    matchedCount,
    reconciliation: getBankReconciliation(
      company.id,
      accountId,
      effectiveYear,
      effectivePeriod
    )
  };
}

export function unmatchBankLineTransaction(lineId: string): {
  found: boolean;
  reconciliation?: BankReconciliationResponse | null;
} {
  const bLine = db
    .query('SELECT * FROM bank_statement_lines WHERE id = ?')
    .get(lineId) as BankLineDbRow | null;
  if (!bLine) return { found: false };

  assertPeriodOpen(bLine.company_id, Number(bLine.ejercicio), Number(bLine.periodo));
  db.prepare('UPDATE bank_statement_lines SET matched_movement_id = NULL WHERE id = ?').run(lineId);
  const company = getCompanyById(bLine.company_id);
  if (!company) return { found: true, reconciliation: null };

  return {
    found: true,
    reconciliation: getBankReconciliation(
      company.id,
      bLine.account_id,
      company.currentYear,
      company.currentPeriod
    )
  };
}
