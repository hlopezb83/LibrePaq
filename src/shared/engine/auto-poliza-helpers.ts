import type { Account, CfdiDocument, PolizaType } from '../types';
import { resolveFiscalAccount } from './auto-poliza-account-resolver';
import type { AutoPolizaMovementDraft, AutoPolizaOverrides } from './auto-poliza-types';
import { fromCents, toCents } from './invariants-and-math';

/**
 * Construye una línea de póliza de auto-contabilización en centavos exactos.
 */
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

/**
 * Convierte un importe en la moneda del CFDI a centavos de MXN usando tipoCambio.
 */
export function toMxnCents(amount: number, cfdi: CfdiDocument): number {
  const rate =
    cfdi.moneda && cfdi.moneda.toUpperCase() !== 'MXN' && cfdi.tipoCambio && cfdi.tipoCambio > 0
      ? cfdi.tipoCambio
      : 1;
  return Math.round(toCents(amount) * rate);
}

export function extractCfdiRuleContext(cfdi: CfdiDocument, overrides?: AutoPolizaOverrides) {
  const subtotalNetoCents = toMxnCents(cfdi.subtotal, cfdi) - toMxnCents(cfdi.descuento, cfdi);
  const ivaCents = toMxnCents(cfdi.ivaTrasladado, cfdi);
  const isrRetCents = toMxnCents(cfdi.isrRetenido, cfdi);
  const ivaRetCents = toMxnCents(cfdi.ivaRetenido, cfdi);
  const totalCents = toMxnCents(cfdi.total, cfdi);
  const { localTrasladadoCents: explicitLocalTrasCents, localRetenidoCents } =
    extractLocalTaxCents(cfdi);
  const nonIvaTaxCents = computeNonIvaTaxCents(
    cfdi, subtotalNetoCents, ivaCents, isrRetCents, ivaRetCents, totalCents, localRetenidoCents
  );
  const explicitIepsCents = cfdi.taxBreakdown?.ieps
    ? Math.max(0, toMxnCents(cfdi.taxBreakdown.ieps, cfdi))
    : 0;
  const iepsCents = Math.min(nonIvaTaxCents, explicitIepsCents);
  const localTrasladadoCents = Math.min(nonIvaTaxCents - iepsCents, explicitLocalTrasCents);
  return {
    esRecibido: cfdi.direction === 'RECIBIDO',
    esPagado: cfdi.metodoPago === 'PUE',
    ref: `${cfdi.serie}-${cfdi.folio}`,
    ivaCents,
    isrRetCents,
    ivaRetCents,
    totalCents,
    localRetenidoCents,
    iepsCents,
    localTrasladadoCents,
    effectiveSubtotalCents: subtotalNetoCents + nonIvaTaxCents,
    emitidaSubtotalCents: subtotalNetoCents + (nonIvaTaxCents - iepsCents - localTrasladadoCents),
    opOverride: overrides?.operationAccountCode ?? overrides?.expenseOrIncomeAccountId,
    counterOverride: overrides?.counterAccountCode ?? overrides?.bankOrCounterpartyAccountId
  };
}

export function extractLocalTaxCents(cfdi: CfdiDocument): {
  localTrasladadoCents: number;
  localRetenidoCents: number;
} {
  const tb = cfdi.taxBreakdown as
    | { localTrasladado?: number; localRetenido?: number }
    | null
    | undefined;
  return {
    localTrasladadoCents: tb?.localTrasladado ? Math.max(0, toMxnCents(tb.localTrasladado, cfdi)) : 0,
    localRetenidoCents: tb?.localRetenido ? Math.max(0, toMxnCents(tb.localRetenido, cfdi)) : 0
  };
}

export function resolveLocalTaxLiabilityAccount(accounts: readonly Account[]): Account {
  const preferred = accounts.find(
    (a) =>
      a.isAffectable &&
      (a.code === '213-01-003' ||
        a.code === '213-02-001' ||
        a.satGroupCode === '213.09' ||
        (a.code.startsWith('213-') && /local|estatal|ish|hospedaje/i.test(a.name)))
  );
  if (preferred) return preferred;
  const any213 = accounts.find((a) => a.isAffectable && a.code.startsWith('213-'));
  return any213 ?? resolveFiscalAccount(accounts, 'PROVISION_IVA_POR_PAGAR');
}

