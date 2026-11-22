import { db, type BankLineDbRow } from '../connection';
import {
  assertAccountingInvariant,
  fromCents,
  resolveFiscalAccount,
  toCents
} from '../../shared/accounting-engine';
import type {
  BankReconciliationResponse,
  PolizaType
} from '../../shared/types';
import { getAccounts } from './accounts.repo';
import { getCompanyById } from './companies.repo';
import { insertMovementStmt, insertPolizaStmt, maxFolioQuery } from './polizas.repo';
import { getBankReconciliation } from './bank.repo';
import { assertPeriodOpen } from './period-locks.repo';

export function createPolizaFromBankLineTransaction(
  lineId: string,
  options?: { counterAccountCode?: string; desglosarIva?: boolean }
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
  const bankAcc =
    accounts.find((a) => a.id === bLine.account_id) ??
    resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL');

  const isWithdrawal = toCents(bLine.cargo_banco) > 0;
  const amountCents = isWithdrawal ? toCents(bLine.cargo_banco) : toCents(bLine.abono_banco);
  const desglosarIva = options?.desglosarIva !== undefined ? Boolean(options.desglosarIva) : true;

  const counterAcc = isWithdrawal
    ? resolveFiscalAccount(accounts, 'COMISIONES_BANCARIAS', options?.counterAccountCode)
    : resolveFiscalAccount(accounts, 'INGRESOS_TASA_16', options?.counterAccountCode);

  const ivaAcc = isWithdrawal
    ? resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO')
    : resolveFiscalAccount(accounts, 'IVA_TRASLADADO_COBRADO');

  const tipo: PolizaType = isWithdrawal ? 'EGRESO' : 'INGRESO';
  const lineYear = parseInt(bLine.fecha.slice(0, 4), 10) || company.currentYear;
  const linePeriod = parseInt(bLine.fecha.slice(5, 7), 10) || company.currentPeriod;

  // Candado Fiscal: Garantizar que el periodo no esté cerrado antes de afectar bancos/pólizas
  assertPeriodOpen(company.id, lineYear, linePeriod);

  const maxRow = maxFolioQuery.get(
    company.id,
    tipo,
    lineYear,
    linePeriod
  ) as { max_folio: number } | null;
  const nextFolio = (maxRow?.max_folio ?? 0) + 1;
  const polizaId = `pol_${crypto.randomUUID().slice(0, 8)}`;
  const bankMovId = `${polizaId}_m_bank`;
  const now = new Date().toISOString();

  const subtotalCents = desglosarIva ? Math.round(amountCents / 1.16) : amountCents;
  const ivaCents = desglosarIva ? amountCents - subtotalCents : 0;

  const tx = db.transaction(() => {
    insertPolizaStmt.run(
      polizaId,
      company.id,
      tipo,
      nextFolio,
      bLine.fecha,
      lineYear,
      linePeriod,
      bLine.descripcion,
      null,
      'MANUAL',
      now
    );

    if (isWithdrawal) {
      insertMovementStmt.run(
        `${polizaId}_m1`,
        polizaId,
        counterAcc.id,
        counterAcc.code,
        counterAcc.name,
        bLine.referencia,
        bLine.descripcion,
        fromCents(subtotalCents),
        0,
        null
      );
      if (ivaCents > 0) {
        insertMovementStmt.run(
          `${polizaId}_m2`,
          polizaId,
          ivaAcc.id,
          ivaAcc.code,
          ivaAcc.name,
          bLine.referencia,
          `IVA 16% ${bLine.referencia}`,
          fromCents(ivaCents),
          0,
          null
        );
      }
      insertMovementStmt.run(
        bankMovId,
        polizaId,
        bankAcc.id,
        bankAcc.code,
        bankAcc.name,
        bLine.referencia,
        bLine.descripcion,
        0,
        fromCents(amountCents),
        null
      );
    } else {
      insertMovementStmt.run(
        bankMovId,
        polizaId,
        bankAcc.id,
        bankAcc.code,
        bankAcc.name,
        bLine.referencia,
        bLine.descripcion,
        fromCents(amountCents),
        0,
        null
      );
      insertMovementStmt.run(
        `${polizaId}_m1`,
        polizaId,
        counterAcc.id,
        counterAcc.code,
        counterAcc.name,
        bLine.referencia,
        bLine.descripcion,
        0,
        fromCents(subtotalCents),
        null
      );
      if (ivaCents > 0) {
        insertMovementStmt.run(
          `${polizaId}_m2`,
          polizaId,
          ivaAcc.id,
          ivaAcc.code,
          ivaAcc.name,
          bLine.referencia,
          `IVA 16% ${bLine.referencia}`,
          0,
          fromCents(ivaCents),
          null
        );
      }
    }

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
      bankAcc.id,
      lineYear,
      linePeriod
    )
  };
}
