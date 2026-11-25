import type { SQLQueryBindings } from 'bun:sqlite';
import { db, type PolizaDbRow } from '../connection';
import {
  assertAccountingInvariant,
  fromCents,
  toCents,
  validateDoubleEntryMovements
} from '../../shared/accounting-engine';
import { resolvePolizaYearPeriod } from '../../shared/date-utils';
import type { Poliza, PolizaType } from '../../shared/types';
import { getAccounts } from './accounts.repo';
import { ensureBankN1MatchesTable } from './bank-n1.repo';
import { assertPeriodOpen } from './period-locks.repo';
import {
  collectPolizaCfdiUuidsRepo,
  getPolizaById,
  reconcileRemovedPolizaCfdisTx,
  syncPolizaCfdisTx
} from './polizas.repo';

function clearBankMatchesForPolizaTx(polizaId: string): void {
  ensureBankN1MatchesTable(db);
  const movRows = db
    .prepare('SELECT id FROM poliza_movements WHERE poliza_id = ?')
    .all(polizaId) as Array<{ id: string }>;
  const movIds = movRows.map((r) => r.id);

  const affectedLineIds = new Set<string>();
  const byPolRows = db
    .prepare('SELECT bank_line_id FROM bank_statement_matches WHERE poliza_id = ?')
    .all(polizaId) as Array<{ bank_line_id: string }>;
  for (const r of byPolRows) affectedLineIds.add(r.bank_line_id);

  if (movIds.length > 0) {
    const placeholders = movIds.map(() => '?').join(',');
    const byMovRows = db
      .prepare(`SELECT bank_line_id FROM bank_statement_matches WHERE movement_id IN (${placeholders})`)
      .all(...movIds) as Array<{ bank_line_id: string }>;
    for (const r of byMovRows) affectedLineIds.add(r.bank_line_id);

    db.prepare(
      `UPDATE bank_statement_lines SET matched_movement_id = NULL WHERE matched_movement_id IN (${placeholders})`
    ).run(...movIds);
    db.prepare(`DELETE FROM bank_statement_matches WHERE movement_id IN (${placeholders})`).run(
      ...movIds
    );
  }

  const lineIds = Array.from(affectedLineIds);
  if (lineIds.length > 0) {
    const linePlaceholders = lineIds.map(() => '?').join(',');
    db.prepare(
      `UPDATE bank_statement_lines SET matched_movement_id = NULL WHERE id IN (${linePlaceholders})`
    ).run(...lineIds);
    db.prepare(`DELETE FROM bank_statement_matches WHERE bank_line_id IN (${linePlaceholders})`).run(
      ...lineIds
    );
  }

  db.prepare('DELETE FROM bank_statement_matches WHERE poliza_id = ?').run(polizaId);
}

