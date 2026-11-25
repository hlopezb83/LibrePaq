import { db, type PolizaDbRow, type PolizaMovementDbRow } from '../connection';
import { fromCents, sumCents } from '../../shared/accounting-engine';
import type { Poliza, PolizaMovement } from '../../shared/types';

export function reconcileRemovedPolizaCfdisTx(
  dbConn: typeof db,
  companyId: string,
  polizaId: string,
  removedUuids: ReadonlyArray<string>
): void {
  if (removedUuids.length === 0) return;
  const findRemainingFromLinks = dbConn.prepare(
    'SELECT poliza_id FROM poliza_cfdis WHERE company_id = ? AND UPPER(cfdi_uuid) = ? AND poliza_id != ? LIMIT 1'
  );
  const findRemainingFromPolizas = dbConn.prepare(
    'SELECT id FROM polizas WHERE company_id = ? AND UPPER(cfdi_uuid) = ? AND id != ? LIMIT 1'
  );
  const updateCfdiDoc = dbConn.prepare(
    'UPDATE cfdi_documents SET poliza_id = ? WHERE company_id = ? AND poliza_id = ? AND UPPER(uuid) = ?'
  );
  for (const rawUuid of removedUuids) {
    const clean = rawUuid.trim().toUpperCase();
    if (!clean) continue;
    const linkRow = findRemainingFromLinks.get(companyId, clean, polizaId) as
      | { poliza_id: string }
      | undefined;
    const headerRow = !linkRow
      ? (findRemainingFromPolizas.get(companyId, clean, polizaId) as { id: string } | undefined)
      : undefined;
    const remainingPolizaId = linkRow?.poliza_id ?? headerRow?.id ?? null;
    updateCfdiDoc.run(remainingPolizaId, companyId, polizaId, clean);
  }
}

export function syncPolizaCfdisTx(
  dbConn: typeof db,
  companyId: string,
  polizaId: string,
  prevUuids: ReadonlyArray<string>,
  nextUuids: ReadonlyArray<string>
): void {
  const nextSet = new Set(nextUuids);
  const removed = prevUuids.filter((u) => !nextSet.has(u));
  dbConn.prepare('DELETE FROM poliza_cfdis WHERE poliza_id = ?').run(polizaId);
  if (removed.length > 0) {
    reconcileRemovedPolizaCfdisTx(dbConn, companyId, polizaId, removed);
  }
  const ins = dbConn.prepare(
    'INSERT OR IGNORE INTO poliza_cfdis (id, company_id, poliza_id, cfdi_uuid) VALUES (?, ?, ?, ?)'
  );
  const upd = dbConn.prepare(
    'UPDATE cfdi_documents SET poliza_id = ? WHERE company_id = ? AND UPPER(uuid) = ?'
  );
  for (const uuid of nextUuids) {
    ins.run(`pc_${crypto.randomUUID().slice(0, 12)}`, companyId, polizaId, uuid);
    upd.run(polizaId, companyId, uuid);
  }
}

export {
  insertPolizaStmt,
  insertMovementStmt,
  maxFolioQuery,
  createPolizaTransaction,
  updatePolizaTransaction,
  deletePolizaTransaction
} from './polizas-write.repo';

export function collectPolizaCfdiUuidsRepo(
  headerCfdiUuid?: string | null,
  headerCfdiUuids?: ReadonlyArray<string> | null,
  movements?: ReadonlyArray<{ cfdiUuid?: string | null }>
): string[] {
  const seen = new Set<string>();
  const add = (val?: string | null) => {
    const clean = val?.trim().toUpperCase();
    if (clean) seen.add(clean);
  };
  if (headerCfdiUuids) {
    for (const u of headerCfdiUuids) add(u);
  }
  add(headerCfdiUuid);
  if (movements) {
    for (const m of movements) add(m.cfdiUuid);
  }
  return Array.from(seen);
}

