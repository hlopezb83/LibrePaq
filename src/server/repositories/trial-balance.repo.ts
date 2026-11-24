import { db } from '../connection';
import { fromCents, toCents } from '../../shared/accounting-engine';
import {
  isResultOfExerciseAccount,
  resolveAccumulatedEarningsAccount
} from '../../shared/engine/financial-reports-helpers';
import { rollUpTrialBalanceAccounts } from '../../shared/engine/financial-reports.engine';
import { MESES_SAT } from '../../shared/sat-constants';
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

  const resultAccIds = new Set(
    accounts.filter((a) => isResultOfExerciseAccount(a)).map((a) => a.id)
  );
  const hasPriorRow = db
    .query('SELECT 1 as found FROM polizas WHERE company_id = ? AND ejercicio < ? LIMIT 1')
    .get(companyId, ejercicio) as { found: number } | null;
  const hasPriorYearMovements = Boolean(hasPriorRow);

  const priorRows = db
    .query(`
      SELECT m.account_id, COALESCE(SUM(m.cargo), 0) as sum_cargo, COALESCE(SUM(m.abono), 0) as sum_abono
      FROM poliza_movements m
      INNER JOIN polizas p ON m.poliza_id = p.id
      WHERE p.company_id = ? AND (
        (p.ejercicio = ? AND p.periodo < ?)
        OR (p.ejercicio < ? AND m.account_id IN (
          SELECT id FROM accounts WHERE company_id = ? AND type IN ('ACTIVO', 'PASIVO', 'CAPITAL', 'ORDEN')
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
  let priorRolloverCargoCents = 0;
  let priorRolloverAbonoCents = 0;

  if (hasPriorYearMovements) {
    // Re-query prior-year movements on 305-* (Resultado del Ejercicio) separately so only prior-year 305-* rolls into 301-02-001
    const prior305Rows = db
      .query(`
        SELECT m.account_id, COALESCE(SUM(m.cargo), 0) as sum_cargo, COALESCE(SUM(m.abono), 0) as sum_abono
        FROM poliza_movements m
        INNER JOIN polizas p ON m.poliza_id = p.id
        WHERE p.company_id = ? AND p.ejercicio < ?
        GROUP BY m.account_id
      `)
      .all(companyId, ejercicio) as Array<{ account_id: string; sum_cargo: number; sum_abono: number }>;
    const prior305CargoMap = new Map<string, number>();
    const prior305AbonoMap = new Map<string, number>();
    for (const r of prior305Rows) {
      if (resultAccIds.has(r.account_id)) {
        const c = toCents(r.sum_cargo);
        const a = toCents(r.sum_abono);
        prior305CargoMap.set(r.account_id, c);
        prior305AbonoMap.set(r.account_id, a);
        priorRolloverCargoCents += c;
        priorRolloverAbonoCents += a;
      }
    }
    for (const r of priorRows) {
      const c = toCents(r.sum_cargo) - (prior305CargoMap.get(r.account_id) || 0);
      const a = toCents(r.sum_abono) - (prior305AbonoMap.get(r.account_id) || 0);
      if (c !== 0) priorChargesCentsMap.set(r.account_id, c);
      if (a !== 0) priorCreditsCentsMap.set(r.account_id, a);
    }
    for (const acc of accounts) {
      if (!acc.isAffectable) continue;
      if (acc.type !== 'INGRESOS' && acc.type !== 'COSTOS' && acc.type !== 'GASTOS') continue;
      const initCents = toCents(acc.initialBalance);
      if (initCents === 0) continue;
      if (acc.nature === 'ACREEDORA') priorRolloverAbonoCents += initCents;
      else priorRolloverCargoCents += initCents;
    }
  } else {
    for (const r of priorRows) {
      priorChargesCentsMap.set(r.account_id, toCents(r.sum_cargo));
      priorCreditsCentsMap.set(r.account_id, toCents(r.sum_abono));
    }
  }

  // AUD-R6-01: Acumular resultados de ejercicios previos sin póliza de cierre en Capital (301-02-001 / 304.01)
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
    priorRolloverCargoCents += toCents(unclosedPrior.sum_cargo);
    priorRolloverAbonoCents += toCents(unclosedPrior.sum_abono);
  }

  if (priorRolloverCargoCents !== 0 || priorRolloverAbonoCents !== 0) {
    try {
      const accumAcc = resolveAccumulatedEarningsAccount(accounts);
      priorChargesCentsMap.set(accumAcc.id, (priorChargesCentsMap.get(accumAcc.id) || 0) + priorRolloverCargoCents);
      priorCreditsCentsMap.set(accumAcc.id, (priorCreditsCentsMap.get(accumAcc.id) || 0) + priorRolloverAbonoCents);
    } catch {
      // Ignorar si el catálogo carece de cuenta de resultados acumulados
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

  return rollUpTrialBalanceAccounts(
    accounts,
    priorChargesCentsMap,
    priorCreditsCentsMap,
    chargesCentsByAccountId,
    creditsCentsByAccountId,
    { zeroResultInitialBalances: hasPriorYearMovements }
  );
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
