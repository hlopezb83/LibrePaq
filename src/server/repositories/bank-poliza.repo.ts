import { db, type BankLineDbRow } from '../connection';
import {
  assertAccountingInvariant,
  validateDoubleEntryMovements
} from '../../shared/engine/invariants-and-math';
import {
  buildBankLinePolizaPlan,
  type BankCounterLineInput
} from '../../shared/engine/bank-and-closing.engine';
import type { BankReconciliationResponse } from '../../shared/types';
import { getAccounts } from './accounts.repo';
import { getCompanyById } from './companies.repo';
import { insertMovementStmt, insertPolizaStmt, maxFolioQuery } from './polizas.repo';
import { getBankReconciliation } from './bank.repo';
import { assertPeriodOpen } from './period-locks.repo';

export function createPolizaFromBankLineTransaction(
  lineId: string,
  options?: { counterAccountCode?: string; desglosarIva?: boolean; counterLines?: ReadonlyArray<BankCounterLineInput> }
): {
  status: 'OK' | 'NOT_FOUND' | 'ALREADY_MATCHED';
  createdPolizaId?: string;
  reconciliation?: BankReconciliationResponse | null;
} {
  const bLine = db
    .query('SELECT * FROM bank_statement_lines WHERE id = ?')
    .get(lineId) as BankLineDbRow | null;
  if (!bLine) return { status: 'NOT_FOUND' };
  if (bLine.matched_movement_id) return { status: 'ALREADY_MATCHED' };

  const company = getCompanyById(bLine.company_id);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const accounts = getAccounts(company.id);
  const plan = buildBankLinePolizaPlan({
    accounts,
    accountId: bLine.account_id,
    cargoBanco: bLine.cargo_banco,
    abonoBanco: bLine.abono_banco,
    referencia: bLine.referencia,
    descripcion: bLine.descripcion,
    desglosarIva: options?.desglosarIva,
    counterAccountCode: options?.counterAccountCode,
    counterLines: options?.counterLines
  });

  assertAccountingInvariant(
    plan.bankAcc.isAffectable,
    'NON_AFFECTABLE_ACCOUNT',
    `La cuenta bancaria ${plan.bankAcc.code} (${plan.bankAcc.name}) es acumulativa y no permite movimientos directos.`
  );
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  validateDoubleEntryMovements(plan.movements, accountsById);

  const lineYear = parseInt(bLine.fecha.slice(0, 4), 10) || company.currentYear;
  const linePeriod = parseInt(bLine.fecha.slice(5, 7), 10) || company.currentPeriod;

  // Candado Fiscal: Garantizar que el periodo no esté cerrado antes de afectar bancos/pólizas
  assertPeriodOpen(company.id, lineYear, linePeriod);

  const maxRow = maxFolioQuery.get(
    company.id,
    plan.tipo,
    lineYear,
    linePeriod
  ) as { max_folio: number } | null;
  const nextFolio = (maxRow?.max_folio ?? 0) + 1;
  const polizaId = `pol_${crypto.randomUUID().slice(0, 8)}`;
  const bankMovId = `${polizaId}_m_bank`;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    insertPolizaStmt.run(
      polizaId,
      company.id,
      plan.tipo,
      nextFolio,
      bLine.fecha,
      lineYear,
      linePeriod,
      bLine.descripcion,
      null,
      'MANUAL',
      now
    );

    plan.movements.forEach((mov, idx) => {
      const movId = mov.isBankMovement ? bankMovId : `${polizaId}_m${idx + 1}`;
      insertMovementStmt.run(
        movId,
        polizaId,
        mov.accountId,
        mov.accountCode,
        mov.accountName,
        mov.referencia,
        mov.concepto,
        mov.cargo,
        mov.abono,
        null
      );
    });

    db.prepare('UPDATE bank_statement_lines SET matched_movement_id = ? WHERE id = ?').run(
      bankMovId,
      lineId
    );
  });

  tx();

  return {
    status: 'OK',
    createdPolizaId: polizaId,
    reconciliation: getBankReconciliation(
      company.id,
      plan.bankAcc.id,
      lineYear,
      linePeriod
    )
  };
}
