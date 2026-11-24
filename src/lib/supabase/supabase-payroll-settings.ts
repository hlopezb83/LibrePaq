import { isGuestDemoMode } from '../sandbox/guest-demo-mode';
import { createReadOnlyGuardedClient } from '../support-impersonation';
import { supabase } from '../supabase';
import { MEXICO_ISN_RATES } from '../../shared/engine/payroll-summary.engine';
import { fromCents, toCents } from '../../shared/engine/invariants-and-math';
import { assertSupabasePeriodOpen } from './supabase-polizas-mappers';

export interface PayrollPeriodSettingsRecord {
  companyId: string;
  ejercicio: number;
  periodo: number;
  stateCode: string;
  isnRate: number;
  imssPatronal: number;
  rcv: number;
  infonavit: number;
}

const DEFAULT_STATE = 'CMX';
const inMemoryPayrollSettings = new Map<string, PayrollPeriodSettingsRecord>();

function getDefaultIsnRate(stateCode: string): number {
  return MEXICO_ISN_RATES.find((s) => s.code === stateCode.toUpperCase())?.ratePct ?? 4.0;
}

function buildStorageKey(companyId: string, ejercicio: number, periodo: number): string {
  return `lp_payroll_settings_${companyId}_${ejercicio}_${periodo}`;
}

function readLocalFallback(
  companyId: string,
  ejercicio: number,
  periodo: number
): PayrollPeriodSettingsRecord {
  const key = buildStorageKey(companyId, ejercicio, periodo);
  const mem = inMemoryPayrollSettings.get(key);
  if (mem) return { ...mem };
  const fallback: PayrollPeriodSettingsRecord = {
    companyId,
    ejercicio,
    periodo,
    stateCode: DEFAULT_STATE,
    isnRate: getDefaultIsnRate(DEFAULT_STATE),
    imssPatronal: 0,
    rcv: 0,
    infonavit: 0
  };
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PayrollPeriodSettingsRecord>;
    const stateCode = (parsed.stateCode || DEFAULT_STATE).toUpperCase();
    return {
      companyId,
      ejercicio,
      periodo,
      stateCode,
      isnRate: Number.isFinite(Number(parsed.isnRate))
        ? Math.max(0, Number(parsed.isnRate))
        : getDefaultIsnRate(stateCode),
      imssPatronal: fromCents(Math.max(0, toCents(Number(parsed.imssPatronal ?? 0)))),
      rcv: fromCents(Math.max(0, toCents(Number(parsed.rcv ?? 0)))),
      infonavit: fromCents(Math.max(0, toCents(Number(parsed.infonavit ?? 0))))
    };
  } catch {
    return fallback;
  }
}

function writeLocalFallback(record: PayrollPeriodSettingsRecord): void {
  const key = buildStorageKey(record.companyId, record.ejercicio, record.periodo);
  inMemoryPayrollSettings.set(key, { ...record });
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(record));
  } catch {
    // Ignore quota/storage errors
  }
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('payroll_period_settings') && msg.includes('does not exist')
  );
}

async function hasActiveSupabaseSession(): Promise<boolean> {
  if (!supabase || isGuestDemoMode()) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data?.session);
  } catch {
    return false;
  }
}

export async function getPayrollPeriodSettings(
  companyId: string,
  ejercicio: number,
  periodo: number
): Promise<PayrollPeriodSettingsRecord> {
  if (!companyId || !(await hasActiveSupabaseSession()) || !supabase) {
    return readLocalFallback(companyId, ejercicio, periodo);
  }

  const { data, error } = await supabase
    .from('payroll_period_settings')
    .select('*')
    .eq('company_id', companyId)
    .eq('ejercicio', ejercicio)
    .eq('periodo', periodo)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return readLocalFallback(companyId, ejercicio, periodo);
    }
    throw new Error(error.message);
  }

  if (!data) {
    return readLocalFallback(companyId, ejercicio, periodo);
  }

  const stateCode = String(data.state_code || DEFAULT_STATE).toUpperCase();
  const record: PayrollPeriodSettingsRecord = {
    companyId,
    ejercicio,
    periodo,
    stateCode,
    isnRate: Number.isFinite(Number(data.isn_rate))
      ? Math.max(0, Number(data.isn_rate))
      : getDefaultIsnRate(stateCode),
    imssPatronal: fromCents(Math.max(0, toCents(Number(data.imss_patronal ?? 0)))),
    rcv: fromCents(Math.max(0, toCents(Number(data.rcv ?? 0)))),
    infonavit: fromCents(Math.max(0, toCents(Number(data.infonavit ?? 0))))
  };
  writeLocalFallback(record);
  return record;
}

const rawPayrollSettingsWriter = {
  async savePayrollPeriodSettings(
    payload: PayrollPeriodSettingsRecord
  ): Promise<PayrollPeriodSettingsRecord> {
    const stateCode = (payload.stateCode || DEFAULT_STATE).toUpperCase();
    const normalized: PayrollPeriodSettingsRecord = {
      companyId: payload.companyId,
      ejercicio: Math.round(payload.ejercicio),
      periodo: Math.round(payload.periodo),
      stateCode,
      isnRate: Number.isFinite(payload.isnRate)
        ? Math.max(0, Number(payload.isnRate.toFixed(3)))
        : getDefaultIsnRate(stateCode),
      imssPatronal: fromCents(Math.max(0, toCents(payload.imssPatronal))),
      rcv: fromCents(Math.max(0, toCents(payload.rcv))),
      infonavit: fromCents(Math.max(0, toCents(payload.infonavit)))
    };

    const activeSession = await hasActiveSupabaseSession();
    if (activeSession && supabase) {
      await assertSupabasePeriodOpen(normalized.companyId, normalized.ejercicio, normalized.periodo);
    }

    writeLocalFallback(normalized);

    if (!activeSession || !supabase) return normalized;

    const { error } = await supabase.from('payroll_period_settings').upsert(
      {
        company_id: normalized.companyId,
        ejercicio: normalized.ejercicio,
        periodo: normalized.periodo,
        state_code: normalized.stateCode,
        isn_rate: normalized.isnRate,
        imss_patronal: normalized.imssPatronal,
        rcv: normalized.rcv,
        infonavit: normalized.infonavit,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'company_id,ejercicio,periodo' }
    );

    if (error) {
      if (isMissingTableError(error)) return normalized;
      throw new Error(error.message);
    }
    return normalized;
  }
};

const guardedPayrollSettingsWriter = createReadOnlyGuardedClient(
  rawPayrollSettingsWriter,
  new Set(['savePayrollPeriodSettings'])
);

export async function savePayrollPeriodSettings(
  payload: PayrollPeriodSettingsRecord
): Promise<PayrollPeriodSettingsRecord> {
  return await guardedPayrollSettingsWriter.savePayrollPeriodSettings(payload);
}
