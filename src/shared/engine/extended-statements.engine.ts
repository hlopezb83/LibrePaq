import type { AccountWithBalance, Company } from '../types';
import type { CashFlowLineItem, CashFlowStatementData, ComparativeAccountRow, EquityChangesRow, EquityChangesStatementData, ExtendedFinancialStatementsResponse } from '../types/extended-statements.types';
import { buildFinancialStatementsFromTrialBalance } from './financial-reports.engine';
import { isIsrExpenseAccount, normalizePostCloseP13Accounts } from './financial-reports-helpers';
import { fromCents, toCents } from './invariants-and-math';

type EquityBucket = 'capitalSocial' | 'reservaLegal' | 'resultadosAcumulados' | 'resultadoEjercicio';

interface AccountPair {
  sample: AccountWithBalance;
  beginCents: number;
  endCents: number;
}

const EQUITY_COLUMNS: EquityChangesStatementData['columns'] = [
  { key: 'capitalSocial', label: 'Capital Social', satRef: 'SAT 301' },
  { key: 'reservaLegal', label: 'Reserva Legal', satRef: 'SAT 303' },
  { key: 'resultadosAcumulados', label: 'Resultados Acumulados', satRef: 'SAT 304' },
  { key: 'resultadoEjercicio', label: 'Resultado del Ejercicio', satRef: 'SAT 305/Neto' },
  { key: 'total', label: 'Total Capital Contable', satRef: 'NIF B-4' }
];

const getSatPrefixNum = (acc: Pick<AccountWithBalance, 'satGroupCode' | 'code'>): number => {
  const match = (acc.satGroupCode || acc.code || '').trim().match(/^(\d{3})/);
  return match?.[1] ? Number(match[1]) : 0;
};

const getSignedCents = (acc: AccountWithBalance, useInitial: boolean): number => {
  const raw = toCents(useInitial ? acc.initialBalanceComputed : acc.finalBalance);
  if (acc.type === 'ACTIVO') return acc.nature === 'DEUDORA' ? raw : -raw;
  if (acc.type === 'PASIVO' || acc.type === 'CAPITAL') return acc.nature === 'ACREEDORA' ? raw : -raw;
  return raw;
};

const isDepreciationExpense = (acc: AccountWithBalance): boolean => {
  if (acc.type !== 'GASTOS' && acc.type !== 'COSTOS') return false;
  const lower = acc.name.toLowerCase();
  return acc.code === '601-01-006' || acc.satGroupCode.startsWith('613') || lower.includes('depreciaci') || lower.includes('amortizaci');
};

const selectLeafAccounts = (accounts: readonly AccountWithBalance[]): AccountWithBalance[] => {
  const hasAffectable = accounts.some((a) => a.isAffectable);
  return accounts.filter((a) => (hasAffectable ? a.isAffectable : a.level >= 2));
};

function computeNetIncomeFromInitialCents(accounts: readonly AccountWithBalance[]): number {
  const leaves = selectLeafAccounts(accounts);
  let ingresosCents = 0;
  let costosCents = 0;
  let gastosCents = 0;
  let isrCents = 0;

  for (const a of leaves) {
    const balCents = toCents(a.initialBalanceComputed);
    if (a.type === 'INGRESOS') {
      ingresosCents += (a.nature === 'ACREEDORA' ? 1 : -1) * balCents;
    } else if (a.type === 'COSTOS') {
      costosCents += (a.nature === 'DEUDORA' ? 1 : -1) * balCents;
    } else if (a.type === 'GASTOS') {
      const signedBal = (a.nature === 'DEUDORA' ? 1 : -1) * balCents;
      if (isIsrExpenseAccount(a)) isrCents += signedBal;
      else gastosCents += signedBal;
    } else if (isIsrExpenseAccount(a)) {
      isrCents += (a.nature === 'DEUDORA' ? 1 : -1) * balCents;
    }
  }

  return ingresosCents - costosCents - gastosCents - isrCents;
}

