import { db } from '../connection';
import { assertAccountingInvariant } from '../../shared/accounting-engine';
import { getAccounts } from './accounts.repo';
import { ensureBankN1MatchesTable } from './bank-n1.repo';
import { assertPeriodOpen } from './period-locks.repo';

export interface ReclassifyAccountInput {
  companyId: string;
  fromAccountId: string;
  toAccountId: string;
  ejercicio: number;
  periodFrom?: number;
  periodTo?: number;
}

export interface ReclassifyAccountResult {
  updatedMovementsCount: number;
  affectedPolizasCount: number;
}

/**
 * Reclasifica masivamente movimientos contables de una cuenta afectable origen
 * a una cuenta afectable destino dentro de un ejercicio y rango de periodos,
 * validando estrictamente que ningún periodo afectado tenga candado fiscal SAT.
 */
export function reclassifyAccountMovements(
  input: ReclassifyAccountInput
): ReclassifyAccountResult {
  assertAccountingInvariant(
    Boolean(input.companyId && input.fromAccountId && input.toAccountId),
    'INVALID_RECLASSIFY_PAYLOAD',
    'Debes seleccionar la empresa, cuenta origen y cuenta destino.'
  );
  assertAccountingInvariant(
    input.fromAccountId !== input.toAccountId,
    'SAME_ACCOUNT_RECLASSIFY',
    'La cuenta origen y la cuenta destino deben ser distintas.'
  );

  const accounts = getAccounts(input.companyId);
  const fromAcc = accounts.find((a) => a.id === input.fromAccountId);
  const toAcc = accounts.find((a) => a.id === input.toAccountId);

  assertAccountingInvariant(
    Boolean(fromAcc),
    'ACCOUNT_NOT_FOUND',
    'La cuenta origen no existe en el catálogo de esta empresa.'
  );
  assertAccountingInvariant(
    Boolean(toAcc),
    'ACCOUNT_NOT_FOUND',
    'La cuenta destino no existe en el catálogo de esta empresa.'
  );
  assertAccountingInvariant(
    Boolean(fromAcc?.isAffectable),
    'NON_AFFECTABLE_ACCOUNT',
    `La cuenta origen ${fromAcc?.code || ''} es acumuladora y no afectable.`
  );
  assertAccountingInvariant(
    Boolean(toAcc?.isAffectable),
    'NON_AFFECTABLE_ACCOUNT',
    `La cuenta destino ${toAcc?.code || ''} es acumuladora y no afectable.`
  );

  const pFrom = Math.max(1, Math.min(13, input.periodFrom ?? 1));
  const pTo = Math.max(pFrom, Math.min(13, input.periodTo ?? 13));

  const matchingRows = db
    .query(
      `
      SELECT m.id as movement_id, m.poliza_id as poliza_id, p.periodo as periodo
      FROM poliza_movements m
      INNER JOIN polizas p ON p.id = m.poliza_id
      WHERE p.company_id = ?
        AND p.ejercicio = ?
        AND p.periodo >= ?
        AND p.periodo <= ?
        AND m.account_id = ?
    `
    )
    .all(input.companyId, input.ejercicio, pFrom, pTo, fromAcc!.id) as Array<{
    movement_id: string;
    poliza_id: string;
    periodo: number;
  }>;

  if (matchingRows.length === 0) {
    // Si el usuario acotó un periodo específico, validar igual si está bloqueado
    if (input.periodFrom !== undefined && input.periodTo !== undefined && pFrom === pTo) {
      assertPeriodOpen(input.companyId, input.ejercicio, pFrom);
    }
    return { updatedMovementsCount: 0, affectedPolizasCount: 0 };
  }

  const distinctPeriods = Array.from(new Set(matchingRows.map((r) => Number(r.periodo))));
  for (const per of distinctPeriods) {
    assertPeriodOpen(input.companyId, input.ejercicio, per);
  }

  const polizaIds = Array.from(new Set(matchingRows.map((r) => r.poliza_id)));
  const movementIds = matchingRows.map((r) => r.movement_id);
  const isFromBankAccount = fromAcc!.code.trim().startsWith('102');
  if (isFromBankAccount) {
    ensureBankN1MatchesTable(db);
  }

  const tx = db.transaction(() => {
    const updStmt = db.prepare(
      'UPDATE poliza_movements SET account_id = ?, account_code = ?, account_name = ? WHERE id = ?'
    );
    for (const movId of movementIds) {
      updStmt.run(toAcc!.id, toAcc!.code, toAcc!.name, movId);
    }

    if (isFromBankAccount && movementIds.length > 0) {
      for (let i = 0; i < movementIds.length; i += 100) {
        const chunk = movementIds.slice(i, i + 100);
        const ph = chunk.map(() => '?').join(',');
        const matchRows = db
          .prepare(`SELECT DISTINCT bank_line_id FROM bank_statement_matches WHERE movement_id IN (${ph})`)
          .all(...chunk) as Array<{ bank_line_id: string }>;
        if (matchRows.length > 0) {
          const lineIds = matchRows.map((r) => r.bank_line_id);
          const linePh = lineIds.map(() => '?').join(',');
          db.prepare(
            `UPDATE bank_statement_lines SET matched_movement_id = NULL WHERE id IN (${linePh})`
          ).run(...lineIds);
        }
        db.prepare(
          `UPDATE bank_statement_lines SET matched_movement_id = NULL WHERE matched_movement_id IN (${ph})`
        ).run(...chunk);
        db.prepare(`DELETE FROM bank_statement_matches WHERE movement_id IN (${ph})`).run(...chunk);
      }
    }
  });
  tx();

  return {
    updatedMovementsCount: movementIds.length,
    affectedPolizasCount: polizaIds.length
  };
}
