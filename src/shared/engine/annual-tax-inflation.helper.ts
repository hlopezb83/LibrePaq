import type { AccountWithBalance } from '../types/core.types';
import type { AnnualInflationMonthlyRow, AnnualInflationResult } from '../types/annual-tax.types';
import { MESES_SAT } from '../sat-constants';
import { getLatestPublishedInpc, getOfficialInpc } from '../sat-inpc-catalog';
import { fromCents, toCents } from './invariants-and-math';
import type { AnnualMonthlyBalancesInput, AnnualTaxMonthlyBalance } from './annual-tax.engine';

const CREDIT_PREFIXES = ['102', '103', '105', '106', '107', '113'] as const;
const DEBT_PREFIXES = ['201', '202', '205', '206', '213', '216', '251', '252', '253'] as const;

export function pickEvalAccounts(accounts: readonly AccountWithBalance[]): AccountWithBalance[] {
  const affectable = accounts.filter((a) => a.isAffectable);
  return affectable.length > 0 ? affectable : accounts.filter((a) => a.level >= 2);
}

export function truncate4(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor((value + 1e-12) * 10000) / 10000;
}

export function resolveAnnualInpcPair(
  ejercicio: number,
  inpcAnterior?: number,
  inpcActual?: number
): { inpcCierreAnterior: number; inpcCierreActual: number } {
  const fallbackAnt = getOfficialInpc(ejercicio - 1, 12) ?? getLatestPublishedInpc() ?? 137.949;
  const fallbackAct = getOfficialInpc(ejercicio, 12) ?? getLatestPublishedInpc() ?? 143.042;
  return {
    inpcCierreAnterior: inpcAnterior !== undefined && Number(inpcAnterior) > 0 ? Number(inpcAnterior) : fallbackAnt,
    inpcCierreActual: inpcActual !== undefined && Number(inpcActual) > 0 ? Number(inpcActual) : fallbackAct
  };
}

function hasPrefix(acc: AccountWithBalance, prefixes: readonly string[]): boolean {
  const code = acc.code ?? '';
  const sat = acc.satGroupCode ?? '';
  return prefixes.some((p) => code.startsWith(p) || sat.startsWith(p));
}

function isExcludedInflationCredit(acc: AccountWithBalance): boolean {
  const code = acc.code ?? '';
  const sat = acc.satGroupCode ?? '';
  if (code === '107-01-001' || sat === '107.01') return true;
  if (code.startsWith('107-02') || sat === '107.02' || sat.startsWith('107.02')) return true;
  const lower = acc.name.toLowerCase();
  return (
    code.startsWith('107') &&
    (lower.includes('empleado') ||
      lower.includes('funcionario') ||
      lower.includes('socio') ||
      lower.includes('accionista'))
  );
}

function isExcludedInflationDebt(acc: AccountWithBalance): boolean {
  const code = acc.code ?? '';
  const sat = acc.satGroupCode ?? '';
  const lower = acc.name.toLowerCase();
  if (sat === '213.03' || sat.startsWith('213.03') || code === '213-01-002') return true;
  if (code.startsWith('210') || code.startsWith('211') || sat.startsWith('210') || sat.startsWith('211')) return true;
  return code.startsWith('213') && lower.includes('isr');
}

function normalizeMonthlyBalances(
  input: AnnualMonthlyBalancesInput,
  fallbackTrialBalance: readonly AccountWithBalance[]
): AnnualTaxMonthlyBalance[] {
  const map = new Map<number, readonly AccountWithBalance[]>();
  if (input instanceof Map) {
    for (const [p, accs] of input.entries()) if (p >= 1 && p <= 12) map.set(p, accs);
  } else if (Array.isArray(input)) {
    for (const item of input) if (item && item.periodo >= 1 && item.periodo <= 12) map.set(item.periodo, item.accounts);
  } else if (input && typeof input === 'object') {
    for (const [k, accs] of Object.entries(input)) {
      const p = Number(k);
      if (p >= 1 && p <= 12 && Array.isArray(accs)) map.set(p, accs);
    }
  }
  if (map.size === 0) {
    return Array.from({ length: 12 }, (_, idx) => ({ periodo: idx + 1, accounts: fallbackTrialBalance }));
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([periodo, accounts]) => ({ periodo, accounts }));
}

