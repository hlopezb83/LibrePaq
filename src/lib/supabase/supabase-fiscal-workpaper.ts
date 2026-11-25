import { getRequiredSupabase, supabase } from '../supabase';
import {
  buildExchangeFluctuationMovements,
  buildTaxProvisionMovements,
  computeFiscalWorkpaperFromTrialBalance,
  fromCents,
  toCents
} from '../../shared/accounting-engine';
import { advanceCarryforwardTaxParameters } from '../../shared/engine/fiscal.engine';
import { getDefaultDateForPeriod } from '../formatters';
import type {
  FiscalWorkpaperResponse,
  Poliza,
  TaxParametersRecord
} from '../../shared/types';
import { logCompanyAuditEvent } from './audit-logger';
import { supabaseAccountingRules } from './supabase-accounting-rules';
import { supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import { supabaseCfdi } from './supabase-cfdi';
import { supabaseFiscalAndAssets } from './supabase-fiscal-assets';
import { fetchAllRows } from './supabase-pagination';
import { supabasePolizas } from './supabase-polizas';

function mapSupabaseTaxParamRow(
  companyId: string,
  ejercicio: number,
  periodo: number,
  row?: Record<string, unknown> | null
): TaxParametersRecord {
  return {
    companyId,
    ejercicio,
    periodo,
    coeficienteUtilidad: Number(row?.coeficiente_utilidad ?? 0),
    perdidasFiscalesPendientes: Number(row?.perdidas_fiscales_pendientes ?? 0),
    pagosProvisionalesAnteriores: Number(row?.pagos_provisionales_anteriores ?? 0),
    saldoFavorIvaAnterior: Number(row?.saldo_favor_iva_anterior ?? 0),
    tipoCambioDofCierre: Number(row?.tipo_cambio_dof_cierre ?? 0),
    ptuPagadaEjercicio: Number(row?.ptu_pagada_ejercicio ?? 0)
  };
}

async function fetchYtd113IsrCharges(
  companyId: string,
  ejercicio: number,
  cutoffPeriod: number,
  trialBalance: ReadonlyArray<{ id: string; code: string; satGroupCode: string; isAffectable: boolean }>
): Promise<number> {
  const isrFavorIds = trialBalance
    .filter((a) => a.isAffectable && (a.code === '113-02-001' || a.satGroupCode === '113.02'))
    .map((a) => a.id);
  if (!supabase || isrFavorIds.length === 0) return 0;
  const ytdMovs = await fetchAllRows<{ cargo?: number; concepto?: string }>(async (from, to) =>
    getRequiredSupabase()
      .from('poliza_movements')
      .select('cargo, concepto, polizas!inner(company_id, ejercicio, periodo)')
      .in('account_id', isrFavorIds)
      .eq('polizas.company_id', companyId)
      .eq('polizas.ejercicio', ejercicio)
      .gte('polizas.periodo', 1)
      .lte('polizas.periodo', cutoffPeriod)
      .order('id', { ascending: true })
      .range(from, to)
  );
  const ytdCents = ytdMovs.reduce((sum, r) => {
    const concept = (r.concepto ?? '').toLowerCase();
    if (concept.includes('subsidio al empleo') || concept.includes('impuesto local')) return sum;
    return sum + Math.max(0, toCents(Number(r.cargo ?? 0)));
  }, 0);
  return fromCents(ytdCents);
}

export const supabaseFiscalWorkpaper = {
  async getTaxParameters(
    companyId: string,
    ejercicio: number,
    periodo = 0
  ): Promise<TaxParametersRecord> {
    const empty = mapSupabaseTaxParamRow(companyId, ejercicio, periodo, null);
    if (!supabase) return empty;

    const { data: rows } = await supabase
      .from('tax_parameters')
      .select('*')
      .eq('company_id', companyId)
      .eq('ejercicio', ejercicio)
      .lte('periodo', Math.max(0, periodo))
      .order('periodo', { ascending: true });

    const byPeriod = new Map<number, TaxParametersRecord>();
    for (const r of rows ?? []) {
      const p = Number((r as { periodo?: number }).periodo ?? 0);
      byPeriod.set(p, mapSupabaseTaxParamRow(companyId, ejercicio, p, r as Record<string, unknown>));
    }
    if (periodo <= 0 || byPeriod.has(periodo)) return byPeriod.get(periodo) ?? empty;
    const fallback0 = byPeriod.get(0) ?? mapSupabaseTaxParamRow(companyId, ejercicio, 0, null);
    if (periodo === 1) return { ...fallback0, periodo: 1 };

    const priorSaved = Array.from(byPeriod.keys()).filter((p) => p > 0 && p < periodo);
    const startPeriod = priorSaved.length > 0 ? Math.max(...priorSaved) : 1;
    let carried: TaxParametersRecord = { ...(byPeriod.get(startPeriod) ?? fallback0), periodo: startPeriod };
    const cutoff = periodo === 13 ? 12 : Math.max(1, Math.min(12, periodo - 1));
    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const company = companies.find((c) => c.id === companyId);
    if (!company) return { ...carried, periodo };

    const [cfdis, rules, thirdParties, fixedAssetsRes] = await Promise.all([
      supabaseCfdi.getCfdis(company.id),
      supabaseAccountingRules.listAccountingRules(company.id),
      supabaseFiscalAndAssets.getThirdParties(company.id),
      supabaseFiscalAndAssets.getFixedAssets(company.id, ejercicio, cutoff)
    ]);
    for (let m = startPeriod; m <= cutoff; m += 1) {
      const [tb, pols] = await Promise.all([
        supabaseCompaniesAndAccounts.getAccounts(company.id, ejercicio, m),
        supabasePolizas.getPolizas(company.id, ejercicio, m)
      ]);
      const ytd = await fetchYtd113IsrCharges(company.id, ejercicio, m, tb);
      const wpM = computeFiscalWorkpaperFromTrialBalance({
        company,
        ejercicio,
        periodo: m,
        parameters: carried,
        trialBalance: tb,
        cfdis,
        rules,
        thirdParties,
        fixedAssets: fixedAssetsRes.assets,
        ytdIsrRetenidoCharges: ytd,
        periodPolizas: pols
      });
      carried = advanceCarryforwardTaxParameters(carried, wpM, m + 1);
    }
    return { ...carried, periodo };
  },

  async saveTaxParameters(payload: {
    companyId: string;
    ejercicio: number;
    periodo?: number;
    coeficienteUtilidad?: number;
    perdidasFiscalesPendientes?: number;
    pagosProvisionalesAnteriores?: number;
    saldoFavorIvaAnterior?: number;
    tipoCambioDofCierre?: number;
    ptuPagadaEjercicio?: number;
  }): Promise<TaxParametersRecord> {
    if (!supabase) throw new Error('Supabase no disponible');
    const targetPeriod = payload.periodo ?? 0;
    const current = await this.getTaxParameters(payload.companyId, payload.ejercicio, targetPeriod);
    const next: TaxParametersRecord = {
      companyId: payload.companyId,
      ejercicio: payload.ejercicio,
      periodo: targetPeriod,
      coeficienteUtilidad: payload.coeficienteUtilidad ?? current.coeficienteUtilidad,
      perdidasFiscalesPendientes:
        payload.perdidasFiscalesPendientes ?? current.perdidasFiscalesPendientes,
      pagosProvisionalesAnteriores:
        payload.pagosProvisionalesAnteriores ?? current.pagosProvisionalesAnteriores,
      saldoFavorIvaAnterior:
        payload.saldoFavorIvaAnterior ?? current.saldoFavorIvaAnterior,
      tipoCambioDofCierre:
        payload.tipoCambioDofCierre ?? current.tipoCambioDofCierre,
      ptuPagadaEjercicio:
        payload.ptuPagadaEjercicio ?? current.ptuPagadaEjercicio ?? 0
    };

    const { error } = await supabase.from('tax_parameters').upsert(
      {
        company_id: next.companyId,
        ejercicio: next.ejercicio,
        periodo: targetPeriod,
        coeficiente_utilidad: next.coeficienteUtilidad,
        perdidas_fiscales_pendientes: fromCents(toCents(next.perdidasFiscalesPendientes)),
        pagos_provisionales_anteriores: fromCents(toCents(next.pagosProvisionalesAnteriores)),
        saldo_favor_iva_anterior: fromCents(toCents(next.saldoFavorIvaAnterior)),
        tipo_cambio_dof_cierre: next.tipoCambioDofCierre,
        ptu_pagada_ejercicio: fromCents(toCents(next.ptuPagadaEjercicio ?? 0))
      },
      { onConflict: 'company_id,ejercicio,periodo' }
    );

    if (error) throw new Error(error.message);
    logCompanyAuditEvent({
      companyId: next.companyId,
      action: 'TAX_PARAMS_SAVE',
      entityType: 'tax_parameters',
      entityId: `${next.ejercicio}-${targetPeriod}`,
      metadata: { ejercicio: next.ejercicio, periodo: targetPeriod, coeficienteUtilidad: next.coeficienteUtilidad }
    });
    return next;
  },

  async getFiscalWorkpaper(
    companyId: string,
    year?: number,
    period?: number
  ): Promise<FiscalWorkpaperResponse> {
    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const company = companyId ? companies.find((c) => c.id === companyId) : companies[0];
    if (!company) throw new Error(`Empresa no encontrada: ${companyId || 'sin ID'}`);

    const ejercicio = year || company.currentYear || 2026;
    const periodo = period || company.currentPeriod || 10;

    const [parameters, trialBalance, cfdis, thirdParties, rules, periodPolizas, fixedAssetsRes] = await Promise.all([
      this.getTaxParameters(company.id, ejercicio, periodo),
      supabaseCompaniesAndAccounts.getAccounts(company.id, ejercicio, periodo),
      supabaseCfdi.getCfdis(company.id),
      supabaseFiscalAndAssets.getThirdParties(company.id),
      supabaseAccountingRules.listAccountingRules(company.id),
      supabasePolizas.getPolizas(company.id, ejercicio, periodo),
      supabaseFiscalAndAssets.getFixedAssets(company.id, ejercicio, periodo)
    ]);

    const cutoffPeriod = periodo === 13 ? 12 : Math.max(1, Math.min(12, periodo));
    const ytdIsrRetenidoCharges = await fetchYtd113IsrCharges(
      company.id,
      ejercicio,
      cutoffPeriod,
      trialBalance
    );

    return computeFiscalWorkpaperFromTrialBalance({
      company,
      ejercicio,
      periodo,
      parameters,
      trialBalance,
      cfdis,
      rules,
      thirdParties,
      fixedAssets: fixedAssetsRes.assets,
      ytdIsrRetenidoCharges,
      periodPolizas
    });
  },

  async generateTaxProvisionPoliza(
    companyId: string,
    year?: number,
    period?: number
  ): Promise<Poliza> {
    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const company = companyId ? companies.find((c) => c.id === companyId) : companies[0];
    if (!company) throw new Error(`Empresa no encontrada: ${companyId || 'sin ID'}`);
    const ejercicio = year || company.currentYear || 2026;
    const periodo = period || company.currentPeriod || 10;

    const existingPolizas = await supabasePolizas.getPolizas(companyId, ejercicio, periodo);
    const hasExistingTaxProvision = existingPolizas.some((p) => {
      const lower = p.concepto.toLowerCase();
      return (
        lower.includes('provisión de impuestos federales') ||
        lower.includes('provision de impuestos federales') ||
        p.movements.some(
          (m) => m.referencia === `ISR-M${periodo}` || m.referencia === `IVA-M${periodo}`
        )
      );
    });
    if (hasExistingTaxProvision) {
      throw new Error(
        `Ya existe una póliza de provisión de impuestos ISR/IVA para ${ejercicio}-${String(periodo).padStart(2, '0')}. Elimínala antes de regenerar.`
      );
    }

    const wp = await this.getFiscalWorkpaper(companyId, ejercicio, periodo);
    const accounts = await supabaseCompaniesAndAccounts.getAccounts(companyId, ejercicio, periodo);
    const movements = buildTaxProvisionMovements(wp, accounts, periodo, ejercicio, {
      roundArt20Cff: true
    });
    const fecha = getDefaultDateForPeriod(ejercicio, periodo);

    return supabasePolizas.createPoliza({
      companyId,
      tipo: 'DIARIO',
      fecha,
      ejercicio,
      periodo,
      concepto: `Póliza de Provisión de Impuestos Federales ISR e IVA (${periodo}/${ejercicio})`,
      cfdiUuid: null,
      movements
    });
  },

  async generateExchangePoliza(
    companyId: string,
    year?: number,
    period?: number
  ): Promise<Poliza> {
    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const company = companyId ? companies.find((c) => c.id === companyId) : companies[0];
    if (!company) throw new Error(`Empresa no encontrada: ${companyId || 'sin ID'}`);
    const ejercicio = year || company.currentYear || 2026;
    const periodo = period || company.currentPeriod || 10;

    const existingPolizas = await supabasePolizas.getPolizas(companyId, ejercicio, periodo);
    const hasExchangePoliza = existingPolizas.some((p) => {
      const lower = p.concepto.toLowerCase();
      return (
        lower.includes('fluctuación cambiaria') ||
        lower.includes('fluctuacion cambiaria') ||
        p.movements.some((m) => m.referencia.startsWith('TC-DOF-'))
      );
    });
    if (hasExchangePoliza) {
      throw new Error(
        `Ya existe una póliza de fluctuación cambiaria USD registrada para ${ejercicio}-${String(periodo).padStart(2, '0')}. Elimínala antes de regenerar.`
      );
    }

    const wp = await this.getFiscalWorkpaper(companyId, ejercicio, periodo);
    const accounts = await supabaseCompaniesAndAccounts.getAccounts(companyId, ejercicio, periodo);
    const plan = buildExchangeFluctuationMovements(wp, accounts);
    const fecha = getDefaultDateForPeriod(ejercicio, periodo);

    return supabasePolizas.createPoliza({
      companyId,
      tipo: 'DIARIO',
      fecha,
      ejercicio,
      periodo,
      concepto: plan.concept,
      cfdiUuid: null,
      movements: plan.movements
    });
  }
};
