import { isSupabaseConfigured, supabase } from '../supabase';
import { apiClient } from '../api-client';
import { isGuestDemoMode } from '../sandbox/guest-demo-mode';
import { parseCalendarDate } from '../../shared/date-utils';
import { fromCents, toCents } from '../../shared/accounting-engine';
import type { Company } from '../../shared/types';

export type FielTrafficLightStatus = 'VIGENTE' | 'POR_VENCER' | 'VENCIDA' | 'SIN_FIEL';
export type MonitorOverallStatus = 'VERDE' | 'AMARILLO' | 'ROJO';

export interface DespachoClientHealthRow {
  companyId: string;
  companyName: string;
  rfc: string;
  regimenFiscal: string;
  ejercicio: number;
  periodo: number;
  periodLockStatus: 'ABIERTO' | 'BLOQUEADO_SAT';
  pendingCfdisCount: number;
  pendingBankLinesCount: number;
  hasSavedTaxParams: boolean;
  ivaNetoAPagar: number;
  isrNetoAPagar: number;
  dia17Ready: boolean;
  fielStatus: FielTrafficLightStatus;
  fielValidTo: string | null;
  fielDaysRemaining: number | null;
  overallTrafficLight: MonitorOverallStatus;
}

export function computeFielTrafficLight(
  validTo: string | null | undefined,
  hasCredentials: boolean,
  nowMs: number = Date.now()
): { status: FielTrafficLightStatus; daysRemaining: number | null } {
  if (!hasCredentials || !validTo) {
    return { status: 'SIN_FIEL', daysRemaining: null };
  }
  const expiresMs = Date.parse(validTo);
  if (!Number.isFinite(expiresMs)) {
    return { status: 'SIN_FIEL', daysRemaining: null };
  }
  const diffDays = Math.ceil((expiresMs - nowMs) / 86_400_000);
  if (diffDays <= 0) {
    return { status: 'VENCIDA', daysRemaining: diffDays };
  }
  if (diffDays <= 30) {
    return { status: 'POR_VENCER', daysRemaining: diffDays };
  }
  return { status: 'VIGENTE', daysRemaining: diffDays };
}

export function computeOverallClientTrafficLight(params: {
  fielStatus: FielTrafficLightStatus;
  pendingCfdisCount: number;
  pendingBankLinesCount: number;
  periodLockStatus: 'ABIERTO' | 'BLOQUEADO_SAT';
  dia17Ready: boolean;
}): MonitorOverallStatus {
  if (
    params.fielStatus === 'VENCIDA' ||
    (params.pendingCfdisCount > 0 && params.periodLockStatus === 'BLOQUEADO_SAT')
  ) {
    return 'ROJO';
  }
  if (
    params.pendingCfdisCount > 0 ||
    params.pendingBankLinesCount > 0 ||
    !params.dia17Ready ||
    params.fielStatus === 'POR_VENCER' ||
    params.fielStatus === 'SIN_FIEL'
  ) {
    return 'AMARILLO';
  }
  return 'VERDE';
}

