import { db, type PolizaDbRow, type PolizaMovementDbRow } from '../connection';
import {
  assertAccountingInvariant,
  fromCents,
  sumCents,
  toCents,
  validateDoubleEntryMovements
} from '../../shared/accounting-engine';
import type { Poliza, PolizaMovement, PolizaType } from '../../shared/types';
import { getAccounts } from './accounts.repo';
import { assertPeriodOpen } from './period-locks.repo';

export function getPolizas(companyId: string, ejercicio?: number, periodo?: number): Poliza[] {
  let sql = 'SELECT * FROM polizas WHERE company_id = ?';
  const params: Array<string | number> = [companyId];
  if (ejercicio) {
    sql += ' AND ejercicio = ?';
    params.push(ejercicio);
  }
  if (periodo) {
    sql += ' AND periodo = ?';
    params.push(periodo);
  }
  sql += ' ORDER BY fecha DESC, folio DESC';

  const polizaRows = db.query(sql).all(...params) as PolizaDbRow[];
  if (polizaRows.length === 0) return [];

  const polizaIds = polizaRows.map((p) => p.id);
  const placeholders = polizaIds.map(() => '?').join(',');
  const allMovRows = db
    .query(`SELECT * FROM poliza_movements WHERE poliza_id IN (${placeholders}) ORDER BY id ASC`)
    .all(...polizaIds) as PolizaMovementDbRow[];

  const movMap = new Map<string, PolizaMovement[]>();
  for (const m of allMovRows) {
    let list = movMap.get(m.poliza_id);
    if (!list) {
      list = [];
      movMap.set(m.poliza_id, list);
    }
    list.push({
      id: m.id,
      polizaId: m.poliza_id,
      accountId: m.account_id,
      accountCode: m.account_code,
      accountName: m.account_name,
      referencia: m.referencia,
      concepto: m.concepto,
      cargo: Number(m.cargo),
      abono: Number(m.abono),
      cfdiUuid: m.cfdi_uuid
    });
  }

  return polizaRows.map((p) => {
    const movements = movMap.get(p.id) || [];
    const totalCargosCents = sumCents(movements.map((m) => m.cargo));
    const totalAbonosCents = sumCents(movements.map((m) => m.abono));

    return {
      id: p.id,
      companyId: p.company_id,
      tipo: p.tipo,
      folio: Number(p.folio),
      fecha: p.fecha,
      ejercicio: Number(p.ejercicio),
      periodo: Number(p.periodo),
      concepto: p.concepto,
      cfdiUuid: p.cfdi_uuid,
      origin: p.origin,
      totalCargos: fromCents(totalCargosCents),
      totalAbonos: fromCents(totalAbonosCents),
      isBalanced: totalCargosCents === totalAbonosCents && totalCargosCents > 0,
      createdAt: p.created_at,
      movements
    };
  });
}

export function getPolizaById(polizaId: string): Poliza | null {
  const p = db.query('SELECT * FROM polizas WHERE id = ?').get(polizaId) as PolizaDbRow | null;
  if (!p) return null;

  const movRows = db
    .query('SELECT * FROM poliza_movements WHERE poliza_id = ? ORDER BY id ASC')
    .all(polizaId) as PolizaMovementDbRow[];

  const movements: PolizaMovement[] = movRows.map((m) => ({
    id: m.id,
    polizaId: m.poliza_id,
    accountId: m.account_id,
    accountCode: m.account_code,
    accountName: m.account_name,
    referencia: m.referencia,
    concepto: m.concepto,
    cargo: Number(m.cargo),
    abono: Number(m.abono),
    cfdiUuid: m.cfdi_uuid
  }));

  const totalCargosCents = sumCents(movements.map((m) => m.cargo));
  const totalAbonosCents = sumCents(movements.map((m) => m.abono));

  return {
    id: p.id,
    companyId: p.company_id,
    tipo: p.tipo,
    folio: Number(p.folio),
    fecha: p.fecha,
    ejercicio: Number(p.ejercicio),
    periodo: Number(p.periodo),
    concepto: p.concepto,
    cfdiUuid: p.cfdi_uuid,
    origin: p.origin,
    totalCargos: fromCents(totalCargosCents),
    totalAbonos: fromCents(totalAbonosCents),
    isBalanced: totalCargosCents === totalAbonosCents && totalCargosCents > 0,
    createdAt: p.created_at,
    movements
  };
}

// NASA Power of 10 - Regla 3 (H-14): Sentencias SQL preparadas de forma perezosa
let _insertPolizaStmt: ReturnType<typeof db.prepare> | null = null;
export const insertPolizaStmt = {
  run: (...args: unknown[]) => {
    if (!_insertPolizaStmt) {
      _insertPolizaStmt = db.prepare(`
        INSERT INTO polizas (id, company_id, tipo, folio, fecha, ejercicio, periodo, concepto, cfdi_uuid, origin, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
    }
    return (_insertPolizaStmt as any).run(...args);
  }
};

let _insertMovementStmt: ReturnType<typeof db.prepare> | null = null;
export const insertMovementStmt = {
  run: (...args: unknown[]) => {
    if (!_insertMovementStmt) {
      _insertMovementStmt = db.prepare(`
        INSERT INTO poliza_movements (id, poliza_id, account_id, account_code, account_name, referencia, concepto, cargo, abono, cfdi_uuid)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
    }
    return (_insertMovementStmt as any).run(...args);
  }
};

let _maxFolioQuery: ReturnType<typeof db.prepare> | null = null;
export const maxFolioQuery = {
  get: (...args: unknown[]) => {
    if (!_maxFolioQuery) {
      _maxFolioQuery = db.prepare(`
        SELECT COALESCE(MAX(folio), 0) as max_folio
        FROM polizas
        WHERE company_id = ? AND tipo = ? AND ejercicio = ? AND periodo = ?
      `);
    }
    return (_maxFolioQuery as any).get(...args);
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

  // NASA Power of 10 - Regla 5 (H-04): Validar partida doble y cuentas afectables
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

  const newDate = new Date(fecha);
  const newYear = isNaN(newDate.getFullYear()) ? Number(existing.ejercicio) : newDate.getFullYear();
  const newPeriod = isNaN(newDate.getMonth()) ? Number(existing.periodo) : newDate.getMonth() + 1;

  if (newYear !== Number(existing.ejercicio) || newPeriod !== Number(existing.periodo)) {
    assertPeriodOpen(existing.company_id, newYear, newPeriod);
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE polizas SET tipo = ?, fecha = ?, ejercicio = ?, periodo = ?, concepto = ?, cfdi_uuid = ? WHERE id = ?
    `).run(tipo, fecha, newYear, newPeriod, input.concepto, cfdiUuid || null, polizaId);

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
        m.referencia || `${tipo.slice(0, 1)}-${existing.folio}`,
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
