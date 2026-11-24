import type { Account, CfdiDocument, PolizaType } from '../types';
import type { AutoPolizaMovementDraft, AutoPolizaOverrides } from './auto-poliza-types';
import { inferExpenseAccountForCfdi, resolveFiscalAccount } from './auto-poliza-account-resolver';
import { appendRecibidoDeductibleMovements } from './auto-poliza-deductible';
import { buildPayrollNominaMovements } from './auto-poliza-nomina';
import {
  buildPaymentRepMovements,
  computeNonIvaTaxCents,
  extractCfdiRuleContext,
  makeDraft,
  resolveLocalTaxLiabilityAccount,
  resolvePendingIsrRetentionAccount,
  resolvePendingIvaRetentionAccount,
  resolveRecibidoIsrRetentionAccount,
  toMxnCents
} from './auto-poliza-helpers';

export { buildPaymentRepMovements, buildPayrollNominaMovements, computeNonIvaTaxCents, makeDraft, toMxnCents };

export function buildCreditNoteEgresoMovements(
  cfdi: CfdiDocument,
  accounts: readonly Account[],
  overrides?: AutoPolizaOverrides
): { polizaType: PolizaType; polizaConcept: string; movements: AutoPolizaMovementDraft[] } {
  const {
    esRecibido, esPagado, ref, ivaCents, isrRetCents, ivaRetCents, totalCents,
    localRetenidoCents, iepsCents, localTrasladadoCents,
    effectiveSubtotalCents, emitidaSubtotalCents, opOverride, counterOverride
  } = extractCfdiRuleContext(cfdi, overrides);
  const movements: AutoPolizaMovementDraft[] = [];

  if (esRecibido) {
    const accGasto = inferExpenseAccountForCfdi(cfdi, accounts, opOverride);
    const accContrapartida = counterOverride
      ? resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL', counterOverride)
      : esPagado
        ? resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL')
        : resolveFiscalAccount(accounts, 'PROVEEDORES_NACIONALES');
    const accIva = esPagado
      ? resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO')
      : resolveFiscalAccount(accounts, 'IVA_PENDIENTE_PAGO');

    movements.push(
      makeDraft(accContrapartida, ref, totalCents, 0, `Nota de Crédito proveedor ${cfdi.emisorNombre}`)
    );
    if (isrRetCents > 0) {
      const accIsrRet = esPagado
        ? resolveRecibidoIsrRetentionAccount(cfdi, accounts)
        : resolvePendingIsrRetentionAccount(cfdi, accounts);
      movements.push(makeDraft(accIsrRet, ref, isrRetCents, 0, `Reverso Retención ISR Nota Crédito ${ref}`));
    }
    if (ivaRetCents > 0) {
      const accIvaRet = esPagado
        ? resolveFiscalAccount(accounts, 'IVA_RETENIDO_POR_PAGAR')
        : resolvePendingIvaRetentionAccount(accounts);
      movements.push(makeDraft(accIvaRet, ref, ivaRetCents, 0, `Reverso Retención IVA Nota Crédito ${ref}`));
    }
    if (localRetenidoCents > 0) {
      const accLocalRet = resolveLocalTaxLiabilityAccount(accounts);
      movements.push(makeDraft(accLocalRet, ref, localRetenidoCents, 0, `Reverso Retención Local Nota Crédito ${ref}`));
    }
    appendRecibidoDeductibleMovements({
      movements,
      accounts,
      accGasto,
      accIva,
      ref,
      conceptoPrincipal: cfdi.conceptoPrincipal,
      subtotalCents: effectiveSubtotalCents,
      ivaCents,
      deductiblePct: overrides?.deductiblePct,
      isCreditNoteReversal: true
    });
    return {
      polizaType: overrides?.polizaType ?? 'DIARIO',
      polizaConcept: `Nota de Crédito Recibida ${ref} - ${cfdi.emisorNombre}`,
      movements
    };
  }

  const accDevoluciones = resolveFiscalAccount(accounts, 'DEVOLUCIONES_DESCUENTOS', opOverride);
  const accContrapartida = counterOverride
    ? resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL', counterOverride)
    : esPagado
      ? resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL')
      : resolveFiscalAccount(accounts, 'CLIENTES_NACIONALES');
  const accIva = esPagado
    ? resolveFiscalAccount(accounts, 'IVA_TRASLADADO_COBRADO')
    : resolveFiscalAccount(accounts, 'IVA_TRASLADADO_NO_COBRADO');

  movements.push(
    makeDraft(accDevoluciones, ref, emitidaSubtotalCents, 0, `Nota de Crédito: ${cfdi.conceptoPrincipal}`)
  );
  if (iepsCents > 0) {
    const accIeps = esPagado
      ? resolveFiscalAccount(accounts, 'IEPS_TRASLADADO_COBRADO')
      : resolveFiscalAccount(accounts, 'IEPS_TRASLADADO_NO_COBRADO');
    movements.push(makeDraft(accIeps, ref, iepsCents, 0, `Ajuste IEPS Trasladado Nota de Crédito ${ref}`));
  }
  if (localTrasladadoCents > 0) {
    const accLocalTras = resolveLocalTaxLiabilityAccount(accounts);
    movements.push(makeDraft(accLocalTras, ref, localTrasladadoCents, 0, `Ajuste Impuesto Local Trasladado NC ${ref}`));
  }
  if (ivaCents > 0) {
    movements.push(makeDraft(accIva, ref, ivaCents, 0, `Ajuste IVA Trasladado Nota de Crédito ${ref}`));
  }
  if (isrRetCents > 0) {
    const accIsrRet = resolveFiscalAccount(accounts, 'ISR_ACREDITABLE_RETENIDO');
    movements.push(makeDraft(accIsrRet, ref, 0, isrRetCents, `Ajuste Retención ISR Nota Crédito ${ref}`));
  }
  if (ivaRetCents > 0) {
    const accIvaRet = resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_RETENIDO');
    movements.push(makeDraft(accIvaRet, ref, 0, ivaRetCents, `Ajuste Retención IVA Nota Crédito ${ref}`));
  }
  if (localRetenidoCents > 0) {
    const accLocalRet = resolveFiscalAccount(accounts, 'ISR_ACREDITABLE_RETENIDO');
    movements.push(makeDraft(accLocalRet, ref, 0, localRetenidoCents, `Ajuste Retención Local Nota Crédito ${ref}`));
  }
  movements.push(
    makeDraft(accContrapartida, ref, 0, totalCents, `Aplicación Nota de Crédito a ${cfdi.receptorNombre}`)
  );

  return {
    polizaType: overrides?.polizaType ?? 'DIARIO',
    polizaConcept: `Nota de Crédito Emitida ${ref} - ${cfdi.receptorNombre}`,
    movements
  };
}

