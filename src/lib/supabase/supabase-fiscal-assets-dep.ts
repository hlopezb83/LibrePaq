import { getRequiredSupabase } from '../supabase';
import { toCents } from '../../shared/accounting-engine';
import { parseCalendarDate } from '../../shared/date-utils';
import {
  computeAssetPostDepreciationUpdate,
  extractDepreciatedAssetCodes,
  hasExistingDepreciationPoliza
} from '../../shared/engine/fixed-assets.engine';
import type { FixedAssetCategory, FixedAssetRecord, Poliza } from '../../shared/types';
import { logCompanyAuditEvent } from './audit-logger';
import { fetchAllRows } from './supabase-pagination';
import { assertSupabasePeriodOpen } from './supabase-polizas';

export interface UpdateFixedAssetPayload {
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

export async function executeSupabaseFixedAssetUpdate(
  assetId: string,
  payload: UpdateFixedAssetPayload,
  targetYear?: number,
  targetPeriod?: number
): Promise<{ companyId: string; effYear: number; effPeriod: number }> {
  const sb = getRequiredSupabase();
  const { data: existing, error: fetchErr } = await sb
    .from('fixed_assets').select('*').eq('id', assetId).maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!existing) throw new Error('Activo fijo no encontrado');

  const companyId = String(existing.company_id);
  const { data: comp } = await sb
    .from('companies').select('current_year, current_period').eq('id', companyId).maybeSingle();
  const effYear = targetYear || Number(comp?.current_year) || 2026;
  const effPeriod = targetPeriod || Number(comp?.current_period) || 10;
  await assertSupabasePeriodOpen(companyId, effYear, effPeriod);
  const origAcq = parseCalendarDate(String(existing.fecha_adquisicion || ''), effYear, effPeriod);
  await assertSupabasePeriodOpen(companyId, origAcq.year, origAcq.month);
  if (payload.fechaAdquisicion) {
    const nextAcq = parseCalendarDate(payload.fechaAdquisicion, effYear, effPeriod);
    await assertSupabasePeriodOpen(companyId, nextAcq.year, nextAcq.month);
  }

  const nextMoi = payload.montoOriginalInversion ?? Number(existing.monto_original_inversion || 0);
  const nextRate = payload.tasaAnualPct ?? Number(existing.tasa_anual_pct || 10);
  const nextMonths =
    payload.mesesDepreciadosPrevios !== undefined
      ? Math.max(0, Math.floor(payload.mesesDepreciadosPrevios))
      : Number(existing.meses_depreciados_previos || 0);
  const nextAccumCents = Math.round((toCents(nextMoi) * (nextRate / 100) * nextMonths) / 12);
  const autoEstatus: FixedAssetRecord['estatus'] =
    payload.estatus !== undefined
      ? payload.estatus
      : existing.estatus === 'BAJA'
        ? 'BAJA'
        : toCents(nextMoi) > 0 && nextAccumCents >= toCents(nextMoi)
          ? 'TOTALMENTE_DEPRECIADO'
          : 'ACTIVO';

  const { error } = await sb
    .from('fixed_assets')
    .update({
      ...(payload.codigo !== undefined ? { codigo: payload.codigo.trim().toUpperCase() } : {}),
      ...(payload.nombre !== undefined ? { nombre: payload.nombre.trim() } : {}),
      ...(payload.categoria !== undefined ? { categoria: payload.categoria } : {}),
      ...(payload.fechaAdquisicion !== undefined ? { fecha_adquisicion: payload.fechaAdquisicion } : {}),
      monto_original_inversion: nextMoi,
      tasa_anual_pct: nextRate,
      meses_depreciados_previos: nextMonths,
      ...(payload.inpcAdquisicion !== undefined ? { inpc_adquisicion: payload.inpcAdquisicion } : {}),
      ...(payload.inpcMedioPeriodo !== undefined ? { inpc_medio_periodo: payload.inpcMedioPeriodo } : {}),
      estatus: autoEstatus
    })
    .eq('id', assetId);
  if (error) throw new Error(error.message);

  logCompanyAuditEvent({
    companyId,
    action: autoEstatus === 'BAJA' ? 'FIXED_ASSET_BAJA' : 'FIXED_ASSET_UPDATE',
    entityType: 'fixed_assets',
    entityId: assetId,
    metadata: { estatus: autoEstatus, mesesDepreciadosPrevios: nextMonths }
  });
  return { companyId, effYear, effPeriod };
}

export async function applySupabaseAssetPostDepreciationUpdates(
  companyId: string,
  assets: readonly FixedAssetRecord[],
  includedCodes: ReadonlySet<string>,
  periodCtx: { ejercicio: number; periodo: number }
): Promise<void> {
  const sb = getRequiredSupabase();
  const appliedPrev: Array<{ id: string; mesesDepreciadosPrevios: number; estatus: FixedAssetRecord['estatus'] }> = [];

  try {
    for (const asset of assets) {
      if (!includedCodes.has(asset.codigo)) continue;
      const nextUpdate = computeAssetPostDepreciationUpdate(asset, periodCtx);
      if (!nextUpdate) continue;

      const { error } = await sb
        .from('fixed_assets')
        .update({
          meses_depreciados_previos: nextUpdate.mesesDepreciadosPrevios,
          estatus: nextUpdate.estatus
        })
        .eq('id', asset.id)
        .eq('company_id', companyId);
      if (error) throw new Error(error.message);

      appliedPrev.push({
        id: asset.id,
        mesesDepreciadosPrevios: asset.mesesDepreciadosPrevios,
        estatus: asset.estatus
      });
    }
  } catch (err) {
    for (const prev of appliedPrev) {
      await sb
        .from('fixed_assets')
        .update({
          meses_depreciados_previos: prev.mesesDepreciadosPrevios,
          estatus: prev.estatus
        })
        .eq('id', prev.id)
        .eq('company_id', companyId);
    }
    throw err;
  }
}

export async function revertSupabaseDepreciationForPoliza(
  companyId: string,
  poliza: Pick<Poliza, 'concepto' | 'origin' | 'movements'>
): Promise<void> {
  if (!hasExistingDepreciationPoliza([poliza])) return;
  const codes = extractDepreciatedAssetCodes([poliza]);
  if (codes.size === 0) return;

  const sb = getRequiredSupabase();
  const rows = await fetchAllRows(async (from, to) =>
    sb
      .from('fixed_assets')
      .select('id, codigo, meses_depreciados_previos, estatus')
      .eq('company_id', companyId)
      .order('id', { ascending: true })
      .range(from, to)
  );

  for (const r of rows as Array<Record<string, unknown>>) {
    const codigo = String(r.codigo || '');
    if (!codes.has(codigo)) continue;
    const prevMonths = Math.max(0, Math.floor(Number(r.meses_depreciados_previos || 0)) - 1);
    const curStatus = String(r.estatus || 'ACTIVO');
    const nextStatus = curStatus === 'TOTALMENTE_DEPRECIADO' ? 'ACTIVO' : curStatus;

    const { error } = await sb
      .from('fixed_assets')
      .update({
        meses_depreciados_previos: prevMonths,
        estatus: nextStatus
      })
      .eq('id', String(r.id))
      .eq('company_id', companyId);
    if (error) throw new Error(error.message);
  }
}
