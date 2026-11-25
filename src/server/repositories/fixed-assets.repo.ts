import { db, mapFixedAssetRow, type FixedAssetDbRow } from '../connection';
import {
  assertAccountingInvariant,
  buildDepreciationPolizaPlan,
  computeFixedAssetWithDepreciation,
  fromCents,
  sumCents,
  toCents
} from '../../shared/accounting-engine';
import {
  buildFixedAssetDisposalPolizaPlan,
  computeAssetPostDepreciationUpdate,
  extractDepreciatedAssetCodes,
  hasExistingDepreciationPoliza
} from '../../shared/engine/fixed-assets.engine';
import { MESES_SAT } from '../../shared/sat-constants';
import { getDefaultDateForPeriod, parseCalendarDate } from '../../shared/date-utils';
import type { CustomInpcEntry, FixedAssetCategory, FixedAssetRecord, FixedAssetsResponse, Poliza, VehicleCapType } from '../../shared/types';
import { getAccounts } from './accounts.repo';
import { getCompanyById } from './companies.repo';
import { createPolizaTransaction, deletePolizaTransaction, getPolizas } from './polizas.repo';
import { assertPeriodOpen } from './period-locks.repo';

type FixedAssetFullRow = FixedAssetDbRow & {
  fecha_baja?: string | null;
  precio_venta?: number | null;
  baja_poliza_id?: string | null;
  vehicle_cap_type?: string | null;
};

function mapFixedAssetFullRow(r: FixedAssetFullRow): FixedAssetRecord {
  const base = mapFixedAssetRow(r);
  return {
    ...base,
    fechaBaja: r.fecha_baja ?? null,
    precioVenta: r.precio_venta !== undefined && r.precio_venta !== null ? Number(r.precio_venta) : null,
    bajaPolizaId: r.baja_poliza_id ?? null,
    vehicleCapType: r.vehicle_cap_type ?? null
  };
}

export interface UpdateFixedAssetInput {
  codigo?: string;
  nombre?: string;
  categoria?: FixedAssetCategory;
  fechaAdquisicion?: string;
  montoOriginalInversion?: number;
  tasaAnualPct?: number;
  mesesDepreciadosPrevios?: number;
  inpcAdquisicion?: number;
  inpcMedioPeriodo?: number;
  estatus?: FixedAssetRecord['estatus'];
  fechaBaja?: string | null;
  precioVenta?: number | null;
  bajaPolizaId?: string | null;
  vehicleCapType?: VehicleCapType | null;
}

export function getFixedAssetsResponse(companyId: string, year?: number, period?: number): FixedAssetsResponse {
  const rows = db
    .query('SELECT * FROM fixed_assets WHERE company_id = ? ORDER BY fecha_adquisicion ASC, codigo ASC')
    .all(companyId) as FixedAssetFullRow[];

  let targetPeriod: { ejercicio: number; periodo: number; alreadyDepreciatedThisPeriod?: boolean; depreciatedAssetCodes?: ReadonlySet<string> } | undefined;
  if (year && period) {
    const periodPolizas = getPolizas(companyId, year, period);
    const alreadyDepreciatedThisPeriod = hasExistingDepreciationPoliza(periodPolizas);
    const depreciatedAssetCodes = alreadyDepreciatedThisPeriod ? extractDepreciatedAssetCodes(periodPolizas) : undefined;
    targetPeriod = { ejercicio: year, periodo: period, alreadyDepreciatedThisPeriod, depreciatedAssetCodes };
  }
  const assets = rows.map((r) => computeFixedAssetWithDepreciation(mapFixedAssetFullRow(r), targetPeriod));
  return {
    assets,
    totals: {
      totalMoi: fromCents(sumCents(assets.map((a) => a.montoOriginalInversion))),
      totalDepreciacionMensualContable: fromCents(sumCents(assets.map((a) => a.depreciacionMensualContable))),
      totalDepreciacionMensualFiscal: fromCents(sumCents(assets.map((a) => a.depreciacionMensualFiscalActualizada))),
      totalDepreciacionAcumulada: fromCents(sumCents(assets.map((a) => a.depreciacionAcumuladaTotal))),
      totalValorNetoEnLibros: fromCents(sumCents(assets.map((a) => a.valorNetoEnLibros)))
    }
  };
}

