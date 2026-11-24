import { fromCents, toCents } from './invariants-and-math';
import {
  computeTrialBalanceTotals,
  registerClosingMovementsForTrialBalance,
  rollUpTrialBalanceAccounts,
  sumResultOfExerciseCents,
  type ClosingMovementCents
} from './financial-reports-rollup';
import {
  buildScopedBucketRows,
  classifyPnlBucket,
  getCodePrefixNumber,
  getLeafIds,
  isCapitalGanadoAccount,
  isResultOfExerciseAccount,
  normalizePostCloseP13Accounts,
  resolveAccumulatedEarningsAccount,
  sumRootByTypeCents,
  type PnlBucket
} from './financial-reports-helpers';
import type {
  AccountWithBalance,
  Company,
  FinancialStatementsResponse
} from '../types';

export { rollUpTrialBalanceAccounts };

export interface JoinedPolizaMovementInput {
  account_id: string;
  cargo: number;
  abono: number;
  polizas:
    | { company_id: string; ejercicio: number; periodo: number; origin?: string | null }
    | { company_id: string; ejercicio: number; periodo: number; origin?: string | null }[]
    | null;
}

/**
 * Aggregates account movements into a full hierarchical trial balance, NIF B-3 income statement,
 * and NIF B-6 balance sheet for a specific fiscal year and period.
 */
export function computeFinancialStatementsData(
  company: Company,
  accounts: AccountWithBalance[],
  movs: JoinedPolizaMovementInput[],
  ejercicio: number,
  periodo: number
): FinancialStatementsResponse {
  const isPersistentBalanceAcc = new Map(
    accounts.map((a) => [
      a.id,
      (a.type === 'ACTIVO' ||
        a.type === 'PASIVO' ||
        a.type === 'ORDEN' ||
        (a.type === 'CAPITAL' && !isResultOfExerciseAccount(a)))
    ])
  );

  const priorChargesMap = new Map<string, number>();
  const priorCreditsMap = new Map<string, number>();
  const currentChargesMap = new Map<string, number>();
  const currentCreditsMap = new Map<string, number>();
  const closingMovementsMap = new Map<string, ClosingMovementCents>();
  let priorUnclosedCargoCents = 0;
  let priorUnclosedAbonoCents = 0;
  let hasPriorYearMovements = false;

  for (const row of movs) {
    const p = Array.isArray(row.polizas) ? row.polizas[0] : row.polizas;
    if (!p) continue;
    const accId = row.account_id;
    const cargoCents = toCents(row.cargo);
    const abonoCents = toCents(row.abono);

    if (p.ejercicio < ejercicio) {
      hasPriorYearMovements = true;
      if (isPersistentBalanceAcc.get(accId)) {
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
        if (periodo === 13 && p.origin === 'CIERRE_ANUAL') {
          const prev = closingMovementsMap.get(accId) ?? { cargoCents: 0, abonoCents: 0 };
          prev.cargoCents += cargoCents;
          prev.abonoCents += abonoCents;
          closingMovementsMap.set(accId, prev);
        }
      }
    }
  }

  // Cuando zeroResultInitialBalances anula initialBalance de cuentas P&L y 305-* entre ejercicios,
  // trasladar el neto de esos saldos iniciales a Utilidades Acumuladas para mantener A = P + C.
  if (hasPriorYearMovements) {
    for (const acc of accounts) {
      if (!acc.isAffectable) continue;
      if (
        acc.type !== 'INGRESOS' &&
        acc.type !== 'COSTOS' &&
        acc.type !== 'GASTOS' &&
        !isResultOfExerciseAccount(acc)
      ) {
        continue;
      }
      const initCents = toCents(acc.initialBalance);
      if (initCents === 0) continue;
      if (acc.nature === 'ACREEDORA') {
        priorUnclosedAbonoCents += initCents;
      } else {
        priorUnclosedCargoCents += initCents;
      }
    }
  }

  if (priorUnclosedCargoCents !== 0 || priorUnclosedAbonoCents !== 0) {
    try {
      const accumAcc = resolveAccumulatedEarningsAccount(accounts);
      priorChargesMap.set(accumAcc.id, (priorChargesMap.get(accumAcc.id) || 0) + priorUnclosedCargoCents);
      priorCreditsMap.set(accumAcc.id, (priorCreditsMap.get(accumAcc.id) || 0) + priorUnclosedAbonoCents);
    } catch {
      // Ignore when company catalog has no equity carryforward account yet
    }
  }

  const computedAccounts = rollUpTrialBalanceAccounts(
    accounts,
    priorChargesMap,
    priorCreditsMap,
    currentChargesMap,
    currentCreditsMap,
    { zeroResultInitialBalances: hasPriorYearMovements }
  );
  if (closingMovementsMap.size > 0) {
    registerClosingMovementsForTrialBalance(computedAccounts, closingMovementsMap);
  }
  return buildFinancialStatementsFromTrialBalance(
    company,
    computedAccounts,
    ejercicio,
    periodo,
    closingMovementsMap.size > 0 ? { closingMovementsByAccountId: closingMovementsMap } : undefined
  );
}

