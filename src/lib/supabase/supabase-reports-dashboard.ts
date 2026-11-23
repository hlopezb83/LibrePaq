import { supabase, getRequiredSupabase } from '../supabase';
import { fromCents, toCents } from '../../shared/accounting-engine';
import {
  buildMonthlyTrendFromPolizas,
  computeFinancialStatementsData,
  type DashboardTrendPolizaInput,
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
    const byCode = new Map(report.trialBalance.map((a) => [a.code, a]));

    const ingresosAcc = byCode.get('400-00-000');
    const costosAcc = byCode.get('500-00-000');
    const gastosAcc = byCode.get('600-00-000');
    const isrAcc = byCode.get('800-00-000') || byCode.get('801-00-000') || byCode.get('801-01-000');

    const ingresosCents = ingresosAcc ? toCents(ingresosAcc.periodCredits) - toCents(ingresosAcc.periodCharges) : 0;
    const costosCents = costosAcc ? toCents(costosAcc.periodCharges) - toCents(costosAcc.periodCredits) : 0;
    const gastosCents = gastosAcc ? toCents(gastosAcc.periodCharges) - toCents(gastosAcc.periodCredits) : 0;
    const isrCents = isrAcc ? toCents(isrAcc.periodCharges) - toCents(isrAcc.periodCredits) : 0;
    const egresosCents = costosCents + gastosCents + isrCents;
    const ingresos = fromCents(ingresosCents);
    const egresos = fromCents(egresosCents);
    const utilidadNeta = fromCents(ingresosCents - egresosCents);

    const ivaTrasladadoCents = toCents(byCode.get('208-00-000')?.finalBalance);
    const ivaAcreditableCents = toCents(byCode.get('118-00-000')?.finalBalance);

    const [cfdis, polizas] = await Promise.all([
      supabaseCfdi.getCfdis(company.id),
      supabasePolizas.getPolizas(company.id, year, period)
    ]);

    const p = period || company.currentPeriod;
    const y = year || company.currentYear;
    const startM = Math.max(1, Math.min(7, p - 5));
    const months = Array.from({ length: 6 }, (_, i) => startM + i);

    let monthlyTrend = months.map((mIdx) => {
      const mesObj = MESES_SAT.find((m) => m.periodo === mIdx);
      return {
        periodo: mIdx,
        mesNombre: mesObj?.nombre || `M${mIdx}`,
        ingresos: mIdx === p ? ingresos : 0,
        egresos: mIdx === p ? egresos : 0,
        utilidad: mIdx === p ? utilidadNeta : 0
      };
    });

    if (supabase) {
      try {
        const { data: tPols } = await supabase
          .from('polizas')
          .select('periodo, poliza_movements(cargo, abono, accounts(type))')
          .eq('company_id', company.id)
          .eq('ejercicio', y)
          .gte('periodo', startM)
          .lte('periodo', startM + 5);

        if (tPols && tPols.length > 0) {
          monthlyTrend = buildMonthlyTrendFromPolizas(
            months,
            tPols as unknown as DashboardTrendPolizaInput[]
          );
        }
      } catch {
        // Fallback a tendencia mono-periodo
      }
    }

    const periodPrefix = `${y}-${String(p).padStart(2, '0')}`;
    const periodCfdis = cfdis.filter(
      (c) => c.fecha?.startsWith(periodPrefix) && c.statusSat !== 'CANCELADO'
    );
    const pendingCfdis = periodCfdis.filter((c) => !c.polizaId);

    return {
      company,
      kpis: {
        ingresosPeriodo: ingresos,
        egresosPeriodo: egresos,
        utilidadNeta,
        efectivoBancos: byCode.get('102-00-000')?.finalBalance || 0,
        cuentasPorCobrar: byCode.get('105-00-000')?.finalBalance || 0,
        cuentasPorPagar: byCode.get('201-00-000')?.finalBalance || 0,
        ivaPorPagarNeto: fromCents(ivaTrasladadoCents - ivaAcreditableCents),
        totalPolizasPeriodo: polizas.length,
        cfdisPendientesContabilizar: pendingCfdis.length,
        cfdisTotalesPeriodo: periodCfdis.length
      },
      monthlyTrend,
      recentPolizas: polizas.slice(0, 5),
      pendingCfdis: pendingCfdis.slice(0, 5)
    };
  },

  getSatXml: getSatAnexo24Xml
};
