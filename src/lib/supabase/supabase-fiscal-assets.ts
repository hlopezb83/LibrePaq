import { supabase } from '../supabase';
import { assertSupabasePeriodOpen } from './supabase-polizas';
import {
  fromCents,
  sumCents,
  computeFixedAssetWithDepreciation
} from '../../shared/accounting-engine';
import type {
  Efos69BStatus,
  FixedAssetCategory,
  FixedAssetRecord,
  FixedAssetsResponse,
  PeriodLock,
  ThirdPartyRecord
} from '../../shared/types';

export const supabaseFiscalAndAssets = {
  async getThirdParties(companyId: string): Promise<ThirdPartyRecord[]> {
    if (!supabase) return [];
    const { data } = await supabase
      .from('third_parties')
      .select('*')
      .eq('company_id', companyId);

    return (data || []).map((t: Record<string, unknown>) => ({
      id: String(t.id),
      companyId: String(t.company_id),
      rfc: String(t.rfc),
      nombre: String(t.nombre),
      rol: (t.rol as 'PROVEEDOR' | 'CLIENTE' | 'AMBOS') || 'PROVEEDOR',
      cuentaOperacionCode: String(t.cuenta_operacion_code || '201-01-001'),
      cuentaContrapartidaCode: String(t.cuenta_contrapartida_code || '601-01-001'),
      tipoTerceroDiot: (t.tipo_tercero_diot as '04' | '05') || '04',
      tipoOperacionDiot: (t.tipo_operacion_diot as '03' | '06' | '85') || '85',
      tasaIvaDefault: (t.tasa_iva_default === 8 ? 8 : t.tasa_iva_default === 0 ? 0 : 16) as 16 | 8 | 0,
      estatus69B: (t.estatus_69b || 'LIMPIO') as Efos69BStatus,
      updatedAt: String(t.updated_at || new Date().toISOString())
    }));
  },

  async saveThirdParty(payload: {
    companyId: string;
    rfc: string;
    nombre: string;
    rol: 'PROVEEDOR' | 'CLIENTE' | 'AMBOS';
    cuentaOperacionCode: string;
    cuentaContrapartidaCode: string;
    tipoTerceroDiot: '04' | '05';
    tipoOperacionDiot: '03' | '06' | '85';
    tasaIvaDefault: 16 | 8 | 0;
    estatus69B: Efos69BStatus;
  }): Promise<ThirdPartyRecord> {
    if (!supabase) throw new Error('Supabase no disponible');
    const id = `tp_${payload.companyId}_${payload.rfc.toUpperCase()}`;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('third_parties')
      .upsert({
        id,
        company_id: payload.companyId,
        rfc: payload.rfc.toUpperCase(),
        nombre: payload.nombre.trim(),
        rol: payload.rol,
        cuenta_operacion_code: payload.cuentaOperacionCode,
        cuenta_contrapartida_code: payload.cuentaContrapartidaCode,
        tipo_tercero_diot: payload.tipoTerceroDiot,
        tipo_operacion_diot: payload.tipoOperacionDiot,
        tasa_iva_default: payload.tasaIvaDefault,
        estatus_69b: payload.estatus69B,
        updated_at: now
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return {
      id: String(data.id),
      companyId: String(data.company_id),
      rfc: String(data.rfc),
      nombre: String(data.nombre),
      rol: data.rol,
      cuentaOperacionCode: data.cuenta_operacion_code,
      cuentaContrapartidaCode: data.cuenta_contrapartida_code,
      tipoTerceroDiot: data.tipo_tercero_diot,
      tipoOperacionDiot: data.tipo_operacion_diot,
      tasaIvaDefault: data.tasa_iva_default as 16 | 8 | 0,
      estatus69B: data.estatus_69b as Efos69BStatus,
      updatedAt: data.updated_at
    };
  },

  async getFixedAssets(companyId: string): Promise<FixedAssetsResponse> {
    const emptyTotals = {
      totalMoi: 0,
      totalDepreciacionMensualContable: 0,
      totalDepreciacionMensualFiscal: 0,
      totalDepreciacionAcumulada: 0,
      totalValorNetoEnLibros: 0
    };
    if (!supabase) return { assets: [], totals: emptyTotals };

    const { data } = await supabase
      .from('fixed_assets')
      .select('*')
      .eq('company_id', companyId)
      .order('fecha_adquisicion', { ascending: true });

    const rawAssets: FixedAssetRecord[] = (data || []).map((f: Record<string, unknown>) => ({
      id: String(f.id),
      companyId: String(f.company_id),
      codigo: String(f.codigo),
      nombre: String(f.nombre),
      categoria: (f.categoria as FixedAssetCategory) || 'OTRO',
      fechaAdquisicion: String(f.fecha_adquisicion),
      cfdiUuid: f.cfdi_uuid ? String(f.cfdi_uuid) : null,
      montoOriginalInversion: Number(f.monto_original_inversion || 0),
      tasaAnualPct: Number(f.tasa_anual_pct || 10),
      mesesDepreciadosPrevios: Number(f.meses_depreciados_previos || 0),
      inpcAdquisicion: Number(f.inpc_adquisicion || 138),
      inpcMedioPeriodo: Number(f.inpc_medio_periodo || 138),
      cuentaActivoCode: String(f.cuenta_activo_code || '156-01-001'),
      cuentaDepAcumCode: String(f.cuenta_dep_acum_code || '171-01-001'),
      cuentaGastoDepCode: String(f.cuenta_gasto_dep_code || '601-01-006'),
      estatus: (f.estatus as 'ACTIVO' | 'BAJA' | 'TOTALMENTE_DEPRECIADO') || 'ACTIVO',
      createdAt: String(f.created_at || new Date().toISOString())
    }));

    const assets = rawAssets.map((a) => computeFixedAssetWithDepreciation(a));

    return {
      assets,
      totals: {
        totalMoi: fromCents(sumCents(assets.map((a) => a.montoOriginalInversion))),
        totalDepreciacionMensualContable: fromCents(
          sumCents(assets.map((a) => a.depreciacionMensualContable))
        ),
        totalDepreciacionMensualFiscal: fromCents(
          sumCents(assets.map((a) => a.depreciacionMensualFiscalActualizada))
        ),
        totalDepreciacionAcumulada: fromCents(
          sumCents(assets.map((a) => a.depreciacionAcumuladaTotal))
        ),
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
    const acqYear = parseInt(payload.fechaAdquisicion.slice(0, 4), 10);
    const acqPeriod = parseInt(payload.fechaAdquisicion.slice(5, 7), 10);
    if (acqYear && acqPeriod) {
      await assertSupabasePeriodOpen(payload.companyId, acqYear, acqPeriod);
    }
    const id = `fa_${Date.now().toString(36)}`;
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
      meses_depreciados_previos: payload.mesesDepreciadosPrevios || 0,
      inpc_adquisicion: payload.inpcAdquisicion || 132.54,
      inpc_medio_periodo: payload.inpcMedioPeriodo || 136.82,
      cuenta_activo_code: payload.cuentaActivoCode || '156-01-001',
      cuenta_dep_acum_code: payload.cuentaDepAcumCode || '171-01-001',
      cuenta_gasto_dep_code: payload.cuentaGastoDepCode || '601-01-006',
      estatus: 'ACTIVO',
      created_at: new Date().toISOString()
    });
    if (error) throw new Error(error.message);
    return this.getFixedAssets(payload.companyId);
  },

  async deleteFixedAsset(assetId: string): Promise<{ deleted: boolean }> {
    if (!supabase) return { deleted: false };
    const { error } = await supabase.from('fixed_assets').delete().eq('id', assetId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  },

  async getPeriodLock(
    companyId: string,
    year?: number,
    period?: number
  ): Promise<PeriodLock> {
    const currentYear = year || 2026;
    const currentPeriod = period || 10;
    if (!supabase) {
      return {
        companyId,
        ejercicio: currentYear,
        periodo: currentPeriod,
        isLocked: false,
        lockedAt: null,
        notes: ''
      };
    }
    const { data } = await supabase
      .from('period_locks')
      .select('*')
      .eq('company_id', companyId)
      .eq('ejercicio', currentYear)
      .eq('periodo', currentPeriod)
      .maybeSingle();

    if (!data) {
      return {
        companyId,
        ejercicio: currentYear,
        periodo: currentPeriod,
        isLocked: false,
        lockedAt: null,
        notes: ''
      };
    }
    return {
      companyId: String(data.company_id || companyId),
      ejercicio: Number(data.ejercicio || currentYear),
      periodo: Number(data.periodo || currentPeriod),
      isLocked: Boolean(data.is_locked),
      lockedAt: data.locked_at ? String(data.locked_at) : null,
      notes: data.notes ? String(data.notes) : ''
    };
  },

  async setPeriodLock(payload: {
    companyId: string;
    ejercicio: number;
    periodo: number;
    isLocked: boolean;
    notes?: string;
  }): Promise<PeriodLock> {
    if (!supabase) throw new Error('Supabase no disponible');
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('period_locks')
      .upsert(
        {
          company_id: payload.companyId,
          ejercicio: payload.ejercicio,
          periodo: payload.periodo,
          is_locked: payload.isLocked,
          locked_at: payload.isLocked ? now : null,
          notes: payload.notes || ''
        },
        { onConflict: 'company_id,ejercicio,periodo' }
      )
      .select()
      .single();

    if (error) throw new Error(error.message);
    return {
      companyId: String(data.company_id),
      ejercicio: Number(data.ejercicio),
      periodo: Number(data.periodo),
      isLocked: Boolean(data.is_locked),
      lockedAt: data.locked_at ? String(data.locked_at) : null,
      notes: data.notes ? String(data.notes) : ''
    };
  }
};