export function resolveRecibidoIsrRetentionAccount(
  cfdi: CfdiDocument,
  accounts: readonly Account[]
): Account {
  const findByCodeOrSat = (code: string, sat: string): Account | undefined =>
    accounts.find((a) => a.isAffectable && a.code === code) ??
    accounts.find((a) => a.isAffectable && a.satGroupCode === sat);

  const netSub = Math.max(0, cfdi.subtotal - (cfdi.descuento || 0));
  const rate = netSub > 0 ? cfdi.isrRetenido / netSub : 0;
  const text = `${cfdi.conceptoPrincipal} ${cfdi.emisorNombre}`.toLowerCase();
  const clave = (cfdi.claveProdServ || '').trim();
  const uso = (cfdi.usoCfdi || '').trim().toUpperCase();

  if (Math.abs(rate - 0.0125) < 0.0025 || /resico|r[eé]gimen simplificado/i.test(text)) {
    return findByCodeOrSat('216-01-005', '216.11') ?? resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');
  }
  if (
    /arrendamiento|renta|alquiler|inmueble|local comercial|oficina/i.test(text) ||
    clave.startsWith('801315')
  ) {
    return findByCodeOrSat('216-01-003', '216.03') ?? resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');
  }
  if (
    Math.abs(rate - 0.1) < 0.01 ||
    /honorario|servicio|profesional|consultor|asesor|contable|legal|m[eé]dic/i.test(text) ||
    /^(801|841|851)/.test(clave) ||
    uso === 'G03'
  ) {
    return findByCodeOrSat('216-01-004', '216.04') ?? resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');
  }
  return resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');
}

/**
 * Calcula impuestos trasladados distintos de IVA (IEPS desde taxBreakdown.ieps e impuestos
 * locales como ISH) sin limitar arbitrariamente IEPS legítimo elevado, para integrarlo
 * al subtotal efectivo en CFDIs Tipo I y Notas de Crédito Tipo E.
 */
export function computeNonIvaTaxCents(
  cfdi: CfdiDocument,
  subtotalNetoCents: number,
  ivaCents: number,
  isrRetCents: number,
  ivaRetCents: number,
  totalCents: number,
  localRetCents = 0
): number {
  const rawFiscalDiffCents =
    totalCents + isrRetCents + ivaRetCents + localRetCents - (subtotalNetoCents + ivaCents);
  if (rawFiscalDiffCents <= 0) return 0;

  const explicitIepsCents = cfdi.taxBreakdown?.ieps
    ? Math.max(0, toMxnCents(cfdi.taxBreakdown.ieps, cfdi))
    : 0;
  const { localTrasladadoCents } = extractLocalTaxCents(cfdi);
  const explicitTotalCents = explicitIepsCents + localTrasladadoCents;

  if (explicitTotalCents > 0) {
    return rawFiscalDiffCents >= explicitTotalCents ? rawFiscalDiffCents : explicitTotalCents;
  }

  return rawFiscalDiffCents > 5 ? rawFiscalDiffCents : 0;
}

/**
 * Resuelve la cuenta de Deudores Diversos / Empleados (107-*) con fallback a Bancos.
 */
export function resolveEmployeeReceivableAccount(
  accounts: readonly Account[],
  fallbackBank: Account
): Account {
  return (
    accounts.find(
      (a) =>
        a.isAffectable &&
        (a.code.startsWith('107-') || (a.satGroupCode ?? '').startsWith('107'))
    ) ?? fallbackBank
  );
}

function resolveRepCounterpartyMxnCents(
  cfdi: CfdiDocument,
  bankMxnCents: number,
  overrides?: AutoPolizaOverrides
): number {
  const docs = cfdi.relatedDocs;
  const headerCur = (cfdi.moneda || 'MXN').toUpperCase();
  const headerTc = headerCur !== 'MXN' && cfdi.tipoCambio > 0 ? cfdi.tipoCambio : 1;

  if (!docs || docs.length === 0) {
    if (headerCur !== 'MXN') {
      const relKey = (cfdi.uuidRelacionado || '').trim().toUpperCase();
      const origTc =
        (relKey ? overrides?.relatedOriginalTipoCambioByUuid?.[relKey] : undefined) ??
        overrides?.relatedOriginalTipoCambio;
      if (origTc && origTc > 0) return Math.round(toCents(cfdi.total) * origTc);
    }
    return bankMxnCents;
  }

  let sumCounterCents = 0;
  let hasForeignDoc = false;

  for (const dr of docs) {
    const pCur = (dr.pagoMoneda || headerCur).toUpperCase();
    const pTc =
      dr.pagoTipoCambio && dr.pagoTipoCambio > 0
        ? dr.pagoTipoCambio
        : pCur !== 'MXN'
          ? headerTc
          : 1;
    const drCur = (dr.monedaDr || pCur).toUpperCase();

    if (drCur !== 'MXN' || pCur !== 'MXN') hasForeignDoc = true;

    if (drCur === 'MXN') {
      sumCounterCents += toCents(dr.impPagado);
      continue;
    }

    const docUuid = (dr.idDocumento || '').trim().toUpperCase();
    const origTc =
      (docUuid ? overrides?.relatedOriginalTipoCambioByUuid?.[docUuid] : undefined) ??
      overrides?.relatedOriginalTipoCambio;
    if (origTc && origTc > 0) {
      sumCounterCents += Math.round(toCents(dr.impPagado) * origTc);
      continue;
    }

    if (dr.equivalenciaDr && dr.equivalenciaDr > 0 && Math.abs(dr.equivalenciaDr - 1) > 0.0001) {
      sumCounterCents += Math.round((toCents(dr.impPagado) / dr.equivalenciaDr) * pTc);
    } else if (
      dr.pagoTipoCambio &&
      dr.pagoTipoCambio > 0 &&
      headerTc > 1 &&
      Math.abs(dr.pagoTipoCambio - headerTc) > 0.0001
    ) {
      sumCounterCents += Math.round(toCents(dr.impPagado) * dr.pagoTipoCambio);
    } else {
      sumCounterCents += Math.round(toCents(dr.impPagado) * pTc);
    }
  }

  if (!hasForeignDoc || sumCounterCents <= 0) return bankMxnCents;
  if (Math.abs(bankMxnCents - sumCounterCents) <= 5) return bankMxnCents;
  return sumCounterCents;
}

