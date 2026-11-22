import type {
  AccountWithBalance,
  BankReconciliationResponse,
  BankStatementLine
} from '../types';
import { resolveFiscalAccount } from './auto-poliza-account-resolver';
import {
  assertAccountingInvariant,
  fromCents,
  toCents,
  validateDoubleEntryMovements
} from './invariants-and-math';

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

  validateDoubleEntryMovements(movements);
  return {
    movements,
    utilidadTraspasada: fromCents(netDiffCents)
  };
}