export function createFixedAssetRecord(
  companyId: string,
  input: {
    codigo: string;
    nombre: string;
    categoria: FixedAssetCategory;
    fechaAdquisicion: string;
    cfdiUuid?: string | null;
    montoOriginalInversion: number;
    tasaAnualPct: number;
    mesesDepreciadosPrevios?: number;
    inpcAdquisicion?: number;
    inpcMedioPeriodo?: number;
    cuentaActivoCode?: string;
    cuentaDepAcumCode?: string;
    cuentaGastoDepCode?: string;
    vehicleCapType?: VehicleCapType | null;
  }
): FixedAssetsResponse {
  const company = getCompanyById(companyId);
  const effYear = company?.currentYear || 2026;
  const effPeriod = company?.currentPeriod || 10;
  assertPeriodOpen(companyId, effYear, effPeriod);
  const priorMonths = Math.max(0, Math.floor(input.mesesDepreciadosPrevios ?? 0));
  if (priorMonths === 0) {
    const { year: acqYear, month: acqPeriod } = parseCalendarDate(input.fechaAdquisicion);
    if (acqYear === effYear && acqPeriod) assertPeriodOpen(companyId, acqYear, acqPeriod);
  }
  const moiCents = Math.max(0, toCents(input.montoOriginalInversion));
  const annualRate = Math.max(0, Math.min(100, input.tasaAnualPct)) / 100;
  const priorAccumCents = priorMonths > 0 ? Math.round((moiCents * annualRate * priorMonths) / 12) : 0;
  const estatus: FixedAssetRecord['estatus'] = moiCents > 0 && priorAccumCents >= moiCents ? 'TOTALMENTE_DEPRECIADO' : 'ACTIVO';
  const id = `fa_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO fixed_assets (
      id, company_id, codigo, nombre, categoria, fecha_adquisicion, cfdi_uuid,
      monto_original_inversion, tasa_anual_pct, meses_depreciados_previos,
      inpc_adquisicion, inpc_medio_periodo, cuenta_activo_code, cuenta_dep_acum_code,
      cuenta_gasto_dep_code, estatus, vehicle_cap_type, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, companyId, input.codigo.trim().toUpperCase(), input.nombre.trim(), input.categoria,
    input.fechaAdquisicion, input.cfdiUuid || null, fromCents(moiCents), input.tasaAnualPct, priorMonths,
    input.inpcAdquisicion ?? 132.54, input.inpcMedioPeriodo ?? 136.82,
    input.cuentaActivoCode || '156-01-001', input.cuentaDepAcumCode || '171-01-001',
    input.cuentaGastoDepCode || '601-01-006', estatus, input.vehicleCapType ?? null, now
  );
  return getFixedAssetsResponse(companyId);
}

export function updateFixedAssetRecord(
  assetId: string,
  payload: UpdateFixedAssetInput,
  targetYear?: number,
  targetPeriod?: number
): FixedAssetsResponse | null {
  const row = db.query('SELECT * FROM fixed_assets WHERE id = ?').get(assetId) as FixedAssetFullRow | null;
  if (!row) return null;

  const company = getCompanyById(row.company_id);
  const effYear = targetYear || company?.currentYear || 2026;
  const effPeriod = targetPeriod || company?.currentPeriod || 10;
  assertPeriodOpen(row.company_id, effYear, effPeriod);
  if (payload.fechaBaja) {
    const bajaDate = parseCalendarDate(payload.fechaBaja);
    assertPeriodOpen(row.company_id, bajaDate.year, bajaDate.month);
  }

  const nextMoi = payload.montoOriginalInversion ?? Number(row.monto_original_inversion);
  const nextRate = payload.tasaAnualPct ?? Number(row.tasa_anual_pct);
  const nextMonths = payload.mesesDepreciadosPrevios !== undefined
    ? Math.max(0, Math.floor(payload.mesesDepreciadosPrevios))
    : Number(row.meses_depreciados_previos);
  const nextAccumCents = Math.round((toCents(nextMoi) * (nextRate / 100) * nextMonths) / 12);
  const autoEstatus: FixedAssetRecord['estatus'] = payload.estatus !== undefined
    ? payload.estatus
    : row.estatus === 'BAJA' ? 'BAJA' : toCents(nextMoi) > 0 && nextAccumCents >= toCents(nextMoi) ? 'TOTALMENTE_DEPRECIADO' : 'ACTIVO';

  db.prepare(`
    UPDATE fixed_assets SET
      codigo = ?, nombre = ?, categoria = ?, fecha_adquisicion = ?,
      monto_original_inversion = ?, tasa_anual_pct = ?, meses_depreciados_previos = ?,
      inpc_adquisicion = ?, inpc_medio_periodo = ?, estatus = ?,
      fecha_baja = ?, precio_venta = ?, baja_poliza_id = ?, vehicle_cap_type = ?
    WHERE id = ?
  `).run(
    payload.codigo !== undefined ? payload.codigo.trim().toUpperCase() : row.codigo,
    payload.nombre !== undefined ? payload.nombre.trim() : row.nombre,
    payload.categoria ?? row.categoria,
    payload.fechaAdquisicion ?? row.fecha_adquisicion,
    fromCents(toCents(nextMoi)),
    nextRate,
    nextMonths,
    payload.inpcAdquisicion ?? Number(row.inpc_adquisicion),
    payload.inpcMedioPeriodo ?? Number(row.inpc_medio_periodo),
    autoEstatus,
    payload.fechaBaja !== undefined ? payload.fechaBaja : (row.fecha_baja ?? null),
    payload.precioVenta !== undefined ? payload.precioVenta : (row.precio_venta ?? null),
    payload.bajaPolizaId !== undefined ? payload.bajaPolizaId : (row.baja_poliza_id ?? null),
    payload.vehicleCapType !== undefined ? payload.vehicleCapType : (row.vehicle_cap_type ?? null),
    assetId
  );
  return getFixedAssetsResponse(row.company_id, effYear, effPeriod);
}

export function retireFixedAssetRecord(
  assetId: string,
  input: { fechaBaja: string; precioVenta: number; generatePoliza?: boolean; cuentaCobroCode?: string }
): { assets: FixedAssetsResponse; poliza: Poliza | null } | null {
  const row = db.query('SELECT * FROM fixed_assets WHERE id = ?').get(assetId) as FixedAssetFullRow | null;
  if (!row) return null;
  const asset = mapFixedAssetFullRow(row);
  assertAccountingInvariant(asset.estatus !== 'BAJA', 'ALREADY_RETIRED', 'El activo fijo ya fue dado de baja.');

  const bajaDate = parseCalendarDate(input.fechaBaja);
  assertPeriodOpen(asset.companyId, bajaDate.year, bajaDate.month);

  let createdPoliza: Poliza | null = null;
  if (input.generatePoliza !== false) {
    const accounts = getAccounts(asset.companyId);
    const plan = buildFixedAssetDisposalPolizaPlan({
      asset,
      accounts,
      fechaBaja: input.fechaBaja,
      precioVenta: input.precioVenta,
      cuentaCobroCode: input.cuentaCobroCode
    });
    createdPoliza = createPolizaTransaction({
      companyId: asset.companyId,
      ejercicio: bajaDate.year,
      periodo: bajaDate.month,
      tipo: plan.polizaType,
      fecha: input.fechaBaja,
      concepto: plan.polizaConcept,
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: plan.movements
    });
  }

  db.prepare('UPDATE fixed_assets SET estatus = ?, fecha_baja = ?, precio_venta = ?, baja_poliza_id = ? WHERE id = ?')
    .run('BAJA', input.fechaBaja, Math.max(0, input.precioVenta), createdPoliza?.id ?? null, assetId);
  return { assets: getFixedAssetsResponse(asset.companyId, bajaDate.year, bajaDate.month), poliza: createdPoliza };
}

export function deleteFixedAssetRecord(assetId: string): boolean {
  const row = db.query('SELECT company_id FROM fixed_assets WHERE id = ?').get(assetId) as { company_id: string } | null;
  if (!row) return false;
  const company = getCompanyById(row.company_id);
  assertPeriodOpen(row.company_id, company?.currentYear || 2026, company?.currentPeriod || 10);
  const res = db.prepare('DELETE FROM fixed_assets WHERE id = ?').run(assetId);
  return res.changes > 0;
}

export function listCustomInpcEntriesSqlite(companyId: string): CustomInpcEntry[] {
  const rows = db.query('SELECT * FROM custom_inpc_entries WHERE company_id = ? ORDER BY year DESC, month ASC').all(companyId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({ companyId: String(r.company_id), year: Number(r.year), month: Number(r.month), inpcValue: Number(r.inpc_value), source: String(r.source ?? 'MANUAL'), updatedAt: String(r.updated_at ?? '') }));
}

export function upsertCustomInpcEntrySqlite(input: { companyId: string; year: number; month: number; inpcValue: number; source?: string }): CustomInpcEntry {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO custom_inpc_entries (company_id, year, month, inpc_value, source, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id, year, month) DO UPDATE SET inpc_value = excluded.inpc_value, source = excluded.source, updated_at = excluded.updated_at
  `).run(input.companyId, input.year, input.month, input.inpcValue, input.source ?? 'MANUAL', now);
  return { companyId: input.companyId, year: input.year, month: input.month, inpcValue: input.inpcValue, source: input.source ?? 'MANUAL', updatedAt: now };
}

