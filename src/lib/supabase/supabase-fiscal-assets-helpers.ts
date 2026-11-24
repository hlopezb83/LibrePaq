import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { logCompanyAuditEvent } from './audit-logger';
import type {
  Efos69BStatus,
  FixedAssetCategory,
  FixedAssetRecord,
  PeriodLock,
  ThirdPartyRecord
} from '../../shared/types';

export type ThirdPartyWithBackupAliases = ThirdPartyRecord & {
  deductiblePct?: number;
  estatus69b?: Efos69BStatus;
};

export function mapSupabaseThirdParty(t: Record<string, unknown>): ThirdPartyWithBackupAliases {
  const estatus = (t.estatus_69b || t.estatus69B || t.estatus69b || 'LIMPIO') as Efos69BStatus;
  return {
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
    deductiblePct: Number(t.deductible_pct ?? t.deductiblePct ?? 100),
    estatus69B: estatus,
    estatus69b: estatus,
    updatedAt: String(t.updated_at || new Date().toISOString())
  };
}

export function mapSupabaseFixedAsset(f: Record<string, unknown>): FixedAssetRecord {
  return {
    id: String(f.id),
    companyId: String(f.company_id),
    codigo: String(f.codigo),
    nombre: String(f.nombre),
    categoria: (f.categoria as FixedAssetCategory) || 'COMPUTO_30',
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
  };
}

export async function saveThirdPartyWithClient(
  client: SupabaseClient,
  payload: Omit<ThirdPartyWithBackupAliases, 'id' | 'updatedAt'>
): Promise<ThirdPartyWithBackupAliases> {
  const cleanRfc = payload.rfc.trim().toUpperCase();
  const { data: existing, error: lookupErr } = await client
    .from('third_parties')
    .select('id')
    .eq('company_id', payload.companyId)
    .eq('rfc', cleanRfc)
    .maybeSingle();
  if (lookupErr) throw new Error(lookupErr.message);

  const id = existing?.id ? String(existing.id) : `tp_${payload.companyId}_${cleanRfc}`;
  const now = new Date().toISOString();
  const resolvedEstatus69B = payload.estatus69B || payload.estatus69b || 'LIMPIO';
  const resolvedDeductiblePct = Math.max(0, Math.min(100, Number(payload.deductiblePct ?? 100)));

  const { data, error } = await client
    .from('third_parties')
    .upsert(
      {
        id,
        company_id: payload.companyId,
        rfc: cleanRfc,
        nombre: payload.nombre.trim(),
        rol: payload.rol,
        cuenta_operacion_code: payload.cuentaOperacionCode,
        cuenta_contrapartida_code: payload.cuentaContrapartidaCode,
        tipo_tercero_diot: payload.tipoTerceroDiot,
        tipo_operacion_diot: payload.tipoOperacionDiot,
        tasa_iva_default: payload.tasaIvaDefault,
        deductible_pct: resolvedDeductiblePct,
        estatus_69b: resolvedEstatus69B,
        updated_at: now
      },
      { onConflict: 'company_id,rfc' }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapSupabaseThirdParty(data as Record<string, unknown>);
}

export async function fetchPeriodLockRecord(
  companyId: string,
  year?: number,
  period?: number
): Promise<PeriodLock> {
  const currentYear = year || 2026;
  const currentPeriod = period || 10;
  if (!supabase) {
    return { companyId, ejercicio: currentYear, periodo: currentPeriod, isLocked: false, lockedAt: null, notes: '' };
  }
  const { data } = await supabase
    .from('period_locks')
    .select('*')
    .eq('company_id', companyId)
    .eq('ejercicio', currentYear)
    .eq('periodo', currentPeriod)
    .maybeSingle();
  if (!data) {
    return { companyId, ejercicio: currentYear, periodo: currentPeriod, isLocked: false, lockedAt: null, notes: '' };
  }
  return {
    companyId: String(data.company_id || companyId),
    ejercicio: Number(data.ejercicio || currentYear),
    periodo: Number(data.periodo || currentPeriod),
    isLocked: Boolean(data.is_locked),
    lockedAt: data.locked_at ? String(data.locked_at) : null,
    notes: data.notes ? String(data.notes) : ''
  };
}

export async function upsertPeriodLockRecord(payload: {
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
  logCompanyAuditEvent({
    companyId: payload.companyId,
    action: payload.isLocked ? 'PERIOD_LOCK' : 'PERIOD_UNLOCK',
    entityType: 'period_lock',
    entityId: `${payload.ejercicio}-${payload.periodo}`,
    metadata: { ejercicio: payload.ejercicio, periodo: payload.periodo }
  });
  return {
    companyId: String(data.company_id),
    ejercicio: Number(data.ejercicio),
    periodo: Number(data.periodo),
    isLocked: Boolean(data.is_locked),
    lockedAt: data.locked_at ? String(data.locked_at) : null,
    notes: data.notes ? String(data.notes) : ''
  };
}
