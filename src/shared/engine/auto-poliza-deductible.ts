import type { Account } from '../types';
import { resolveNonDeductibleAccount } from './auto-poliza-account-resolver';
import type { AutoPolizaMovementDraft } from './auto-poliza-types';
import { fromCents } from './invariants-and-math';

function createDraft(
  acc: Account,
  referencia: string,
  cargoCents: number,
  abonoCents: number,
  concepto: string
): AutoPolizaMovementDraft {
  return {
    accountId: acc.id,
    accountCode: acc.code,
    accountName: acc.name,
    referencia,
    cargo: fromCents(cargoCents),
    abono: fromCents(abonoCents),
    concepto
  };
}

export function clampDeductiblePct(pct?: number): number {
  if (pct === undefined || pct === null || !Number.isFinite(pct)) return 100;
  return Math.max(0, Math.min(100, Number(pct)));
}

/**
 * Divide un gasto RECIBIDO y su IVA acreditable según `deductiblePct` (0..100).
 * La fracción no deducible (subtotal + IVA no acreditable) se asigna a la cuenta 801
 * manteniendo cierre exacto al centavo (Debe = Haber).
 */
export function appendRecibidoDeductibleMovements(params: {
  movements: AutoPolizaMovementDraft[];
  accounts: readonly Account[];
  accGasto: Account;
  accIva: Account;
  ref: string;
  conceptoPrincipal: string;
  subtotalCents: number;
  ivaCents: number;
  deductiblePct?: number;
  isCreditNoteReversal?: boolean;
}): void {
  const {
    movements,
    accounts,
    accGasto,
    accIva,
    ref,
    conceptoPrincipal,
    subtotalCents,
    ivaCents,
    isCreditNoteReversal = false
  } = params;

  const pct = clampDeductiblePct(params.deductiblePct);
  const pushSide = (acc: Account, cents: number, concepto: string) => {
    if (cents <= 0) return;
    movements.push(
      isCreditNoteReversal
        ? createDraft(acc, ref, 0, cents, concepto)
        : createDraft(acc, ref, cents, 0, concepto)
    );
  };

  if (pct >= 100) {
    pushSide(
      accGasto,
      subtotalCents,
      isCreditNoteReversal ? `Bonificación s/gasto: ${conceptoPrincipal}` : conceptoPrincipal
    );
    pushSide(
      accIva,
      ivaCents,
      isCreditNoteReversal
        ? `Disminución IVA acreditable Nota de Crédito ${ref}`
        : `IVA Acreditable 16% ${ref}`
    );
    return;
  }

  const accNoDeducible = resolveNonDeductibleAccount(accounts);
  const nonPct = Number((100 - pct).toFixed(2));
  const deductibleSubCents = Math.round((subtotalCents * pct) / 100);
  const nonDeductibleSubCents = subtotalCents - deductibleSubCents;
  const deductibleIvaCents = Math.round((ivaCents * pct) / 100);
  const nonDeductibleIvaCents = ivaCents - deductibleIvaCents;

  pushSide(accGasto, deductibleSubCents, `${conceptoPrincipal} (Deducible ${pct}%)`);
  pushSide(accNoDeducible, nonDeductibleSubCents, `Gasto No Deducible (${nonPct}%): ${conceptoPrincipal}`);
  pushSide(accIva, deductibleIvaCents, `IVA Acreditable (${pct}%) ${ref}`);
  pushSide(accNoDeducible, nonDeductibleIvaCents, `IVA No Acreditable (${nonPct}%) ${ref}`);
}
