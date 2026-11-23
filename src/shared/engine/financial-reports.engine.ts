import { fromCents, toCents } from './invariants-and-math';
import { resolveFiscalAccount } from './auto-poliza.engine';
import type {
  Account,
  AccountWithBalance,
  Company,
  FinancialStatementsResponse
} from '../types';

export interface JoinedPolizaMovementInput {
  account_id: string;
  cargo: number;
  abono: number;
  polizas:
    | { company_id: string; ejercicio: number; periodo: number }
    | { company_id: string; ejercicio: number; periodo: number }[]
    | null;
}

/**
 * Aggregates account movements into a full hierarchical trial balance, income statement,
 * and balance sheet for a specific fiscal year and period.
 */
export function computeFinancialStatementsData(
  company: Company,
  accounts: AccountWithBalance[],
  movs: JoinedPolizaMovementInput[],
  ejercicio: number,
  periodo: number
): FinancialStatementsResponse {
  const isBsMap = new Map(
    accounts.map((a) => [a.id, a.type === 'ACTIVO' || a.type === 'PASIVO' || a.type === 'CAPITAL'])
  );

  const priorChargesMap = new Map<string, number>();
  const priorCreditsMap = new Map<string, number>();
  const currentChargesMap = new Map<string, number>();
  const currentCreditsMap = new Map<string, number>();
  let priorUnclosedCargoCents = 0;
  let priorUnclosedAbonoCents = 0;

  for (const row of movs) {
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
      // Ignore when company catalog has no earnings carryforward account yet
    }
  }

  const computedAccounts = rollUpTrialBalanceAccounts(
    accounts,
    priorChargesMap,
    priorCreditsMap,
    currentChargesMap,
    currentCreditsMap
  );
  return buildFinancialStatementsFromTrialBalance(
    company,
    computedAccounts,
    ejercicio,
    periodo
  );
}

/**
 * Calcula saldos iniciales, cargos/abonos del periodo, saldo final y roll-up
 * jerárquico por nivel descendente (incluyendo cuentas complementarias con signo opuesto).
 */
export function rollUpTrialBalanceAccounts(
  accounts: readonly Account[],
  priorChargesMap: ReadonlyMap<string, number>,
  priorCreditsMap: ReadonlyMap<string, number>,
  currentChargesMap: ReadonlyMap<string, number>,
  currentCreditsMap: ReadonlyMap<string, number>
): AccountWithBalance[] {
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
      acc.nature === 'DEUDORA' ? initCents + chg - cred : initCents + cred - chg;

    byCode.set(acc.code, {
      ...acc,
      initialBalanceComputed: fromCents(initCents),
      periodCharges: fromCents(chg),
      periodCredits: fromCents(cred),
      finalBalance: fromCents(finalCents)
    });
  }

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

  return accounts.map(
    (a) =>
      byCode.get(a.code) ?? {
        ...a,
        initialBalanceComputed: 0,
        periodCharges: 0,
        periodCredits: 0,
        finalBalance: 0
      }
  );
}

/**
 * Construye los Estados Financieros (Totales de Balanza, Estado de Resultados y Balance General)
 * a partir de una balanza de comprobación ya calculada y totalizada por nivel jerárquico.
 */
export function buildFinancialStatementsFromTrialBalance(
  company: Company,
  computedAccounts: AccountWithBalance[],
  ejercicio: number,
  periodo: number
): FinancialStatementsResponse {
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
  const gastosAccs = computedAccounts.filter(
    (a) => a.type === 'GASTOS' && a.level >= 2 && !a.code.startsWith('8')
  );
  const isrAccs = computedAccounts.filter(
    (a) =>
      (a.code.startsWith('801') || a.code.startsWith('800') || a.satGroupCode.startsWith('611')) &&
      a.level >= 2
  );
  const activosAccs = computedAccounts.filter((a) => a.type === 'ACTIVO' && a.level >= 2);
  const pasivosAccs = computedAccounts.filter((a) => a.type === 'PASIVO' && a.level >= 2);
  const capitalAccs = computedAccounts.filter((a) => a.type === 'CAPITAL' && a.level >= 2);

  const sumL2Signed = (accs: AccountWithBalance[]) =>
    fromCents(
      accs.reduce((s, a) => s + (a.level === 2 ? toCents(a.finalBalance) : 0), 0)
    );

  const totalIngresosCents = toCents(
    computedAccounts.find((a) => a.code === '400-00-000')?.finalBalance ?? sumL2Signed(ingresosAccs)
  );
  const totalCostosCents = toCents(
    computedAccounts.find((a) => a.code === '500-00-000')?.finalBalance ?? sumL2Signed(costosAccs)
  );
  const totalGastosCents = toCents(
    computedAccounts.find((a) => a.code === '600-00-000')?.finalBalance ?? sumL2Signed(gastosAccs)
  );
  const totalIsrCents = toCents(
    computedAccounts.find((a) => a.code === '800-00-000' || a.code === '801-00-000')
      ?.finalBalance ?? sumL2Signed(isrAccs)
  );
  const utilidadBrutaCents = totalIngresosCents - totalCostosCents;
  const utilidadNetaCents = utilidadBrutaCents - totalGastosCents - totalIsrCents;

  const totalActivoCents = toCents(
    computedAccounts.find((a) => a.code === '100-00-000')?.finalBalance ?? sumL2Signed(activosAccs)
  );
  const totalPasivoCents = toCents(
    computedAccounts.find((a) => a.code === '200-00-000')?.finalBalance ?? sumL2Signed(pasivosAccs)
  );
  const totalCapitalBaseCents = toCents(
    computedAccounts.find((a) => a.code === '300-00-000')?.finalBalance ?? sumL2Signed(capitalAccs)
  );
  const totalPasivoMasCapitalCents = totalPasivoCents + totalCapitalBaseCents + utilidadNetaCents;

  const totalIngresos = fromCents(totalIngresosCents);
  const totalCostos = fromCents(totalCostosCents);
  const totalGastos = fromCents(totalGastosCents);
  const totalIsr = fromCents(totalIsrCents);
  const utilidadBruta = fromCents(utilidadBrutaCents);
  const utilidadNeta = fromCents(utilidadNetaCents);
  const totalActivo = fromCents(totalActivoCents);
  const totalPasivo = fromCents(totalPasivoCents);
  const totalCapitalBase = fromCents(totalCapitalBaseCents);
  const totalPasivoMasCapital = fromCents(totalPasivoMasCapitalCents);

  return {
    company,
    ejercicio,
    periodo,
    trialBalance: computedAccounts,
    totals: {
      initialDeudor: fromCents(initDeudorCents),
      initialAcreedor: fromCents(initAcreedorCents),
      totalCargos: fromCents(totalChgCents),
      totalAbonos: fromCents(totalCredCents),
      finalDeudor: fromCents(finalDeudorCents),
      finalAcreedor: fromCents(finalAcreedorCents)
    },
    incomeStatement: {
      ingresos: ingresosAccs,
      totalIngresos,
      costos: costosAccs,
      totalCostos,
      utilidadBruta,
      gastos: gastosAccs,
      totalGastos,
      isrEjercicio: isrAccs,
      totalIsr,
      utilidadNeta
    },
    balanceSheet: {
      activos: activosAccs,
      totalActivo,
      pasivos: pasivosAccs,
      totalPasivo,
      capital: capitalAccs,
      totalCapitalBase,
      utilidadEjercicio: utilidadNeta,
      totalPasivoMasCapital,
      isBalanced: Math.abs(totalActivo - totalPasivoMasCapital) < 0.05
    }
  };
}
