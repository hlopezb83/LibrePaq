import type {
  BankStatementLine,
  CfdiDocument,
  CfdiRelatedDoc,
  CxcCxpAgingBucket,
  CxcCxpDocumentRow
} from '../types';
import { parseCalendarDate } from '../date-utils';
import { fromCents, sumCents, toCents } from './invariants-and-math';

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

export interface CxcCxpBankMatchInfo {
  bankLineId: string;
  fecha: string;
  referencia: string;
  descripcion: string;
  amount: number;
  matchReason: 'MONTO_EXACTO' | 'RFC_O_NOMBRE';
}

export interface CxcCxpPartyStatementGroup {
  rfc: string;
  nombre: string;
  docCount: number;
  maxDaysPast: number;
  totalOriginalMxn: number;
  totalPagadoMxn: number;
  saldoInsolutoMxn: number;
  buckets: Record<CxcCxpAgingBucket, number>;
  documents: CxcCxpDocumentRow[];
}

export function groupCxcCxpByCounterparty(
  items: readonly CxcCxpDocumentRow[]
): CxcCxpPartyStatementGroup[] {
  const byRfc = new Map<string, CxcCxpDocumentRow[]>();
  for (const row of items) {
    const key = row.rfc.trim().toUpperCase() || 'XAXX010101000';
    const list = byRfc.get(key) ?? [];
    list.push(row);
    byRfc.set(key, list);
  }
  const groups: CxcCxpPartyStatementGroup[] = [];
  for (const [rfc, docs] of byRfc.entries()) {
    const bucketsCents: Record<CxcCxpAgingBucket, number> = { '0_30': 0, '31_60': 0, '61_90': 0, '90_PLUS': 0 };
    let maxDaysPast = 0;
    for (const d of docs) {
      bucketsCents[d.bucket] += toCents(d.saldoInsolutoMxn);
      if (d.daysPast > maxDaysPast) maxDaysPast = d.daysPast;
    }
    const sortedDocs = [...docs].sort((a, b) => a.fecha.localeCompare(b.fecha));
    groups.push({
      rfc,
      nombre: sortedDocs[0]?.nombre ?? rfc,
      docCount: sortedDocs.length,
      maxDaysPast,
      totalOriginalMxn: fromCents(sumCents(sortedDocs.map((d) => d.totalOriginalMxn))),
      totalPagadoMxn: fromCents(sumCents(sortedDocs.map((d) => d.totalPagadoMxn))),
      saldoInsolutoMxn: fromCents(sumCents(sortedDocs.map((d) => d.saldoInsolutoMxn))),
      buckets: {
        '0_30': fromCents(bucketsCents['0_30']),
        '31_60': fromCents(bucketsCents['31_60']),
        '61_90': fromCents(bucketsCents['61_90']),
        '90_PLUS': fromCents(bucketsCents['90_PLUS'])
      },
      documents: sortedDocs
    });
  }
  return groups.sort((a, b) => b.saldoInsolutoMxn - a.saldoInsolutoMxn || b.maxDaysPast - a.maxDaysPast);
}

const GENERIC_RFCS = new Set(['XAXX010101000', 'XEXX010101000']);
const STOP_WORDS = new Set(['SA', 'DE', 'CV', 'SAPI', 'SRL', 'SC', 'AC', 'SAS', 'SOCIEDAD', 'ANONIMA', 'EMPRESA']);

export function findPossibleBankPaymentsForCxcCxp(
  items: readonly CxcCxpDocumentRow[],
  bankLines: readonly BankStatementLine[],
  mode: 'CXC' | 'CXP'
): Map<string, CxcCxpBankMatchInfo[]> {
  const result = new Map<string, CxcCxpBankMatchInfo[]>();
  const pendingLines = bankLines.filter((l) => !l.matchedMovementId);
  if (items.length === 0 || pendingLines.length === 0) return result;

  for (const doc of items) {
    const targetCents = toCents(doc.saldoInsolutoMxn);
    const origCents = toCents(doc.totalOriginalMxn);
    const rfcUpper = doc.rfc.trim().toUpperCase();
    const nameTokens = doc.nombre
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 5 && !STOP_WORDS.has(t));

    const matches: CxcCxpBankMatchInfo[] = [];
    for (const line of pendingLines) {
      const bankAmt = mode === 'CXC' ? line.abonoBanco : line.cargoBanco;
      const bankCents = toCents(bankAmt);
      if (bankCents <= 0) continue;

      const exactAmt = Math.abs(bankCents - targetCents) <= 5 || Math.abs(bankCents - origCents) <= 5;
      const text = `${line.referencia} ${line.descripcion}`.toUpperCase();
      const textHit =
        (!GENERIC_RFCS.has(rfcUpper) && rfcUpper.length >= 12 && text.includes(rfcUpper)) ||
        nameTokens.some((tok) => text.includes(tok));

      if (exactAmt || textHit) {
        matches.push({
          bankLineId: line.id,
          fecha: line.fecha,
          referencia: line.referencia,
          descripcion: line.descripcion,
          amount: bankAmt,
          matchReason: exactAmt ? 'MONTO_EXACTO' : 'RFC_O_NOMBRE'
        });
      }
    }
    if (matches.length > 0) result.set(doc.cfdiId, matches);
  }
  return result;
}
