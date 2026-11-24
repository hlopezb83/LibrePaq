import type { Account, AccountWithBalance } from '../types';
import { fromCents, toCents } from './invariants-and-math';

/**
 * Calcula saldos iniciales, cargos/abonos del periodo, saldo final y roll-up
 * jerárquico por nivel descendente (incluyendo cuentas complementarias con signo opuesto
 * y excluyendo cuentas de ORDEN de padres no-ORDEN).
 */
export function rollUpTrialBalanceAccounts(
  accounts: readonly Account[],
  priorChargesMap: ReadonlyMap<string, number>,
  priorCreditsMap: ReadonlyMap<string, number>,
  currentChargesMap: ReadonlyMap<string, number>,
  currentCreditsMap: ReadonlyMap<string, number>,
  options?: { zeroResultInitialBalances?: boolean }
): AccountWithBalance[] {
  const byCode = new Map<string, AccountWithBalance>();
  const zeroResults = Boolean(options?.zeroResultInitialBalances);
  for (const acc of accounts) {
    const priorChg = priorChargesMap.get(acc.id) || 0;
    const priorCred = priorCreditsMap.get(acc.id) || 0;
    const chg = currentChargesMap.get(acc.id) || 0;
    const cred = currentCreditsMap.get(acc.id) || 0;

    const isPersistentAcc =
      acc.type === 'ACTIVO' ||
      acc.type === 'PASIVO' ||
      acc.type === 'CAPITAL' ||
      acc.type === 'ORDEN';
    const allowOpening = !zeroResults || isPersistentAcc;
    const openingCents =
      acc.isAffectable && allowOpening ? toCents(acc.initialBalance) : 0;
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
    if (node.type === 'ORDEN' && parent.type !== 'ORDEN') continue;

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
