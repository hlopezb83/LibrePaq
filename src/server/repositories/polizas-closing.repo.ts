import { db } from '../connection';
import { buildYearCloseMovements } from '../../shared/accounting-engine';
import { computeTrialBalance } from './trial-balance.repo';
import { assertPeriodOpen } from './period-locks.repo';
import { insertMovementStmt, insertPolizaStmt, maxFolioQuery } from './polizas.repo';

export function closeYearPolizaTransaction(
  companyId: string,
  ejercicio: number,
  switchToPeriod13 = true
): { closed: boolean; polizaId: string; utilidadTraspasada: number } {
  assertPeriodOpen(companyId, ejercicio, 13);

  const polizaId = `pol_cierre_${ejercicio}_${crypto.randomUUID().slice(0, 4)}`;
  const now = new Date().toISOString();
  let utilidadTraspasada = 0;

  const tx = db.transaction(() => {
    // Preservar pólizas manuales/ajuste en Periodo 13: borrar únicamente pólizas previas de CIERRE_ANUAL
    db.prepare(
      "DELETE FROM polizas WHERE company_id = ? AND ejercicio = ? AND periodo = 13 AND origin = 'CIERRE_ANUAL'"
    ).run(companyId, ejercicio);

    const tb13 = computeTrialBalance(companyId, ejercicio, 13);
    const built = buildYearCloseMovements(tb13, ejercicio, 'finalBalance');
    utilidadTraspasada = built.utilidadTraspasada;
    const { movements } = built;

    const maxRow = maxFolioQuery.get(companyId, 'DIARIO', ejercicio, 13) as {
      max_folio?: number;
    } | null;
    const nextFolio = Number(maxRow?.max_folio ?? 0) + 1;

    insertPolizaStmt.run(
      polizaId,
      companyId,
      'DIARIO',
      nextFolio,
      `${ejercicio}-12-31`,
      ejercicio,
      13,
      `Póliza de Cierre Anual del Ejercicio ${ejercicio} (Cancelación de Cuentas de Resultados)`,
      null,
      'CIERRE_ANUAL',
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

    if (switchToPeriod13) {
      db.prepare('UPDATE companies SET current_period = 13 WHERE id = ?').run(companyId);
    }
  });

  tx();
  return { closed: true, polizaId, utilidadTraspasada };
}