function buildAccountPairs(
  currentAccounts: readonly AccountWithBalance[],
  previousAccounts: readonly AccountWithBalance[] | null | undefined,
  useComparativeOpening: boolean
): AccountPair[] {
  const currByCode = new Map(selectLeafAccounts(currentAccounts).map((a) => [a.code, a]));
  const prevByCode = new Map(selectLeafAccounts(previousAccounts ?? []).map((a) => [a.code, a]));
  const allCodes = Array.from(new Set([...currByCode.keys(), ...prevByCode.keys()])).sort();
  return allCodes.flatMap((code) => {
    const curr = currByCode.get(code);
    const prev = prevByCode.get(code);
    const sample = curr ?? prev;
    if (!sample) return [];
    const endCents = curr ? getSignedCents(curr, false) : 0;
    const beginCents = useComparativeOpening ? (prev ? getSignedCents(prev, false) : 0) : (curr ? getSignedCents(curr, true) : 0);
    return [{ sample, beginCents, endCents }];
  });
}

function resolveEquityBucket(acc: AccountWithBalance): EquityBucket {
  const prefix = getSatPrefixNum(acc);
  if (prefix === 301 && acc.code.startsWith('301-02')) return 'resultadosAcumulados';
  if (prefix === 301) return 'capitalSocial';
  if (prefix === 303) return 'reservaLegal';
  if (prefix === 304) return 'resultadosAcumulados';
  if (prefix === 305 || (prefix === 302 && acc.name.toLowerCase().includes('resultado'))) return 'resultadoEjercicio';
  if (prefix === 302 || prefix === 306) return 'capitalSocial';
  return 'resultadosAcumulados';
}

const lineIfNonZero = (code: string, label: string, cents: number, satReference: string): CashFlowLineItem[] =>
  cents !== 0 ? [{ code, label, amount: fromCents(cents), satReference }] : [];

