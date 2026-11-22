import type { Account } from '../types';
import { SAFETY_BOUNDS } from '../sat-constants';

export class AccountingInvariantError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AccountingInvariantError';
    this.code = code;
  }
}

/**
 * NASA Power of 10 - Regla 5 (H-04):
 * Aserción obligatoria de invariantes contables y fiscales en tiempo de ejecución.
 */
export function assertAccountingInvariant(
  condition: boolean,
  code: string,
  message: string
): asserts condition {
  if (!condition) {
    throw new AccountingInvariantError(code, message);
  }
}

/**
 * NASA Power of 10 - Regla 9 (H-03):
 * Aritmética monetaria exacta en centavos enteros para eliminar desviaciones IEEE 754.
 */
export function toCents(amount: number | undefined | null): number {
  const num = Number(amount ?? 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function fromCents(cents: number): number {
  return Number((Math.round(cents) / 100).toFixed(2));
}

export function sumCents(values: readonly number[]): number {
  let total = 0;
  const bound = Math.min(values.length, SAFETY_BOUNDS.MAX_CSV_ROWS);
  for (let i = 0; i < bound; i += 1) {
    total += toCents(values[i]);
  }
  return total;
}

export function validateDoubleEntryMovements(
  movements: ReadonlyArray<{ accountId: string; cargo: number; abono: number; concepto?: string }>,
  accountsById?: ReadonlyMap<string, Account>
): { totalCargo: number; totalAbono: number } {
  assertAccountingInvariant(
    movements.length >= 2 && movements.length <= SAFETY_BOUNDS.MAX_POLIZA_MOVEMENTS,
    'MOVEMENT_COUNT_OUT_OF_BOUNDS',
    `La póliza debe contener entre 2 y ${SAFETY_BOUNDS.MAX_POLIZA_MOVEMENTS} movimientos.`
  );

  let totalCargoCents = 0;
  let totalAbonoCents = 0;

  for (let i = 0; i < movements.length; i += 1) {
    const mov = movements[i];
    assertAccountingInvariant(
      mov !== undefined && Boolean(mov.accountId),
      'MISSING_MOVEMENT_ACCOUNT',
      `La partida #${i + 1} no tiene una cuenta contable asignada.`
    );

    const cargoCents = toCents(mov.cargo);
    const abonoCents = toCents(mov.abono);

    assertAccountingInvariant(
      cargoCents >= 0 && abonoCents >= 0,
      'NEGATIVE_MOVEMENT_AMOUNT',
      `La partida #${i + 1} contiene importes negativos no permitidos.`
    );
    assertAccountingInvariant(
      !(cargoCents > 0 && abonoCents > 0),
      'SIMULTANEOUS_CARGO_ABONO',
      `La partida #${i + 1} no puede tener cargo y abono simultáneamente en la misma línea.`
    );

    if (accountsById) {
      const account = accountsById.get(mov.accountId);
      assertAccountingInvariant(
        account !== undefined,
        'UNKNOWN_ACCOUNT_ID',
        `La cuenta de la partida #${i + 1} no pertenece a la empresa activa.`
      );
      assertAccountingInvariant(
        account.isAffectable,
        'NON_AFFECTABLE_ACCOUNT',
        `La cuenta ${account.code} (${account.name}) es acumulativa (de mayor) y no permite cargos ni abonos directos.`
      );
    }

    totalCargoCents += cargoCents;
    totalAbonoCents += abonoCents;
  }

  assertAccountingInvariant(
    totalCargoCents > 0,
    'ZERO_POLIZA_TOTAL',
    'El total de la póliza debe ser mayor a $0.00.'
  );
  assertAccountingInvariant(
    totalCargoCents === totalAbonoCents,
    'UNBALANCED_POLIZA',
    `Póliza descuadrada: Cargos ($${fromCents(totalCargoCents).toFixed(2)}) ≠ Abonos ($${fromCents(totalAbonoCents).toFixed(2)}).`
  );

  return {
    totalCargo: fromCents(totalCargoCents),
    totalAbono: fromCents(totalAbonoCents)
  };
}

/**
 * NASA Power of 10 - Reglas 1 y 2 (H-11):
 * Verificación iterativa acotada (sin recursión) contra ciclos y profundidad excesiva
 * en el árbol del Catálogo de Cuentas usando `parentCode`.
 */
export function validateAccountHierarchy(
  accounts: readonly Account[],
  parentCode: string | null | undefined,
  candidateCode?: string
): { level: number } {
  if (!parentCode) {
    return { level: 1 };
  }

  if (candidateCode && parentCode === candidateCode) {
    throw new AccountingInvariantError(
      'ACCOUNT_HIERARCHY_CYCLE',
      'Una cuenta no puede ser subcuenta de sí misma.'
    );
  }

  const byCode = new Map<string, Account>();
  for (const acc of accounts) {
    byCode.set(acc.code, acc);
  }

  const parent = byCode.get(parentCode);
  assertAccountingInvariant(
    parent !== undefined,
    'PARENT_ACCOUNT_NOT_FOUND',
    `La cuenta padre (${parentCode}) no existe en el catálogo.`
  );

  let current: Account | undefined = parent;
  let depth = 1;

  while (current && depth <= SAFETY_BOUNDS.MAX_ACCOUNT_LEVEL + 1) {
    if (candidateCode && current.code === candidateCode) {
      throw new AccountingInvariantError(
        'ACCOUNT_HIERARCHY_CYCLE',
        'No se puede asignar una cuenta como subcuenta de sí misma o de sus descendientes.'
      );
    }
    depth += 1;
    current = current.parentCode ? byCode.get(current.parentCode) : undefined;
  }

  assertAccountingInvariant(
    depth <= SAFETY_BOUNDS.MAX_ACCOUNT_LEVEL,
    'MAX_ACCOUNT_DEPTH_EXCEEDED',
    `El catálogo no permite más de ${SAFETY_BOUNDS.MAX_ACCOUNT_LEVEL} niveles de profundidad.`
  );

  return { level: depth };
}