function mapPolizaMovementRow(m: PolizaMovementDbRow & Record<string, unknown>): PolizaMovement {
  return {
    id: m.id,
    polizaId: m.poliza_id,
    accountId: m.account_id,
    accountCode: m.account_code,
    accountName: m.account_name,
    referencia: m.referencia,
    concepto: m.concepto,
    cargo: Number(m.cargo),
    abono: Number(m.abono),
    cfdiUuid: m.cfdi_uuid,
    paymentMethodSat: m.payment_method_sat ? String(m.payment_method_sat) : null,
    bankCodeOri: m.bank_code_ori ? String(m.bank_code_ori) : null,
    accountOri: m.account_ori ? String(m.account_ori) : null,
    bankCodeDest: m.bank_code_dest ? String(m.bank_code_dest) : null,
    accountDest: m.account_dest ? String(m.account_dest) : null,
    beneficiaryName: m.beneficiary_name ? String(m.beneficiary_name) : null,
    beneficiaryRfc: m.beneficiary_rfc ? String(m.beneficiary_rfc) : null,
    chequeNum: m.cheque_num ? String(m.cheque_num) : null,
    businessSegmentId: m.business_segment_id ? String(m.business_segment_id) : null
  };
}

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

  const linkMap = new Map<string, string[]>();
  try {
    const linkRows = db
      .query(`SELECT poliza_id, cfdi_uuid FROM poliza_cfdis WHERE poliza_id IN (${placeholders})`)
      .all(...polizaIds) as Array<{ poliza_id: string; cfdi_uuid: string }>;
    for (const lr of linkRows) {
      const list = linkMap.get(lr.poliza_id) ?? [];
      list.push(lr.cfdi_uuid);
      linkMap.set(lr.poliza_id, list);
    }
  } catch {
    // Fallback when poliza_cfdis is not yet initialized
  }

  const movMap = new Map<string, PolizaMovement[]>();
  for (const m of allMovRows) {
    let list = movMap.get(m.poliza_id);
    if (!list) {
      list = [];
      movMap.set(m.poliza_id, list);
    }
    list.push(mapPolizaMovementRow(m as PolizaMovementDbRow & Record<string, unknown>));
  }

  return polizaRows.map((p) => {
    const movements = movMap.get(p.id) || [];
    const totalCargosCents = sumCents(movements.map((m) => m.cargo));
    const totalAbonosCents = sumCents(movements.map((m) => m.abono));
    const cfdiUuids = collectPolizaCfdiUuidsRepo(p.cfdi_uuid, linkMap.get(p.id), movements);

    return {
      id: p.id,
      companyId: p.company_id,
      tipo: p.tipo,
      folio: Number(p.folio),
      fecha: p.fecha,
      ejercicio: Number(p.ejercicio),
      periodo: Number(p.periodo),
      concepto: p.concepto,
      cfdiUuid: p.cfdi_uuid ?? cfdiUuids[0] ?? null,
      cfdiUuids,
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

  let linkUuids: string[] = [];
  try {
    const linkRows = db
      .query('SELECT cfdi_uuid FROM poliza_cfdis WHERE poliza_id = ?')
      .all(polizaId) as Array<{ cfdi_uuid: string }>;
    linkUuids = linkRows.map((l) => l.cfdi_uuid);
  } catch {
    // Fallback
  }

  const movements: PolizaMovement[] = movRows.map((m) =>
    mapPolizaMovementRow(m as PolizaMovementDbRow & Record<string, unknown>)
  );

  const totalCargosCents = sumCents(movements.map((m) => m.cargo));
  const totalAbonosCents = sumCents(movements.map((m) => m.abono));
  const cfdiUuids = collectPolizaCfdiUuidsRepo(p.cfdi_uuid, linkUuids, movements);

  return {
    id: p.id,
    companyId: p.company_id,
    tipo: p.tipo,
    folio: Number(p.folio),
    fecha: p.fecha,
    ejercicio: Number(p.ejercicio),
    periodo: Number(p.periodo),
    concepto: p.concepto,
    cfdiUuid: p.cfdi_uuid ?? cfdiUuids[0] ?? null,
    cfdiUuids,
    origin: p.origin,
    totalCargos: fromCents(totalCargosCents),
    totalAbonos: fromCents(totalAbonosCents),
    isBalanced: totalCargosCents === totalAbonosCents && totalCargosCents > 0,
    createdAt: p.created_at,
    movements
  };
}
