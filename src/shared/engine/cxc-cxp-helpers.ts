import type { CfdiDocument, CfdiRelatedDoc } from '../types';
import { parseCalendarDate } from '../date-utils';

export interface ParcialidadEntry {
  paymentUuid: string;
  fechaPago: string;
  numParcialidad: number;
  impPagadoMxn: number;
  impPagadoOrig?: number;
  impSaldoInsolutoDr?: number;
  drIsValidZero?: boolean;
  drCurrency?: string;
  paymentTc?: number;
  paymentCurrency?: string;
}

export function resolveCurrencyRate(doc: Pick<CfdiDocument, 'moneda' | 'tipoCambio'>): number {
  const cur = (doc.moneda || 'MXN').toUpperCase();
  return cur !== 'MXN' && doc.tipoCambio > 0 ? doc.tipoCambio : 1;
}

export function diffCalendarDays(fromIso: string, toIso: string): number {
  const a = parseCalendarDate(fromIso);
  const b = parseCalendarDate(toIso);
  const utcA = Date.UTC(a.year, a.month - 1, a.day);
  const utcB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.max(0, Math.round((utcB - utcA) / 86_400_000));
}

export function resolveDrPaymentInfo(
  paymentDoc: CfdiDocument,
  dr: CfdiRelatedDoc,
  targetDoc: CfdiDocument | undefined,
  singleRelatedDoc: boolean
): {
  paidMxn: number;
  paidOrig: number | undefined;
  effectiveTc: number;
  paymentCurrency: string;
  drCurrency: string;
} {
  const pCurrency = (dr.pagoMoneda || paymentDoc.moneda || 'MXN').toUpperCase();
  const hasExplicitPagoTc =
    pCurrency !== 'MXN' &&
    ((Boolean(dr.pagoMoneda) && (dr.pagoTipoCambio ?? 0) > 0) ||
      (!dr.pagoMoneda && (paymentDoc.moneda || 'MXN').toUpperCase() === pCurrency && paymentDoc.tipoCambio > 0));
  const pTc = dr.pagoMoneda
    ? pCurrency !== 'MXN' && (dr.pagoTipoCambio ?? 0) > 0
      ? dr.pagoTipoCambio!
      : 1
    : resolveCurrencyRate(paymentDoc);
  const drCurrency = (dr.monedaDr || pCurrency).toUpperCase();
  const invCurrency = (targetDoc?.moneda || 'MXN').toUpperCase();
  const invTc = targetDoc ? resolveCurrencyRate(targetDoc) : 1;
  const hasInvForeignTc = invCurrency !== 'MXN' && invTc > 0;

  let paidMxn: number;
  if (drCurrency === 'MXN') {
    paidMxn = dr.impPagado;
  } else if (drCurrency === pCurrency) {
    const rate =
      pCurrency !== 'MXN' && hasExplicitPagoTc && pTc > 0
        ? pTc
        : invCurrency === drCurrency && hasInvForeignTc
          ? invTc
          : pTc;
    paidMxn = dr.impPagado * rate;
  } else if (singleRelatedDoc && paymentDoc.total > 0 && pCurrency === 'MXN') {
    paidMxn = paymentDoc.total;
  } else if (dr.equivalenciaDr && dr.equivalenciaDr > 0) {
    paidMxn = (dr.impPagado / dr.equivalenciaDr) * pTc;
  } else {
    paidMxn = dr.impPagado * invTc;
  }

  let paidOrig: number | undefined;
  if (invCurrency !== 'MXN') {
    if (drCurrency === invCurrency) {
      paidOrig = dr.impPagado;
    } else if (drCurrency === 'MXN' && pCurrency === invCurrency && dr.equivalenciaDr && dr.equivalenciaDr > 0) {
      paidOrig = dr.impPagado / dr.equivalenciaDr;
    } else {
      paidOrig = invTc > 0 ? paidMxn / invTc : 0;
    }
  }

  const effectiveTc =
    pCurrency !== 'MXN' && hasExplicitPagoTc && pTc > 0
      ? pTc
      : drCurrency === invCurrency && hasInvForeignTc
        ? invTc
        : 1;
  const paymentCurrency =
    pCurrency !== 'MXN' && hasExplicitPagoTc && pTc > 0
      ? pCurrency
      : drCurrency === invCurrency && hasInvForeignTc
        ? invCurrency
        : 'MXN';
  return { paidMxn, paidOrig, effectiveTc, paymentCurrency, drCurrency };
}