function buildCashFlowStatement(
  pairs: readonly AccountPair[],
  currentLeaves: readonly AccountWithBalance[],
  utilidadNetaFlowCents: number,
  priorYearNetIncomeCarryCents: number,
  useComparativeOpening: boolean
): CashFlowStatementData {
  const acc = { cashBegin: 0, cashEnd: 0, clientes: 0, inv: 0, actCirc: 0, prov: 0, pasCirc: 0, af: 0, noCirc: 0, depAc: 0, deudaLp: 0, capSoc: 0, capOtr: 0 };
  for (const { sample, beginCents, endCents } of pairs) {
    const d = endCents - beginCents;
    const p = getSatPrefixNum(sample);
    if (sample.type === 'ACTIVO') {
      if (p === 101 || p === 102 || p === 103) { acc.cashBegin += beginCents; acc.cashEnd += endCents; }
      else if (p === 105) acc.clientes += d;
      else if (p === 115) acc.inv += d;
      else if (p === 171) acc.depAc += -d;
      else if (p >= 151 && p <= 179) acc.af += d;
      else if (p >= 180 && p <= 199) acc.noCirc += d;
      else acc.actCirc += d;
    } else if (sample.type === 'PASIVO') {
      if (p === 201) acc.prov += d;
      else if (p >= 250 && p <= 299) acc.deudaLp += d;
      else acc.pasCirc += d;
    } else if (sample.type === 'CAPITAL') {
      if (resolveEquityBucket(sample) === 'capitalSocial') acc.capSoc += d;
      else acc.capOtr += d;
    }
  }

  const deprGasto = currentLeaves.reduce((sum, a) => (
    isDepreciationExpense(a) ? sum + toCents(a.finalBalance) - (useComparativeOpening ? 0 : toCents(a.initialBalanceComputed)) : sum
  ), 0);
  const ajustesPartidasVirtuales: CashFlowLineItem[] = deprGasto !== 0
    ? [{ code: '601-01-006', label: 'Depreciación y amortización del periodo', amount: fromCents(deprGasto), satReference: 'NIF B-2 / 601-01-006' }]
    : lineIfNonZero('171', 'Depreciación acumulada del periodo (ajuste virtual)', acc.depAc, 'SAT 171');
  const virtualTotal = deprGasto !== 0 ? deprGasto : acc.depAc;
  const deprResidual = deprGasto !== 0 ? acc.depAc - deprGasto : 0;

  const cambiosCapitalTrabajo = [
    ...lineIfNonZero('105', 'Variación en Clientes y Cuentas por Cobrar', -acc.clientes, 'SAT 105'),
    ...lineIfNonZero('115', 'Variación en Inventarios', -acc.inv, 'SAT 115'),
    ...lineIfNonZero('113/118', 'Otros Activos Circulantes e Impuestos a Favor', -acc.actCirc, 'SAT 107-119'),
    ...lineIfNonZero('201', 'Variación en Proveedores', acc.prov, 'SAT 201'),
    ...lineIfNonZero('205/213/216', 'Impuestos, Acreedores y Retenciones por Pagar', acc.pasCirc, 'SAT 205-216')
  ];
  const wcTotal = -acc.clientes - acc.inv - acc.actCirc + acc.prov + acc.pasCirc;
  const flujoOp = utilidadNetaFlowCents + virtualTotal + wcTotal;

  const actividadesInversion = [
    ...lineIfNonZero('15x', 'Adquisición / Baja de Activos Fijos e Inversiones', -acc.af, 'SAT 151-179'),
    ...lineIfNonZero('171/18x', 'Otros Activos No Circulantes y Bajas de Depreciación', -acc.noCirc + deprResidual, 'SAT 171/18x')
  ];
  const flujoInv = -acc.af - acc.noCirc + deprResidual;

  const equityOtherCash = acc.capOtr - priorYearNetIncomeCarryCents;
  const actividadesFinanciamiento = [
    ...lineIfNonZero('25x', 'Obtención / Amortización de Deuda a Largo Plazo', acc.deudaLp, 'SAT 250-299'),
    ...lineIfNonZero('301', 'Aportaciones / Reembolsos de Capital Social', acc.capSoc, 'SAT 301'),
    ...lineIfNonZero('303/304', 'Dividendos y Otros Movimientos de Capital', equityOtherCash, 'SAT 303-304')
  ];
  const flujoFin = acc.deudaLp + acc.capSoc + equityOtherCash;
  const variacion = flujoOp + flujoInv + flujoFin;
  const diff = fromCents(variacion - (acc.cashEnd - acc.cashBegin));
  return {
    utilidadNeta: fromCents(utilidadNetaFlowCents),
    ajustesPartidasVirtuales, totalPartidasVirtuales: fromCents(virtualTotal),
    cambiosCapitalTrabajo, totalCambiosCapitalTrabajo: fromCents(wcTotal),
    actividadesOperacion: [{ code: 'NETO', label: 'Utilidad (o Pérdida) Neta del Periodo', amount: fromCents(utilidadNetaFlowCents), satReference: 'NIF B-3' }, ...ajustesPartidasVirtuales, ...cambiosCapitalTrabajo],
    flujoNetoOperacion: fromCents(flujoOp),
    actividadesInversion, flujoNetoInversion: fromCents(flujoInv),
    actividadesFinanciamiento, flujoNetoFinanciamiento: fromCents(flujoFin),
    variacionNetaEfectivo: fromCents(variacion),
    efectivoInicial: fromCents(acc.cashBegin), efectivoFinal: fromCents(acc.cashEnd),
    diferenciaReconciliacion: diff, isReconciled: Math.abs(diff) < 0.05
  };
}

function makeEquityRow(id: string, concepto: string, rowType: EquityChangesRow['rowType'], c: Partial<Record<EquityBucket, number>>): EquityChangesRow {
  const cap = c.capitalSocial ?? 0;
  const res = c.reservaLegal ?? 0;
  const acum = c.resultadosAcumulados ?? 0;
  const ejer = c.resultadoEjercicio ?? 0;
  return {
    id, concepto, rowType,
    capitalSocial: fromCents(cap), reservaLegal: fromCents(res),
    resultadosAcumulados: fromCents(acum), resultadoEjercicio: fromCents(ejer),
    total: fromCents(cap + res + acum + ejer)
  };
}

