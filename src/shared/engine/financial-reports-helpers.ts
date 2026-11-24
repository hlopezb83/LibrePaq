import type { Account, AccountType, AccountWithBalance } from '../types';
import { resolveFiscalAccount } from './auto-poliza.engine';
import { fromCents, toCents } from './invariants-and-math';

export type PnlBucket =
  | 'INGRESOS'
  | 'COSTOS'
  | 'GASTOS'
  | 'RIF_PRODUCTOS'
  | 'RIF_GASTOS'
  | 'ISR';

export function getCodePrefixNumber(acc: Pick<Account, 'code' | 'satGroupCode'>): number {
  const codeMatch = (acc.code || '').trim().match(/^(\d{3})/);
  if (codeMatch?.[1]) return Number(codeMatch[1]);
  const satMatch = (acc.satGroupCode || '').trim().match(/^(\d{3})/);
  return satMatch?.[1] ? Number(satMatch[1]) : 0;
}

export function isResultOfExerciseAccount(
  acc: Pick<Account, 'type' | 'code' | 'satGroupCode'>
): boolean {
  return (
    acc.type === 'CAPITAL' &&
    (acc.code.startsWith('305') || acc.satGroupCode.startsWith('305'))
  );
}

/**
 * Resuelve la cuenta de Resultados Acumulados de Ejercicios Anteriores (301-02-001 / SAT 304.01)
 * para recibir traspasos de ejercicios previos sin contaminar 305-01-001 (Resultado del Ejercicio Actual).
 */
export function resolveAccumulatedEarningsAccount(accounts: readonly Account[]): Account {
  const byExact = accounts.find((a) => a.code === '301-02-001' && a.isAffectable);
  if (byExact) return byExact;

  const bySatExact = accounts.find((a) => a.satGroupCode === '304.01' && a.isAffectable);
  if (bySatExact) return bySatExact;

  const bySatPrefix = accounts.find(
    (a) => a.satGroupCode.startsWith('304') && a.isAffectable
  );
  if (bySatPrefix) return bySatPrefix;

  const otherCap = accounts.find(
    (a) => a.type === 'CAPITAL' && a.isAffectable && !isResultOfExerciseAccount(a)
  );
  if (otherCap) return otherCap;

  return resolveFiscalAccount(accounts, 'RESULTADO_DEL_EJERCICIO');
}

export function isNonDeductible801Account(
  acc: Pick<Account, 'code' | 'satGroupCode'>
): boolean {
  return (
    acc.code === '801-01-002' ||
    acc.satGroupCode === '601.74' ||
    acc.satGroupCode.startsWith('601.74')
  );
}

export function isIsrExpenseAccount(
  acc: Pick<Account, 'code' | 'satGroupCode'>
): boolean {
  if (isNonDeductible801Account(acc)) return false;
  if (acc.satGroupCode.startsWith('611')) return true;
  if (acc.code.startsWith('801-01-001')) return true;
  return acc.code.startsWith('8') && !acc.satGroupCode.startsWith('601');
}

export function classifyPnlBucket(acc: Pick<Account, 'type' | 'code' | 'satGroupCode'>): PnlBucket {
  if (isIsrExpenseAccount(acc)) return 'ISR';
  if (acc.code.startsWith('702') || acc.satGroupCode.startsWith('702')) return 'RIF_PRODUCTOS';
  if (acc.code.startsWith('701') || acc.satGroupCode.startsWith('701')) return 'RIF_GASTOS';
  if (acc.type === 'INGRESOS') return 'INGRESOS';
  if (acc.type === 'COSTOS') return 'COSTOS';
  return 'GASTOS';
}

export function getLeafIds(accounts: readonly AccountWithBalance[]): Set<string> {
  const parentCodes = new Set(
    accounts.map((a) => a.parentCode).filter((p): p is string => Boolean(p))
  );
  const hasAffectable = accounts.some((a) => a.isAffectable);
  const leafIds = new Set<string>();
  for (const a of accounts) {
    if (hasAffectable ? a.isAffectable : !parentCodes.has(a.code) || a.level >= 2) {
      if (!parentCodes.has(a.code) || a.isAffectable) {
        leafIds.add(a.id);
      }
    }
  }
  return leafIds;
}

/**
 * Detecta cuando Periodo 13 tiene cuentas de resultados saldadas en $0.00 tras póliza CIERRE_ANUAL
 * y reconstruye sus saldos pre-cierre para que ER, NIF B-2/B-4 y Comparativo muestren cifras reales.
 */
