import { supabase } from '../supabase';
import {
  buildExchangeFluctuationMovements,
  buildTaxProvisionMovements,
  computeFiscalWorkpaperFromTrialBalance,
  fromCents,
  toCents
} from '../../shared/accounting-engine';
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
import { supabasePolizas } from './supabase-polizas';

export const supabaseFiscalWorkpaper = {
  async getTaxParameters(
    companyId: string,
    ejercicio: number,
    periodo = 0
  ): Promise<TaxParametersRecord> {
    const emptyDefaults: TaxParametersRecord = {
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
    if (!supabase) return emptyDefaults;

    const { data: exact } = await supabase
      .from('tax_parameters')
      .select('*')
      .eq('company_id', companyId)
      .eq('ejercicio', ejercicio)
      .eq('periodo', periodo)
      .maybeSingle();

    let row = exact;
    if (!row && periodo > 0) {
      const { data: priorRows } = await supabase
        .from('tax_parameters')
        .select('*')
        .eq('company_id', companyId)
        .eq('ejercicio', ejercicio)
        .gt('periodo', 0)
        .lt('periodo', periodo)
        .order('periodo', { ascending: false })
        .limit(1);
      row = priorRows?.[0] ?? null;
    }
    if (!row && periodo !== 0) {
      const { data: fallback } = await supabase
        .from('tax_parameters')
        .select('*')
        .eq('company_id', companyId)
        .eq('ejercicio', ejercicio)
        .eq('periodo', 0)
        .maybeSingle();
      row = fallback;
    }

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

    const [parameters, trialBalance, cfdis, thirdParties, rules, periodPolizas] = await Promise.all([
      this.getTaxParameters(company.id, ejercicio, periodo),
      supabaseCompaniesAndAccounts.getAccounts(company.id, ejercicio, periodo),
      supabaseCfdi.getCfdis(company.id),
      supabaseFiscalAndAssets.getThirdParties(company.id),
      supabaseAccountingRules.listAccountingRules(company.id),
      supabasePolizas.getPolizas(company.id, ejercicio, periodo)
    ]);

    const cutoffPeriod = periodo === 13 ? 12 : Math.max(1, Math.min(12, periodo));
    const isrFavorIds = trialBalance
      .filter((a) => a.isAffectable && (a.code === '113-02-001' || a.satGroupCode === '113.02'))
      .map((a) => a.id);
    let ytdIsrRetenidoCharges = 0;
    if (supabase && isrFavorIds.length > 0) {
      const { data: ytdMovs } = await supabase
        .from('poliza_movements')
        .select('cargo, polizas!inner(company_id, ejercicio, periodo)')
        .in('account_id', isrFavorIds)
        .eq('polizas.company_id', company.id)
        .eq('polizas.ejercicio', ejercicio)
        .gte('polizas.periodo', 1)
        .lte('polizas.periodo', cutoffPeriod);
      const ytdCents = (ytdMovs ?? []).reduce(
        (sum, r) => sum + Math.max(0, toCents(Number((r as { cargo?: number }).cargo ?? 0))),
        0
      );
      ytdIsrRetenidoCharges = fromCents(ytdCents);
    }

    return computeFiscalWorkpaperFromTrialBalance({
      company,
      ejercicio,
      periodo,
      parameters,
      trialBalance,
      cfdis,
      rules,
      thirdParties,
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
    const movements = buildTaxProvisionMovements(wp, accounts, periodo, ejercicio);
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