function buildEquityChangesStatement(
  pairs: readonly AccountPair[],
  openNet: number,
  closeNet: number,
  flowNet: number,
  useComparativeOpening: boolean
): EquityChangesStatementData {
  const open: Record<EquityBucket, number> = { capitalSocial: 0, reservaLegal: 0, resultadosAcumulados: 0, resultadoEjercicio: openNet };
  const close: Record<EquityBucket, number> = { capitalSocial: 0, reservaLegal: 0, resultadosAcumulados: 0, resultadoEjercicio: closeNet };
  for (const { sample, beginCents, endCents } of pairs) {
    if (sample.type !== 'CAPITAL') continue;
    const bucket = resolveEquityBucket(sample);
    open[bucket] += beginCents;
    close[bucket] += endCents;
  }

  // Evitar fabricar dividendos negativos o doble conteo si un catálogo externo retuvo openNet en 305
  const residualPriorIn305 = close.resultadoEjercicio - closeNet;
  if (
    useComparativeOpening &&
    openNet !== 0 &&
    residualPriorIn305 === openNet &&
    close.resultadosAcumulados === open.resultadosAcumulados
  ) {
    close.resultadoEjercicio -= openNet;
    close.resultadosAcumulados += openNet;
  }

  const rows: EquityChangesRow[] = [makeEquityRow('opening', 'Saldos Iniciales del Capital Contable', 'OPENING', open)];
  if (useComparativeOpening && openNet !== 0) {
    rows.push(makeEquityRow('carryforward', 'Traspaso de Resultado del Ejercicio Anterior a Resultados Acumulados', 'MOVEMENT', { resultadosAcumulados: openNet, resultadoEjercicio: -openNet }));
  }
  const capDelta = close.capitalSocial - open.capitalSocial;
  if (capDelta !== 0) rows.push(makeEquityRow('cap-social', 'Aportaciones / Movimientos de Capital Social (301)', 'MOVEMENT', { capitalSocial: capDelta }));
  const resDelta = close.reservaLegal - open.reservaLegal;
  if (resDelta !== 0) rows.push(makeEquityRow('reserva', 'Incremento / Movimiento en Reserva Legal (303)', 'MOVEMENT', { reservaLegal: resDelta }));
  const accumResidual = (close.resultadosAcumulados - open.resultadosAcumulados) - (useComparativeOpening ? openNet : 0);
  if (accumResidual !== 0) rows.push(makeEquityRow('resultados-acum', 'Dividendos y Otros Movimientos en Resultados Acumulados (304)', 'MOVEMENT', { resultadosAcumulados: accumResidual }));

  const netMovement = (useComparativeOpening ? closeNet : flowNet) + ((close.resultadoEjercicio - closeNet) - (open.resultadoEjercicio - openNet));
  if (netMovement !== 0 || rows.length === 1) {
    rows.push(makeEquityRow('net-income', 'Resultado Integral (Utilidad / Pérdida Neta del Periodo)', 'MOVEMENT', { resultadoEjercicio: netMovement }));
  }

  const closingRow = makeEquityRow('closing', 'Saldos Finales del Capital Contable', 'CLOSING', close);
  rows.push(closingRow);
  const openingRow = rows[0]!;
  const movementNetCents = rows.filter((r) => r.rowType === 'MOVEMENT').reduce((acc, r) => acc + toCents(r.total), 0);
  return {
    columns: EQUITY_COLUMNS, rows,
    saldoInicialTotal: openingRow.total, movimientoNetoTotal: fromCents(movementNetCents), saldoFinalTotal: closingRow.total,
    isBalanced: Math.abs(toCents(openingRow.total) + movementNetCents - toCents(closingRow.total)) <= 1
  };
}

