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
import { supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import { supabaseCfdi } from './supabase-cfdi';
import { supabasePolizas } from './supabase-polizas';

export const supabaseFiscalWorkpaper = {
  async getTaxParameters(companyId: string, ejercicio: number): Promise<TaxParametersRecord> {
    if (!supabase) {
      return {
        companyId,
        ejercicio,
        coeficienteUtilidad: 0.1845,
        perdidasFiscalesPendientes: 45000,
        pagosProvisionalesAnteriores: 128500,
        saldoFavorIvaAnterior: 0,
        tipoCambioDofCierre: 19.865
      };
    }

    const { data } = await supabase
      .from('tax_parameters')
      .select('*')
      .eq('company_id', companyId)
      .eq('ejercicio', ejercicio)
      .maybeSingle();

    return {
      companyId,
      ejercicio,
      coeficienteUtilidad: Number(data?.coeficiente_utilidad ?? 0.1845),
      perdidasFiscalesPendientes: Number(data?.perdidas_fiscales_pendientes ?? 45000),
      pagosProvisionalesAnteriores: Number(data?.pagos_provisionales_anteriores ?? 128500),
      saldoFavorIvaAnterior: Number(data?.saldo_favor_iva_anterior ?? 0),
      tipoCambioDofCierre: Number(data?.tipo_cambio_dof_cierre ?? 19.865)
    };
  },

  async saveTaxParameters(payload: {
    companyId: string;
    ejercicio: number;
    coeficienteUtilidad?: number;
    perdidasFiscalesPendientes?: number;
    pagosProvisionalesAnteriores?: number;
    saldoFavorIvaAnterior?: number;
    tipoCambioDofCierre?: number;
  }): Promise<TaxParametersRecord> {
    if (!supabase) throw new Error('Supabase no disponible');
    const current = await this.getTaxParameters(payload.companyId, payload.ejercicio);
    const next: TaxParametersRecord = {
      companyId: payload.companyId,
      ejercicio: payload.ejercicio,
      coeficienteUtilidad: payload.coeficienteUtilidad ?? current.coeficienteUtilidad,
      perdidasFiscalesPendientes:
        payload.perdidasFiscalesPendientes ?? current.perdidasFiscalesPendientes,
      pagosProvisionalesAnteriores:
        payload.pagosProvisionalesAnteriores ?? current.pagosProvisionalesAnteriores,
      saldoFavorIvaAnterior:
        payload.saldoFavorIvaAnterior ?? current.saldoFavorIvaAnterior,
      tipoCambioDofCierre:
        payload.tipoCambioDofCierre ?? current.tipoCambioDofCierre
    };

    const { error } = await supabase.from('tax_parameters').upsert({
      company_id: next.companyId,
      ejercicio: next.ejercicio,
      coeficiente_utilidad: next.coeficienteUtilidad,
      perdidas_fiscales_pendientes: fromCents(toCents(next.perdidasFiscalesPendientes)),
      pagos_provisionales_anteriores: fromCents(toCents(next.pagosProvisionalesAnteriores)),
      saldo_favor_iva_anterior: fromCents(toCents(next.saldoFavorIvaAnterior)),
      tipo_cambio_dof_cierre: next.tipoCambioDofCierre
    });

    if (error) throw new Error(error.message);
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

    const parameters = await this.getTaxParameters(company.id, ejercicio);
    const trialBalance = await supabaseCompaniesAndAccounts.getAccounts(company.id, ejercicio, periodo);
    const cfdis = await supabaseCfdi.getCfdis(company.id);

    return computeFiscalWorkpaperFromTrialBalance({
      company,
      ejercicio,
      periodo,
      parameters,
      trialBalance,
      cfdis
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
