import type {
  CfdiDocument,
  CxcCxpAgingBucket,
  CxcCxpAgingResponse,
  CxcCxpDocumentRow
} from '../types';
import { getTodayLocalIso, parseCalendarDate } from '../date-utils';
import { fromCents, sumCents, toCents } from './invariants-and-math';
import {
  diffCalendarDays,
  resolveCurrencyRate,
  resolveDrPaymentInfo,
  type ParcialidadEntry
} from './cxc-cxp-helpers';

function classifyBucket(daysPast: number): CxcCxpAgingBucket {
  if (daysPast <= 30) return '0_30';
  if (daysPast <= 60) return '31_60';
  if (daysPast <= 90) return '61_90';
  return '90_PLUS';
}

function emptyBuckets(): Record<CxcCxpAgingBucket, number> {
  return { '0_30': 0, '31_60': 0, '61_90': 0, '90_PLUS': 0 };
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
    (c) =>
      c.tipoComprobante === 'I' &&
      c.metodoPago === 'PPD' &&
      parseCalendarDate(c.fecha).isoDate <= asOfDate
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
    if (doc.tipoComprobante === 'P') {
      if (doc.relatedDocs && doc.relatedDocs.length > 0) {
        const singleDoc = doc.relatedDocs.length === 1;
        for (const dr of doc.relatedDocs) {
          const drFechaPago = parseCalendarDate(dr.fechaPago ?? doc.fechaPago ?? doc.fecha).isoDate;
          if (drFechaPago > asOfDate) continue;
          const targetUuid = (dr.idDocumento || '').trim().toUpperCase();
          if (!targetUuid) continue;
          const targetDoc = ppdByUuid.get(targetUuid);
          const info = resolveDrPaymentInfo(doc, dr, targetDoc, singleDoc);
          const isValidZero =
            dr.impSaldoInsoluto === 0 && (dr.impSaldoAnt <= 0 || dr.impPagado >= dr.impSaldoAnt - 0.01);
          pushParcialidad(targetUuid, {
            paymentUuid: doc.uuid,
            fechaPago: drFechaPago,
            numParcialidad: dr.numParcialidad || 1,
            impPagadoMxn: fromCents(toCents(info.paidMxn)),
            impPagadoOrig: info.paidOrig !== undefined ? fromCents(toCents(info.paidOrig)) : undefined,
            impSaldoInsolutoDr: dr.impSaldoInsoluto,
            drIsValidZero: isValidZero,
            drCurrency: info.drCurrency,
            paymentTc: info.effectiveTc,
            paymentCurrency: info.paymentCurrency
          });
        }
      } else if (doc.uuidRelacionado) {
        const fechaPago = parseCalendarDate(doc.fechaPago || doc.fecha).isoDate;
        if (fechaPago > asOfDate) continue;
        const targetUuid = doc.uuidRelacionado.trim().toUpperCase();
        const targetDoc = ppdByUuid.get(targetUuid);
        const docCur = (doc.moneda || 'MXN').toUpperCase();
        const docRate = resolveCurrencyRate(doc);
        const paidMxn = doc.total * docRate;
        const invCur = (targetDoc?.moneda || 'MXN').toUpperCase();
        const paidOrig =
          invCur !== 'MXN'
            ? docCur === invCur
              ? doc.total
              : paidMxn / (targetDoc ? resolveCurrencyRate(targetDoc) : 1)
            : undefined;
        pushParcialidad(targetUuid, {
          paymentUuid: doc.uuid,
          fechaPago,
          numParcialidad: 1,
          impPagadoMxn: fromCents(toCents(paidMxn)),
          impPagadoOrig: paidOrig !== undefined ? fromCents(toCents(paidOrig)) : undefined,
          paymentTc: docRate,
          paymentCurrency: docCur
        });
      }
    } else if (doc.tipoComprobante === 'E' && doc.uuidRelacionado) {
      const fechaPago = parseCalendarDate(doc.fechaPago || doc.fecha).isoDate;
      if (fechaPago > asOfDate) continue;
      const targetUuid = doc.uuidRelacionado.trim().toUpperCase();
      const targetDoc = ppdByUuid.get(targetUuid);
      const docCur = (doc.moneda || 'MXN').toUpperCase();
      const docRate = resolveCurrencyRate(doc);
      const creditMxn = doc.total * docRate;
      const invCur = (targetDoc?.moneda || 'MXN').toUpperCase();
      const paidOrig =
        invCur !== 'MXN'
          ? docCur === invCur
            ? doc.total
            : creditMxn / (targetDoc ? resolveCurrencyRate(targetDoc) : 1)
          : undefined;
      pushParcialidad(targetUuid, {
        paymentUuid: doc.uuid,
        fechaPago,
        numParcialidad: 0,
        impPagadoMxn: fromCents(toCents(creditMxn)),
        impPagadoOrig: paidOrig !== undefined ? fromCents(toCents(paidOrig)) : undefined,
        paymentTc: docRate,
        paymentCurrency: docCur
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
    const entries = [...(parcialidadesByUuid.get(uuidUpper) ?? [])].sort((a, b) => {
      const dateCmp = a.fechaPago.localeCompare(b.fechaPago);
      return dateCmp !== 0 ? dateCmp : a.numParcialidad - b.numParcialidad;
    });
    const totalPagadoCents = sumCents(entries.map((e) => e.impPagadoMxn));

    let saldoInsolutoCents: number;
    if (invCurrency !== 'MXN') {
      const invOrigCents = toCents(inv.total);
      const paidOrigCents = sumCents(entries.map((e) => e.impPagadoOrig ?? 0));
      let remainingOrigCents = Math.max(0, invOrigCents - paidOrigCents);

      let minInsolutoOrigCents: number | undefined;
      let latestPaymentTc = 0;
      for (const e of entries) {
        if (
          invCurrency !== 'MXN' &&
          e.paymentCurrency === invCurrency &&
          e.paymentTc &&
          e.paymentTc > 0
        ) {
          latestPaymentTc = e.paymentTc;
        }
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
      const effectiveRate = invCurrency !== 'MXN' && latestPaymentTc > 0 ? latestPaymentTc : tc;
      saldoInsolutoCents = remainingOrigCents <= 0 ? 0 : Math.round(remainingOrigCents * effectiveRate);
    } else {
      saldoInsolutoCents = Math.max(0, totalOriginalCents - totalPagadoCents);
    }

    if (saldoInsolutoCents <= 1) continue;

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

  return {
    companyId,
    asOfDate,
    cxcTotal: fromCents(sumCents(cxcItems.map((i) => i.saldoInsolutoMxn))),
    cxpTotal: fromCents(sumCents(cxpItems.map((i) => i.saldoInsolutoMxn))),
    cxcBuckets: toBucketsMxn(cxcBucketsCents),
    cxpBuckets: toBucketsMxn(cxpBucketsCents),
    cxcItems,
    cxpItems
  };
}
