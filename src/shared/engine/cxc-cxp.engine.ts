import type {
  CfdiDocument,
  CfdiRelatedDoc,
  CxcCxpAgingBucket,
  CxcCxpAgingResponse,
  CxcCxpDocumentRow
} from '../types';
import { getTodayLocalIso, parseCalendarDate } from '../date-utils';
import { fromCents, sumCents, toCents } from './invariants-and-math';

interface ParcialidadEntry {
  paymentUuid: string;
  fechaPago: string;
  numParcialidad: number;
  impPagadoMxn: number;
  impPagadoOrig?: number;
  impSaldoInsolutoDr?: number;
  drIsValidZero?: boolean;
  drCurrency?: string;
  paymentTc?: number;
}

function resolveCurrencyRate(doc: Pick<CfdiDocument, 'moneda' | 'tipoCambio'>): number {
  return doc.moneda && doc.moneda.toUpperCase() !== 'MXN' && (doc.tipoCambio || 1) > 0
    ? doc.tipoCambio
    : 1;
}

function diffCalendarDays(fromIso: string, toIso: string): number {
  const a = parseCalendarDate(fromIso);
  const b = parseCalendarDate(toIso);
  const utcA = Date.UTC(a.year, a.month - 1, a.day);
  const utcB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.max(0, Math.round((utcB - utcA) / 86_400_000));
}

function classifyBucket(daysPast: number): CxcCxpAgingBucket {
  if (daysPast <= 30) return '0_30';
  if (daysPast <= 60) return '31_60';
  if (daysPast <= 90) return '61_90';
  return '90_PLUS';
}

function emptyBuckets(): Record<CxcCxpAgingBucket, number> {
  return { '0_30': 0, '31_60': 0, '61_90': 0, '90_PLUS': 0 };
}

function resolveDrPaymentInfo(
  paymentDoc: CfdiDocument,
  dr: CfdiRelatedDoc,
  targetDoc: CfdiDocument | undefined,
  singleRelatedDoc: boolean
): { paidMxn: number; paidOrig: number | undefined; effectiveTc: number; drCurrency: string } {
  const pCurrency = (dr.pagoMoneda || paymentDoc.moneda || 'MXN').toUpperCase();
  const pTc = dr.pagoMoneda
    ? pCurrency !== 'MXN' && (dr.pagoTipoCambio || 1) > 0
      ? dr.pagoTipoCambio!
      : 1
    : resolveCurrencyRate(paymentDoc);
  const drCurrency = (dr.monedaDr || pCurrency).toUpperCase();
  const invCurrency = (targetDoc?.moneda || 'MXN').toUpperCase();
  const invTc = targetDoc ? resolveCurrencyRate(targetDoc) : 1;

  let paidMxn: number;
  if (drCurrency === 'MXN') {
    paidMxn = dr.impPagado;
  } else if (drCurrency === pCurrency) {
    const rate = pTc > 1 ? pTc : invCurrency === drCurrency ? invTc : pTc;
    paidMxn = dr.impPagado * rate;
  } else if (singleRelatedDoc && paymentDoc.total > 0 && pCurrency === 'MXN') {
    paidMxn = paymentDoc.total;
  } else if (dr.equivalenciaDr && dr.equivalenciaDr > 0) {
    paidMxn =
      dr.equivalenciaDr < 1
        ? (dr.impPagado / dr.equivalenciaDr) * pTc
        : dr.impPagado * dr.equivalenciaDr * pTc;
  } else {
    paidMxn = dr.impPagado * invTc;
  }

  let paidOrig: number | undefined;
  if (invCurrency !== 'MXN') {
    if (drCurrency === invCurrency) {
      paidOrig = dr.impPagado;
    } else if (drCurrency === 'MXN' && dr.equivalenciaDr && dr.equivalenciaDr > 0) {
      paidOrig = dr.equivalenciaDr >= 1 ? dr.impPagado / dr.equivalenciaDr : dr.impPagado * dr.equivalenciaDr;
    } else {
      paidOrig = invTc > 0 ? paidMxn / invTc : 0;
    }
  }

  const effectiveTc = pTc > 1 ? pTc : drCurrency === invCurrency && invTc > 1 ? invTc : 1;
  return { paidMxn, paidOrig, effectiveTc, drCurrency };
}

