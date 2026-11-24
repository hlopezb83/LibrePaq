import { isSupabaseConfigured, supabase } from '../supabase';
import { apiClient } from '../api-client';
import { isGuestDemoMode } from '../sandbox/guest-demo-mode';
import { toCents } from '../../shared/accounting-engine';
import type { Company } from '../../shared/types';
import {
  computeFielTrafficLight,
  computeOverallClientTrafficLight,
  fetchDespachoMonitorCloud,
  type DespachoClientHealthRow,
  type FielTrafficLightStatus,
  type MonitorOverallStatus
} from './supabase-despacho-monitor-cloud';

export {
  computeFielTrafficLight,
  computeOverallClientTrafficLight,
  type DespachoClientHealthRow,
  type FielTrafficLightStatus,
  type MonitorOverallStatus
};

function shouldUseCloudMonitor(): boolean {
  return (
    typeof window !== 'undefined' &&
    isSupabaseConfigured &&
    Boolean(supabase) &&
    !isGuestDemoMode() &&
    (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'))
  );
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

      const bankAccounts = accounts.filter(
        (a) => a.code === '102-01-001' || (a.code.startsWith('102') && a.isAffectable)
      );
      const bankRecs = await Promise.all(
        bankAccounts.map((acc) =>
          apiClient.getBankReconciliation(comp.id, acc.id, ejercicio, periodo).catch(() => null)
        )
      );
      const workpaper = await apiClient.getFiscalWorkpaper(comp.id, ejercicio, periodo).catch(() => null);

      const periodLockStatus: 'ABIERTO' | 'BLOQUEADO_SAT' = lock?.isLocked ? 'BLOQUEADO_SAT' : 'ABIERTO';
      const pendingCfdisCount = cfdis.filter(
        (c) => !c.polizaId && c.statusSat !== 'CANCELADO' && c.tipoComprobante !== 'T' && toCents(c.total) > 0
      ).length;
      const pendingBankLinesCount = bankRecs.reduce(
        (sum, rec) => sum + (rec?.summary.movimientosPendientesBanco ?? 0),
        0
      );
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