export function normalizePostCloseP13Accounts(
  accounts: readonly AccountWithBalance[],
  periodo: number
): { isPreCloseP13: boolean; accounts: AccountWithBalance[] } {
  if (periodo !== 13) return { isPreCloseP13: false, accounts: [...accounts] };

  const pnl = accounts.filter(
    (a) =>
      (a.type === 'INGRESOS' || a.type === 'COSTOS' || a.type === 'GASTOS') &&
      (a.isAffectable || a.level >= 2)
  );
  if (pnl.length === 0) return { isPreCloseP13: false, accounts: [...accounts] };

  const allClosed = pnl.every((a) => toCents(a.finalBalance) === 0);
  const hadActivity = pnl.some(
    (a) =>
      toCents(a.initialBalanceComputed) !== 0 ||
      toCents(a.periodCharges) > 0 ||
      toCents(a.periodCredits) > 0
  );
  if (!allClosed || !hadActivity) return { isPreCloseP13: false, accounts: [...accounts] };

  const leafIds = getLeafIds(accounts);
  const adjusted = accounts.map((a) => {
    if (a.type === 'INGRESOS' || a.type === 'COSTOS' || a.type === 'GASTOS') {
      const initCents = toCents(a.initialBalanceComputed);
      const chgCents = toCents(a.periodCharges);
      const credCents = toCents(a.periodCredits);
      if (a.nature === 'ACREEDORA') {
        const normalSign = initCents >= 0;
        const preCloseCents = normalSign ? initCents + credCents : initCents;
        return {
          ...a,
          periodCharges: normalSign ? 0 : fromCents(chgCents),
          periodCredits: normalSign ? fromCents(credCents) : 0,
          finalBalance: fromCents(preCloseCents)
        };
      }
      const normalSign = initCents >= 0;
      const preCloseCents = normalSign ? initCents + chgCents : initCents;
      return {
        ...a,
        periodCharges: normalSign ? fromCents(chgCents) : 0,
        periodCredits: normalSign ? 0 : fromCents(credCents),
        finalBalance: fromCents(preCloseCents)
      };
    }

    if (
      a.type === 'CAPITAL' &&
      (isResultOfExerciseAccount(a) ||
        (getCodePrefixNumber(a) === 302 && a.name.toLowerCase().includes('resultado')))
    ) {
      return { ...a, finalBalance: a.initialBalanceComputed };
    }
    return a;
  });

  // Recalcular padres de resultados desde hojas si existen hojas afectables
  const byCode = new Map(adjusted.map((a) => [a.code, { ...a }]));
  const pnlParents = [...byCode.values()]
    .filter(
      (a) =>
        (a.type === 'INGRESOS' || a.type === 'COSTOS' || a.type === 'GASTOS') &&
        !leafIds.has(a.id)
    )
    .sort((a, b) => b.level - a.level);

  for (const parent of pnlParents) {
    const children = [...byCode.values()].filter((c) => c.parentCode === parent.code);
    if (children.length === 0) continue;
    let initC = 0;
    let chgC = 0;
    let credC = 0;
    let finC = 0;
    for (const child of children) {
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
    byCode.set(parent.code, parent);
  }

  return {
    isPreCloseP13: true,
    accounts: adjusted.map((a) => byCode.get(a.code) ?? a)
  };
}

export function sumRootByTypeCents(
  accounts: readonly AccountWithBalance[],
  targetType: AccountType,
  expectedNature: 'DEUDORA' | 'ACREEDORA'
): number {
  const sameTypeCodes = new Set(
    accounts.filter((a) => a.type === targetType).map((a) => a.code)
  );
  const roots = accounts.filter(
    (a) => a.type === targetType && (!a.parentCode || !sameTypeCodes.has(a.parentCode))
  );
  return roots.reduce((sum, a) => {
    const sign = a.nature === expectedNature ? 1 : -1;
    return sum + sign * toCents(a.finalBalance);
  }, 0);
}

export function isCapitalGanadoAccount(
  acc: Pick<Account, 'code' | 'satGroupCode' | 'name'>
): boolean {
  const lower = acc.name.toLowerCase();
  return (
    acc.code.startsWith('301-02') ||
    acc.satGroupCode.startsWith('304') ||
    acc.code.startsWith('303') ||
    acc.satGroupCode.startsWith('303') ||
    acc.code.startsWith('304') ||
    acc.code.startsWith('305') ||
    acc.satGroupCode.startsWith('305') ||
    lower.includes('resultado') ||
    lower.includes('utilidades acumuladas') ||
    lower.includes('reserva')
  );
}

export function buildScopedBucketRows(
  accounts: readonly AccountWithBalance[],
  bucket: PnlBucket,
  leafIds: ReadonlySet<string>
): AccountWithBalance[] {
  const matchingLeaves = accounts.filter(
    (a) =>
      (a.type === 'INGRESOS' || a.type === 'COSTOS' || a.type === 'GASTOS') &&
      leafIds.has(a.id) &&
      classifyPnlBucket(a) === bucket
  );
  if (matchingLeaves.length === 0) return [];

  const leafCodesByParent = new Map<string, AccountWithBalance[]>();
  for (const leaf of matchingLeaves) {
    if (!leaf.parentCode) continue;
    const list = leafCodesByParent.get(leaf.parentCode) ?? [];
    list.push(leaf);
    leafCodesByParent.set(leaf.parentCode, list);
  }

  const rows: AccountWithBalance[] = [];
  for (const acc of accounts) {
    if (acc.type !== 'INGRESOS' && acc.type !== 'COSTOS' && acc.type !== 'GASTOS') continue;
    if (acc.level < 2) continue;

    if (leafIds.has(acc.id)) {
      if (classifyPnlBucket(acc) === bucket) rows.push(acc);
      continue;
    }

    if (acc.level === 2) {
      const descendants = matchingLeaves.filter(
        (l) => l.parentCode === acc.code || l.code.startsWith(acc.code.slice(0, 4))
      );
      const directChildren = leafCodesByParent.get(acc.code) ?? [];
      const scopedLeaves = directChildren.length > 0 ? directChildren : descendants;
      if (scopedLeaves.length === 0) continue;

      let initC = 0;
      let chgC = 0;
      let credC = 0;
      let finC = 0;
      for (const l of scopedLeaves) {
        const sign = acc.nature === l.nature ? 1 : -1;
        initC += sign * toCents(l.initialBalanceComputed);
        chgC += toCents(l.periodCharges);
        credC += toCents(l.periodCredits);
        finC += sign * toCents(l.finalBalance);
      }
      const hasAnyActivity =
        initC !== 0 || chgC !== 0 || credC !== 0 || finC !== 0 || classifyPnlBucket(acc) === bucket;
      if (!hasAnyActivity) continue;

      rows.push({
        ...acc,
        initialBalanceComputed: fromCents(initC),
        periodCharges: fromCents(chgC),
        periodCredits: fromCents(credC),
        finalBalance: fromCents(finC)
      });
    }
  }
  return rows;
}
