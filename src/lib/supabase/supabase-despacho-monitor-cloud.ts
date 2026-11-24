import { supabase } from '../supabase';
import { parseCalendarDate } from '../../shared/date-utils';
import { fromCents, toCents } from '../../shared/accounting-engine';
import { computeFiscalWorkpaper } from '../../shared/engine/fiscal.engine';
import type { Company, TaxParametersRecord } from '../../shared/types';
import { fetchAllRows } from './supabase-pagination';

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

function parseValidCalendarDate(raw: string): { year: number; month: number } | null {
  const trimmed = raw.trim();
  const match = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(trimmed);
  if (!match) return null;
  const rawY = Number.parseInt(match[1] ?? '', 10);
  const rawM = Number.parseInt(match[2] ?? '', 10);
  if (rawY < 1990 || rawY > 2100 || rawM < 1 || rawM > 12) return null;
  const cal = parseCalendarDate(trimmed, rawY, rawM);
  return { year: cal.year, month: cal.month };
}

function resolveMonitorTaxParams(
  taxMap: Map<string, TaxParametersRecord>,
  companyId: string,
  ejercicio: number,
  periodo: number
): TaxParametersRecord {
  const exact = taxMap.get(`${companyId}:${ejercicio}:${periodo}`);
  if (exact) return exact;
  for (let p = periodo - 1; p >= 1; p -= 1) {
    const prior = taxMap.get(`${companyId}:${ejercicio}:${p}`);
    if (prior) return prior;
  }
  const annual = taxMap.get(`${companyId}:${ejercicio}:0`);
  if (annual) return annual;
  return {
    companyId,
    ejercicio,
    periodo,
    coeficienteUtilidad: 0,
    perdidasFiscalesPendientes: 0,
    pagosProvisionalesAnteriores: 0,
    saldoFavorIvaAnterior: 0,
    tipoCambioDofCierre: 0,
    ptuPagadaEjercicio: 0
  };
}