// NASA Power of 10 - Regla 3 (H-14): Sentencias SQL preparadas de forma perezosa
let _insertPolizaStmt: ReturnType<typeof db.prepare> | null = null;
export const insertPolizaStmt = {
  run: (...args: SQLQueryBindings[]) => {
    if (!_insertPolizaStmt) {
      _insertPolizaStmt = db.prepare(`
        INSERT INTO polizas (id, company_id, tipo, folio, fecha, ejercicio, periodo, concepto, cfdi_uuid, origin, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
    }
    return _insertPolizaStmt.run(...args);
  }
};

let _insertMovementStmt: ReturnType<typeof db.prepare> | null = null;
export const insertMovementStmt = {
  run: (...args: SQLQueryBindings[]) => {
    if (!_insertMovementStmt) {
      _insertMovementStmt = db.prepare(`
        INSERT INTO poliza_movements (
          id, poliza_id, account_id, account_code, account_name, referencia, concepto, cargo, abono, cfdi_uuid,
          payment_method_sat, bank_code_ori, account_ori, bank_code_dest, account_dest,
          beneficiary_name, beneficiary_rfc, cheque_num, business_segment_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
    }
    const padded = args.length >= 19 ? args.slice(0, 19) : [...args, ...Array(19 - args.length).fill(null)];
    return _insertMovementStmt.run(...padded);
  }
};

let _maxFolioQuery: ReturnType<typeof db.prepare> | null = null;
export const maxFolioQuery = {
  get: (...args: SQLQueryBindings[]) => {
    if (!_maxFolioQuery) {
      _maxFolioQuery = db.prepare(`
        SELECT COALESCE(MAX(folio), 0) as max_folio
        FROM polizas
        WHERE company_id = ? AND tipo = ? AND ejercicio = ? AND periodo = ?
      `);
    }
    return _maxFolioQuery.get(...args);
  }
};

export interface PolizaMovementWriteInput {
  accountId: string;
  referencia?: string;
  concepto?: string;
  cargo: number;
  abono: number;
  cfdiUuid?: string | null;
  paymentMethodSat?: string | null;
  bankCodeOri?: string | null;
  accountOri?: string | null;
  bankCodeDest?: string | null;
  accountDest?: string | null;
  beneficiaryName?: string | null;
  beneficiaryRfc?: string | null;
  chequeNum?: string | null;
  businessSegmentId?: string | null;
}

function insertMovementRow(
  movId: string,
  polizaId: string,
  acc: { id: string; code: string; name: string },
  m: PolizaMovementWriteInput,
  fallbackRef: string,
  fallbackConcepto: string,
  movUuid: string | null
): void {
  insertMovementStmt.run(
    movId, polizaId, acc.id, acc.code, acc.name,
    m.referencia || fallbackRef, m.concepto || fallbackConcepto,
    fromCents(toCents(m.cargo)), fromCents(toCents(m.abono)), movUuid,
    m.paymentMethodSat ?? null, m.bankCodeOri ?? null, m.accountOri ?? null,
    m.bankCodeDest ?? null, m.accountDest ?? null, m.beneficiaryName ?? null,
    m.beneficiaryRfc ?? null, m.chequeNum ?? null, m.businessSegmentId ?? null
  );
}

export function createPolizaTransaction(input: {
  companyId: string;
  ejercicio: number;
  periodo: number;
  tipo: PolizaType;
  fecha: string;
  concepto: string;
  cfdiUuid: string | null;
  cfdiUuids?: string[];
  origin: 'MANUAL' | 'ADD_AUTO';
  movements: ReadonlyArray<PolizaMovementWriteInput>;
}): Poliza {
  assertPeriodOpen(input.companyId, input.ejercicio, input.periodo);

  const accounts = getAccounts(input.companyId);
  const accById = new Map(accounts.map((a) => [a.id, a]));
  validateDoubleEntryMovements(input.movements, accById);

  const allUuids = collectPolizaCfdiUuidsRepo(input.cfdiUuid, input.cfdiUuids, input.movements);
  const primaryUuid = input.cfdiUuid?.trim().toUpperCase() || allUuids[0] || null;
  const maxRow = maxFolioQuery.get(
    input.companyId,
    input.tipo,
    input.ejercicio,
    input.periodo
  ) as { max_folio: number } | null;
  const nextFolio = (maxRow?.max_folio ?? 0) + 1;
  const polizaId = `pol_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    insertPolizaStmt.run(
      polizaId,
      input.companyId,
      input.tipo,
      nextFolio,
      input.fecha,
      input.ejercicio,
      input.periodo,
      input.concepto,
      primaryUuid,
      input.origin,
      now
    );

    for (let idx = 0; idx < input.movements.length; idx += 1) {
      const m = input.movements[idx];
      if (!m) continue;
      const acc = accById.get(m.accountId);
      assertAccountingInvariant(
        acc !== undefined,
        'ACCOUNT_NOT_FOUND',
        `Cuenta contable inválida: ${m.accountId}`
      );
      const movUuid = m.cfdiUuid?.trim().toUpperCase() || primaryUuid || null;
      insertMovementRow(
        `${polizaId}_m${idx + 1}`, polizaId, acc, m,
        `${input.tipo.slice(0, 1)}-${nextFolio}`, input.concepto, movUuid
      );
    }

    syncPolizaCfdisTx(db, input.companyId, polizaId, [], allUuids);
  });

  tx();

  const created = getPolizaById(polizaId);
  assertAccountingInvariant(created !== null, 'POLIZA_NOT_CREATED', 'Error al leer la póliza creada.');
  return created;
}

export function updatePolizaTransaction(
  polizaId: string,
  input: {
    tipo?: PolizaType;
    fecha?: string;
    periodo?: number | null;
    concepto: string;
    cfdiUuid?: string | null;
    cfdiUuids?: string[];
    movements: ReadonlyArray<PolizaMovementWriteInput>;
  }
): boolean {
  const existing = db.query('SELECT * FROM polizas WHERE id = ?').get(polizaId) as PolizaDbRow | null;
  if (!existing) return false;

  assertPeriodOpen(existing.company_id, Number(existing.ejercicio), Number(existing.periodo));

  const accounts = getAccounts(existing.company_id);
  const accById = new Map(accounts.map((a) => [a.id, a]));
  validateDoubleEntryMovements(input.movements, accById);

  const tipo = input.tipo ?? existing.tipo;
  const fecha = input.fecha ?? existing.fecha;
  const hasExplicitUuids = input.cfdiUuid !== undefined || input.cfdiUuids !== undefined;
  const prevLinkRows = db
    .query('SELECT cfdi_uuid FROM poliza_cfdis WHERE poliza_id = ?')
    .all(polizaId) as Array<{ cfdi_uuid: string }>;
  const prevMovRows = db
    .query('SELECT cfdi_uuid FROM poliza_movements WHERE poliza_id = ?')
    .all(polizaId) as Array<{ cfdi_uuid: string | null }>;
  const prevUuids = collectPolizaCfdiUuidsRepo(
    existing.cfdi_uuid,
    prevLinkRows.map((l) => l.cfdi_uuid),
    prevMovRows.map((m) => ({ cfdiUuid: m.cfdi_uuid }))
  );
  const nextUuids = hasExplicitUuids
    ? collectPolizaCfdiUuidsRepo(input.cfdiUuid, input.cfdiUuids, input.movements)
    : collectPolizaCfdiUuidsRepo(existing.cfdi_uuid, prevUuids, input.movements);
  const cfdiUuid =
    (input.cfdiUuid !== undefined ? input.cfdiUuid?.trim().toUpperCase() || null : existing.cfdi_uuid) ??
    nextUuids[0] ??
    null;

  const explicitPeriodo =
    input.periodo !== undefined
      ? (input.periodo ?? undefined)
      : fecha === existing.fecha
        ? Number(existing.periodo)
        : undefined;

  const { ejercicio: newYear, periodo: newPeriod } = resolvePolizaYearPeriod(
    fecha,
    explicitPeriodo,
    Number(existing.ejercicio),
    Number(existing.periodo)
  );

  if (newYear !== Number(existing.ejercicio) || newPeriod !== Number(existing.periodo)) {
    assertPeriodOpen(existing.company_id, newYear, newPeriod);
  }

  const periodOrTypeChanged =
    tipo !== existing.tipo ||
    newYear !== Number(existing.ejercicio) ||
    newPeriod !== Number(existing.periodo);
  const nextFolio = periodOrTypeChanged
    ? Number(
        (maxFolioQuery.get(existing.company_id, tipo, newYear, newPeriod) as {
          max_folio?: number;
        } | null)?.max_folio ?? 0
      ) + 1
    : Number(existing.folio);

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE polizas SET tipo = ?, folio = ?, fecha = ?, ejercicio = ?, periodo = ?, concepto = ?, cfdi_uuid = ? WHERE id = ?
    `).run(tipo, nextFolio, fecha, newYear, newPeriod, input.concepto, cfdiUuid || null, polizaId);

    syncPolizaCfdisTx(db, existing.company_id, polizaId, prevUuids, nextUuids);

    clearBankMatchesForPolizaTx(polizaId);
    db.prepare('DELETE FROM poliza_movements WHERE poliza_id = ?').run(polizaId);

    for (let idx = 0; idx < input.movements.length; idx += 1) {
      const m = input.movements[idx];
      if (!m) continue;
      const acc = accById.get(m.accountId);
      assertAccountingInvariant(
        acc !== undefined,
        'ACCOUNT_NOT_FOUND',
        `Cuenta inválida: ${m.accountId}`
      );
      const movUuid = m.cfdiUuid?.trim().toUpperCase() || cfdiUuid || null;
      insertMovementRow(
        `${polizaId}_m${idx + 1}_${Date.now().toString(36)}`, polizaId, acc, m,
        `${tipo.slice(0, 1)}-${nextFolio}`, input.concepto, movUuid
      );
    }
  });

  tx();
  return true;
}

export function deletePolizaTransaction(polizaId: string): boolean {
  const existing = db.query('SELECT * FROM polizas WHERE id = ?').get(polizaId) as PolizaDbRow | null;
  if (!existing) return false;

  assertPeriodOpen(existing.company_id, Number(existing.ejercicio), Number(existing.periodo));

  const tx = db.transaction(() => {
    const linkedDocs = db
      .prepare('SELECT uuid FROM cfdi_documents WHERE company_id = ? AND poliza_id = ?')
      .all(existing.company_id, polizaId) as Array<{ uuid: string }>;
    db.prepare('DELETE FROM poliza_cfdis WHERE poliza_id = ?').run(polizaId);
    reconcileRemovedPolizaCfdisTx(
      db,
      existing.company_id,
      polizaId,
      linkedDocs.map((d) => d.uuid)
    );
    clearBankMatchesForPolizaTx(polizaId);
    const res = db.prepare('DELETE FROM polizas WHERE id = ?').run(polizaId);
    return res.changes > 0;
  });
  return tx();
}
