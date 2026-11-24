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
  totalCents: number
): number {
  const rawFiscalDiffCents =
    totalCents + isrRetCents + ivaRetCents - (subtotalNetoCents + ivaCents);
  if (rawFiscalDiffCents <= 0) return 0;

  const explicitIepsCents = cfdi.taxBreakdown?.ieps
    ? Math.max(0, toMxnCents(cfdi.taxBreakdown.ieps, cfdi))
    : 0;

  if (explicitIepsCents > 0) {
    return rawFiscalDiffCents >= explicitIepsCents ? rawFiscalDiffCents : explicitIepsCents;
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
  if (!docs || docs.length === 0) return bankMxnCents;

  let sumCounterCents = 0;
  let hasForeignDoc = false;
  const headerCur = (cfdi.moneda || 'MXN').toUpperCase();
  const headerTc = headerCur !== 'MXN' && cfdi.tipoCambio > 0 ? cfdi.tipoCambio : 1;

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

    if (overrides?.relatedOriginalTipoCambio && overrides.relatedOriginalTipoCambio > 0) {
      sumCounterCents += Math.round(toCents(dr.impPagado) * overrides.relatedOriginalTipoCambio);
      continue;
    }

    if (drCur === pCur) {
      if (dr.equivalenciaDr && dr.equivalenciaDr > 0 && Math.abs(dr.equivalenciaDr - 1) > 0.0001) {
        const docTc = dr.equivalenciaDr < 1 ? pTc / dr.equivalenciaDr : dr.equivalenciaDr;
        sumCounterCents += Math.round(toCents(dr.impPagado) * docTc);
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
      continue;
    }

    const eqRate =
      dr.equivalenciaDr && dr.equivalenciaDr > 0
        ? dr.equivalenciaDr < 1
          ? 1 / dr.equivalenciaDr
          : dr.equivalenciaDr
        : 0;
    if (
      dr.pagoTipoCambio &&
      dr.pagoTipoCambio > 1 &&
      eqRate > 0 &&
      Math.abs(eqRate - dr.pagoTipoCambio) > 0.0001
    ) {
      sumCounterCents += Math.round(toCents(dr.impPagado) * dr.pagoTipoCambio);
    } else if (eqRate > 0) {
      sumCounterCents += Math.round(toCents(dr.impPagado) * eqRate * pTc);
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
 * Incluye cálculo y asiento automático de utilidad/pérdida cambiaria (702-01-001 / 701-01-001)
 * cuando el tipo de cambio en moneda extranjera difiere del documento relacionado.
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
    if (totalCents > counterpartyCents) {
      const accPerdida = resolveFiscalAccount(accounts, 'PERDIDA_CAMBIARIA');
      movements.push(
        makeDraft(accPerdida, ref, totalCents - counterpartyCents, 0, `Pérdida cambiaria realizada REP ${ref}`)
      );
    } else if (counterpartyCents > totalCents) {
      const accUtilidad = resolveFiscalAccount(accounts, 'UTILIDAD_CAMBIARIA');
      movements.push(
        makeDraft(accUtilidad, ref, 0, counterpartyCents - totalCents, `Utilidad cambiaria realizada REP ${ref}`)
      );
    }
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
    makeDraft(accClientes, ref, 0, counterpartyCents, `Liquidación factura PPD (${cfdi.uuidRelacionado || ref})`)
  );
  if (totalCents > counterpartyCents) {
    const accUtilidad = resolveFiscalAccount(accounts, 'UTILIDAD_CAMBIARIA');
    movements.push(
      makeDraft(accUtilidad, ref, 0, totalCents - counterpartyCents, `Utilidad cambiaria realizada REP ${ref}`)
    );
  } else if (counterpartyCents > totalCents) {
    const accPerdida = resolveFiscalAccount(accounts, 'PERDIDA_CAMBIARIA');
    movements.push(
      makeDraft(accPerdida, ref, counterpartyCents - totalCents, 0, `Pérdida cambiaria realizada REP ${ref}`)
    );
  }
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
