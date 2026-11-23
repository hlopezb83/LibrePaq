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
  impSaldoInsolutoDr?: number;
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

function resolveDrPaidMxn(
  paymentDoc: CfdiDocument,
  dr: CfdiRelatedDoc,
  targetDoc: CfdiDocument | undefined,
  singleRelatedDoc: boolean
): number {
  const pCurrency = (dr.pagoMoneda || paymentDoc.moneda || 'MXN').toUpperCase();
  const pTc = dr.pagoMoneda
    ? pCurrency !== 'MXN' && (dr.pagoTipoCambio || 1) > 0
      ? dr.pagoTipoCambio!
      : 1
    : resolveCurrencyRate(paymentDoc);
  const drCurrency = (dr.monedaDr || pCurrency).toUpperCase();

  // Anexo SAT Pagos 2.0: ImpPagado está expresado en MonedaDR (moneda del documento relacionado)
  if (drCurrency === 'MXN') return dr.impPagado;

  if (drCurrency === pCurrency) {
    const effectiveTc =
      pTc > 1
        ? pTc
        : targetDoc && (targetDoc.moneda || '').toUpperCase() === drCurrency
          ? resolveCurrencyRate(targetDoc)
          : pTc;
    return dr.impPagado * effectiveTc;
  }

  if (singleRelatedDoc && paymentDoc.total > 0 && pCurrency === 'MXN') {
    return paymentDoc.total;
  }
  if (dr.equivalenciaDr && dr.equivalenciaDr > 0) {
    return dr.equivalenciaDr < 1
      ? (dr.impPagado / dr.equivalenciaDr) * pTc
      : dr.impPagado * dr.equivalenciaDr * pTc;
  }
  const invTc = targetDoc ? resolveCurrencyRate(targetDoc) : 1;
  return dr.impPagado * invTc;
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
          const paidMxn = resolveDrPaidMxn(
            doc,
            dr,
            ppdByUuid.get(targetUuid),
            singleDoc
          );
          pushParcialidad(targetUuid, {
            paymentUuid: doc.uuid,
            fechaPago,
            numParcialidad: dr.numParcialidad || 1,
            impPagadoMxn: fromCents(toCents(paidMxn)),
            impSaldoInsolutoDr: dr.impSaldoInsoluto
          });
        }
      } else if (doc.uuidRelacionado) {
        const targetUuid = doc.uuidRelacionado.trim().toUpperCase();
        const paidMxn = doc.total * resolveCurrencyRate(doc);
        pushParcialidad(targetUuid, {
          paymentUuid: doc.uuid,
          fechaPago,
          numParcialidad: 1,
          impPagadoMxn: fromCents(toCents(paidMxn))
        });
      }
    } else if (doc.tipoComprobante === 'E' && doc.uuidRelacionado) {
      const targetUuid = doc.uuidRelacionado.trim().toUpperCase();
      const creditMxn = doc.total * resolveCurrencyRate(doc);
      pushParcialidad(targetUuid, {
        paymentUuid: doc.uuid,
        fechaPago,
        numParcialidad: 0,
        impPagadoMxn: fromCents(toCents(creditMxn))
      });
    }
  }

  const cxcBucketsCents = emptyBuckets();
  const cxpBucketsCents = emptyBuckets();
  const cxcItems: CxcCxpDocumentRow[] = [];
  const cxpItems: CxcCxpDocumentRow[] = [];

  for (const inv of ppdInvoices) {
    const uuidUpper = (inv.uuid || '').trim().toUpperCase();
    const tc = resolveCurrencyRate(inv);
    const totalOriginalCents = toCents(inv.total * tc);
    const entries = parcialidadesByUuid.get(uuidUpper) ?? [];
    const totalPagadoCents = sumCents(entries.map((e) => e.impPagadoMxn));
    const settledInForeignDr =
      (inv.moneda || 'MXN').toUpperCase() !== 'MXN' &&
      entries.some((e) => e.impSaldoInsolutoDr === 0);
    const saldoInsolutoCents = settledInForeignDr
      ? 0
      : Math.max(0, totalOriginalCents - totalPagadoCents);

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
      moneda: (inv.moneda || 'MXN').toUpperCase(),
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
    cxcTotal: fromCents(
      cxcBucketsCents['0_30'] + cxcBucketsCents['31_60'] + cxcBucketsCents['61_90'] + cxcBucketsCents['90_PLUS']
    ),
    cxpTotal: fromCents(
      cxpBucketsCents['0_30'] + cxpBucketsCents['31_60'] + cxpBucketsCents['61_90'] + cxpBucketsCents['90_PLUS']
    ),
    cxcBuckets,
    cxpBuckets,
    cxcItems,
    cxpItems
  };
}
