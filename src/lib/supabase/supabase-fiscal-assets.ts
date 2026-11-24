import { getRequiredSupabase, supabase } from '../supabase';
import { fetchAllRows } from './supabase-pagination';
import { assertSupabasePeriodOpen, supabasePolizas } from './supabase-polizas';
import { supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import {
  buildDepreciationPolizaPlan,
  fromCents,
  sumCents,
  toCents,
  computeFixedAssetWithDepreciation
} from '../../shared/accounting-engine';
import {
  extractDepreciatedAssetCodes,
  hasExistingDepreciationPoliza
} from '../../shared/engine/fixed-assets.engine';
import { MESES_SAT } from '../../shared/sat-constants';
import { getDefaultDateForPeriod } from '../formatters';
import { parseCalendarDate } from '../../shared/date-utils';
import {
  applySupabaseAssetPostDepreciationUpdates,
  executeSupabaseFixedAssetUpdate,
  revertSupabaseDepreciationForPoliza,
  type UpdateFixedAssetPayload
} from './supabase-fiscal-assets-dep';
import type {
  FixedAssetCategory,
  FixedAssetRecord,
  FixedAssetsResponse,
  PeriodLock,
  Poliza,
  ThirdPartyRecord
} from '../../shared/types';
import {
  fetchPeriodLockRecord,
  mapSupabaseFixedAsset,
  mapSupabaseThirdParty,
  saveThirdPartyWithClient,
  upsertPeriodLockRecord
} from './supabase-fiscal-assets-helpers';

export { saveThirdPartyWithClient };
export type { UpdateFixedAssetPayload };

export const supabaseFiscalAndAssets = {
  async getThirdParties(companyId: string): Promise<ThirdPartyRecord[]> {
    if (!supabase) return [];
    const data = await fetchAllRows(async (from, to) =>
      getRequiredSupabase()
        .from('third_parties')
        .select('*')
        .eq('company_id', companyId)
        .order('rfc', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    );
    return data.map((t: Record<string, unknown>) => mapSupabaseThirdParty(t));
  },

  async saveThirdParty(payload: Omit<ThirdPartyRecord, 'id' | 'updatedAt'>): Promise<ThirdPartyRecord> {
    if (!supabase) throw new Error('Supabase no disponible');
    return saveThirdPartyWithClient(supabase, payload);
  },

  async getFixedAssets(
    companyId: string,
    targetYear?: number,
    targetPeriod?: number
  ): Promise<FixedAssetsResponse> {
    const emptyTotals = {
      totalMoi: 0,
      totalDepreciacionMensualContable: 0,
      totalDepreciacionMensualFiscal: 0,
      totalDepreciacionAcumulada: 0,
      totalValorNetoEnLibros: 0
    };
    if (!supabase) return { assets: [], totals: emptyTotals };

    let effYear = targetYear;
    let effPeriod = targetPeriod;
    if (!effYear || !effPeriod) {
      const { data: comp } = await supabase
        .from('companies')
        .select('current_year, current_period')
        .eq('id', companyId)
        .maybeSingle();
      effYear = effYear || Number(comp?.current_year) || 2026;
      effPeriod = effPeriod || Number(comp?.current_period) || 10;
    }

    const data = await fetchAllRows(async (from, to) =>
      getRequiredSupabase()
        .from('fixed_assets')
        .select('*')
        .eq('company_id', companyId)
        .order('fecha_adquisicion', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    );

    const periodPolizas = await supabasePolizas.getPolizas(companyId, effYear, effPeriod);
    const alreadyDepreciatedThisPeriod = hasExistingDepreciationPoliza(periodPolizas);
    const depreciatedAssetCodes = alreadyDepreciatedThisPeriod
      ? extractDepreciatedAssetCodes(periodPolizas)
      : undefined;
    const rawAssets = data.map((f: Record<string, unknown>) => mapSupabaseFixedAsset(f));
    const periodCtx = {
      ejercicio: effYear,
      periodo: effPeriod,
      alreadyDepreciatedThisPeriod,
      depreciatedAssetCodes
    };
    const assets = rawAssets.map((a) => computeFixedAssetWithDepreciation(a, periodCtx));

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
  },

  async createFixedAsset(payload: {
    companyId: string;
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
  }): Promise<FixedAssetsResponse> {
    if (!supabase) throw new Error('Supabase no disponible');
    const { data: comp } = await supabase
      .from('companies')
      .select('current_year, current_period')
      .eq('id', payload.companyId)
      .maybeSingle();
    const activeYear = Number(comp?.current_year) || 2026;
    const activePeriod = Number(comp?.current_period) || 10;
    await assertSupabasePeriodOpen(payload.companyId, activeYear, activePeriod);
    const acq = parseCalendarDate(payload.fechaAdquisicion, activeYear, activePeriod);
    await assertSupabasePeriodOpen(payload.companyId, acq.year, acq.month);
    const priorMonths = Math.max(0, Math.floor(payload.mesesDepreciadosPrevios || 0));
    const moiCents = Math.max(0, toCents(payload.montoOriginalInversion));
    const annualRate = Math.max(0, Math.min(100, payload.tasaAnualPct)) / 100;
    const priorAccumCents = priorMonths > 0 ? Math.round((moiCents * annualRate * priorMonths) / 12) : 0;
    const estatus: FixedAssetRecord['estatus'] =
      moiCents > 0 && priorAccumCents >= moiCents ? 'TOTALMENTE_DEPRECIADO' : 'ACTIVO';

    const id = `fa_${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase.from('fixed_assets').insert({
      id,
      company_id: payload.companyId,
      codigo: payload.codigo.trim().toUpperCase(),
      nombre: payload.nombre.trim(),
      categoria: payload.categoria,
      fecha_adquisicion: payload.fechaAdquisicion,
      cfdi_uuid: payload.cfdiUuid || null,
      monto_original_inversion: payload.montoOriginalInversion,
      tasa_anual_pct: payload.tasaAnualPct,
      meses_depreciados_previos: priorMonths,
      inpc_adquisicion: payload.inpcAdquisicion || 132.54,
      inpc_medio_periodo: payload.inpcMedioPeriodo || 136.82,
      cuenta_activo_code: payload.cuentaActivoCode || '156-01-001',
      cuenta_dep_acum_code: payload.cuentaDepAcumCode || '171-01-001',
      cuenta_gasto_dep_code: payload.cuentaGastoDepCode || '601-01-006',
      estatus,
      created_at: new Date().toISOString()
    });
    if (error) throw new Error(error.message);
    return this.getFixedAssets(payload.companyId);
  },

  async updateFixedAsset(
    assetId: string,
    payload: UpdateFixedAssetPayload,
    targetYear?: number,
    targetPeriod?: number
  ): Promise<FixedAssetsResponse> {
    if (!supabase) throw new Error('Supabase no disponible');
    const { companyId, effYear, effPeriod } = await executeSupabaseFixedAssetUpdate(
      assetId,
      payload,
      targetYear,
      targetPeriod
    );
    return this.getFixedAssets(companyId, effYear, effPeriod);
  },

  async deleteFixedAsset(assetId: string): Promise<{ deleted: boolean }> {
    if (!supabase) return { deleted: false };
    const { data: existing, error: fetchErr } = await supabase
      .from('fixed_assets').select('company_id, fecha_adquisicion').eq('id', assetId).maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing) return { deleted: false };

    const companyId = String(existing.company_id);
    const { data: comp } = await supabase
      .from('companies')
      .select('current_year, current_period')
      .eq('id', companyId)
      .maybeSingle();
    const activeYear = Number(comp?.current_year) || 2026;
    const activePeriod = Number(comp?.current_period) || 10;
    await assertSupabasePeriodOpen(companyId, activeYear, activePeriod);
    const acq = parseCalendarDate(String(existing.fecha_adquisicion || ''), activeYear, activePeriod);
    await assertSupabasePeriodOpen(companyId, acq.year, acq.month);
    const { error } = await supabase.from('fixed_assets').delete().eq('id', assetId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  },

  getPeriodLock: (companyId: string, year?: number, period?: number): Promise<PeriodLock> =>
    fetchPeriodLockRecord(companyId, year, period),

  setPeriodLock: (payload: {
    companyId: string;
    ejercicio: number;
    periodo: number;
    isLocked: boolean;
    notes?: string;
  }): Promise<PeriodLock> => upsertPeriodLockRecord(payload),

  async generateDepreciationPoliza(companyId: string, year?: number, period?: number): Promise<Poliza> {
    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const company = companies.find((c) => c.id === companyId);
    if (!company) throw new Error(`Empresa no encontrada: ${companyId || 'sin ID'}`);
    const ejercicio = year || company.currentYear || 2026;
    const periodo = period || company.currentPeriod || 10;
    await assertSupabasePeriodOpen(companyId, ejercicio, periodo);

    const existing = await supabasePolizas.getPolizas(companyId, ejercicio, periodo);
    if (hasExistingDepreciationPoliza(existing)) {
      throw new Error(
        `Ya existe una póliza de depreciación registrada para ${ejercicio}-${String(periodo).padStart(2, '0')}`
      );
    }

    const periodCtx = { ejercicio, periodo };
    const faResponse = await this.getFixedAssets(companyId, ejercicio, periodo);
    const accounts = await supabaseCompaniesAndAccounts.getAccounts(companyId, ejercicio, periodo);
    const mesNombre = MESES_SAT.find((m) => m.periodo === periodo)?.nombre || `M${periodo}`;
    const periodLabel = `${mesNombre} ${ejercicio}`;

    const plan = buildDepreciationPolizaPlan(faResponse.assets, accounts, periodLabel, periodCtx);
    const fecha = getDefaultDateForPeriod(ejercicio, periodo);

    const poliza = await supabasePolizas.createPoliza({
      companyId,
      tipo: plan.polizaType,
      fecha,
      ejercicio,
      periodo,
      concepto: plan.polizaConcept,
      cfdiUuid: null,
      movements: plan.movements
    });

    if (supabase) {
      const includedCodes = extractDepreciatedAssetCodes([
        { concepto: plan.polizaConcept, movements: plan.movements }
      ]);
      try {
        await applySupabaseAssetPostDepreciationUpdates(companyId, faResponse.assets, includedCodes, periodCtx);
      } catch (err) {
        await supabasePolizas.deletePoliza(poliza.id).catch(() => {});
        throw err;
      }
    }

    return poliza;
  },

  revertDepreciationForPoliza: (
    companyId: string,
    poliza: Pick<Poliza, 'concepto' | 'origin' | 'movements'>
  ): Promise<void> => revertSupabaseDepreciationForPoliza(companyId, poliza)
};
