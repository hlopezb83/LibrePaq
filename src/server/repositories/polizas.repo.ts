import { db, type PolizaDbRow, type PolizaMovementDbRow } from '../connection';
import { fromCents, sumCents } from '../../shared/accounting-engine';
import type { Poliza, PolizaMovement } from '../../shared/types';

export {
  insertPolizaStmt,
  insertMovementStmt,
  maxFolioQuery,
  createPolizaTransaction,
  updatePolizaTransaction,
  deletePolizaTransaction
} from './polizas-write.repo';

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