export function computeCxcCxpAging(params: {
  companyId: string;
  cfdis: readonly CfdiDocument[];
  asOfIso?: string;
}): CxcCxpAgingResponse {
  const { companyId, cfdis, asOfIso = getTodayLocalIso() } = params;
  const asOfDate = parseCalendarDate(asOfIso).isoDate;

  const companyCfdis = cfdis.filter(
    (c) => (!companyId || !c.companyId || c.companyId === companyId) && c.statusSat !== 'CANCELADO'
  );

  const ppdInvoices = companyCfdis.filter(
    (c) => c.tipoComprobante === 'I' && c.metodoPago === 'PPD'
  );
  const ppdByUuid = new Map<string, CfdiDocument>();
  for (const inv of ppdInvoices) {
    if (inv.uuid) ppdByUuid.set(inv.uuid.trim().toUpperCase(), inv);
  }

  const parcialidadesByUuid = new Map<string, ParcialidadEntry[]>();
  const pushParcialidad = (targetUuid: string, entry: ParcialidadEntry) => {
    const list = parcialidadesByUuid.get(targetUuid);
    if (list) list.push(entry);
    else parcialidadesByUuid.set(targetUuid, [entry]);
  };

  for (const doc of companyCfdis) {
    const fechaPago = parseCalendarDate(doc.fecha).isoDate;
    if (doc.tipoComprobante === 'P') {
      if (doc.relatedDocs && doc.relatedDocs.length > 0) {
        const singleDoc = doc.relatedDocs.length === 1;
        for (const dr of doc.relatedDocs) {
          const targetUuid = (dr.idDocumento || '').trim().toUpperCase();
          if (!targetUuid) continue;
          const targetDoc = ppdByUuid.get(targetUuid);
          const info = resolveDrPaymentInfo(doc, dr, targetDoc, singleDoc);
          const isValidZero =
            dr.impSaldoInsoluto === 0 && (dr.impSaldoAnt <= 0 || dr.impPagado >= dr.impSaldoAnt - 0.01);
          pushParcialidad(targetUuid, {
            paymentUuid: doc.uuid,
            fechaPago,
            numParcialidad: dr.numParcialidad || 1,
            impPagadoMxn: fromCents(toCents(info.paidMxn)),
            impPagadoOrig: info.paidOrig !== undefined ? fromCents(toCents(info.paidOrig)) : undefined,
            impSaldoInsolutoDr: dr.impSaldoInsoluto,
            drIsValidZero: isValidZero,
            drCurrency: info.drCurrency,
            paymentTc: info.effectiveTc
          });
        }
      } else if (doc.uuidRelacionado) {
        const targetUuid = doc.uuidRelacionado.trim().toUpperCase();
        const targetDoc = ppdByUuid.get(targetUuid);
        const docRate = resolveCurrencyRate(doc);
        const paidMxn = doc.total * docRate;
        const invCur = (targetDoc?.moneda || 'MXN').toUpperCase();
        const paidOrig =
          invCur !== 'MXN'
            ? (doc.moneda || 'MXN').toUpperCase() === invCur
              ? doc.total
              : paidMxn / resolveCurrencyRate(targetDoc!)
            : undefined;
        pushParcialidad(targetUuid, {
          paymentUuid: doc.uuid,
          fechaPago,
          numParcialidad: 1,
          impPagadoMxn: fromCents(toCents(paidMxn)),
          impPagadoOrig: paidOrig !== undefined ? fromCents(toCents(paidOrig)) : undefined,
          paymentTc: docRate
        });
      }
    } else if (doc.tipoComprobante === 'E' && doc.uuidRelacionado) {
      const targetUuid = doc.uuidRelacionado.trim().toUpperCase();
      const targetDoc = ppdByUuid.get(targetUuid);
      const docRate = resolveCurrencyRate(doc);
      const creditMxn = doc.total * docRate;
      const invCur = (targetDoc?.moneda || 'MXN').toUpperCase();
      const paidOrig =
        invCur !== 'MXN'
          ? (doc.moneda || 'MXN').toUpperCase() === invCur
            ? doc.total
            : creditMxn / resolveCurrencyRate(targetDoc!)
          : undefined;
      pushParcialidad(targetUuid, {
        paymentUuid: doc.uuid,
        fechaPago,
        numParcialidad: 0,
        impPagadoMxn: fromCents(toCents(creditMxn)),
        impPagadoOrig: paidOrig !== undefined ? fromCents(toCents(paidOrig)) : undefined,
        paymentTc: docRate
      });
    }
  }

  const cxcBucketsCents = emptyBuckets();
  const cxpBucketsCents = emptyBuckets();
  const cxcItems: CxcCxpDocumentRow[] = [];
  const cxpItems: CxcCxpDocumentRow[] = [];

  for (const inv of ppdInvoices) {
    const uuidUpper = (inv.uuid || '').trim().toUpperCase();
    const invCurrency = (inv.moneda || 'MXN').toUpperCase();
    const tc = resolveCurrencyRate(inv);
    const totalOriginalCents = toCents(inv.total * tc);
    const entries = parcialidadesByUuid.get(uuidUpper) ?? [];
    const totalPagadoCents = sumCents(entries.map((e) => e.impPagadoMxn));

    let saldoInsolutoCents: number;
    if (invCurrency !== 'MXN') {
      const invOrigCents = toCents(inv.total);
      const paidOrigCents = sumCents(entries.map((e) => e.impPagadoOrig ?? 0));
      let remainingOrigCents = Math.max(0, invOrigCents - paidOrigCents);

      let minInsolutoOrigCents: number | undefined;
      let latestPaymentTc = 0;
      for (const e of entries) {
        if (e.paymentTc && e.paymentTc > 1) latestPaymentTc = e.paymentTc;
        if (
          e.drCurrency === invCurrency &&
          e.impSaldoInsolutoDr !== undefined &&
          (e.impSaldoInsolutoDr > 0 || e.drIsValidZero)
        ) {
          const insCents = Math.max(0, toCents(e.impSaldoInsolutoDr));
          minInsolutoOrigCents =
            minInsolutoOrigCents === undefined ? insCents : Math.min(minInsolutoOrigCents, insCents);
        }
      }
      if (minInsolutoOrigCents !== undefined) {
        remainingOrigCents = Math.min(remainingOrigCents, minInsolutoOrigCents);
      }
      const effectiveRate = latestPaymentTc > 1 ? latestPaymentTc : tc;
      saldoInsolutoCents = remainingOrigCents <= 0 ? 0 : Math.round(remainingOrigCents * effectiveRate);
    } else {
      saldoInsolutoCents = Math.max(0, totalOriginalCents - totalPagadoCents);
    }

    if (saldoInsolutoCents <= 0) continue;

    const invDate = parseCalendarDate(inv.fecha).isoDate;
    const daysPast = diffCalendarDays(invDate, asOfDate);
    const bucket = classifyBucket(daysPast);
    const serieFolio =
      inv.serie && inv.folio
        ? `${inv.serie}-${inv.folio}`
        : inv.folio || inv.serie || inv.uuid.slice(0, 8);

    const row: CxcCxpDocumentRow = {
      cfdiId: inv.id,
      uuid: inv.uuid,
      direction: inv.direction,
      rfc: inv.direction === 'EMITIDO' ? inv.receptorRfc : inv.emisorRfc,
      nombre: inv.direction === 'EMITIDO' ? inv.receptorNombre : inv.emisorNombre,
      serieFolio,
      fecha: invDate,
      moneda: invCurrency,
      tipoCambio: tc,
      totalOriginalMxn: fromCents(totalOriginalCents),
      totalPagadoMxn: fromCents(totalPagadoCents),
      saldoInsolutoMxn: fromCents(saldoInsolutoCents),
      daysPast,
      bucket,
      parcialidades: entries.map(({ paymentUuid, fechaPago, numParcialidad, impPagadoMxn }) => ({
        paymentUuid,
        fechaPago,
        numParcialidad,
        impPagadoMxn
      }))
    };

    if (inv.direction === 'EMITIDO') {
      cxcItems.push(row);
      cxcBucketsCents[bucket] += saldoInsolutoCents;
    } else {
      cxpItems.push(row);
      cxpBucketsCents[bucket] += saldoInsolutoCents;
    }
  }

  cxcItems.sort((a, b) => b.daysPast - a.daysPast);
  cxpItems.sort((a, b) => b.daysPast - a.daysPast);

  const toBucketsMxn = (b: Record<CxcCxpAgingBucket, number>): Record<CxcCxpAgingBucket, number> => ({
    '0_30': fromCents(b['0_30']),
    '31_60': fromCents(b['31_60']),
    '61_90': fromCents(b['61_90']),
    '90_PLUS': fromCents(b['90_PLUS'])
  });

  const cxcBuckets = toBucketsMxn(cxcBucketsCents);
  const cxpBuckets = toBucketsMxn(cxpBucketsCents);

  return {
    companyId,
    asOfDate,
    cxcTotal: fromCents(sumCents(cxcItems.map((i) => i.saldoInsolutoMxn))),
    cxpTotal: fromCents(sumCents(cxpItems.map((i) => i.saldoInsolutoMxn))),
    cxcBuckets,
    cxpBuckets,
    cxcItems,
    cxpItems
  };
}
