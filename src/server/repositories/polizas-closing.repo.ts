import { db } from '../connection';
import {
  assertAccountingInvariant,
  fromCents,
  resolveFiscalAccount,
  toCents,
  validateDoubleEntryMovements
} from '../../shared/accounting-engine';
import { computeTrialBalance } from './trial-balance.repo';
import { assertPeriodOpen } from './period-locks.repo';
import { insertMovementStmt, insertPolizaStmt } from './polizas.repo';

export function closeYearPolizaTransaction(
  companyId: string,
  ejercicio: number,
  switchToPeriod13 = true
): { closed: boolean; polizaId: string; utilidadTraspasada: number } {
  assertPeriodOpen(companyId, ejercicio, 13);
  const tb13 = computeTrialBalance(companyId, ejercicio, 13);

  const resultAccounts = tb13.filter(
    (a) =>
      a.isAffectable &&
      (a.type === 'INGRESOS' || a.type === 'COSTOS' || a.type === 'GASTOS') &&
      Math.abs(toCents(a.initialBalanceComputed)) >= 1
  );

  assertAccountingInvariant(
    resultAccounts.length > 0,
    'ALREADY_CLOSED_YEAR',
    'Las cuentas de resultados (Ingresos, Costos y Gastos) ya están saldadas en $0.00.'
  );

  const capitalResultAcc = resolveFiscalAccount(tb13, 'RESULTADO_DEL_EJERCICIO');

  const movements: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    cargo: number;
    abono: number;
  }> = [];

  let sumCargosCents = 0;
  let sumAbonosCents = 0;

  for (const acc of resultAccounts) {
    const balCents = toCents(acc.initialBalanceComputed);
    if (acc.nature === 'ACREEDORA') {
      const cargoCents = balCents > 0 ? balCents : 0;
      const abonoCents = balCents < 0 ? Math.abs(balCents) : 0;
      movements.push({
        accountId: acc.id,
        accountCode: acc.code,
        accountName: acc.name,
        cargo: fromCents(cargoCents),
        abono: fromCents(abonoCents)
      });
      sumCargosCents += cargoCents;
      sumAbonosCents += abonoCents;
    } else {
      const abonoCents = balCents > 0 ? balCents : 0;
      const cargoCents = balCents < 0 ? Math.abs(balCents) : 0;
      movements.push({
        accountId: acc.id,
        accountCode: acc.code,
        accountName: acc.name,
        cargo: fromCents(cargoCents),
        abono: fromCents(abonoCents)
      });
      sumCargosCents += cargoCents;
      sumAbonosCents += abonoCents;
    }
  }

  const netDiffCents = sumCargosCents - sumAbonosCents;
  if (netDiffCents !== 0) {
    movements.push({
      accountId: capitalResultAcc.id,
      accountCode: capitalResultAcc.code,
      accountName: capitalResultAcc.name,
      cargo: netDiffCents < 0 ? fromCents(Math.abs(netDiffCents)) : 0,
      abono: netDiffCents > 0 ? fromCents(netDiffCents) : 0
    });
  }

  // Post-condition invariant: verify double entry on closing entry
  validateDoubleEntryMovements(movements);

  const polizaId = `pol_cierre_${ejercicio}_${crypto.randomUUID().slice(0, 4)}`;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    if (switchToPeriod13) {
      db.prepare('UPDATE companies SET current_period = 13 WHERE id = ?').run(companyId);
    }

    db.prepare('DELETE FROM polizas WHERE company_id = ? AND ejercicio = ? AND periodo = 13').run(
      companyId,
      ejercicio
    );

    insertPolizaStmt.run(
      polizaId,
      companyId,
      'DIARIO',
      1,
      `${ejercicio}-12-31`,
      ejercicio,
      13,
      `Póliza de Cierre Anual del Ejercicio ${ejercicio} (Cancelación de Cuentas de Resultados)`,
      null,
      'MANUAL',
      now
    );

    for (let idx = 0; idx < movements.length; idx += 1) {
      const m = movements[idx];
      if (!m) continue;
      insertMovementStmt.run(
        `${polizaId}_m${idx + 1}`,
        polizaId,
        m.accountId,
        m.accountCode,
        m.accountName,
        'CIERRE-13',
        `Traspaso de cierre ejercicio ${ejercicio}`,
        m.cargo,
        m.abono,
        null
      );
    }
  });

  tx();
  return { closed: true, polizaId, utilidadTraspasada: fromCents(netDiffCents) };
}
