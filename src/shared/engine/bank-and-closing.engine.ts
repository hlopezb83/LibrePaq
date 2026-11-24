import type {
  Account,
  AccountWithBalance,
  BankReconciliationResponse,
  BankStatementLine,
  PolizaType
} from '../types';
import { resolveFiscalAccount } from './auto-poliza-account-resolver';
import {
  assertAccountingInvariant,
  fromCents,
  toCents,
  validateDoubleEntryMovements
} from './invariants-and-math';

export { findManyToOneBankMatches } from './bank-n1-matcher';

export interface BankMatchPair {
  statementLineId: string;
  movementId: string;
}

/**
 * Empareja automáticamente renglones bancarios no conciliados contra pólizas
 * contables en libros usando coincidencia exacta en centavos (Abono Banco ↔ Cargo Libros).
 */
export function findBankReconciliationMatches(
  statementLines: readonly BankStatementLine[],
  bookMovements: ReadonlyArray<BankReconciliationResponse['bookMovements'][number]>
): BankMatchPair[] {
  const unmatchedBank = statementLines.filter((s) => !s.matchedMovementId);
  const availableBooks = bookMovements.filter((b) => !b.isMatched);
  const pairs: BankMatchPair[] = [];

  for (const bLine of unmatchedBank) {
    const matchIdx = availableBooks.findIndex(
      (bm) =>
        toCents(bm.cargoContable) === toCents(bLine.abonoBanco) &&
        toCents(bm.abonoContable) === toCents(bLine.cargoBanco)
    );
    if (matchIdx !== -1) {
      const matchedBook = availableBooks[matchIdx];
      if (matchedBook) {
        pairs.push({
          statementLineId: bLine.id,
          movementId: matchedBook.movementId
        });
        availableBooks.splice(matchIdx, 1);
      }
    }
  }

  return pairs;
}

export interface YearCloseMovementDraft {
  accountId: string;
  accountCode: string;
  accountName: string;
  referencia: string;
  concepto: string;
  cargo: number;
  abono: number;
}

/**
 * Construye la póliza de cierre anual (Periodo 13) saldando cuentas de resultados
 * y traspasando la utilidad o pérdida neta a Resultado del Ejercicio.
 */
export function buildYearCloseMovements(
  tb13: readonly AccountWithBalance[],
  ejercicio: number,
  balanceField: 'finalBalance' | 'initialBalanceComputed'
): { movements: YearCloseMovementDraft[]; utilidadTraspasada: number } {
  const resultAccounts = tb13.filter(
    (a) =>
      a.isAffectable &&
      (a.type === 'INGRESOS' || a.type === 'COSTOS' || a.type === 'GASTOS') &&
      Math.abs(toCents(a[balanceField])) >= 1
  );

  assertAccountingInvariant(
    resultAccounts.length > 0,
    'ALREADY_CLOSED_YEAR',
    'Las cuentas de resultados (Ingresos, Costos y Gastos) ya están saldadas en $0.00.'
  );

  const capitalResultAcc = resolveFiscalAccount([...tb13], 'RESULTADO_DEL_EJERCICIO');
  const movements: YearCloseMovementDraft[] = [];
  let sumCargosCents = 0;
  let sumAbonosCents = 0;

  for (const acc of resultAccounts) {
    const balCents = toCents(acc[balanceField]);
    const isCreditor = acc.nature === 'ACREEDORA';
    const cargoCents = isCreditor
      ? (balCents > 0 ? balCents : 0)
      : (balCents < 0 ? Math.abs(balCents) : 0);
    const abonoCents = isCreditor
      ? (balCents < 0 ? Math.abs(balCents) : 0)
      : (balCents > 0 ? balCents : 0);

    movements.push({
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      referencia: 'CIERRE-13',
      concepto: `Cancelación anual de cuenta de ${isCreditor ? 'ingresos' : 'egresos'} ${acc.code}`,
      cargo: fromCents(cargoCents),
      abono: fromCents(abonoCents)
    });
    sumCargosCents += cargoCents;
    sumAbonosCents += abonoCents;
  }

  const netDiffCents = sumCargosCents - sumAbonosCents;
  if (netDiffCents !== 0) {
    movements.push({
      accountId: capitalResultAcc.id,
      accountCode: capitalResultAcc.code,
      accountName: capitalResultAcc.name,
      referencia: 'CIERRE-13',
      concepto: `Traspaso a Resultado del Ejercicio ${ejercicio}`,
      cargo: netDiffCents < 0 ? fromCents(Math.abs(netDiffCents)) : 0,
      abono: netDiffCents > 0 ? fromCents(netDiffCents) : 0
    });
  }

  const accountsById = new Map(tb13.map((a) => [a.id, a]));
  validateDoubleEntryMovements(movements, accountsById);
  return {
    movements,
    utilidadTraspasada: fromCents(netDiffCents)
  };
}

