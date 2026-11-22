import { supabase, getRequiredSupabase } from '../supabase';
import { fromCents, toCents, resolveFiscalAccount } from '../../shared/accounting-engine';
import { MESES_SAT } from '../../shared/sat-constants';
import type { AccountWithBalance, DashboardSummary, FinancialStatementsResponse } from '../../shared/types';
import { mapSupabaseAccount, mapSupabaseCompany } from './supabase-mappers';
import { fetchAllRows } from './supabase-pagination';
import { supabasePolizasAndCfdi } from './supabase-polizas-cfdi';
import { getSatXml as getSatAnexo24Xml } from './supabase-sat-xml';

interface JoinedPolizaRow {
  account_id: string;
  cargo: number;
  abono: number;
  polizas: { company_id: string; ejercicio: number; periodo: number } | { company_id: string; ejercicio: number; periodo: number }[] | null;
}

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
    const accounts = rawAccounts.map(mapSupabaseAccount);
    const isBsMap = new Map(
      accounts.map((a) => [a.id, a.type === 'ACTIVO' || a.type === 'PASIVO' || a.type === 'CAPITAL'])
    );

    const priorChargesMap = new Map<string, number>();
    const priorCreditsMap = new Map<string, number>();
    const currentChargesMap = new Map<string, number>();
    const currentCreditsMap = new Map<string, number>();
    let priorUnclosedCargoCents = 0;
    let priorUnclosedAbonoCents = 0;

    for (const m of movs) {
      const row = m as unknown as JoinedPolizaRow;
      const p = Array.isArray(row.polizas) ? row.polizas[0] : row.polizas;
      if (!p) continue;
      const accId = row.account_id;
      const cargoCents = toCents(row.cargo);
      const abonoCents = toCents(row.abono);

      if (p.ejercicio < ejercicio) {
        if (isBsMap.get(accId)) {
          priorChargesMap.set(accId, (priorChargesMap.get(accId) || 0) + cargoCents);
          priorCreditsMap.set(accId, (priorCreditsMap.get(accId) || 0) + abonoCents);
        } else {
          priorUnclosedCargoCents += cargoCents;
          priorUnclosedAbonoCents += abonoCents;
        }
      } else if (p.ejercicio === ejercicio) {
        if (p.periodo < periodo) {
          priorChargesMap.set(accId, (priorChargesMap.get(accId) || 0) + cargoCents);
          priorCreditsMap.set(accId, (priorCreditsMap.get(accId) || 0) + abonoCents);
        } else if (p.periodo === periodo) {
          currentChargesMap.set(accId, (currentChargesMap.get(accId) || 0) + cargoCents);
          currentCreditsMap.set(accId, (currentCreditsMap.get(accId) || 0) + abonoCents);
        }
      }
    }

    if (priorUnclosedCargoCents > 0 || priorUnclosedAbonoCents > 0) {
      try {
        const capAcc = resolveFiscalAccount(accounts, 'RESULTADO_DEL_EJERCICIO');
        priorChargesMap.set(capAcc.id, (priorChargesMap.get(capAcc.id) || 0) + priorUnclosedCargoCents);
        priorCreditsMap.set(capAcc.id, (priorCreditsMap.get(capAcc.id) || 0) + priorUnclosedAbonoCents);
      } catch {
        // Ignorar si el catálogo no tiene cuenta de resultados
      }
    }

    const byCode = new Map<string, AccountWithBalance>();
    for (const acc of accounts) {
      const priorChg = priorChargesMap.get(acc.id) || 0;
      const priorCred = priorCreditsMap.get(acc.id) || 0;
      const chg = currentChargesMap.get(acc.id) || 0;
      const cred = currentCreditsMap.get(acc.id) || 0;

      const openingCents = acc.isAffectable ? toCents(acc.initialBalance) : 0;
      const initCents = acc.isAffectable
        ? acc.nature === 'DEUDORA'
          ? openingCents + priorChg - priorCred
          : openingCents + priorCred - priorChg
        : 0;

      const finalCents =
        acc.nature === 'DEUDORA'
          ? initCents + chg - cred
          : initCents + cred - chg;

      byCode.set(acc.code, {
        ...acc,
        initialBalanceComputed: fromCents(initCents),
        periodCharges: fromCents(chg),
        periodCredits: fromCents(cred),
        finalBalance: fromCents(finalCents)
      });
    }

    // Roll-up de niveles jerárquicos
    const sortedDesc = [...byCode.values()].sort((a, b) => b.level - a.level);
    for (const node of sortedDesc) {
      if (!node.parentCode) continue;
      const parent = byCode.get(node.parentCode);
      if (!parent) continue;

      const sign = parent.nature === node.nature ? 1 : -1;
      const parentInit =
        toCents(parent.initialBalanceComputed) + sign * toCents(node.initialBalanceComputed);
      const parentChg = toCents(parent.periodCharges) + toCents(node.periodCharges);
      const parentCred = toCents(parent.periodCredits) + toCents(node.periodCredits);
      const parentFinal =
        parent.nature === 'DEUDORA'
          ? parentInit + parentChg - parentCred
          : parentInit + parentCred - parentChg;

      parent.initialBalanceComputed = fromCents(parentInit);
      parent.periodCharges = fromCents(parentChg);
      parent.periodCredits = fromCents(parentCred);
      parent.finalBalance = fromCents(parentFinal);
    }

    const computedAccounts = accounts.map((a) => byCode.get(a.code) || a);

    // Totales nivel 1
    const l1 = computedAccounts.filter((a) => a.level === 1);
    let totalChgCents = 0;
    let totalCredCents = 0;
    let initDeudorCents = 0;
    let initAcreedorCents = 0;
    let finalDeudorCents = 0;
    let finalAcreedorCents = 0;

    for (const a of l1) {
      totalChgCents += toCents(a.periodCharges);
      totalCredCents += toCents(a.periodCredits);
      if (a.nature === 'DEUDORA') {
        initDeudorCents += toCents(a.initialBalanceComputed);
        finalDeudorCents += toCents(a.finalBalance);
      } else {
        initAcreedorCents += toCents(a.initialBalanceComputed);
        finalAcreedorCents += toCents(a.finalBalance);
      }
    }

    const ingresosAccs = computedAccounts.filter((a) => a.type === 'INGRESOS' && a.level >= 2);
    const costosAccs = computedAccounts.filter((a) => a.type === 'COSTOS' && a.level >= 2);
    const gastosAccs = computedAccounts.filter((a) => a.type === 'GASTOS' && a.level >= 2 && !a.code.startsWith('8'));
    const isrAccs = computedAccounts.filter(
      (a) =>
        (a.code.startsWith('801') || a.code.startsWith('800') || a.satGroupCode.startsWith('611')) &&
        a.level >= 2
    );
    const activosAccs = computedAccounts.filter((a) => a.type === 'ACTIVO' && a.level >= 2);
    const pasivosAccs = computedAccounts.filter((a) => a.type === 'PASIVO' && a.level >= 2);
    const capitalAccs = computedAccounts.filter((a) => a.type === 'CAPITAL' && a.level >= 2);

    const totalIngresos = Math.abs(computedAccounts.find((a) => a.code === '400-00-000')?.finalBalance ?? 
      ingresosAccs.reduce((s, a) => s + (a.level === 2 ? Math.abs(a.finalBalance) : 0), 0));
    const totalCostos = Math.abs(computedAccounts.find((a) => a.code === '500-00-000')?.finalBalance ?? 
      costosAccs.reduce((s, a) => s + (a.level === 2 ? Math.abs(a.finalBalance) : 0), 0));
    const totalGastos = Math.abs(computedAccounts.find((a) => a.code === '600-00-000')?.finalBalance ?? 
      gastosAccs.reduce((s, a) => s + (a.level === 2 ? Math.abs(a.finalBalance) : 0), 0));
    const totalIsr = Math.abs(computedAccounts.find((a) => a.code === '800-00-000' || a.code === '801-00-000')?.finalBalance ?? 
      isrAccs.reduce((s, a) => s + (a.level === 2 ? Math.abs(a.finalBalance) : 0), 0));
    const utilidadBruta = totalIngresos - totalCostos;
    const utilidadNeta = utilidadBruta - totalGastos - totalIsr;

    const totalActivo = Math.abs(computedAccounts.find((a) => a.code === '100-00-000')?.finalBalance ?? 
      activosAccs.reduce((s, a) => s + (a.level === 2 ? Math.abs(a.finalBalance) : 0), 0));
    const totalPasivo = Math.abs(computedAccounts.find((a) => a.code === '200-00-000')?.finalBalance ?? 
      pasivosAccs.reduce((s, a) => s + (a.level === 2 ? Math.abs(a.finalBalance) : 0), 0));
    const totalCapitalBase = computedAccounts.find((a) => a.code === '300-00-000')?.finalBalance ?? 
      capitalAccs.reduce((s, a) => s + (a.level === 2 ? a.finalBalance : 0), 0);
    const totalPasivoMasCapital = totalPasivo + totalCapitalBase + utilidadNeta;

    return {
      company,
      ejercicio,
      periodo,
      trialBalance: computedAccounts,
      totals: {
        initialDeudor: fromCents(initDeudorCents), initialAcreedor: fromCents(initAcreedorCents),
        totalCargos: fromCents(totalChgCents), totalAbonos: fromCents(totalCredCents),
        finalDeudor: fromCents(finalDeudorCents), finalAcreedor: fromCents(finalAcreedorCents)
      },
      incomeStatement: {
        ingresos: ingresosAccs, totalIngresos, costos: costosAccs, totalCostos, utilidadBruta,
        gastos: gastosAccs, totalGastos, isrEjercicio: isrAccs, totalIsr, utilidadNeta
      },
      balanceSheet: {
        activos: activosAccs, totalActivo, pasivos: pasivosAccs, totalPasivo,
        capital: capitalAccs, totalCapitalBase, utilidadEjercicio: utilidadNeta,
        totalPasivoMasCapital, isBalanced: Math.abs(totalActivo - totalPasivoMasCapital) < 0.05
      }
    };
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
      supabasePolizasAndCfdi.getCfdis(company.id),
      supabasePolizasAndCfdi.getPolizas(company.id, year, period)
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
          const mTrendMap = new Map<number, { ing: number; cos: number; gas: number }>();
          for (const m of months) mTrendMap.set(m, { ing: 0, cos: 0, gas: 0 });

          for (const pol of tPols) {
            const entry = mTrendMap.get(pol.periodo);
            if (!entry) continue;
            for (const mov of pol.poliza_movements || []) {
              const accType = (mov as unknown as { accounts?: { type?: string } | null })?.accounts?.type;
              const c = Number(mov.cargo || 0);
              const a = Number(mov.abono || 0);
              if (accType === 'INGRESOS') entry.ing += (a - c);
              else if (accType === 'COSTOS') entry.cos += (c - a);
              else if (accType === 'GASTOS') entry.gas += (c - a);
            }
          }

          monthlyTrend = months.map((mIdx) => {
            const mesObj = MESES_SAT.find((m) => m.periodo === mIdx);
            const d = mTrendMap.get(mIdx) || { ing: 0, cos: 0, gas: 0 };
            const ingVal = fromCents(toCents(d.ing));
            const egVal = fromCents(toCents(d.cos + d.gas));
            return {
              periodo: mIdx,
              mesNombre: mesObj?.nombre || `M${mIdx}`,
              ingresos: ingVal,
              egresos: egVal,
              utilidad: fromCents(toCents(ingVal - egVal))
            };
          });
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