/**
 * Construye los movimientos de póliza para Complementos de Pago (REP 2.0, CFDI Tipo P).
 * Calcula utilidad/pérdida cambiaria (702-01-001 / 701-01-001) sobre el principal y
 * reclasifica 209->208 / 119->118 al TC histórico para evitar saldos rojos y distorsión del 16%.
 */
export function buildPaymentRepMovements(
  cfdi: CfdiDocument,
  accounts: readonly Account[],
  overrides?: AutoPolizaOverrides
): { polizaType: PolizaType; polizaConcept: string; movements: AutoPolizaMovementDraft[] } {
  const esRecibido = cfdi.direction === 'RECIBIDO';
  const ref = `${cfdi.serie}-${cfdi.folio}`;
  const totalCents = toMxnCents(cfdi.total, cfdi);
  const counterpartyCents = resolveRepCounterpartyMxnCents(cfdi, totalCents, overrides);
  const ivaCents = toMxnCents(cfdi.ivaTrasladado, cfdi);
  const historicalIvaCents =
    ivaCents > 0 && totalCents > 0 && counterpartyCents !== totalCents
      ? Math.round(ivaCents * (counterpartyCents / totalCents))
      : ivaCents;
  const counterOverride = overrides?.counterAccountCode ?? overrides?.bankOrCounterpartyAccountId;
  const opOverride = overrides?.operationAccountCode ?? overrides?.expenseOrIncomeAccountId;

  const accBancos = resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL', counterOverride);
  const movements: AutoPolizaMovementDraft[] = [];

  if (esRecibido) {
    const accProveedores = resolveFiscalAccount(accounts, 'PROVEEDORES_NACIONALES', opOverride);
    const accIvaPagado = resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO');
    const accIvaPorAcreditar = resolveFiscalAccount(accounts, 'IVA_PENDIENTE_PAGO');

    movements.push(
      makeDraft(accProveedores, ref, counterpartyCents, 0, `Liquidación a proveedor REP ${ref} - ${cfdi.emisorNombre}`),
      makeDraft(accBancos, ref, 0, totalCents, `Pago bancario REP ${ref}`)
    );
    if (ivaCents > 0) {
      movements.push(
        makeDraft(accIvaPagado, ref, ivaCents, 0, `IVA Efectivamente Pagado REP ${ref}`),
        makeDraft(accIvaPorAcreditar, ref, 0, historicalIvaCents, `Reclasificación IVA Pendiente REP ${ref}`)
      );
    }
    const fxDiffCents = counterpartyCents + ivaCents - (totalCents + historicalIvaCents);
    if (fxDiffCents < 0) {
      const accPerdida = resolveFiscalAccount(accounts, 'PERDIDA_CAMBIARIA');
      movements.push(
        makeDraft(accPerdida, ref, Math.abs(fxDiffCents), 0, `Pérdida cambiaria realizada REP ${ref}`)
      );
    } else if (fxDiffCents > 0) {
      const accUtilidad = resolveFiscalAccount(accounts, 'UTILIDAD_CAMBIARIA');
      movements.push(
        makeDraft(accUtilidad, ref, 0, fxDiffCents, `Utilidad cambiaria realizada REP ${ref}`)
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
    makeDraft(accClientes, ref, 0, counterpartyCents, `Liquidación factura PPD (${cfdi.uuidRelacionado || ref})`)
  );
  if (ivaCents > 0) {
    movements.push(
      makeDraft(accIvaTrasNoCobrado, ref, historicalIvaCents, 0, `Cancelación IVA Pendiente por cobro REP ${ref}`),
      makeDraft(accIvaTrasCobrado, ref, 0, ivaCents, `IVA Efectivamente Cobrado REP ${ref}`)
    );
  }
  const fxDiffCents = totalCents + historicalIvaCents - (counterpartyCents + ivaCents);
  if (fxDiffCents > 0) {
    const accUtilidad = resolveFiscalAccount(accounts, 'UTILIDAD_CAMBIARIA');
    movements.push(
      makeDraft(accUtilidad, ref, 0, fxDiffCents, `Utilidad cambiaria realizada REP ${ref}`)
    );
  } else if (fxDiffCents < 0) {
    const accPerdida = resolveFiscalAccount(accounts, 'PERDIDA_CAMBIARIA');
    movements.push(
      makeDraft(accPerdida, ref, Math.abs(fxDiffCents), 0, `Pérdida cambiaria realizada REP ${ref}`)
    );
  }
  return {
    polizaType: overrides?.polizaType ?? 'INGRESO',
    polizaConcept: `Complemento de Pago ${ref} - ${cfdi.receptorNombre}`,
    movements
  };
}
