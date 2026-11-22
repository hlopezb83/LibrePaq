import { db } from '../connection';
import { fromCents, toCents, resolveFiscalAccount } from '../../shared/accounting-engine';
import { MESES_SAT } from '../../shared/sat-catalog';
import type { AccountType, AccountWithBalance } from '../../shared/types';
import { getAccounts } from './accounts.repo';

/**
 * Calcula la Balanza de Comprobación jerárquica usando aritmética en centavos enteros (H-03, H-04, H-05).
 */
export function computeTrialBalance(
  companyId: string,
  ejercicio = 2026,
  periodo = 10
): AccountWithBalance[] {
  const accounts = getAccounts(companyId);
  if (accounts.length === 0) return [];

  const priorRows = db
    .query(`
      SELECT m.account_id, COALESCE(SUM(m.cargo), 0) as sum_cargo, COALESCE(SUM(m.abono), 0) as sum_abono
      FROM poliza_movements m
      INNER JOIN polizas p ON m.poliza_id = p.id
      WHERE p.company_id = ? AND (
        (p.ejercicio = ? AND p.periodo < ?)
        OR (p.ejercicio < ? AND m.account_id IN (
          SELECT id FROM accounts WHERE company_id = ? AND type IN ('ACTIVO', 'PASIVO', 'CAPITAL')
        ))
      )
      GROUP BY m.account_id
    `)
    .all(companyId, ejercicio, periodo, ejercicio, companyId) as Array<{
    account_id: string;
    sum_cargo: number;
    sum_abono: number;
  }>;

  const priorChargesCentsMap = new Map<string, number>();
  const priorCreditsCentsMap = new Map<string, number>();
  for (const r of priorRows) {
    priorChargesCentsMap.set(r.account_id, toCents(r.sum_cargo));
    priorCreditsCentsMap.set(r.account_id, toCents(r.sum_abono));
  }

  // AUD-R6-01: Acumular resultados de ejercicios previos sin póliza de cierre en Capital
  const unclosedPrior = db
    .query(`
      SELECT COALESCE(SUM(m.cargo), 0) as sum_cargo, COALESCE(SUM(m.abono), 0) as sum_abono
      FROM poliza_movements m
      INNER JOIN polizas p ON m.poliza_id = p.id
      WHERE p.company_id = ? AND p.ejercicio < ? AND m.account_id IN (
        SELECT id FROM accounts WHERE company_id = ? AND type IN ('INGRESOS', 'COSTOS', 'GASTOS')
      )
    `)
    .get(companyId, ejercicio, companyId) as { sum_cargo: number; sum_abono: number } | null;

  if (unclosedPrior) {
    const uCargo = toCents(unclosedPrior.sum_cargo);
    const uAbono = toCents(unclosedPrior.sum_abono);
    if (uCargo > 0 || uAbono > 0) {
      try {
        const capAcc = resolveFiscalAccount(accounts, 'RESULTADO_DEL_EJERCICIO');
        priorChargesCentsMap.set(capAcc.id, (priorChargesCentsMap.get(capAcc.id) || 0) + uCargo);
        priorCreditsCentsMap.set(capAcc.id, (priorCreditsCentsMap.get(capAcc.id) || 0) + uAbono);
      } catch {
        // Ignorar si el catálogo carece de cuenta de resultados
      }
    }
  }

  const currentRows = db
    .query(`
      SELECT m.account_id, COALESCE(SUM(m.cargo), 0) as sum_cargo, COALESCE(SUM(m.abono), 0) as sum_abono
      FROM poliza_movements m
      INNER JOIN polizas p ON m.poliza_id = p.id
      WHERE p.company_id = ? AND p.ejercicio = ? AND p.periodo = ?
      GROUP BY m.account_id
    `)
    .all(companyId, ejercicio, periodo) as Array<{
    account_id: string;
    sum_cargo: number;
    sum_abono: number;
  }>;

  const chargesCentsByAccountId = new Map<string, number>();
  const creditsCentsByAccountId = new Map<string, number>();
  for (const r of currentRows) {
    chargesCentsByAccountId.set(r.account_id, toCents(r.sum_cargo));
    creditsCentsByAccountId.set(r.account_id, toCents(r.sum_abono));
  }

  const byCode = new Map<string, AccountWithBalance>();
  for (const acc of accounts) {
    const priorChargesCents = priorChargesCentsMap.get(acc.id) ?? 0;
    const priorCreditsCents = priorCreditsCentsMap.get(acc.id) ?? 0;
    const chargesCents = chargesCentsByAccountId.get(acc.id) ?? 0;
    const creditsCents = creditsCentsByAccountId.get(acc.id) ?? 0;

    const openingCents = acc.isAffectable ? toCents(acc.initialBalance) : 0;
    const initCents = acc.isAffectable
      ? acc.nature === 'DEUDORA'
        ? openingCents + priorChargesCents - priorCreditsCents
        : openingCents + priorCreditsCents - priorChargesCents
      : 0;

    const finalCents =
      acc.nature === 'DEUDORA'
        ? initCents + chargesCents - creditsCents
        : initCents + creditsCents - chargesCents;

    byCode.set(acc.code, {
      ...acc,
      initialBalanceComputed: fromCents(initCents),
      periodCharges: fromCents(chargesCents),
      periodCredits: fromCents(creditsCents),
      finalBalance: fromCents(finalCents)
    });
  }

  // NASA Power of 10 - Regla 1: Roll-up iterativo por nivel descendente (sin recursión)
  const sortedDesc = [...byCode.values()].sort((a, b) => b.level - a.level);
  for (const node of sortedDesc) {
    if (!node.parentCode) continue;
    const parent = byCode.get(node.parentCode);
    if (!parent) continue;

    const sign = parent.nature === node.nature ? 1 : -1;
    const parentInitCents =
      toCents(parent.initialBalanceComputed) + sign * toCents(node.initialBalanceComputed);
    const parentChargesCents = toCents(parent.periodCharges) + toCents(node.periodCharges);
    const parentCreditsCents = toCents(parent.periodCredits) + toCents(node.periodCredits);
    const parentFinalCents =
      parent.nature === 'DEUDORA'
        ? parentInitCents + parentChargesCents - parentCreditsCents
        : parentInitCents + parentCreditsCents - parentChargesCents;

    parent.initialBalanceComputed = fromCents(parentInitCents);
    parent.periodCharges = fromCents(parentChargesCents);
    parent.periodCredits = fromCents(parentCreditsCents);
    parent.finalBalance = fromCents(parentFinalCents);
  }

  const result: AccountWithBalance[] = [];
  for (const a of accounts) {
    const item = byCode.get(a.code);
    if (item) result.push(item);
  }
  return result;
}

