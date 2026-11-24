import type { Account, AccountWithBalance } from '../types/core.types';
import type { AnnualInflationMonthlyRow, AnnualInflationResult } from '../types/annual-tax.types';
import type { FixedAssetRecord as FaRecord } from '../types/fiscal.types';
import { MESES_SAT } from '../sat-constants';
import { getLatestPublishedInpc, getOfficialInpc } from '../sat-inpc-catalog';
import { parseCalendarDate } from '../date-utils';
import { resolveFiscalAccount } from './auto-poliza.engine';
import { rollUpTrialBalanceAccounts, type JoinedPolizaMovementInput } from './financial-reports.engine';
import { computeFixedAssetWithDepreciation } from './fixed-assets.engine';
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

/**
 * Construye los 12 cortes mensuales acumulados (periodos 1..12) y la balanza anual
 * a partir de cuentas y movimientos contables, reutilizable en SQLite y Supabase.
 */
export function buildAnnualMonthlyBalancesFromMovements(
  accounts: readonly Account[],
  movs: readonly JoinedPolizaMovementInput[],
  ejercicio: number
): { trialBalance: AccountWithBalance[]; monthlyBalancesByPeriod: AnnualTaxMonthlyBalance[] } {
  const isBsMap = new Map(
    accounts.map((a) => [a.id, a.type === 'ACTIVO' || a.type === 'PASIVO' || a.type === 'CAPITAL'])
  );

  const openingCharges = new Map<string, number>();
  const openingCredits = new Map<string, number>();
  let unclosedCargoCents = 0;
  let unclosedAbonoCents = 0;
  let hasPriorYearMovements = false;

  const yearMonthCharges = new Map<number, Map<string, number>>();
  const yearMonthCredits = new Map<number, Map<string, number>>();
  for (let m = 1; m <= 12; m += 1) {
    yearMonthCharges.set(m, new Map<string, number>());
    yearMonthCredits.set(m, new Map<string, number>());
  }

  for (const row of movs) {
    const p = Array.isArray(row.polizas) ? row.polizas[0] : row.polizas;
    if (!p) continue;
    const cargoCents = toCents(row.cargo);
    const abonoCents = toCents(row.abono);
    if (p.ejercicio < ejercicio) {
      hasPriorYearMovements = true;
      if (isBsMap.get(row.account_id)) {
        openingCharges.set(row.account_id, (openingCharges.get(row.account_id) || 0) + cargoCents);
        openingCredits.set(row.account_id, (openingCredits.get(row.account_id) || 0) + abonoCents);
      } else {
        unclosedCargoCents += cargoCents;
        unclosedAbonoCents += abonoCents;
      }
    } else if (p.ejercicio === ejercicio && p.periodo >= 1 && p.periodo <= 12) {
      const chgMap = yearMonthCharges.get(p.periodo)!;
      const credMap = yearMonthCredits.get(p.periodo)!;
      chgMap.set(row.account_id, (chgMap.get(row.account_id) || 0) + cargoCents);
      credMap.set(row.account_id, (credMap.get(row.account_id) || 0) + abonoCents);
    }
  }

  if (unclosedCargoCents > 0 || unclosedAbonoCents > 0) {
    try {
      const capAcc = resolveFiscalAccount(accounts, 'RESULTADO_DEL_EJERCICIO');
      openingCharges.set(capAcc.id, (openingCharges.get(capAcc.id) || 0) + unclosedCargoCents);
      openingCredits.set(capAcc.id, (openingCredits.get(capAcc.id) || 0) + unclosedAbonoCents);
    } catch {
      // Ignorar si el catálogo no tiene cuenta de resultado acumulado
    }
  }

  const runningPriorCharges = new Map(openingCharges);
  const runningPriorCredits = new Map(openingCredits);
  const monthlyBalancesByPeriod: AnnualTaxMonthlyBalance[] = [];

  for (let m = 1; m <= 12; m += 1) {
    const curChg = yearMonthCharges.get(m)!;
    const curCred = yearMonthCredits.get(m)!;
    const rolled = rollUpTrialBalanceAccounts(
      accounts,
      runningPriorCharges,
      runningPriorCredits,
      curChg,
      curCred,
      { zeroResultInitialBalances: hasPriorYearMovements }
    );
    monthlyBalancesByPeriod.push({ periodo: m, accounts: rolled });
    for (const [accId, val] of curChg.entries()) {
      runningPriorCharges.set(accId, (runningPriorCharges.get(accId) || 0) + val);
    }
    for (const [accId, val] of curCred.entries()) {
      runningPriorCredits.set(accId, (runningPriorCredits.get(accId) || 0) + val);
    }
  }

  const trialBalance = monthlyBalancesByPeriod[11]?.accounts ?? [];
  return { trialBalance: [...trialBalance], monthlyBalancesByPeriod };
}