export interface BankLinePolizaMovementDraft {
  accountId: string;
  accountCode: string;
  accountName: string;
  referencia: string;
  concepto: string;
  cargo: number;
  abono: number;
  isBankMovement: boolean;
}

export interface BankLinePolizaPlan {
  tipo: PolizaType;
  bankAcc: Account;
  isWithdrawal: boolean;
  amountCents: number;
  movements: BankLinePolizaMovementDraft[];
}

/**
 * Construye el plan contable de una póliza automática a partir de un movimiento
 * bancario (cargo o abono en estado de cuenta), aplicando desglose opcional de IVA 16%.
 */
export function buildBankLinePolizaPlan(params: {
  accounts: Account[];
  accountId: string;
  cargoBanco: number;
  abonoBanco: number;
  referencia: string;
  descripcion: string;
  desglosarIva?: boolean;
  counterAccountCode?: string;
}): BankLinePolizaPlan {
  const { accounts, accountId, cargoBanco, abonoBanco, referencia, descripcion } = params;
  const bankAcc =
    accounts.find((a) => a.id === accountId) ?? resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL');
  assertAccountingInvariant(
    bankAcc.isAffectable,
    'NON_AFFECTABLE_ACCOUNT',
    `La cuenta bancaria ${bankAcc.code} (${bankAcc.name}) es acumulativa (de mayor) y no permite cargos ni abonos directos.`
  );

  const isWithdrawal = toCents(cargoBanco) > 0;
  const amountCents = isWithdrawal ? toCents(cargoBanco) : toCents(abonoBanco);
  const desglosarIva = params.desglosarIva !== undefined ? Boolean(params.desglosarIva) : true;

  const counterAcc = isWithdrawal
    ? resolveFiscalAccount(accounts, 'COMISIONES_BANCARIAS', params.counterAccountCode)
    : resolveFiscalAccount(accounts, 'INGRESOS_TASA_16', params.counterAccountCode);

  const ivaAcc = isWithdrawal
    ? resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO')
    : resolveFiscalAccount(accounts, 'IVA_TRASLADADO_COBRADO');

  const tipo: PolizaType = isWithdrawal ? 'EGRESO' : 'INGRESO';
  const subtotalCents = desglosarIva ? Math.round(amountCents / 1.16) : amountCents;
  const ivaCents = desglosarIva ? amountCents - subtotalCents : 0;

  const movements: BankLinePolizaMovementDraft[] = isWithdrawal
    ? [
        {
          accountId: counterAcc.id,
          accountCode: counterAcc.code,
          accountName: counterAcc.name,
          referencia: referencia || 'MOV-BANCO',
          concepto: descripcion || 'Gasto registrado desde banco',
          cargo: fromCents(subtotalCents),
          abono: 0,
          isBankMovement: false
        },
        ...(ivaCents > 0
          ? [
              {
                accountId: ivaAcc.id,
                accountCode: ivaAcc.code,
                accountName: ivaAcc.name,
                referencia: referencia || 'IVA',
                concepto: 'IVA Acreditable Pagado 16% desglosado de banco',
                cargo: fromCents(ivaCents),
                abono: 0,
                isBankMovement: false
              }
            ]
          : []),
        {
          accountId: bankAcc.id,
          accountCode: bankAcc.code,
          accountName: bankAcc.name,
          referencia: referencia || 'BANCO',
          concepto: descripcion || 'Salida de banco',
          cargo: 0,
          abono: fromCents(amountCents),
          isBankMovement: true
        }
      ]
    : [
        {
          accountId: bankAcc.id,
          accountCode: bankAcc.code,
          accountName: bankAcc.name,
          referencia: referencia || 'BANCO',
          concepto: descripcion || 'Entrada a banco',
          cargo: fromCents(amountCents),
          abono: 0,
          isBankMovement: true
        },
        {
          accountId: counterAcc.id,
          accountCode: counterAcc.code,
          accountName: counterAcc.name,
          referencia: referencia || 'INGRESO',
          concepto: descripcion || 'Ingreso cobrado en banco',
          cargo: 0,
          abono: fromCents(subtotalCents),
          isBankMovement: false
        },
        ...(ivaCents > 0
          ? [
              {
                accountId: ivaAcc.id,
                accountCode: ivaAcc.code,
                accountName: ivaAcc.name,
                referencia: referencia || 'IVA',
                concepto: 'IVA Trasladado Cobrado 16% desglosado de banco',
                cargo: 0,
                abono: fromCents(ivaCents),
                isBankMovement: false
              }
            ]
          : [])
      ];

  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  validateDoubleEntryMovements(movements, accountsById);

  return {
    tipo,
    bankAcc,
    isWithdrawal,
    amountCents,
    movements
  };
}