export function computeAnnualInflation(
  ejercicio: number,
  monthlyBalancesByPeriod: AnnualMonthlyBalancesInput,
  fallbackTrialBalance: readonly AccountWithBalance[],
  inpcAnteriorInput?: number,
  inpcActualInput?: number
): AnnualInflationResult {
  const { inpcCierreAnterior, inpcCierreActual } = resolveAnnualInpcPair(ejercicio, inpcAnteriorInput, inpcActualInput);
  const periods = normalizeMonthlyBalances(monthlyBalancesByPeriod, fallbackTrialBalance);
  const monthlyRows: AnnualInflationMonthlyRow[] = [];
  let sumCreditosCents = 0;
  let sumDeudasCents = 0;

  for (const item of periods) {
    let monthCreditosCents = 0;
    let monthDeudasCents = 0;
    for (const acc of pickEvalAccounts(item.accounts)) {
      const balCents = toCents(acc.finalBalance);
      if (hasPrefix(acc, CREDIT_PREFIXES) && !isExcludedInflationCredit(acc)) {
        monthCreditosCents += Math.max(0, balCents);
      } else if (hasPrefix(acc, DEBT_PREFIXES) && !isExcludedInflationDebt(acc)) {
        monthDeudasCents += Math.max(0, balCents);
      }
    }
    sumCreditosCents += monthCreditosCents;
    sumDeudasCents += monthDeudasCents;
    const mesNombre = MESES_SAT.find((m) => m.periodo === item.periodo)?.nombre ?? `Mes ${item.periodo}`;
    monthlyRows.push({ periodo: item.periodo, mesNombre, creditosCierre: fromCents(monthCreditosCents), deudasCierre: fromCents(monthDeudasCents) });
  }

  const divisor = Math.max(1, periods.length);
  const promedioCreditosCents = Math.round(sumCreditosCents / divisor);
  const promedioDeudasCents = Math.round(sumDeudasCents / divisor);
  const diffCents = promedioDeudasCents - promedioCreditosCents;
  const factorAjuste = truncate4(inpcCierreAnterior > 0 && inpcCierreActual > inpcCierreAnterior ? inpcCierreActual / inpcCierreAnterior - 1 : 0);
  const tipo: AnnualInflationResult['tipo'] = diffCents > 0 ? 'ACUMULABLE' : diffCents < 0 ? 'DEDUCIBLE' : 'NEUTRO';

  return {
    promedioCreditos: fromCents(promedioCreditosCents),
    promedioDeudas: fromCents(promedioDeudasCents),
    diferenciaPromedios: fromCents(Math.abs(diffCents)),
    tipo,
    inpcCierreAnterior,
    inpcCierreActual,
    factorAjuste,
    ajusteAcumulable: fromCents(diffCents > 0 ? Math.round(diffCents * factorAjuste) : 0),
    ajusteDeducible: fromCents(diffCents < 0 ? Math.round(Math.abs(diffCents) * factorAjuste) : 0),
    monthlyRows
  };
}

export function sumMonthlyIsrRetentionChargesCents(monthlyBalancesByPeriod: AnnualMonthlyBalancesInput): number {
  let tbRetChargesCents = 0;
  for (const item of normalizeMonthlyBalances(monthlyBalancesByPeriod, [])) {
    for (const acc of pickEvalAccounts(item.accounts)) {
      if (acc.code === '113-02-001' || acc.satGroupCode === '113.02') {
        tbRetChargesCents += Math.max(0, toCents(acc.periodCharges));
      }
    }
  }
  return tbRetChargesCents;
}
