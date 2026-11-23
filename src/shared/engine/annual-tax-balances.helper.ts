import type { Account, AccountWithBalance } from '../types/core.types';
import type { FixedAssetRecord as FaRecord } from '../types/fiscal.types';
import { resolveFiscalAccount } from './auto-poliza.engine';
import { rollUpTrialBalanceAccounts, type JoinedPolizaMovementInput } from './financial-reports.engine';
import { computeFixedAssetWithDepreciation } from './fixed-assets.engine';
import { fromCents, toCents } from './invariants-and-math';
import type { AnnualTaxMonthlyBalance } from './annual-tax.engine';

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
      curCred
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
 * Suma la deducción fiscal anual actualizada de inversiones (Art. 31 LISR) de los 12 meses del ejercicio.
 */
export function computeAnnualFixedAssetFiscalDeduction(
  assets: readonly FaRecord[],
  ejercicio: number
): number {
  let totalCents = 0;
  for (const asset of assets) {
    if (asset.estatus !== 'ACTIVO') continue;
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
