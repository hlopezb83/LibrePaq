import { supabase } from '../supabase';
import { computeDiotReportData } from '../../shared/engine/diot.engine';
import type { DiotReportResponse } from '../../shared/types';
import { supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import { supabasePolizas } from './supabase-polizas';
import { supabaseCfdi } from './supabase-cfdi';

export const supabaseDiot = {
  async getDiotReport(
    companyId: string,
    year?: number,
    period?: number
  ): Promise<DiotReportResponse> {
    if (!supabase) throw new Error('Supabase no disponible');
    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const company = companyId ? companies.find((c) => c.id === companyId) : companies[0];
    if (!company) throw new Error(`Empresa no encontrada: ${companyId || 'sin ID'}`);

    const currentYear = year || company.currentYear;
    const currentPeriod = period || company.currentPeriod;

    const [cfdis, polizas, trialBalance] = await Promise.all([
      supabaseCfdi.getCfdis(company.id),
      supabasePolizas.getPolizas(company.id, currentYear, currentPeriod),
      supabaseCompaniesAndAccounts.getAccounts(company.id, currentYear, currentPeriod)
    ]);

    return computeDiotReportData({
      company,
      ejercicio: currentYear,
      periodo: currentPeriod,
      cfdis,
      polizaIdsInPeriod: new Set(polizas.map((p) => p.id)),
      trialBalance
    });
  }
};
