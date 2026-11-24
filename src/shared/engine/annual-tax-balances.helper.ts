import type { Account, AccountWithBalance } from '../types/core.types';
import type { FixedAssetRecord as FaRecord } from '../types/fiscal.types';
import { parseCalendarDate } from '../date-utils';
import { resolveFiscalAccount } from './auto-poliza.engine';
import { rollUpTrialBalanceAccounts, type JoinedPolizaMovementInput } from './financial-reports.engine';
import { computeFixedAssetWithDepreciation } from './fixed-assets.engine';
import { fromCents, toCents } from './invariants-and-math';
import type { AnnualTaxMonthlyBalance } from './annual-tax.engine';
import {
  computeAnnualInflation,
  pickEvalAccounts,
  resolveAnnualInpcPair,
  sumMonthlyIsrRetentionChargesCents,
  truncate4
} from './annual-tax-inflation.helper';

export {
  computeAnnualInflation,
  pickEvalAccounts,
  resolveAnnualInpcPair,
  sumMonthlyIsrRetentionChargesCents,
  truncate4
};

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
    const acq = parseCalendarDate(asset.fechaAdquisicion || `${ejercicio}-01-01`, ejercicio, 1);
    if (acq.year > ejercicio) continue;
    const monthsBeforeYear = asset.fechaAdquisicion
      ? Math.max(0, (ejercicio - acq.year) * 12 - acq.month)
      : Math.max(0, Math.floor(asset.mesesDepreciadosPrevios));
    let extraMonths = 0;
    for (let m = 1; m <= 12; m += 1) {
      const calc = computeFixedAssetWithDepreciation(
        { ...asset, mesesDepreciadosPrevios: monthsBeforeYear + extraMonths },
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
    accounts.filter((a) => a.code === '213-01-002' || a.satGroupCode === '213.03').map((a) => a.id)
  );
  const monthCharges = new Map<number, number>();
  const monthCredits = new Map<number, number>();
  let priorOpenLiabilityCents = 0;
  let nextYearP01ChargesCents = 0;
  for (const row of movs) {
    if (!provIsrIds.has(row.account_id)) continue;
    const p = Array.isArray(row.polizas) ? row.polizas[0] : row.polizas;
    if (!p) continue;
    const cargoCents = toCents(row.cargo);
    const abonoCents = toCents(row.abono);
    if (p.ejercicio < ejercicio) {
      priorOpenLiabilityCents += abonoCents - cargoCents;
    } else if (p.ejercicio === ejercicio + 1 && p.periodo === 1) {
      nextYearP01ChargesCents += cargoCents;
    } else if (p.ejercicio === ejercicio && p.periodo >= 1 && p.periodo <= 12) {
      monthCharges.set(p.periodo, (monthCharges.get(p.periodo) || 0) + cargoCents);
      monthCredits.set(p.periodo, (monthCredits.get(p.periodo) || 0) + abonoCents);
    }
  }

  const priorOpenCents = Math.max(0, priorOpenLiabilityCents);
  const p01Raw = monthCharges.get(1) || 0;
  const p01Credit = monthCredits.get(1) || 0;
  const p01Charge =
    priorOpenCents > 0 ? Math.max(0, p01Raw - priorOpenCents) : p01Credit > 0 ? Math.min(p01Raw, p01Credit) : 0;

  let charges1To11Cents = p01Charge;
  for (let m = 2; m <= 11; m += 1) charges1To11Cents += monthCharges.get(m) || 0;
  const p12CreditCents = monthCredits.get(12) || 0;
  const nextP01ValidCents =
    p12CreditCents > 0 && nextYearP01ChargesCents > 0
      ? Math.min(nextYearP01ChargesCents, p12CreditCents)
      : nextYearP01ChargesCents;
  const charges12AndNextP01Cents = (monthCharges.get(12) || 0) + nextP01ValidCents;
  const totalChargesCents = charges1To11Cents + charges12AndNextP01Cents;
  let totalCreditsCents = 0;
  for (let m = 1; m <= 12; m += 1) totalCreditsCents += monthCredits.get(m) || 0;

  let maxParamPriorCents = 0;
  for (const row of taxParameterRows) {
    maxParamPriorCents = Math.max(maxParamPriorCents, Math.max(0, toCents(row.pagosProvisionalesAnteriores)));
  }

  const p12FallbackCents = nextP01ValidCents > 0 ? nextP01ValidCents : p12CreditCents;
  if (totalChargesCents > 0) {
    if (charges1To11Cents === 0 && maxParamPriorCents > 0) {
      return fromCents(maxParamPriorCents + (charges12AndNextP01Cents > 0 ? charges12AndNextP01Cents : p12CreditCents));
    }
    return fromCents(Math.max(totalChargesCents, maxParamPriorCents + p12FallbackCents));
  }
  if (maxParamPriorCents > 0) {
    return fromCents(maxParamPriorCents + p12FallbackCents);
  }
  return fromCents(totalCreditsCents);
}