/**
 * Suma la deducción fiscal anual actualizada de inversiones (Art. 31 LISR) de los 12 meses del ejercicio,
 * incluyendo activos `TOTALMENTE_DEPRECIADO` que concluyeron su vida útil dentro de `ejercicio`.
 */
export function computeAnnualFixedAssetFiscalDeduction(
  assets: readonly FaRecord[],
  ejercicio: number
): number {
  let totalCents = 0;
  for (const asset of assets) {
    if (asset.estatus === 'BAJA') continue;
    if (asset.estatus === 'TOTALMENTE_DEPRECIADO') {
      const acq = parseCalendarDate(asset.fechaAdquisicion || `${ejercicio}-01-01`, ejercicio, 1);
      if (acq.year > ejercicio) continue;
      const totalLifeMonths = asset.tasaAnualPct > 0 ? Math.ceil((100 / asset.tasaAnualPct) * 12) : 0;
      const depTotalMonths = Math.min(
        totalLifeMonths,
        Math.max(0, Math.floor(asset.mesesDepreciadosPrevios || totalLifeMonths))
      );
      const monthsBeforeYear =
        acq.year < ejercicio ? (ejercicio - acq.year) * 12 + (1 - acq.month) : 0;
      const monthsInYear = Math.max(0, Math.min(12, depTotalMonths - monthsBeforeYear));
      const startMonth = acq.year === ejercicio ? acq.month : 1;
      for (let i = 0; i < monthsInYear; i += 1) {
        const period = Math.min(12, startMonth + i);
        const calc = computeFixedAssetWithDepreciation(
          { ...asset, estatus: 'ACTIVO', mesesDepreciadosPrevios: monthsBeforeYear + i },
          { ejercicio, periodo: period }
        );
        totalCents += toCents(calc.depreciacionMensualFiscalActualizada);
      }
      continue;
    }
    let extraMonths = 0;
    const basePriorMonths = Math.max(0, Math.floor(asset.mesesDepreciadosPrevios));
    for (let m = 1; m <= 12; m += 1) {
      const calc = computeFixedAssetWithDepreciation(
        { ...asset, mesesDepreciadosPrevios: basePriorMonths + extraMonths },
        { ejercicio, periodo: m }
      );
      const fiscalCents = toCents(calc.depreciacionMensualFiscalActualizada);
      if (fiscalCents > 0) {
        totalCents += fiscalCents;
        extraMonths += 1;
      }
    }
  }
  return fromCents(totalCents);
}

/**
 * Consolida los pagos provisionales reales de los 12 meses (P01-P12, incluyendo P12 y RESICO PF)
 * desde movimientos contables de ISR provisional por pagar (213-01-002 / 213.03) y parámetros guardados.
 */
export function computeAnnualProvisionalPayments(params: {
  accounts: readonly Account[];
  movs: readonly JoinedPolizaMovementInput[];
  ejercicio: number;
  taxParameterRows: ReadonlyArray<{ periodo?: number; pagosProvisionalesAnteriores: number }>;
}): number {
  const { accounts, movs, ejercicio, taxParameterRows } = params;
  const provIsrIds = new Set(
    accounts
      .filter((a) => a.code === '213-01-002' || a.satGroupCode === '213.03')
      .map((a) => a.id)
  );

  const monthCharges = new Map<number, number>();
  const monthCredits = new Map<number, number>();
  for (const row of movs) {
    if (!provIsrIds.has(row.account_id)) continue;
    const p = Array.isArray(row.polizas) ? row.polizas[0] : row.polizas;
    if (!p || p.ejercicio !== ejercicio || p.periodo < 1 || p.periodo > 12) continue;
    monthCharges.set(p.periodo, (monthCharges.get(p.periodo) || 0) + toCents(row.cargo));
    monthCredits.set(p.periodo, (monthCredits.get(p.periodo) || 0) + toCents(row.abono));
  }

  let charges1To11Cents = 0;
  let charges12Cents = 0;
  let totalCreditsCents = 0;
  for (let m = 1; m <= 12; m += 1) {
    const ch = monthCharges.get(m) || 0;
    const cr = monthCredits.get(m) || 0;
    if (m < 12) charges1To11Cents += ch;
    else charges12Cents += ch;
    totalCreditsCents += cr;
  }
  const totalChargesCents = charges1To11Cents + charges12Cents;

  let maxParamPriorCents = 0;
  for (const row of taxParameterRows) {
    maxParamPriorCents = Math.max(
      maxParamPriorCents,
      Math.max(0, toCents(row.pagosProvisionalesAnteriores))
    );
  }

  if (totalChargesCents > 0) {
    if (charges1To11Cents === 0 && maxParamPriorCents > 0) {
      return fromCents(maxParamPriorCents + charges12Cents);
    }
    return fromCents(Math.max(totalChargesCents, maxParamPriorCents));
  }
  if (maxParamPriorCents > 0) {
    return fromCents(maxParamPriorCents);
  }
  return fromCents(totalCreditsCents);
}
