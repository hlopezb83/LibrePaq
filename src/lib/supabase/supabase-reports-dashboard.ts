import { supabase, getRequiredSupabase } from '../supabase';
import {
  buildDashboardKpisFromTrialBalance,
  buildMonthlyTrendFromPolizas,
  type DashboardTrendPolizaInput
} from '../../shared/engine/dashboard.engine';
import {
  computeFinancialStatementsData,
  type JoinedPolizaMovementInput
} from '../../shared/engine/financial-reports.engine';
import { MESES_SAT } from '../../shared/sat-constants';
import type { DashboardSummary, FinancialStatementsResponse } from '../../shared/types';
import { mapSupabaseAccount, mapSupabaseCompany } from './supabase-mappers';
import { fetchAllRows } from './supabase-pagination';
import { supabaseCfdi } from './supabase-cfdi';
import { supabasePolizas } from './supabase-polizas';
import { getSatXml as getSatAnexo24Xml } from './supabase-sat-xml';

export const supabaseReportsAndDashboard = {
  async getReports(
    companyId: string,
    year?: number,
    period?: number
  ): Promise<FinancialStatementsResponse> {
    if (!supabase) throw new Error('Supabase no disponible');

    const { data: cRow } = await getRequiredSupabase().from('companies').select('*').eq('id', companyId).maybeSingle();
    const company = cRow ? mapSupabaseCompany(cRow) : null;
    if (!company) throw new Error(`Empresa no encontrada: ${companyId}`);

    const ejercicio = year || company.currentYear;
    const periodo = period || company.currentPeriod;

    // Obtener cuentas y movimientos concurrentemente para eliminar latencia de cascada en red
    const [rawAccounts, movs] = await Promise.all([
      fetchAllRows(async (from, to) =>
        getRequiredSupabase().from('accounts').select('*').eq('company_id', company.id).order('code', { ascending: true }).range(from, to)
      ),
      fetchAllRows(async (from, to) =>
        getRequiredSupabase()
          .from('poliza_movements')
          .select('account_id, cargo, abono, polizas!inner(company_id, ejercicio, periodo)')
          .eq('polizas.company_id', company.id)
          .lte('polizas.ejercicio', ejercicio)
          .order('id', { ascending: true })
          .range(from, to)
      )
    ]);

    return computeFinancialStatementsData(
      company,
      rawAccounts.map(mapSupabaseAccount),
      movs as unknown as JoinedPolizaMovementInput[],
      ejercicio,
      periodo
    );
  },

  async getDashboard(
    companyId: string,
    year?: number,
    period?: number
  ): Promise<DashboardSummary> {
    const report = await this.getReports(companyId, year, period);
    const company = report.company;

    const [cfdis, polizas] = await Promise.all([
      supabaseCfdi.getCfdis(company.id),
      supabasePolizas.getPolizas(company.id, year, period)
    ]);

    const p = period || company.currentPeriod;
    const y = year || company.currentYear;
    const { kpis, recentPolizas, pendingCfdis } = buildDashboardKpisFromTrialBalance({
      trialBalance: report.trialBalance,
      polizas,
      cfdis,
      year: y,
      period: p
    });

    const startM = Math.max(1, Math.min(7, p - 5));
    const months = Array.from({ length: 6 }, (_, i) => startM + i);

    let monthlyTrend = months.map((mIdx) => {
      const mesObj = MESES_SAT.find((m) => m.periodo === mIdx);
      return {
        periodo: mIdx,
        mesNombre: mesObj?.nombre || `M${mIdx}`,
        ingresos: mIdx === p ? kpis.ingresosPeriodo : 0,
        egresos: mIdx === p ? kpis.egresosPeriodo : 0,
        utilidad: mIdx === p ? kpis.utilidadNeta : 0
      };
    });

    if (supabase) {
      try {
        const tPols = await fetchAllRows(async (from, to) =>
          getRequiredSupabase()
            .from('polizas')
            .select('periodo, poliza_movements(cargo, abono, accounts(type))')
            .eq('company_id', company.id)
            .eq('ejercicio', y)
            .gte('periodo', startM)
            .lte('periodo', startM + 5)
            .order('id', { ascending: true })
            .range(from, to)
        );

        if (tPols.length > 0) {
          monthlyTrend = buildMonthlyTrendFromPolizas(
            months,
            tPols as unknown as DashboardTrendPolizaInput[]
          );
        }
      } catch {
        // Fallback a tendencia mono-periodo
      }
    }

    return {
      company,
      kpis,
      monthlyTrend,
      recentPolizas,
      pendingCfdis
    };
  },

  getSatXml: getSatAnexo24Xml
};