/**
 * Construye los Estados Financieros (Totales de Balanza, Estado de Resultados NIF B-3 Mes/YTD
 * y Balance General NIF B-6) a partir de una balanza de comprobación ya calculada.
 */
export function buildFinancialStatementsFromTrialBalance(
  company: Company,
  computedAccounts: AccountWithBalance[],
  ejercicio: number,
  periodo: number,
  options?: { closingMovementsByAccountId?: ReadonlyMap<string, ClosingMovementCents> }
): FinancialStatementsResponse {
  const totals = computeTrialBalanceTotals(computedAccounts);

  const { isPreCloseP13, accounts: erSourceAccounts } = normalizePostCloseP13Accounts(
    computedAccounts,
    periodo,
    options?.closingMovementsByAccountId
  );
  const erLeafIds = getLeafIds(erSourceAccounts);

  const sumBucketCents = (bucket: PnlBucket, expectedNature: 'ACREEDORA' | 'DEUDORA') => {
    let ytd = 0;
    let period = 0;
    for (const a of erSourceAccounts) {
      if (a.type !== 'INGRESOS' && a.type !== 'COSTOS' && a.type !== 'GASTOS') continue;
      if (!erLeafIds.has(a.id)) continue;
      if (classifyPnlBucket(a) !== bucket) continue;
      const sign = a.nature === expectedNature ? 1 : -1;
      ytd += sign * toCents(a.finalBalance);
      period +=
        expectedNature === 'ACREEDORA'
          ? toCents(a.periodCredits) - toCents(a.periodCharges)
          : toCents(a.periodCharges) - toCents(a.periodCredits);
    }
    return { ytd, period };
  };

  const ing = sumBucketCents('INGRESOS', 'ACREEDORA');
  const cos = sumBucketCents('COSTOS', 'DEUDORA');
  const gas = sumBucketCents('GASTOS', 'DEUDORA');
  const rifProd = sumBucketCents('RIF_PRODUCTOS', 'ACREEDORA');
  const rifGas = sumBucketCents('RIF_GASTOS', 'DEUDORA');
  const isr = sumBucketCents('ISR', 'DEUDORA');

  const utilidadBrutaCents = ing.ytd - cos.ytd;
  const utilidadOperativaCents = utilidadBrutaCents - gas.ytd;
  const rifNetoCents = rifProd.ytd - rifGas.ytd;
  const uaiCents = utilidadOperativaCents + rifNetoCents;
  const utilidadNetaCents = uaiCents - isr.ytd;

  const pUtilidadBrutaCents = ing.period - cos.period;
  const pUtilidadOperativaCents = pUtilidadBrutaCents - gas.period;
  const pRifNetoCents = rifProd.period - rifGas.period;
  const pUaiCents = pUtilidadOperativaCents + pRifNetoCents;
  const pUtilidadNetaCents = pUaiCents - isr.period;

  const bsLeafIds = getLeafIds(computedAccounts);
  const isVisibleBsRow = (a: AccountWithBalance, targetType: 'ACTIVO' | 'PASIVO' | 'CAPITAL') =>
    a.type === targetType && (a.level >= 2 || (!a.parentCode && a.isAffectable));

  const erAccById = new Map(erSourceAccounts.map((a) => [a.id, a]));
  const resolveCapitalRow = (a: AccountWithBalance): AccountWithBalance | null => {
    if (!isResultOfExerciseAccount(a)) return a;
    const effective = isPreCloseP13 ? (erAccById.get(a.id) ?? a) : a;
    return toCents(effective.finalBalance) !== 0 ? effective : null;
  };
  const activosAccs = computedAccounts.filter((a) => isVisibleBsRow(a, 'ACTIVO'));
  const pasivosAccs = computedAccounts.filter((a) => isVisibleBsRow(a, 'PASIVO'));
  const capitalAccs = computedAccounts
    .filter((a) => isVisibleBsRow(a, 'CAPITAL'))
    .map(resolveCapitalRow)
    .filter((a): a is AccountWithBalance => a !== null);

  const totalActivoCents = sumRootByTypeCents(computedAccounts, 'ACTIVO', 'DEUDORA');
  const totalPasivoCents = sumRootByTypeCents(computedAccounts, 'PASIVO', 'ACREEDORA');
  const totalCapitalAllCents = sumRootByTypeCents(computedAccounts, 'CAPITAL', 'ACREEDORA');

  const postClose305Cents = sumResultOfExerciseCents(computedAccounts, bsLeafIds);
  const preClose305Cents = sumResultOfExerciseCents(erSourceAccounts, erLeafIds);

  const closingDelta305Cents = isPreCloseP13 ? postClose305Cents - preClose305Cents : 0;
  const totalCapitalBaseCents = totalCapitalAllCents - closingDelta305Cents;
  const totalPasivoMasCapitalCents =
    totalPasivoCents + totalCapitalBaseCents + utilidadNetaCents;

  // Clasificación NIF B-6 sobre hojas afectables (preserva suma exacta al centavo)
  const activoCirculante = activosAccs.filter((a) => getCodePrefixNumber(a) < 150);
  const activoNoCirculante = activosAccs.filter((a) => getCodePrefixNumber(a) >= 150);
  const totalActivoCircCents = computedAccounts
    .filter((a) => a.type === 'ACTIVO' && bsLeafIds.has(a.id) && getCodePrefixNumber(a) < 150)
    .reduce((s, a) => s + (a.nature === 'DEUDORA' ? 1 : -1) * toCents(a.finalBalance), 0);
  const totalActivoNoCircCents = totalActivoCents - totalActivoCircCents;

  const pasivoCortoPlazo = pasivosAccs.filter((a) => getCodePrefixNumber(a) < 250);
  const pasivoLargoPlazo = pasivosAccs.filter((a) => getCodePrefixNumber(a) >= 250);
  const totalPasivoCpCents = computedAccounts
    .filter((a) => a.type === 'PASIVO' && bsLeafIds.has(a.id) && getCodePrefixNumber(a) < 250)
    .reduce((s, a) => s + (a.nature === 'ACREEDORA' ? 1 : -1) * toCents(a.finalBalance), 0);
  const totalPasivoLpCents = totalPasivoCents - totalPasivoCpCents;

  const capitalLeafs = computedAccounts
    .filter((a) => a.type === 'CAPITAL' && bsLeafIds.has(a.id))
    .map(resolveCapitalRow)
    .filter((a): a is AccountWithBalance => a !== null);
  const capitalContribuido = capitalLeafs.filter((a) => !isCapitalGanadoAccount(a));
  const capitalGanado = capitalLeafs.filter((a) => isCapitalGanadoAccount(a));
  const totalCapContribCents = capitalContribuido.reduce(
    (s, a) => s + (a.nature === 'ACREEDORA' ? 1 : -1) * toCents(a.finalBalance),
    0
  );
  const totalCapGanadoCents = totalCapitalBaseCents - totalCapContribCents + utilidadNetaCents;

  const totalActivo = fromCents(totalActivoCents);
  const totalPasivo = fromCents(totalPasivoCents);
  const totalCapitalBase = fromCents(totalCapitalBaseCents);
  const utilidadNeta = fromCents(utilidadNetaCents);
  const totalPasivoMasCapital = fromCents(totalPasivoMasCapitalCents);

  return {
    company,
    ejercicio,
    periodo,
    trialBalance: computedAccounts,
    totals,
    incomeStatement: {
      ingresos: buildScopedBucketRows(erSourceAccounts, 'INGRESOS', erLeafIds),
      totalIngresos: fromCents(ing.ytd),
      costos: buildScopedBucketRows(erSourceAccounts, 'COSTOS', erLeafIds),
      totalCostos: fromCents(cos.ytd),
      utilidadBruta: fromCents(utilidadBrutaCents),
      gastos: buildScopedBucketRows(erSourceAccounts, 'GASTOS', erLeafIds),
      totalGastos: fromCents(gas.ytd),
      utilidadOperativa: fromCents(utilidadOperativaCents),
      rifProductos: buildScopedBucketRows(erSourceAccounts, 'RIF_PRODUCTOS', erLeafIds),
      totalRifProductos: fromCents(rifProd.ytd),
      rifGastos: buildScopedBucketRows(erSourceAccounts, 'RIF_GASTOS', erLeafIds),
      totalRifGastos: fromCents(rifGas.ytd),
      rifNeto: fromCents(rifNetoCents),
      utilidadAntesImpuestos: fromCents(uaiCents),
      isrEjercicio: buildScopedBucketRows(erSourceAccounts, 'ISR', erLeafIds),
      totalIsr: fromCents(isr.ytd),
      utilidadNeta,
      isPreCloseP13,
      periodTotals: {
        totalIngresos: fromCents(ing.period),
        totalCostos: fromCents(cos.period),
        utilidadBruta: fromCents(pUtilidadBrutaCents),
        totalGastos: fromCents(gas.period),
        utilidadOperativa: fromCents(pUtilidadOperativaCents),
        totalRifProductos: fromCents(rifProd.period),
        totalRifGastos: fromCents(rifGas.period),
        rifNeto: fromCents(pRifNetoCents),
        utilidadAntesImpuestos: fromCents(pUaiCents),
        totalIsr: fromCents(isr.period),
        utilidadNeta: fromCents(pUtilidadNetaCents)
      }
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
      isBalanced: Math.abs(totalActivoCents - totalPasivoMasCapitalCents) <= 1,
      nifB6: {
        activoCirculante,
        totalActivoCirculante: fromCents(totalActivoCircCents),
        activoNoCirculante,
        totalActivoNoCirculante: fromCents(totalActivoNoCircCents),
        pasivoCortoPlazo,
        totalPasivoCortoPlazo: fromCents(totalPasivoCpCents),
        pasivoLargoPlazo,
        totalPasivoLargoPlazo: fromCents(totalPasivoLpCents),
        capitalContribuido,
        totalCapitalContribuido: fromCents(totalCapContribCents),
        capitalGanado,
        totalCapitalGanado: fromCents(totalCapGanadoCents)
      }
    }
  };
}
