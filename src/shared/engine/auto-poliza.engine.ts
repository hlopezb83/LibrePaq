import type { Account, CfdiDocument } from '../types';
import {
  assertAccountingInvariant,
  fromCents,
  sumCents,
  toCents
} from './invariants-and-math';
import {
  buildCreditNoteEgresoMovements,
  buildPaymentRepMovements,
  buildPayrollNominaMovements,
  buildStandardIngresoMovements
} from './auto-poliza-rules';
import {
  resolveFiscalAccount,
  inferExpenseAccountForCfdi
} from './auto-poliza-account-resolver';
import type {
  AutoPolizaMovementDraft,
  AutoPolizaOverrides,
  AutoPolizaPlan
} from './auto-poliza-types';

export type { AutoPolizaMovementDraft, AutoPolizaOverrides, AutoPolizaPlan };
export { resolveFiscalAccount, inferExpenseAccountForCfdi };


/**
 * NASA Power of 10 - Reglas 1, 4, 5, 8 y 9 (H-01, H-03, H-04):
 * Motor único y determinista de generación de pólizas desde un CFDI 4.0.
 * Consumido tanto por el Backend como por las previsualizaciones de UI.
 */
export function buildAutoPolizaPlan(
  cfdi: CfdiDocument,
  accounts: readonly Account[],
  overrides?: AutoPolizaOverrides
): AutoPolizaPlan {
  assertAccountingInvariant(
    Boolean(cfdi && cfdi.uuid),
    'INVALID_CFDI',
    'El comprobante CFDI es inválido o carece de UUID.'
  );
  assertAccountingInvariant(
    cfdi.statusSat !== 'CANCELADO',
    'CFDI_CANCELADO',
    'No es posible contabilizar un CFDI con estatus CANCELADO ante el SAT.'
  );
  assertAccountingInvariant(
    cfdi.tipoComprobante !== 'T',
    'CFDI_TRASLADO',
    'Los CFDI de Traslado (Tipo T / Carta Porte) tienen importe cero y no generan asiento contable.'
  );
  assertAccountingInvariant(
    accounts.length > 0,
    'EMPTY_ACCOUNTS',
    'No existen cuentas en el catálogo para generar la póliza.'
  );

  const effectiveOverrides: AutoPolizaOverrides | undefined = overrides?.thirdParty
    ? {
        ...overrides,
        operationAccountCode:
          overrides.operationAccountCode ??
          overrides.expenseOrIncomeAccountId ??
          overrides.thirdParty.cuentaOperacionCode,
        counterAccountCode:
          overrides.counterAccountCode ??
          overrides.bankOrCounterpartyAccountId ??
          (cfdi.metodoPago === 'PPD'
            ? overrides.thirdParty.cuentaContrapartidaCode
            : undefined)
      }
    : overrides;

  const built =
    cfdi.tipoComprobante === 'P'
      ? buildPaymentRepMovements(cfdi, accounts, effectiveOverrides)
      : cfdi.tipoComprobante === 'N'
        ? buildPayrollNominaMovements(cfdi, accounts, effectiveOverrides)
        : cfdi.tipoComprobante === 'E'
          ? buildCreditNoteEgresoMovements(cfdi, accounts, effectiveOverrides)
          : buildStandardIngresoMovements(cfdi, accounts, effectiveOverrides);

  const totalCargoCents = sumCents(built.movements.map((m) => m.cargo));
  const totalAbonoCents = sumCents(built.movements.map((m) => m.abono));

  // Ajuste de redondeo fiscal (1..5 centavos MXN o equivalente cambiario de $0.02 divisa extranjera)
  // Se aplica preferentemente sobre la partida de resultados (4xx/5xx/6xx/7xx) para no alterar Bancos/Clientes
  const diffCents = totalCargoCents - totalAbonoCents;
  const isForeign =
    Boolean(cfdi.moneda && cfdi.moneda.toUpperCase() !== 'MXN') && (cfdi.tipoCambio || 1) > 1;
  const maxRoundingCents = isForeign ? Math.max(5, Math.ceil((cfdi.tipoCambio || 1) * 2)) : 5;
  if (diffCents !== 0 && Math.abs(diffCents) <= maxRoundingCents && built.movements.length > 0) {
    const resultLine =
      built.movements.find((m) => /^[4567]/.test(m.accountCode)) ?? built.movements[0];
    if (resultLine) {
      if (resultLine.cargo > 0 && toCents(resultLine.cargo) > diffCents) {
        resultLine.cargo = fromCents(toCents(resultLine.cargo) - diffCents);
      } else if (resultLine.abono > 0 && toCents(resultLine.abono) + diffCents > 0) {
        resultLine.abono = fromCents(toCents(resultLine.abono) + diffCents);
      }
    }
  }

  const finalCargoCents = sumCents(built.movements.map((m) => m.cargo));
  const finalAbonoCents = sumCents(built.movements.map((m) => m.abono));

  return {
    polizaType: built.polizaType,
    polizaConcept: built.polizaConcept,
    movements: built.movements,
    totalCargo: fromCents(finalCargoCents),
    totalAbono: fromCents(finalAbonoCents),
    isBalanced: finalCargoCents > 0 && finalCargoCents === finalAbonoCents
  };
}
