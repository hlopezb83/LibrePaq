import type { Account, CfdiDocument, PolizaType } from '../types';
import { extractNominaOtrosPagos } from '../cfdi-xml';
import { fromCents, toCents } from './invariants-and-math';
import type { AutoPolizaMovementDraft, AutoPolizaOverrides } from './auto-poliza-types';
import { inferExpenseAccountForCfdi, resolveFiscalAccount } from './auto-poliza-account-resolver';

export function makeDraft(
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

export function toMxnCents(amount: number, cfdi: CfdiDocument): number {
  const rate =
    cfdi.moneda && cfdi.moneda.toUpperCase() !== 'MXN' && cfdi.tipoCambio && cfdi.tipoCambio > 0
      ? cfdi.tipoCambio
      : 1;
  return Math.round(toCents(amount) * rate);
}

export function buildPaymentRepMovements(
  cfdi: CfdiDocument,
  accounts: readonly Account[],
  overrides?: AutoPolizaOverrides
): { polizaType: PolizaType; polizaConcept: string; movements: AutoPolizaMovementDraft[] } {
  const esRecibido = cfdi.direction === 'RECIBIDO';
  const ref = `${cfdi.serie}-${cfdi.folio}`;
  const totalCents = toMxnCents(cfdi.total, cfdi);
  const ivaCents = toMxnCents(cfdi.ivaTrasladado, cfdi);
  const counterOverride = overrides?.counterAccountCode ?? overrides?.bankOrCounterpartyAccountId;
  const opOverride = overrides?.operationAccountCode ?? overrides?.expenseOrIncomeAccountId;

  const accBancos = resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL', counterOverride);
  const movements: AutoPolizaMovementDraft[] = [];

  if (esRecibido) {
    const accProveedores = resolveFiscalAccount(accounts, 'PROVEEDORES_NACIONALES', opOverride);
    const accIvaPagado = resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO');
    const accIvaPorAcreditar = resolveFiscalAccount(accounts, 'IVA_PENDIENTE_PAGO');

    movements.push(
      makeDraft(accProveedores, ref, totalCents, 0, `Liquidación a proveedor REP ${ref} - ${cfdi.emisorNombre}`),
      makeDraft(accBancos, ref, 0, totalCents, `Pago bancario REP ${ref}`)
    );
    if (ivaCents > 0) {
      movements.push(
        makeDraft(accIvaPagado, ref, ivaCents, 0, `IVA Efectivamente Pagado REP ${ref}`),
        makeDraft(accIvaPorAcreditar, ref, 0, ivaCents, `Reclasificación IVA Pendiente REP ${ref}`)
      );
    }
    return {
      polizaType: overrides?.polizaType ?? 'EGRESO',
      polizaConcept: `Complemento de Pago ${ref} - ${cfdi.emisorNombre}`,
      movements
    };
  }

  const accClientes = resolveFiscalAccount(accounts, 'CLIENTES_NACIONALES', opOverride);
  const accIvaTrasCobrado = resolveFiscalAccount(accounts, 'IVA_TRASLADADO_COBRADO');
  const accIvaTrasNoCobrado = resolveFiscalAccount(accounts, 'IVA_TRASLADADO_NO_COBRADO');

  movements.push(
    makeDraft(accBancos, ref, totalCents, 0, `Cobro REP ${ref} - ${cfdi.receptorNombre}`),
    makeDraft(accClientes, ref, 0, totalCents, `Liquidación factura PPD (${cfdi.uuidRelacionado || ref})`)
  );
  if (ivaCents > 0) {
    movements.push(
      makeDraft(accIvaTrasNoCobrado, ref, ivaCents, 0, `Cancelación IVA Pendiente por cobro REP ${ref}`),
      makeDraft(accIvaTrasCobrado, ref, 0, ivaCents, `IVA Efectivamente Cobrado REP ${ref}`)
    );
  }
  return {
    polizaType: overrides?.polizaType ?? 'INGRESO',
    polizaConcept: `Complemento de Pago ${ref} - ${cfdi.receptorNombre}`,
    movements
  };
}

export function buildPayrollNominaMovements(
  cfdi: CfdiDocument,
  accounts: readonly Account[],
  overrides?: AutoPolizaOverrides
): { polizaType: PolizaType; polizaConcept: string; movements: AutoPolizaMovementDraft[] } {
  const ref = `${cfdi.serie}-${cfdi.folio}`;
  const opOverride = overrides?.operationAccountCode ?? overrides?.expenseOrIncomeAccountId;
  const counterOverride = overrides?.counterAccountCode ?? overrides?.bankOrCounterpartyAccountId;

  const accSueldos = resolveFiscalAccount(accounts, 'SUELDOS_Y_SALARIOS', opOverride);
  const accBancos = resolveFiscalAccount(accounts, 'BANCO_SECUNDARIO', counterOverride);
  const accIsrRetPorPagar = resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');

  const subtotalCents = toMxnCents(cfdi.subtotal, cfdi);
  const rawOtrosPagos = extractNominaOtrosPagos(cfdi.xmlRaw);
  const otrosPagosCents = Math.min(subtotalCents, toMxnCents(rawOtrosPagos, cfdi));
  const sueldosGravadosCents = Math.max(0, subtotalCents - otrosPagosCents);

  const isrCents = toMxnCents(cfdi.isrRetenido, cfdi);
  const imssDescuentoCents = toMxnCents(cfdi.descuento, cfdi);
  let totalCents = toMxnCents(cfdi.total, cfdi);

  const cargosTotal = sueldosGravadosCents + otrosPagosCents;
  const abonosTotal = isrCents + imssDescuentoCents + totalCents;
  if (cargosTotal !== abonosTotal) {
    totalCents += cargosTotal - abonosTotal;
  }

  const movements: AutoPolizaMovementDraft[] = [];
  if (sueldosGravadosCents > 0) {
    movements.push(makeDraft(accSueldos, ref, sueldosGravadosCents, 0, cfdi.conceptoPrincipal));
  }
  if (otrosPagosCents > 0) {
    const accSubsidio = resolveFiscalAccount(accounts, 'ISR_ACREDITABLE_RETENIDO');
    movements.push(
      makeDraft(accSubsidio, ref, otrosPagosCents, 0, `Subsidio al Empleo / Otros Pagos Nómina ${ref}`)
    );
  }
  if (isrCents > 0) {
    movements.push(
      makeDraft(accIsrRetPorPagar, ref, 0, isrCents, `Retenciones ISR Nómina ${ref}`)
    );
  }
  if (imssDescuentoCents > 0) {
    const accOtrasRet = resolveFiscalAccount(accounts, 'OTRAS_CUENTAS_POR_PAGAR');
    movements.push(
      makeDraft(accOtrasRet, ref, 0, imssDescuentoCents, `Cuotas Obreras IMSS / Descuentos ${ref}`)
    );
  }
  movements.push(
    makeDraft(accBancos, ref, 0, totalCents, `Pago neto nómina ${ref} - ${cfdi.receptorNombre}`)
  );

  return {
    polizaType: overrides?.polizaType ?? 'EGRESO',
    polizaConcept: `Nómina ${ref} - ${cfdi.receptorNombre}`,
    movements
  };
}

export function buildCreditNoteEgresoMovements(
  cfdi: CfdiDocument,
  accounts: readonly Account[],
  overrides?: AutoPolizaOverrides
): { polizaType: PolizaType; polizaConcept: string; movements: AutoPolizaMovementDraft[] } {
  const esRecibido = cfdi.direction === 'RECIBIDO';
  const esPagado = cfdi.metodoPago === 'PUE';
  const ref = `${cfdi.serie}-${cfdi.folio}`;
  const subtotalNetoCents = toMxnCents(cfdi.subtotal, cfdi) - toMxnCents(cfdi.descuento, cfdi);
  const ivaCents = toMxnCents(cfdi.ivaTrasladado, cfdi);
  const isrRetCents = toMxnCents(cfdi.isrRetenido, cfdi);
  const ivaRetCents = toMxnCents(cfdi.ivaRetenido, cfdi);
  const totalCents = toMxnCents(cfdi.total, cfdi);
  const opOverride = overrides?.operationAccountCode ?? overrides?.expenseOrIncomeAccountId;
  const counterOverride = overrides?.counterAccountCode ?? overrides?.bankOrCounterpartyAccountId;
  const movements: AutoPolizaMovementDraft[] = [];

  if (esRecibido) {
    const accGasto = inferExpenseAccountForCfdi(cfdi, accounts, opOverride);
    const accContrapartida = counterOverride
      ? resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL', counterOverride)
      : resolveFiscalAccount(accounts, 'PROVEEDORES_NACIONALES');
    const accIva = esPagado
      ? resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO')
      : resolveFiscalAccount(accounts, 'IVA_PENDIENTE_PAGO');

    movements.push(
      makeDraft(accContrapartida, ref, totalCents, 0, `Nota de Crédito proveedor ${cfdi.emisorNombre}`)
    );
    if (isrRetCents > 0) {
      const accIsrRet = resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');
      movements.push(makeDraft(accIsrRet, ref, isrRetCents, 0, `Reverso Retención ISR Nota Crédito ${ref}`));
    }
    if (ivaRetCents > 0) {
      const accIvaRet = resolveFiscalAccount(accounts, 'IVA_RETENIDO_POR_PAGAR');
      movements.push(makeDraft(accIvaRet, ref, ivaRetCents, 0, `Reverso Retención IVA Nota Crédito ${ref}`));
    }
    movements.push(
      makeDraft(accGasto, ref, 0, subtotalNetoCents, `Bonificación s/gasto: ${cfdi.conceptoPrincipal}`)
    );
    if (ivaCents > 0) {
      movements.push(
        makeDraft(accIva, ref, 0, ivaCents, `Disminución IVA acreditable Nota de Crédito ${ref}`)
      );
    }
    return {
      polizaType: overrides?.polizaType ?? 'DIARIO',
      polizaConcept: `Nota de Crédito Recibida ${ref} - ${cfdi.emisorNombre}`,
      movements
    };
  }

  const accDevoluciones = resolveFiscalAccount(accounts, 'DEVOLUCIONES_DESCUENTOS', opOverride);
  const accContrapartida = counterOverride
    ? resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL', counterOverride)
    : resolveFiscalAccount(accounts, 'CLIENTES_NACIONALES');
  const accIva = esPagado
    ? resolveFiscalAccount(accounts, 'IVA_TRASLADADO_COBRADO')
    : resolveFiscalAccount(accounts, 'IVA_TRASLADADO_NO_COBRADO');

  movements.push(
    makeDraft(accDevoluciones, ref, subtotalNetoCents, 0, `Nota de Crédito: ${cfdi.conceptoPrincipal}`)
  );
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
  const esRecibido = cfdi.direction === 'RECIBIDO';
  const esPagado = cfdi.metodoPago === 'PUE';
  const ref = `${cfdi.serie}-${cfdi.folio}`;
  const subtotalNetoCents = toMxnCents(cfdi.subtotal, cfdi) - toMxnCents(cfdi.descuento, cfdi);
  const ivaCents = toMxnCents(cfdi.ivaTrasladado, cfdi);
  const isrRetCents = toMxnCents(cfdi.isrRetenido, cfdi);
  const ivaRetCents = toMxnCents(cfdi.ivaRetenido, cfdi);
  const totalCents = toMxnCents(cfdi.total, cfdi);
  const opOverride = overrides?.operationAccountCode ?? overrides?.expenseOrIncomeAccountId;
  const counterOverride = overrides?.counterAccountCode ?? overrides?.bankOrCounterpartyAccountId;
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

    movements.push(makeDraft(accGasto, ref, subtotalNetoCents, 0, cfdi.conceptoPrincipal));
    if (ivaCents > 0) {
      movements.push(makeDraft(accIva, ref, ivaCents, 0, `IVA Acreditable 16% ${ref}`));
    }
    if (isrRetCents > 0) {
      const accIsrRet = resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');
      movements.push(makeDraft(accIsrRet, ref, 0, isrRetCents, `Retención ISR ${ref} (${cfdi.emisorRfc})`));
    }
    if (ivaRetCents > 0) {
      const accIvaRet = resolveFiscalAccount(accounts, 'IVA_RETENIDO_POR_PAGAR');
      movements.push(makeDraft(accIvaRet, ref, 0, ivaRetCents, `Retención IVA ${ref} (${cfdi.emisorRfc})`));
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
  movements.push(makeDraft(accIngreso, ref, 0, subtotalNetoCents, cfdi.conceptoPrincipal));
  if (ivaCents > 0) {
    movements.push(makeDraft(accIva, ref, 0, ivaCents, `IVA 16% ${ref}`));
  }

  return {
    polizaType: overrides?.polizaType ?? (esPagado ? 'INGRESO' : 'DIARIO'),
    polizaConcept: `Ingreso CFDI ${ref} - ${cfdi.receptorNombre}`,
    movements
  };
}