export async function fetchDespachoMonitorCloud(
  companies: readonly Company[]
): Promise<DespachoClientHealthRow[]> {
  const client = supabase!;
  const ids = companies.map((c) => c.id);
  if (ids.length === 0) return [];

  const [locksData, cfdisData, bankData, taxData, fielData] = await Promise.all([
    fetchAllRows<Record<string, unknown>>((from, to) =>
      client
        .from('period_locks')
        .select('company_id, ejercicio, periodo, is_locked')
        .in('company_id', ids)
        .order('company_id', { ascending: true })
        .order('ejercicio', { ascending: true })
        .order('periodo', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      client
        .from('cfdi_documents')
        .select('id, company_id, fecha, fecha_pago, tipo_comprobante, direction, metodo_pago, status_sat, poliza_id, total, iva_trasladado, isr_retenido, iva_retenido, subtotal, descuento, moneda, tipo_cambio')
        .in('company_id', ids)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      client
        .from('bank_statement_lines')
        .select('id, company_id, ejercicio, periodo, matched_movement_id')
        .in('company_id', ids)
        .is('matched_movement_id', null)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      client
        .from('tax_parameters')
        .select('company_id, ejercicio, periodo, coeficiente_utilidad, perdidas_fiscales_pendientes, pagos_provisionales_anteriores, saldo_favor_iva_anterior, tipo_cambio_dof_cierre, ptu_pagada_ejercicio')
        .in('company_id', ids)
        .order('company_id', { ascending: true })
        .order('ejercicio', { ascending: true })
        .order('periodo', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      client
        .from('fiel_credentials')
        .select('company_id, valid_to')
        .in('company_id', ids)
        .order('company_id', { ascending: true })
        .range(from, to)
    )
  ]);

  const lockMap = new Map<string, boolean>();
  for (const r of locksData) {
    lockMap.set(`${r.company_id}:${r.ejercicio}:${r.periodo}`, Boolean(r.is_locked));
  }

  const taxSet = new Set<string>();
  const taxMap = new Map<string, TaxParametersRecord>();
  for (const r of taxData) {
    const cid = String(r.company_id);
    const ej = Number(r.ejercicio);
    const per = Number(r.periodo ?? 0);
    const key = `${cid}:${ej}:${per}`;
    taxSet.add(key);
    taxMap.set(key, {
      companyId: cid,
      ejercicio: ej,
      periodo: per,
      coeficienteUtilidad: Number(r.coeficiente_utilidad ?? 0),
      perdidasFiscalesPendientes: Number(r.perdidas_fiscales_pendientes ?? 0),
      pagosProvisionalesAnteriores: Number(r.pagos_provisionales_anteriores ?? 0),
      saldoFavorIvaAnterior: Number(r.saldo_favor_iva_anterior ?? 0),
      tipoCambioDofCierre: Number(r.tipo_cambio_dof_cierre ?? 0),
      ptuPagadaEjercicio: Number(r.ptu_pagada_ejercicio ?? 0)
    });
  }

  const fielMap = new Map<string, string | null>();
  for (const r of fielData) {
    fielMap.set(String(r.company_id), r.valid_to ? String(r.valid_to) : null);
  }

  const nowMs = Date.now();
  return companies.map((comp) => {
    const ejercicio = comp.currentYear || 2026;
    const periodo = comp.currentPeriod || 10;
    const isLocked = lockMap.get(`${comp.id}:${ejercicio}:${periodo}`) ?? false;
    const periodLockStatus: 'ABIERTO' | 'BLOQUEADO_SAT' = isLocked ? 'BLOQUEADO_SAT' : 'ABIERTO';
    const isCashBasis = comp.regimenFiscal.startsWith('626') || comp.rfc.trim().length === 13;

    let pendingCfdisCount = 0;
    let ivaTrasCents = 0;
    let ivaAcredCents = 0;
    let isrRetFavorCents = 0;
    let ingresosPeriodoCents = 0;
    let ingresosAcumCents = 0;
    let deduccionesPeriodoCents = 0;
    let deduccionesAcumCents = 0;
    let hasCfdiInPeriod = false;

    for (const c of cfdisData) {
      if (c.company_id !== comp.id) continue;
      if (c.status_sat === 'CANCELADO' || c.tipo_comprobante === 'T') continue;
      const totalCents = toCents(Number(c.total || 0));
      if (!c.poliza_id && totalCents > 0) {
        pendingCfdisCount += 1;
      }
      const effDate = String(c.tipo_comprobante === 'P' ? (c.fecha_pago || c.fecha || '') : (c.fecha || ''));
      const cal = parseValidCalendarDate(effDate);
      if (!cal || cal.year !== ejercicio || cal.month > periodo) continue;

      const isCurrentPeriod = cal.month === periodo;
      if (isCurrentPeriod) hasCfdiInPeriod = true;
      const isFlow = c.metodo_pago === 'PUE' || c.tipo_comprobante === 'P';
      const sign = c.tipo_comprobante === 'E' ? -1 : 1;
      const tc = c.moneda && String(c.moneda).toUpperCase() !== 'MXN' ? Number(c.tipo_cambio || 1) : 1;
      const netBaseC = toCents((Number(c.subtotal || 0) - Number(c.descuento || 0)) * tc) * sign;

      if (c.direction === 'EMITIDO') {
        if (!isCashBasis || isFlow) {
          ingresosAcumCents += netBaseC;
          if (isCurrentPeriod) ingresosPeriodoCents += netBaseC;
        }
        if (isFlow && isCurrentPeriod) {
          ivaTrasCents += toCents(Number(c.iva_trasladado || 0) * tc) * sign;
          isrRetFavorCents += toCents(Number(c.isr_retenido || 0) * tc) * sign;
        }
      } else if (isFlow) {
        deduccionesAcumCents += netBaseC;
        if (isCurrentPeriod) {
          deduccionesPeriodoCents += netBaseC;
          ivaAcredCents += toCents(Number(c.iva_trasladado || 0) * tc) * sign;
        }
      }
    }

    let pendingBankLinesCount = 0;
    for (const b of bankData) {
      if (b.company_id === comp.id && Number(b.ejercicio) === ejercicio && Number(b.periodo) === periodo) {
        pendingBankLinesCount += 1;
      }
    }

    const hasSavedTaxParams =
      taxSet.has(`${comp.id}:${ejercicio}:${periodo}`) || taxSet.has(`${comp.id}:${ejercicio}:0`);
    const resolvedParams = resolveMonitorTaxParams(taxMap, comp.id, ejercicio, periodo);
    const workpaper = computeFiscalWorkpaper({
      company: comp,
      ejercicio,
      periodo,
      parameters: resolvedParams,
      ingresosPeriodo: fromCents(ingresosPeriodoCents),
      ingresosAcumuladosEjercicio: fromCents(ingresosAcumCents),
      deduccionesAutorizadasPeriodo: fromCents(deduccionesPeriodoCents),
      deduccionesAcumuladasEjercicio: fromCents(deduccionesAcumCents),
      ivaTrasladadoCobrado: fromCents(ivaTrasCents),
      ivaAcreditablePagado: fromCents(ivaAcredCents),
      isrRetenidoPorPagar: 0,
      ivaRetenidoPorPagar: 0,
      isrRetenidoFavorPeriodo: fromCents(isrRetFavorCents),
      usdCfdis: []
    });
    const ivaNetoAPagar = workpaper.ivaDefinitivo.ivaNetoAPagar;
    const isrNetoAPagar = workpaper.isrProvisional.isrNetoAPagar;
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
      isrNetoAPagar,
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
