import { db } from '../connection';
import { buildYearCloseMovements } from '../../shared/accounting-engine';
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
  const { movements, utilidadTraspasada } = buildYearCloseMovements(
    tb13,
    ejercicio,
    'initialBalanceComputed'
  );

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
  return { closed: true, polizaId, utilidadTraspasada };
}