export function deleteCustomInpcEntrySqlite(companyId: string, year: number, month: number): boolean {
  const res = db.prepare('DELETE FROM custom_inpc_entries WHERE company_id = ? AND year = ? AND month = ?').run(companyId, year, month);
  return res.changes > 0;
}

export function revertDepreciationForPolizaRepo(
  companyId: string,
  poliza: Pick<Poliza, 'concepto' | 'origin' | 'movements'>
): void {
  if (!hasExistingDepreciationPoliza([poliza])) return;
  const codes = extractDepreciatedAssetCodes([poliza]);
  if (codes.size === 0) return;

  const updStmt = db.prepare(
    'UPDATE fixed_assets SET meses_depreciados_previos = ?, estatus = ? WHERE id = ? AND company_id = ?'
  );
  const rows = db
    .query('SELECT id, codigo, meses_depreciados_previos, estatus FROM fixed_assets WHERE company_id = ?')
    .all(companyId) as Array<{ id: string; codigo: string; meses_depreciados_previos: number; estatus: string }>;

  const tx = db.transaction(() => {
    for (const r of rows) {
      if (!codes.has(r.codigo)) continue;
      const prevMonths = Math.max(0, Math.floor(Number(r.meses_depreciados_previos)) - 1);
      const nextStatus = r.estatus === 'TOTALMENTE_DEPRECIADO' ? 'ACTIVO' : r.estatus;
      updStmt.run(prevMonths, nextStatus, r.id, companyId);
    }
  });
  tx();
}