function shouldUseCloudMonitor(): boolean {
  return (
    typeof window !== 'undefined' &&
    isSupabaseConfigured &&
    Boolean(supabase) &&
    !isGuestDemoMode() &&
    (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'))
  );
}

async function fetchDespachoMonitorCloud(
  companies: readonly Company[]
): Promise<DespachoClientHealthRow[]> {
  const client = supabase!;
  const ids = companies.map((c) => c.id);
  const [locksRes, cfdisRes, bankRes, taxRes, fielRes] = await Promise.all([
    client.from('period_locks').select('company_id, ejercicio, periodo, is_locked').in('company_id', ids),
    client
      .from('cfdi_documents')
      .select('company_id, fecha, fecha_pago, tipo_comprobante, direction, metodo_pago, status_sat, poliza_id, total, iva_trasladado, subtotal, moneda, tipo_cambio')
      .in('company_id', ids),
    client
      .from('bank_statement_lines')
      .select('company_id, ejercicio, periodo, matched_movement_id')
      .in('company_id', ids)
      .is('matched_movement_id', null),
    client.from('tax_parameters').select('company_id, ejercicio, periodo').in('company_id', ids),
    client.from('fiel_credentials').select('company_id, valid_to').in('company_id', ids)
  ]);

  const lockMap = new Map<string, boolean>();
  for (const r of (locksRes.data || []) as Array<{ company_id: string; ejercicio: number; periodo: number; is_locked: boolean }>) {
    lockMap.set(`${r.company_id}:${r.ejercicio}:${r.periodo}`, Boolean(r.is_locked));
  }

  const taxSet = new Set<string>();
  for (const r of (taxRes.data || []) as Array<{ company_id: string; ejercicio: number }>) {
    taxSet.add(`${r.company_id}:${r.ejercicio}`);
  }

  const fielMap = new Map<string, string | null>();
  for (const r of (fielRes.data || []) as Array<{ company_id: string; valid_to: string | null }>) {
    fielMap.set(r.company_id, r.valid_to);
  }

  const nowMs = Date.now();
  return companies.map((comp) => {
    const ejercicio = comp.currentYear || 2026;
    const periodo = comp.currentPeriod || 10;
    const isLocked = lockMap.get(`${comp.id}:${ejercicio}:${periodo}`) ?? false;
    const periodLockStatus: 'ABIERTO' | 'BLOQUEADO_SAT' = isLocked ? 'BLOQUEADO_SAT' : 'ABIERTO';

    let pendingCfdisCount = 0;
    let ivaTrasCents = 0;
    let ivaAcredCents = 0;
    let hasCfdiInPeriod = false;

    for (const c of (cfdisRes.data || []) as Array<Record<string, unknown>>) {
      if (c.company_id !== comp.id) continue;
      if (c.status_sat === 'CANCELADO' || c.tipo_comprobante === 'T') continue;
      const totalCents = toCents(Number(c.total || 0));
      if (!c.poliza_id && totalCents > 0) {
        pendingCfdisCount += 1;
      }
      const effDate = String(c.tipo_comprobante === 'P' ? (c.fecha_pago || c.fecha || '') : (c.fecha || ''));
      const cal = parseCalendarDate(effDate, ejercicio, periodo);
      if (cal.year === ejercicio && cal.month === periodo) {
        hasCfdiInPeriod = true;
        if (c.metodo_pago === 'PUE' || c.tipo_comprobante === 'P') {
          const tc = c.moneda && String(c.moneda).toUpperCase() !== 'MXN' ? Number(c.tipo_cambio || 1) : 1;
          const ivaC = toCents(Number(c.iva_trasladado || 0) * tc) * (c.tipo_comprobante === 'E' ? -1 : 1);
          if (c.direction === 'EMITIDO') ivaTrasCents += ivaC;
          else ivaAcredCents += ivaC;
        }
      }
    }

    let pendingBankLinesCount = 0;
    for (const b of (bankRes.data || []) as Array<{ company_id: string; ejercicio: number; periodo: number }>) {
      if (b.company_id === comp.id && Number(b.ejercicio) === ejercicio && Number(b.periodo) === periodo) {
        pendingBankLinesCount += 1;
      }
    }

    const hasSavedTaxParams = taxSet.has(`${comp.id}:${ejercicio}`);
    const ivaNetoAPagar = fromCents(Math.max(0, ivaTrasCents - ivaAcredCents));
    const dia17Ready = hasSavedTaxParams && (hasCfdiInPeriod || ivaTrasCents > 0 || ivaAcredCents > 0);
    const validTo = fielMap.has(comp.id) ? (fielMap.get(comp.id) ?? null) : null;
    const fiel = computeFielTrafficLight(validTo, fielMap.has(comp.id), nowMs);

    return {
      companyId: comp.id,
      companyName: comp.name,
      rfc: comp.rfc,
      regimenFiscal: comp.regimenFiscal,
      ejercicio,
      periodo,
      periodLockStatus,
      pendingCfdisCount,
      pendingBankLinesCount,
      hasSavedTaxParams,
      ivaNetoAPagar,
      isrNetoAPagar: 0,
      dia17Ready,
      fielStatus: fiel.status,
      fielValidTo: validTo,
      fielDaysRemaining: fiel.daysRemaining,
      overallTrafficLight: computeOverallClientTrafficLight({
        fielStatus: fiel.status,
        pendingCfdisCount,
        pendingBankLinesCount,
        periodLockStatus,
        dia17Ready
      })
    };
  });
}

async function fetchDespachoMonitorLocal(
  companies: readonly Company[]
): Promise<DespachoClientHealthRow[]> {
  const nowMs = Date.now();
  const rows = await Promise.all(
    companies.map(async (comp) => {
      const ejercicio = comp.currentYear || 2026;
      const periodo = comp.currentPeriod || 10;
      const [lock, cfdis, accounts, taxParams, fiel] = await Promise.all([
        apiClient.getPeriodLock(comp.id, ejercicio, periodo).catch(() => null),
        apiClient.getCfdis(comp.id).catch(() => []),
        apiClient.getAccounts(comp.id, ejercicio, periodo).catch(() => []),
        apiClient.getTaxParameters(comp.id, ejercicio, periodo).catch(() => null),
        apiClient.getFielStatus(comp.id).catch(() => null)
      ]);

      const bankAcc = accounts.find((a) => a.code === '102-01-001' || a.code.startsWith('102'));
      const bankRec = bankAcc
        ? await apiClient.getBankReconciliation(comp.id, bankAcc.id, ejercicio, periodo).catch(() => null)
        : null;
      const workpaper = await apiClient.getFiscalWorkpaper(comp.id, ejercicio, periodo).catch(() => null);

      const periodLockStatus: 'ABIERTO' | 'BLOQUEADO_SAT' = lock?.isLocked ? 'BLOQUEADO_SAT' : 'ABIERTO';
      const pendingCfdisCount = cfdis.filter(
        (c) => !c.polizaId && c.statusSat !== 'CANCELADO' && c.tipoComprobante !== 'T' && toCents(c.total) > 0
      ).length;
      const pendingBankLinesCount = bankRec?.summary.movimientosPendientesBanco ?? 0;
      const hasSavedTaxParams = Boolean(
        taxParams &&
          (taxParams.coeficienteUtilidad > 0 ||
            taxParams.tipoCambioDofCierre > 0 ||
            taxParams.saldoFavorIvaAnterior > 0 ||
            taxParams.pagosProvisionalesAnteriores > 0)
      );
      const ivaNetoAPagar = workpaper?.ivaDefinitivo.ivaNetoAPagar ?? 0;
      const isrNetoAPagar = workpaper?.isrProvisional.isrNetoAPagar ?? 0;
      const dia17Ready = Boolean(workpaper) && (hasSavedTaxParams || cfdis.length > 0);
      const fielLight = computeFielTrafficLight(fiel?.validTo, Boolean(fiel?.hasCredentials), nowMs);

      return {
        companyId: comp.id,
        companyName: comp.name,
        rfc: comp.rfc,
        regimenFiscal: comp.regimenFiscal,
        ejercicio,
        periodo,
        periodLockStatus,
        pendingCfdisCount,
        pendingBankLinesCount,
        hasSavedTaxParams,
        ivaNetoAPagar,
        isrNetoAPagar,
        dia17Ready,
        fielStatus: fielLight.status,
        fielValidTo: fiel?.validTo ?? null,
        fielDaysRemaining: fielLight.daysRemaining,
        overallTrafficLight: computeOverallClientTrafficLight({
          fielStatus: fielLight.status,
          pendingCfdisCount,
          pendingBankLinesCount,
          periodLockStatus,
          dia17Ready
        })
      };
    })
  );
  return rows;
}

export async function fetchDespachoMonitorRows(
  companies: readonly Company[]
): Promise<DespachoClientHealthRow[]> {
  if (companies.length === 0) return [];
  if (shouldUseCloudMonitor()) {
    return fetchDespachoMonitorCloud(companies);
  }
  return fetchDespachoMonitorLocal(companies);
}
