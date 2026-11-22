import { supabase } from '../supabase';
import {
  buildDepreciationPolizaPlan,
  buildExchangeFluctuationMovements,
  buildTaxProvisionMovements,
  computeFiscalWorkpaper,
  fromCents,
  sumCents,
  toCents
} from '../../shared/accounting-engine';
import { MESES_SAT } from '../../shared/sat-catalog';
import { getDefaultDateForPeriod } from '../formatters';
import type {
  FiscalWorkpaperResponse,
  Poliza,
  TaxParametersRecord
} from '../../shared/types';
import { supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import { supabasePolizasAndCfdi } from './supabase-polizas-cfdi';
import { supabaseFiscalAndAssets } from './supabase-fiscal-assets';

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
    const tb = await supabaseCompaniesAndAccounts.getAccounts(company.id, ejercicio, periodo);

    const ingresosAccounts = tb.filter((a) => a.isAffectable && a.type === 'INGRESOS');
    const egresosAccounts = tb.filter(
      (a) =>
        a.isAffectable &&
        (a.type === 'COSTOS' || a.type === 'GASTOS') &&
        !a.code.startsWith('801') &&
        !a.satGroupCode?.startsWith('801') &&
        !a.satGroupCode?.startsWith('611') &&
        a.code !== '601-01-006'
    );

    const ingresosPeriodo = fromCents(
      sumCents(ingresosAccounts.map((a) => a.periodCredits - a.periodCharges))
    );
    const ingresosAcumuladosEjercicio = fromCents(
      sumCents(ingresosAccounts.map((a) => a.finalBalance))
    );
    const deduccionesAutorizadasPeriodo = fromCents(
      sumCents(egresosAccounts.map((a) => a.periodCharges - a.periodCredits))
    );
    const deduccionesAcumuladasEjercicio = fromCents(
      sumCents(egresosAccounts.map((a) => a.finalBalance))
    );

    const accIvaCobrado = tb.find((a) => a.code === '208-01-001' || a.satGroupCode === '208.01');
    const accIvaPagado = tb.find((a) => a.code === '118-01-001' || a.satGroupCode === '118.01');
    const accRetIsr = tb.find((a) => a.code === '216-01-001' || a.satGroupCode === '216.01');
    const accRetIva = tb.find((a) => a.code === '216-01-002' || a.satGroupCode === '216.02');
    const accIsrFavor = tb.find(
      (a) => a.code === '113-02-001' || a.code === '113-01-002' || a.satGroupCode === '113.02'
    );
    const accIvaFavor = tb.find(
      (a) => a.code === '113-01-001' || a.satGroupCode === '113.01'
    );

    const cfdis = await supabasePolizasAndCfdi.getCfdis(company.id);
    const usdCfdis = cfdis.filter(
      (c) =>
        c.moneda?.toUpperCase() === 'USD' &&
        c.statusSat !== 'CANCELADO' &&
        c.metodoPago === 'PPD'
    );

    return computeFiscalWorkpaper({
      company,
      ejercicio,
      periodo,
      parameters,
      ingresosPeriodo,
      ingresosAcumuladosEjercicio,
      deduccionesAutorizadasPeriodo,
      deduccionesAcumuladasEjercicio,
      ivaTrasladadoCobrado: accIvaCobrado?.periodCredits ?? 0,
      ivaAcreditablePagado: accIvaPagado?.periodCharges ?? 0,
      isrRetenidoPorPagar: accRetIsr?.periodCredits ?? 0,
      ivaRetenidoPorPagar: accRetIva?.periodCredits ?? 0,
      isrRetenidoFavorPeriodo: accIsrFavor?.periodCharges ?? 0,
      ivaRetenidoFavorPeriodo: accIvaFavor?.periodCharges ?? 0,
      usdCfdis
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

    return supabasePolizasAndCfdi.createPoliza({
      companyId,
      tipo: 'DIARIO',
      fecha,
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

    return supabasePolizasAndCfdi.createPoliza({
      companyId,
      tipo: 'DIARIO',
      fecha,
      concepto: plan.concept,
      cfdiUuid: null,
      movements: plan.movements
    });
  },

  async generateDepreciationPoliza(
    companyId: string,
    year?: number,
    period?: number
  ): Promise<Poliza> {
    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const company = companies.find((c) => c.id === companyId);
    if (!company) throw new Error(`Empresa no encontrada: ${companyId || 'sin ID'}`);
    const ejercicio = year || company.currentYear || 2026;
    const periodo = period || company.currentPeriod || 10;

    // Verificar si ya existe una póliza de depreciación para este periodo
    const existing = await supabasePolizasAndCfdi.getPolizas(companyId, ejercicio, periodo);
    const hasDep = existing.some(
      (p) =>
        p.concepto.toLowerCase().includes('depreciación') ||
        p.concepto.toLowerCase().includes('depreciacion')
    );
    if (hasDep) {
      throw new Error(`Ya existe una póliza de depreciación registrada para ${ejercicio}-${String(periodo).padStart(2, '0')}`);
    }

    const faResponse = await supabaseFiscalAndAssets.getFixedAssets(companyId);
    const accounts = await supabaseCompaniesAndAccounts.getAccounts(companyId, ejercicio, periodo);
    const mesNombre = MESES_SAT.find((m) => m.periodo === periodo)?.nombre || `M${periodo}`;
    const periodLabel = `${mesNombre} ${ejercicio}`;

    const plan = buildDepreciationPolizaPlan(faResponse.assets, accounts, periodLabel);
    const fecha = getDefaultDateForPeriod(ejercicio, periodo);

    return supabasePolizasAndCfdi.createPoliza({
      companyId,
      tipo: plan.polizaType,
      fecha,
      concepto: plan.polizaConcept,
      cfdiUuid: null,
      movements: plan.movements
    });
  }
};
