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
import { assertPeriodOpen } from './period-locks.repo';
import { getPolizaById } from './polizas.repo';

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
        INSERT INTO poliza_movements (id, poliza_id, account_id, account_code, account_name, referencia, concepto, cargo, abono, cfdi_uuid)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
    }
    return _insertMovementStmt.run(...args);
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

export function createPolizaTransaction(input: {
  companyId: string;
  ejercicio: number;
  periodo: number;
  tipo: PolizaType;
  fecha: string;
  concepto: string;
  cfdiUuid: string | null;
  origin: 'MANUAL' | 'ADD_AUTO';
  movements: ReadonlyArray<{
    accountId: string;
    referencia?: string;
    concepto?: string;
    cargo: number;
    abono: number;
  }>;
}): Poliza {
  assertPeriodOpen(input.companyId, input.ejercicio, input.periodo);

  const accounts = getAccounts(input.companyId);
  const accById = new Map(accounts.map((a) => [a.id, a]));
  validateDoubleEntryMovements(input.movements, accById);

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
      input.cfdiUuid,
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
      insertMovementStmt.run(
        `${polizaId}_m${idx + 1}`,
        polizaId,
        acc.id,
        acc.code,
        acc.name,
        m.referencia || `${input.tipo.slice(0, 1)}-${nextFolio}`,
        m.concepto || input.concepto,
        fromCents(toCents(m.cargo)),
        fromCents(toCents(m.abono)),
        input.cfdiUuid
      );
    }

    if (input.cfdiUuid) {
      db.prepare('UPDATE cfdi_documents SET poliza_id = ? WHERE company_id = ? AND uuid = ?').run(
        polizaId,
        input.companyId,
        input.cfdiUuid
      );
    }
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
    movements: ReadonlyArray<{
      accountId: string;
      referencia?: string;
      concepto?: string;
      cargo: number;
      abono: number;
    }>;
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
  const cfdiUuid = input.cfdiUuid !== undefined ? input.cfdiUuid : existing.cfdi_uuid;

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
          maxFolio?: number;
        } | null)?.maxFolio ?? 0
      ) + 1
    : Number(existing.folio);

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE polizas SET tipo = ?, folio = ?, fecha = ?, ejercicio = ?, periodo = ?, concepto = ?, cfdi_uuid = ? WHERE id = ?
    `).run(tipo, nextFolio, fecha, newYear, newPeriod, input.concepto, cfdiUuid || null, polizaId);

    if (existing.cfdi_uuid && existing.cfdi_uuid !== cfdiUuid) {
      db.prepare('UPDATE cfdi_documents SET poliza_id = NULL WHERE company_id = ? AND poliza_id = ? AND uuid = ?').run(
        existing.company_id,
        polizaId,
        existing.cfdi_uuid
      );
    }
    if (cfdiUuid && cfdiUuid !== existing.cfdi_uuid) {
      db.prepare('UPDATE cfdi_documents SET poliza_id = ? WHERE company_id = ? AND uuid = ?').run(
        polizaId,
        existing.company_id,
        cfdiUuid
      );
    }

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
      insertMovementStmt.run(
        `${polizaId}_m${idx + 1}_${Date.now().toString(36)}`,
        polizaId,
        acc.id,
        acc.code,
        acc.name,
        m.referencia || `${tipo.slice(0, 1)}-${nextFolio}`,
        m.concepto || input.concepto,
        fromCents(toCents(m.cargo)),
        fromCents(toCents(m.abono)),
        cfdiUuid || null
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
    db.prepare('UPDATE cfdi_documents SET poliza_id = NULL WHERE poliza_id = ?').run(polizaId);
    const movRows = db
      .prepare('SELECT id FROM poliza_movements WHERE poliza_id = ?')
      .all(polizaId) as Array<{ id: string }>;
    const movIds = movRows.map((r) => r.id);
    if (movIds.length > 0) {
      const placeholders = movIds.map(() => '?').join(',');
      db.prepare(
        `UPDATE bank_statement_lines SET matched_movement_id = NULL WHERE matched_movement_id IN (${placeholders})`
      ).run(...movIds);
    }
    const res = db.prepare('DELETE FROM polizas WHERE id = ?').run(polizaId);
    return res.changes > 0;
  });
  return tx();
}