export function buildStandardIngresoMovements(
  cfdi: CfdiDocument,
  accounts: readonly Account[],
  overrides?: AutoPolizaOverrides
): { polizaType: PolizaType; polizaConcept: string; movements: AutoPolizaMovementDraft[] } {
  const {
    esRecibido, esPagado, ref, ivaCents, isrRetCents, ivaRetCents, totalCents,
    localRetenidoCents, iepsCents, localTrasladadoCents,
    effectiveSubtotalCents, emitidaSubtotalCents, opOverride, counterOverride
  } = extractCfdiRuleContext(cfdi, overrides);
  const movements: AutoPolizaMovementDraft[] = [];

  if (esRecibido) {
    const accGasto = inferExpenseAccountForCfdi(cfdi, accounts, opOverride);
    const accContrapartida = counterOverride
      ? resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL', counterOverride)
      : esPagado
        ? resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL')
        : resolveFiscalAccount(accounts, 'PROVEEDORES_NACIONALES');
    const accIva = esPagado
      ? resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO')
      : resolveFiscalAccount(accounts, 'IVA_PENDIENTE_PAGO');

    appendRecibidoDeductibleMovements({
      movements,
      accounts,
      accGasto,
      accIva,
      ref,
      conceptoPrincipal: cfdi.conceptoPrincipal,
      subtotalCents: effectiveSubtotalCents,
      ivaCents,
      deductiblePct: overrides?.deductiblePct
    });
    if (isrRetCents > 0) {
      const accIsrRet = esPagado
        ? resolveRecibidoIsrRetentionAccount(cfdi, accounts)
        : resolvePendingIsrRetentionAccount(cfdi, accounts);
      movements.push(makeDraft(accIsrRet, ref, 0, isrRetCents, `Retención ISR ${ref} (${cfdi.emisorRfc})`));
    }
    if (ivaRetCents > 0) {
      const accIvaRet = esPagado
        ? resolveFiscalAccount(accounts, 'IVA_RETENIDO_POR_PAGAR')
        : resolvePendingIvaRetentionAccount(accounts);
      movements.push(makeDraft(accIvaRet, ref, 0, ivaRetCents, `Retención IVA ${ref} (${cfdi.emisorRfc})`));
    }
    if (localRetenidoCents > 0) {
      const accLocalRet = resolveLocalTaxLiabilityAccount(accounts);
      movements.push(makeDraft(accLocalRet, ref, 0, localRetenidoCents, `Retención Impuesto Local ${ref} (${cfdi.emisorRfc})`));
    }
    movements.push(
      makeDraft(
        accContrapartida,
        ref,
        0,
        totalCents,
        `${esPagado ? 'Pago' : 'Provisión'} ${ref} - ${cfdi.emisorNombre}`
      )
    );
    return {
      polizaType: overrides?.polizaType ?? (esPagado ? 'EGRESO' : 'DIARIO'),
      polizaConcept: `Gasto CFDI ${ref} - ${cfdi.emisorNombre}`,
      movements
    };
  }

  const accIngreso = resolveFiscalAccount(accounts, 'INGRESOS_TASA_16', opOverride);
  const accContrapartida = counterOverride
    ? resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL', counterOverride)
    : esPagado
      ? resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL')
      : resolveFiscalAccount(accounts, 'CLIENTES_NACIONALES');
  const accIva = esPagado
    ? resolveFiscalAccount(accounts, 'IVA_TRASLADADO_COBRADO')
    : resolveFiscalAccount(accounts, 'IVA_TRASLADADO_NO_COBRADO');

  movements.push(
    makeDraft(
      accContrapartida,
      ref,
      totalCents,
      0,
      `${esPagado ? 'Cobro' : 'Provisión'} ${ref} - ${cfdi.receptorNombre}`
    )
  );
  if (isrRetCents > 0) {
    const accIsrRet = resolveFiscalAccount(accounts, 'ISR_ACREDITABLE_RETENIDO');
    movements.push(makeDraft(accIsrRet, ref, isrRetCents, 0, `Retención ISR clientes ${ref}`));
  }
  if (ivaRetCents > 0) {
    const accIvaRet = resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_RETENIDO');
    movements.push(makeDraft(accIvaRet, ref, ivaRetCents, 0, `Retención IVA clientes ${ref}`));
  }
  if (localRetenidoCents > 0) {
    const accLocalRet = resolveFiscalAccount(accounts, 'ISR_ACREDITABLE_RETENIDO');
    movements.push(makeDraft(accLocalRet, ref, localRetenidoCents, 0, `Retención Impuesto Local clientes ${ref}`));
  }
  movements.push(makeDraft(accIngreso, ref, 0, emitidaSubtotalCents, cfdi.conceptoPrincipal));
  if (iepsCents > 0) {
    const accIeps = esPagado
      ? resolveFiscalAccount(accounts, 'IEPS_TRASLADADO_COBRADO')
      : resolveFiscalAccount(accounts, 'IEPS_TRASLADADO_NO_COBRADO');
    movements.push(makeDraft(accIeps, ref, 0, iepsCents, `IEPS Trasladado ${ref}`));
  }
  if (localTrasladadoCents > 0) {
    const accLocalTras = resolveLocalTaxLiabilityAccount(accounts);
    movements.push(makeDraft(accLocalTras, ref, 0, localTrasladadoCents, `Impuesto Local Trasladado ${ref}`));
  }
  if (ivaCents > 0) {
    movements.push(makeDraft(accIva, ref, 0, ivaCents, `IVA 16% ${ref}`));
  }

  return {
    polizaType: overrides?.polizaType ?? (esPagado ? 'INGRESO' : 'DIARIO'),
    polizaConcept: `Ingreso CFDI ${ref} - ${cfdi.receptorNombre}`,
    movements
  };
}