export function generateMonthlyDepreciationPoliza(
  companyId: string,
  ejercicio?: number,
  periodo?: number
): Poliza {
  const company = getCompanyById(companyId);
  const effYear = ejercicio || company?.currentYear || 2026;
  const effPeriod = periodo || company?.currentPeriod || 10;
  assertPeriodOpen(companyId, effYear, effPeriod);

  const existing = getPolizas(companyId, effYear, effPeriod);
  assertAccountingInvariant(
    !hasExistingDepreciationPoliza(existing),
    'DUPLICATE_DEPRECIATION',
    `Ya existe una póliza de depreciación registrada para ${effYear}-${String(effPeriod).padStart(2, '0')}`
  );

  const rawRows = db
    .query('SELECT * FROM fixed_assets WHERE company_id = ? ORDER BY fecha_adquisicion ASC, codigo ASC')
    .all(companyId) as FixedAssetDbRow[];
  const assets = rawRows.map(mapFixedAssetRow);
  const accounts = getAccounts(companyId);
  const mesNombre = MESES_SAT.find((m) => m.periodo === effPeriod)?.nombre || `M${effPeriod}`;
  const periodLabel = `${mesNombre} ${effYear}`;
  const targetPeriod = { ejercicio: effYear, periodo: effPeriod };

  const plan = buildDepreciationPolizaPlan(assets, accounts, periodLabel, targetPeriod);
  const fecha = getDefaultDateForPeriod(effYear, effPeriod);

  const poliza = createPolizaTransaction({
    companyId,
    ejercicio: effYear,
    periodo: effPeriod,
    tipo: plan.polizaType,
    fecha,
    concepto: plan.polizaConcept,
    cfdiUuid: null,
    origin: 'MANUAL',
    movements: plan.movements
  });

  const includedCodes = extractDepreciatedAssetCodes([{ concepto: plan.polizaConcept, movements: plan.movements }]);
  const updStmt = db.prepare(
    'UPDATE fixed_assets SET meses_depreciados_previos = ?, estatus = ? WHERE id = ? AND company_id = ?'
  );

  try {
    const tx = db.transaction(() => {
      for (const asset of assets) {
        if (!includedCodes.has(asset.codigo)) continue;
        const nextUpdate = computeAssetPostDepreciationUpdate(asset, targetPeriod);
        if (!nextUpdate) continue;
        updStmt.run(nextUpdate.mesesDepreciadosPrevios, nextUpdate.estatus, asset.id, companyId);
      }
    });
    tx();
  } catch (err) {
    deletePolizaTransaction(poliza.id);
    throw err;
  }

  return poliza;
}
