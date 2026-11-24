import type { Account, AccountWithBalance, FinancialStatementsResponse } from '../types';
import { fromCents, toCents } from './invariants-and-math';

export function computeTrialBalanceTotals(
  computedAccounts: readonly AccountWithBalance[]
): FinancialStatementsResponse['totals'] {
  const tbRoots = computedAccounts.filter((a) => a.level === 1 || !a.parentCode);
  let totalChgCents = 0;
  let totalCredCents = 0;
  let initDeudorCents = 0;
  let initAcreedorCents = 0;
  let finalDeudorCents = 0;
  let finalAcreedorCents = 0;

  for (const a of tbRoots) {
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

  return {
    initialDeudor: fromCents(initDeudorCents),
    initialAcreedor: fromCents(initAcreedorCents),
    totalCargos: fromCents(totalChgCents),
    totalAbonos: fromCents(totalCredCents),
    finalDeudor: fromCents(finalDeudorCents),
    finalAcreedor: fromCents(finalAcreedorCents)
  };
}

export function sumResultOfExerciseCents(
  accounts: readonly AccountWithBalance[],
  leafIds: ReadonlySet<string>
): number {
  return accounts
    .filter((a) => isResultOfExerciseAccount(a) && leafIds.has(a.id))
    .reduce((s, a) => s + (a.nature === 'ACREEDORA' ? 1 : -1) * toCents(a.finalBalance), 0);
}

export function isResultOfExerciseAccount(
  acc: Pick<Account, 'type' | 'code' | 'satGroupCode'>
): boolean {
  return (
    acc.type === 'CAPITAL' &&
    (acc.code.startsWith('305') || acc.satGroupCode.startsWith('305'))
  );
}

export interface ClosingMovementCents {
  cargoCents: number;
  abonoCents: number;
}

const closingMovementsRegistry = new WeakMap<
  readonly AccountWithBalance[],
  ReadonlyMap<string, ClosingMovementCents>
>();

export function registerClosingMovementsForTrialBalance(
  trialBalance: readonly AccountWithBalance[],
  closingMap: ReadonlyMap<string, ClosingMovementCents>
): void {
  if (closingMap.size > 0) {
    closingMovementsRegistry.set(trialBalance, closingMap);
  }
}

export function getRegisteredClosingMovements(
  trialBalance: readonly AccountWithBalance[]
): ReadonlyMap<string, ClosingMovementCents> | undefined {
  return closingMovementsRegistry.get(trialBalance);
}

/**
 * Revierte de forma exacta los movimientos de pólizas CIERRE_ANUAL sobre cuentas afectables
 * y recalcula el roll-up jerárquico por nivel descendente, preservando pólizas de ajuste de P13.
 */
export function backOutClosingMovementsFromAccounts(
  accounts: readonly AccountWithBalance[],
  closingMap: ReadonlyMap<string, ClosingMovementCents>
): AccountWithBalance[] {
  const parentCodes = new Set(
    accounts.map((a) => a.parentCode).filter((p): p is string => Boolean(p))
  );
  const hasAffectable = accounts.some((a) => a.isAffectable);
  const isLeaf = (a: AccountWithBalance) =>
    hasAffectable ? a.isAffectable : !parentCodes.has(a.code);

  const byCode = new Map<string, AccountWithBalance>();
  for (const a of accounts) {
    if (isLeaf(a)) {
      const cm = closingMap.get(a.id);
      const chgCents = toCents(a.periodCharges) - (cm?.cargoCents ?? 0);
      const credCents = toCents(a.periodCredits) - (cm?.abonoCents ?? 0);
      const initCents = toCents(a.initialBalanceComputed);
      const finalCents =
        a.nature === 'DEUDORA' ? initCents + chgCents - credCents : initCents + credCents - chgCents;
      byCode.set(a.code, {
        ...a,
        periodCharges: fromCents(chgCents),
        periodCredits: fromCents(credCents),
        finalBalance: fromCents(finalCents)
      });
    } else {
      byCode.set(a.code, { ...a });
    }
  }

  const childrenByParent = new Map<string, AccountWithBalance[]>();
  for (const node of byCode.values()) {
    if (!node.parentCode) continue;
    const list = childrenByParent.get(node.parentCode) ?? [];
    list.push(node);
    childrenByParent.set(node.parentCode, list);
  }

  const parentsDesc = [...byCode.values()]
    .filter((a) => !isLeaf(a) && (childrenByParent.get(a.code)?.length ?? 0) > 0)
    .sort((a, b) => b.level - a.level);

  for (const parent of parentsDesc) {
    const children = childrenByParent.get(parent.code) ?? [];
    let initC = 0;
    let chgC = 0;
    let credC = 0;
    let finC = 0;
    for (const child of children) {
      if (child.type === 'ORDEN' && parent.type !== 'ORDEN') continue;
      const sign = parent.nature === child.nature ? 1 : -1;
      initC += sign * toCents(child.initialBalanceComputed);
      chgC += toCents(child.periodCharges);
      credC += toCents(child.periodCredits);
      finC += sign * toCents(child.finalBalance);
    }
    parent.initialBalanceComputed = fromCents(initC);
    parent.periodCharges = fromCents(chgC);
    parent.periodCredits = fromCents(credC);
    parent.finalBalance = fromCents(finC);
  }

  return accounts.map((a) => byCode.get(a.code) ?? a);
}

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
      acc.type === 'ORDEN' ||
      (acc.type === 'CAPITAL' && !isResultOfExerciseAccount(acc));
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