function buildComparativeRows(
  currentTrialBalance: readonly AccountWithBalance[],
  previousTrialBalance: readonly AccountWithBalance[] | null | undefined
): ComparativeAccountRow[] {
  const prevByCode = new Map((previousTrialBalance ?? []).map((a) => [a.code, a]));
  const seen = new Set<string>();
  const rows: ComparativeAccountRow[] = [];
  const pushRow = (curr: AccountWithBalance | undefined, prev: AccountWithBalance | undefined) => {
    const ref = curr ?? prev;
    if (!ref) return;
    const currentBalance = curr?.finalBalance ?? 0;
    const previousBalance = prev?.finalBalance ?? 0;
    const prevCents = toCents(previousBalance);
    rows.push({
      accountId: ref.id, code: ref.code, name: ref.name, type: ref.type, nature: ref.nature, level: ref.level, satGroupCode: ref.satGroupCode,
      currentBalance, previousBalance,
      varianceAmount: fromCents(toCents(currentBalance) - prevCents),
      variancePct: prevCents === 0 ? null : Number((((currentBalance - previousBalance) / Math.abs(previousBalance)) * 100).toFixed(2))
    });
  };
  for (const curr of currentTrialBalance) { seen.add(curr.code); pushRow(curr, prevByCode.get(curr.code)); }
  for (const prev of previousTrialBalance ?? []) { if (!seen.has(prev.code)) pushRow(undefined, prev); }
  return rows;
}

function hasNonZeroTrialActivity(accounts: readonly AccountWithBalance[] | null | undefined): boolean {
  if (!accounts || accounts.length === 0) return false;
  return accounts.some(
    (a) =>
      Math.abs(a.finalBalance) >= 0.01 ||
      Math.abs(a.periodCharges) >= 0.01 ||
      Math.abs(a.periodCredits) >= 0.01
  );
}

/**
 * Calcula los estados financieros extendidos NIF B-2 (Flujos de Efectivo Método Indirecto),
 * NIF B-4 (Cambios en el Capital Contable) y Comparativo Interanual a partir de las balanzas.
 */
export function computeExtendedFinancialStatements(params: {
  company: Company;
  ejercicio: number;
  periodo: number;
  currentTrialBalance: readonly AccountWithBalance[];
  previousTrialBalance?: readonly AccountWithBalance[] | null;
}): ExtendedFinancialStatementsResponse {
  const { company, ejercicio, periodo, currentTrialBalance, previousTrialBalance } = params;
  const normalizedCurrTB = normalizePostCloseP13Accounts(currentTrialBalance, periodo).accounts;
  const hasPrev = hasNonZeroTrialActivity(previousTrialBalance);
  const normalizedPrevTB = hasPrev
    ? normalizePostCloseP13Accounts(previousTrialBalance ?? [], 13).accounts
    : null;

  const currNetCents = toCents(buildFinancialStatementsFromTrialBalance(company, normalizedCurrTB, ejercicio, periodo).incomeStatement.utilidadNeta);
  const prevNetCents = hasPrev && normalizedPrevTB
    ? toCents(buildFinancialStatementsFromTrialBalance(company, normalizedPrevTB, ejercicio - 1, 13).incomeStatement.utilidadNeta)
    : computeNetIncomeFromInitialCents(normalizedCurrTB);
  const flowNetCents = hasPrev ? currNetCents : currNetCents - prevNetCents;
  const pairs = buildAccountPairs(normalizedCurrTB, normalizedPrevTB, hasPrev);

  return {
    company, ejercicio, periodo,
    hasPreviousComparative: hasPrev,
    previousEjercicioLabel: hasPrev
      ? `Ejercicio ${ejercicio - 1}`
      : `Ejercicio ${ejercicio - 1} (Sin datos — Solo periodo actual)`,
    cashFlowWindowLabel: hasPrev
      ? `Acumulado YTD ${ejercicio} vs. Cierre ${ejercicio - 1}`
      : `Periodo ${periodo} / ${ejercicio} (Movimientos del periodo — sin ejercicio ${ejercicio - 1})`,
    cashFlow: buildCashFlowStatement(pairs, selectLeafAccounts(normalizedCurrTB), flowNetCents, hasPrev ? prevNetCents : 0, hasPrev),
    equityChanges: buildEquityChangesStatement(pairs, prevNetCents, currNetCents, flowNetCents, hasPrev),
    comparative: buildComparativeRows(normalizedCurrTB, normalizedPrevTB)
  };
}
