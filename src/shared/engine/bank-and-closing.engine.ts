import { parseCalendarDate } from '../date-utils';
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

function normalizeBankRef(raw: string | null | undefined): string {
  const clean = (raw ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean || clean === 'MOVBANCO' || /^CSV\d+$/.test(clean) || clean.length < 3) return '';
  return clean;
}

function toDayIndex(fecha: string | null | undefined): number | null {
  if (!fecha || !/^\d{4}-\d{1,2}-\d{1,2}/.test(fecha.trim())) return null;
  const { year, month, day } = parseCalendarDate(fecha);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function computeMatchScore(
  bLine: BankStatementLine,
  bm: BankReconciliationResponse['bookMovements'][number]
): { refScore: number; dayDiff: number } {
  const bRef = normalizeBankRef(bLine.referencia);
  const mRef = normalizeBankRef(bm.referencia);
  let refScore = 0;
  if (bRef && mRef) {
    if (bRef === mRef) refScore = 3;
    else if (bRef.includes(mRef) || mRef.includes(bRef)) refScore = 2;
  }
  if (refScore === 0) {
    const bDesc = normalizeBankRef(bLine.descripcion);
    const mConc = normalizeBankRef(bm.concepto);
    if ((bRef && mConc.includes(bRef)) || (mRef && bDesc.includes(mRef))) refScore = 1;
  }
  const bDay = toDayIndex(bLine.fecha);
  const mDay = toDayIndex(bm.fecha);
  const dayDiff = bDay !== null && mDay !== null ? Math.abs(bDay - mDay) : 9999;
  return { refScore, dayDiff };
}

/**
 * Empareja automáticamente renglones bancarios no conciliados contra pólizas
 * contables en libros usando coincidencia exacta en centavos (Abono Banco ↔ Cargo Libros)
 * priorizando coincidencia de referencia y cercanía de fecha.
 */
export function findBankReconciliationMatches(
  statementLines: readonly BankStatementLine[],
  bookMovements: ReadonlyArray<BankReconciliationResponse['bookMovements'][number]>
): BankMatchPair[] {
  const unmatchedBank = statementLines.filter((s) => !s.matchedMovementId);
  const availableBooks = bookMovements.filter((b) => !b.isMatched);
  if (unmatchedBank.length === 0 || availableBooks.length === 0) return [];

  const booksByAmountKey = new Map<string, Array<{ bookIdx: number; bm: BankReconciliationResponse['bookMovements'][number] }>>();
  availableBooks.forEach((bm, bookIdx) => {
    const key = `${toCents(bm.cargoContable)}:${toCents(bm.abonoContable)}`;
    const bucket = booksByAmountKey.get(key) ?? [];
    bucket.push({ bookIdx, bm });
    booksByAmountKey.set(key, bucket);
  });

  const candidates: Array<{ bankIdx: number; bookIdx: number; refScore: number; dayDiff: number; statementLineId: string; movementId: string }> = [];
  unmatchedBank.forEach((bLine, bankIdx) => {
    const key = `${toCents(bLine.abonoBanco)}:${toCents(bLine.cargoBanco)}`;
    const bucket = booksByAmountKey.get(key);
    if (!bucket) return;
    for (const { bookIdx, bm } of bucket) {
      const { refScore, dayDiff } = computeMatchScore(bLine, bm);
      candidates.push({ bankIdx, bookIdx, refScore, dayDiff, statementLineId: bLine.id, movementId: bm.movementId });
    }
  });

  candidates.sort((a, b) => b.refScore - a.refScore || a.dayDiff - b.dayDiff || a.bankIdx - b.bankIdx || a.bookIdx - b.bookIdx);

  const usedBank = new Set<number>();
  const usedBook = new Set<number>();
  const pairs: BankMatchPair[] = [];
  for (const cand of candidates) {
    if (usedBank.has(cand.bankIdx) || usedBook.has(cand.bookIdx)) continue;
    usedBank.add(cand.bankIdx);
    usedBook.add(cand.bookIdx);
    pairs.push({ statementLineId: cand.statementLineId, movementId: cand.movementId });
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

export interface BankCounterLineInput {
  accountCode: string;
  side?: 'CARGO' | 'ABONO';
  amount: number;
  concepto?: string;
}

/**
 * Construye el plan contable de una póliza automática a partir de un movimiento
 * bancario (cargo o abono en estado de cuenta), aplicando desglose opcional de IVA 16%
 * o múltiples contracuentas (impuestos DyP, PPD con reclasificación de IVA, etc.).
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
  counterLines?: ReadonlyArray<BankCounterLineInput>;
}): BankLinePolizaPlan {
  const { accounts, accountId, cargoBanco, abonoBanco, referencia, descripcion, counterLines } = params;
  const bankAcc =
    accounts.find((a) => a.id === accountId) ?? resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL');
  assertAccountingInvariant(
    bankAcc.isAffectable,
    'NON_AFFECTABLE_ACCOUNT',
    `La cuenta bancaria ${bankAcc.code} (${bankAcc.name}) es acumulativa (de mayor) y no permite cargos ni abonos directos.`
  );

  const isWithdrawal = toCents(cargoBanco) > 0;
  const amountCents = isWithdrawal ? toCents(cargoBanco) : toCents(abonoBanco);
  const tipo: PolizaType = isWithdrawal ? 'EGRESO' : 'INGRESO';
  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  if (counterLines && counterLines.length > 0) {
    const validLines = counterLines.filter((cl) => toCents(cl.amount) > 0 && cl.accountCode.trim() !== '');
    assertAccountingInvariant(validLines.length > 0, 'EMPTY_COUNTER_LINES', 'Agrega al menos una contracuenta con importe mayor a $0.00.');
    const movements: BankLinePolizaMovementDraft[] = [];
    if (!isWithdrawal) {
      movements.push({
        accountId: bankAcc.id, accountCode: bankAcc.code, accountName: bankAcc.name,
        referencia: referencia || 'BANCO', concepto: descripcion || 'Entrada a banco',
        cargo: fromCents(amountCents), abono: 0, isBankMovement: true
      });
    }
    for (const cl of validLines) {
      const acc = accounts.find((a) => a.code === cl.accountCode && a.isAffectable);
      assertAccountingInvariant(acc !== undefined, 'INVALID_COUNTER_ACCOUNT', `La contracuenta ${cl.accountCode} no existe o no es afectable.`);
      const side = cl.side ?? (isWithdrawal ? 'CARGO' : 'ABONO');
      const amt = fromCents(toCents(cl.amount));
      movements.push({
        accountId: acc.id, accountCode: acc.code, accountName: acc.name,
        referencia: referencia || 'MOV-BANCO', concepto: cl.concepto?.trim() || descripcion || acc.name,
        cargo: side === 'CARGO' ? amt : 0, abono: side === 'ABONO' ? amt : 0, isBankMovement: false
      });
    }
    if (isWithdrawal) {
      movements.push({
        accountId: bankAcc.id, accountCode: bankAcc.code, accountName: bankAcc.name,
        referencia: referencia || 'BANCO', concepto: descripcion || 'Salida de banco',
        cargo: 0, abono: fromCents(amountCents), isBankMovement: true
      });
    }
    validateDoubleEntryMovements(movements, accountsById);
    return { tipo, bankAcc, isWithdrawal, amountCents, movements };
  }

  const desglosarIva = params.desglosarIva !== undefined ? Boolean(params.desglosarIva) : true;
  const counterAcc = isWithdrawal
    ? resolveFiscalAccount(accounts, 'COMISIONES_BANCARIAS', params.counterAccountCode)
    : resolveFiscalAccount(accounts, 'INGRESOS_TASA_16', params.counterAccountCode);
  const ivaAcc = isWithdrawal
    ? resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO')
    : resolveFiscalAccount(accounts, 'IVA_TRASLADADO_COBRADO');
  const subtotalCents = desglosarIva ? Math.round(amountCents / 1.16) : amountCents;
  const ivaCents = desglosarIva ? amountCents - subtotalCents : 0;

  const movements: BankLinePolizaMovementDraft[] = isWithdrawal
    ? [
        { accountId: counterAcc.id, accountCode: counterAcc.code, accountName: counterAcc.name, referencia: referencia || 'MOV-BANCO', concepto: descripcion || 'Gasto registrado desde banco', cargo: fromCents(subtotalCents), abono: 0, isBankMovement: false },
        ...(ivaCents > 0 ? [{ accountId: ivaAcc.id, accountCode: ivaAcc.code, accountName: ivaAcc.name, referencia: referencia || 'IVA', concepto: 'IVA Acreditable Pagado 16% desglosado de banco', cargo: fromCents(ivaCents), abono: 0, isBankMovement: false }] : []),
        { accountId: bankAcc.id, accountCode: bankAcc.code, accountName: bankAcc.name, referencia: referencia || 'BANCO', concepto: descripcion || 'Salida de banco', cargo: 0, abono: fromCents(amountCents), isBankMovement: true }
      ]
    : [
        { accountId: bankAcc.id, accountCode: bankAcc.code, accountName: bankAcc.name, referencia: referencia || 'BANCO', concepto: descripcion || 'Entrada a banco', cargo: fromCents(amountCents), abono: 0, isBankMovement: true },
        { accountId: counterAcc.id, accountCode: counterAcc.code, accountName: counterAcc.name, referencia: referencia || 'INGRESO', concepto: descripcion || 'Ingreso cobrado en banco', cargo: 0, abono: fromCents(subtotalCents), isBankMovement: false },
        ...(ivaCents > 0 ? [{ accountId: ivaAcc.id, accountCode: ivaAcc.code, accountName: ivaAcc.name, referencia: referencia || 'IVA', concepto: 'IVA Trasladado Cobrado 16% desglosado de banco', cargo: 0, abono: fromCents(ivaCents), isBankMovement: false }] : [])
      ];

  validateDoubleEntryMovements(movements, accountsById);
  return { tipo, bankAcc, isWithdrawal, amountCents, movements };
}
