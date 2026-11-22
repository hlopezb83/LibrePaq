import { db, type PeriodLockDbRow } from '../connection';
import { assertAccountingInvariant } from '../../shared/accounting-engine';
import { MESES_SAT } from '../../shared/sat-catalog';
import type { PeriodLock } from '../../shared/types';

export function getPeriodLock(
  companyId: string,
  ejercicio: number,
  periodo: number
): PeriodLock {
  const row = db
    .query('SELECT * FROM period_locks WHERE company_id = ? AND ejercicio = ? AND periodo = ?')
    .get(companyId, ejercicio, periodo) as PeriodLockDbRow | null;

  return {
    companyId,
    ejercicio,
    periodo,
    isLocked: Boolean(row?.is_locked),
    lockedAt: row?.locked_at || null,
    notes: row?.notes || ''
  };
}

export function setPeriodLock(
  companyId: string,
  ejercicio: number,
  periodo: number,
  isLocked: boolean,
  notes = ''
): PeriodLock {
  const lockedAt = isLocked ? new Date().toISOString() : null;
  db.prepare(`
    INSERT INTO period_locks (company_id, ejercicio, periodo, is_locked, locked_at, notes)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id, ejercicio, periodo) DO UPDATE SET
      is_locked = excluded.is_locked,
      locked_at = excluded.locked_at,
      notes = excluded.notes
  `).run(companyId, ejercicio, periodo, isLocked ? 1 : 0, lockedAt, notes);

  return getPeriodLock(companyId, ejercicio, periodo);
}

export function assertPeriodOpen(companyId: string, ejercicio: number, periodo: number): void {
  const lock = getPeriodLock(companyId, ejercicio, periodo);
  const mesNombre = MESES_SAT.find((m) => m.periodo === periodo)?.nombre || `Periodo ${periodo}`;
  assertAccountingInvariant(
    !lock.isLocked,
    'PERIOD_LOCKED',
    `El periodo contable ${mesNombre} ${ejercicio} está CERRADO con candado fiscal. Ábrelo primero si necesitas registrar, editar o eliminar pólizas.`
  );
}
