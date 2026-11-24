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
  computeAssetPostDepreciationUpdate,
  extractDepreciatedAssetCodes,
  hasExistingDepreciationPoliza
} from '../../shared/engine/fixed-assets.engine';
import { MESES_SAT } from '../../shared/sat-constants';
import { getDefaultDateForPeriod, parseCalendarDate } from '../../shared/date-utils';
import type { FixedAssetCategory, FixedAssetRecord, FixedAssetsResponse, Poliza } from '../../shared/types';
import { getAccounts } from './accounts.repo';
import { getCompanyById } from './companies.repo';
import { createPolizaTransaction, deletePolizaTransaction, getPolizas } from './polizas.repo';
import { assertPeriodOpen } from './period-locks.repo';

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
}

export function getFixedAssetsResponse(
  companyId: string,
  year?: number,
  period?: number
): FixedAssetsResponse {
  const rows = db
    .query('SELECT * FROM fixed_assets WHERE company_id = ? ORDER BY fecha_adquisicion ASC, codigo ASC')
    .all(companyId) as FixedAssetDbRow[];

  let targetPeriod:
    | {
        ejercicio: number;
        periodo: number;
        alreadyDepreciatedThisPeriod?: boolean;
        depreciatedAssetCodes?: ReadonlySet<string>;
      }
    | undefined;

  if (year && period) {
    const periodPolizas = getPolizas(companyId, year, period);
    const alreadyDepreciatedThisPeriod = hasExistingDepreciationPoliza(periodPolizas);
    const depreciatedAssetCodes = alreadyDepreciatedThisPeriod
      ? extractDepreciatedAssetCodes(periodPolizas)
      : undefined;
    targetPeriod = { ejercicio: year, periodo: period, alreadyDepreciatedThisPeriod, depreciatedAssetCodes };
  }

  const assets = rows.map((r) => computeFixedAssetWithDepreciation(mapFixedAssetRow(r), targetPeriod));

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
  }
): FixedAssetsResponse {
  const { year: acqYear, month: acqPeriod } = parseCalendarDate(input.fechaAdquisicion);
  if (acqYear && acqPeriod) assertPeriodOpen(companyId, acqYear, acqPeriod);

  const priorMonths = Math.max(0, Math.floor(input.mesesDepreciadosPrevios ?? 0));
  const moiCents = Math.max(0, toCents(input.montoOriginalInversion));
  const annualRate = Math.max(0, Math.min(100, input.tasaAnualPct)) / 100;
  const priorAccumCents = priorMonths > 0 ? Math.round((moiCents * annualRate * priorMonths) / 12) : 0;
  const estatus: FixedAssetRecord['estatus'] =
    moiCents > 0 && priorAccumCents >= moiCents ? 'TOTALMENTE_DEPRECIADO' : 'ACTIVO';

  const id = `fa_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO fixed_assets (
      id, company_id, codigo, nombre, categoria, fecha_adquisicion, cfdi_uuid,
      monto_original_inversion, tasa_anual_pct, meses_depreciados_previos,
      inpc_adquisicion, inpc_medio_periodo, cuenta_activo_code, cuenta_dep_acum_code,
      cuenta_gasto_dep_code, estatus, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    companyId,
    input.codigo.trim().toUpperCase(),
    input.nombre.trim(),
    input.categoria,
    input.fechaAdquisicion,
    input.cfdiUuid || null,
    fromCents(moiCents),
    input.tasaAnualPct,
    priorMonths,
    input.inpcAdquisicion ?? 132.54,
    input.inpcMedioPeriodo ?? 136.82,
    input.cuentaActivoCode || '156-01-001',
    input.cuentaDepAcumCode || '171-01-001',
    input.cuentaGastoDepCode || '601-01-006',
    estatus,
    now
  );

  return getFixedAssetsResponse(companyId);
}

export function updateFixedAssetRecord(
  assetId: string,
  payload: UpdateFixedAssetInput,
  targetYear?: number,
  targetPeriod?: number
): FixedAssetsResponse | null {
  const row = db.query('SELECT * FROM fixed_assets WHERE id = ?').get(assetId) as FixedAssetDbRow | null;
  if (!row) return null;

  const company = getCompanyById(row.company_id);
  const effYear = targetYear || company?.currentYear || 2026;
  const effPeriod = targetPeriod || company?.currentPeriod || 10;
  assertPeriodOpen(row.company_id, effYear, effPeriod);

  const origAcq = parseCalendarDate(row.fecha_adquisicion);
  assertPeriodOpen(row.company_id, origAcq.year, origAcq.month);
  if (payload.fechaAdquisicion) {
    const nextAcq = parseCalendarDate(payload.fechaAdquisicion);
    assertPeriodOpen(row.company_id, nextAcq.year, nextAcq.month);
  }

  const nextMoi = payload.montoOriginalInversion ?? Number(row.monto_original_inversion);
  const nextRate = payload.tasaAnualPct ?? Number(row.tasa_anual_pct);
  const nextMonths =
    payload.mesesDepreciadosPrevios !== undefined
      ? Math.max(0, Math.floor(payload.mesesDepreciadosPrevios))
      : Number(row.meses_depreciados_previos);
  const nextAccumCents = Math.round((toCents(nextMoi) * (nextRate / 100) * nextMonths) / 12);
  const autoEstatus: FixedAssetRecord['estatus'] =
    payload.estatus !== undefined
      ? payload.estatus
      : row.estatus === 'BAJA'
        ? 'BAJA'
        : toCents(nextMoi) > 0 && nextAccumCents >= toCents(nextMoi)
          ? 'TOTALMENTE_DEPRECIADO'
          : 'ACTIVO';

  db.prepare(`
    UPDATE fixed_assets SET
      codigo = ?, nombre = ?, categoria = ?, fecha_adquisicion = ?,
      monto_original_inversion = ?, tasa_anual_pct = ?, meses_depreciados_previos = ?,
      inpc_adquisicion = ?, inpc_medio_periodo = ?, estatus = ?
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
    assetId
  );

  return getFixedAssetsResponse(row.company_id, effYear, effPeriod);
}

export function deleteFixedAssetRecord(assetId: string): boolean {
  const row = db
    .query('SELECT company_id, fecha_adquisicion FROM fixed_assets WHERE id = ?')
    .get(assetId) as { company_id: string; fecha_adquisicion: string } | null;
  if (!row) return false;

  const { year, month } = parseCalendarDate(row.fecha_adquisicion);
  assertPeriodOpen(row.company_id, year, month);

  const res = db.prepare('DELETE FROM fixed_assets WHERE id = ?').run(assetId);
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