/**
 * Optimización H-12 (NASA Power of 10 Regla 3):
 * Calcula la tendencia histórica de 6 meses en UNA SOLA consulta SQL agregada
 * por `(periodo, type)`, eliminando las 6 ejecuciones redundantes de `computeTrialBalance`.
 */
export function computeMonthlyTrendFast(
  companyId: string,
  ejercicio: number,
  monthsToQuery: readonly number[]
): Array<{
  periodo: number;
  mesNombre: string;
  ingresos: number;
  egresos: number;
  utilidad: number;
}> {
  if (monthsToQuery.length === 0) return [];
  const minMonth = Math.min(...monthsToQuery);
  const maxMonth = Math.max(...monthsToQuery);

  const rows = db
    .query(`
      SELECT
        p.periodo as periodo,
        a.type as account_type,
        COALESCE(SUM(m.cargo), 0) as sum_cargo,
        COALESCE(SUM(m.abono), 0) as sum_abono
      FROM poliza_movements m
      INNER JOIN polizas p ON m.poliza_id = p.id
      INNER JOIN accounts a ON m.account_id = a.id
      WHERE p.company_id = ?
        AND p.ejercicio = ?
        AND p.periodo >= ?
        AND p.periodo <= ?
        AND a.type IN ('INGRESOS', 'COSTOS', 'GASTOS')
      GROUP BY p.periodo, a.type
    `)
    .all(companyId, ejercicio, minMonth, maxMonth) as Array<{
    periodo: number;
    account_type: AccountType;
    sum_cargo: number;
    sum_abono: number;
  }>;

  const byPeriod = new Map<number, { ingCents: number; cosCents: number; gasCents: number }>();
  for (const m of monthsToQuery) {
    byPeriod.set(m, { ingCents: 0, cosCents: 0, gasCents: 0 });
  }

  for (const r of rows) {
    const bucket = byPeriod.get(Number(r.periodo));
    if (!bucket) continue;
    const cargoCents = toCents(r.sum_cargo);
    const abonoCents = toCents(r.sum_abono);
    if (r.account_type === 'INGRESOS') {
      bucket.ingCents += abonoCents - cargoCents;
    } else if (r.account_type === 'COSTOS') {
      bucket.cosCents += cargoCents - abonoCents;
    } else if (r.account_type === 'GASTOS') {
      bucket.gasCents += cargoCents - abonoCents;
    }
  }

  return monthsToQuery.map((m) => {
    const mesObj = MESES_SAT.find((item) => item.periodo === m) ?? MESES_SAT[0];
    const bucket = byPeriod.get(m) ?? { ingCents: 0, cosCents: 0, gasCents: 0 };
    const egrCents = bucket.cosCents + bucket.gasCents;
    return {
      periodo: m,
      mesNombre: mesObj ? mesObj.corto : `M${m}`,
      ingresos: fromCents(bucket.ingCents),
      egresos: fromCents(egrCents),
      utilidad: fromCents(bucket.ingCents - egrCents)
    };
  });
}
