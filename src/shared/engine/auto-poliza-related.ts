import type { CfdiDocument, CfdiRelatedDoc, CfdiRelatedDocMeta } from '../types';
import { stripXmlAddenda } from '../xml-utils';
import { clampDeductiblePct } from './auto-poliza-deductible';
import type { AutoPolizaOverrides } from './auto-poliza-types';
import { toCents } from './invariants-and-math';

export interface RelatedCfdiDbRowLike {
  uuid?: string | null;
  moneda?: string | null;
  tipo_cambio?: number | null;
  metodo_pago?: string | null;
  subtotal?: number | null;
  descuento?: number | null;
  iva_trasladado?: number | null;
  isr_retenido?: number | null;
  iva_retenido?: number | null;
  total?: number | null;
  concepto_principal?: string | null;
  clave_prod_serv?: string | null;
  emisor_nombre?: string | null;
  uso_cfdi?: string | null;
  xml_raw?: string | null;
}

export function extractRegimenEmisorFromXml(xmlRaw?: string | null): string | undefined {
  if (!xmlRaw) return undefined;
  const clean = stripXmlAddenda(xmlRaw);
  const m = /<(?:[A-Za-z_][\w.-]*:)?Emisor\b[^>]*\bRegimenFiscal\s*=\s*["']([^"']+)["']/i.exec(clean);
  return m?.[1]?.trim() || undefined;
}

export function buildRelatedCfdiOverridesFromRows(
  relRows: ReadonlyArray<RelatedCfdiDbRowLike>,
  tipoComprobante: CfdiDocument['tipoComprobante'],
  requestedUuidCount = relRows.length
): Partial<AutoPolizaOverrides> {
  const tcMap: Record<string, number> = {};
  const metaMap: Record<string, CfdiRelatedDocMeta> = {};
  let singleForeignTc: number | undefined;
  let foreignCount = 0;
  let relatedIsPpd: boolean | undefined;
  let relatedPpdIsrRetenido = 0;
  let relatedPpdIvaRetenido = 0;
  let relatedPpdTotal = 0;

  for (const r of relRows) {
    const key = String(r.uuid ?? '').trim().toUpperCase();
    if (!key) continue;
    const cur = String(r.moneda ?? 'MXN').toUpperCase();
    const tc = Number(r.tipo_cambio ?? 0);
    const fx = cur !== 'MXN' && tc > 0 ? tc : 1;
    if (cur !== 'MXN' && tc > 0) {
      tcMap[key] = tc;
      foreignCount += 1;
      singleForeignTc = tc;
    }
    const subtotalMxn = Number((((Number(r.subtotal ?? 0) - Number(r.descuento ?? 0)) || 0) * fx).toFixed(2));
    const ivaTrasladadoMxn = Number((Number(r.iva_trasladado ?? 0) * fx).toFixed(2));
    const isrRetenidoMxn = Number((Number(r.isr_retenido ?? 0) * fx).toFixed(2));
    const ivaRetenidoMxn = Number((Number(r.iva_retenido ?? 0) * fx).toFixed(2));
    const totalMxn = Number((Number(r.total ?? 0) * fx).toFixed(2));
    const regimenEmisor = extractRegimenEmisorFromXml(r.xml_raw);

    metaMap[key] = {
      moneda: cur,
      ...(cur !== 'MXN' && tc > 0 ? { tipoCambio: tc } : {}),
      ...(r.concepto_principal ? { conceptoPrincipal: String(r.concepto_principal) } : {}),
      ...(r.clave_prod_serv ? { claveProdServ: String(r.clave_prod_serv) } : {}),
      ...(regimenEmisor ? { regimenEmisor } : {}),
      ...(r.emisor_nombre ? { emisorNombre: String(r.emisor_nombre) } : {}),
      ...(r.uso_cfdi ? { usoCfdi: String(r.uso_cfdi) } : {}),
      subtotalMxn, ivaTrasladadoMxn, totalMxn, isrRetenidoMxn, ivaRetenidoMxn
    };

    if (String(r.metodo_pago ?? '').toUpperCase() === 'PPD') {
      relatedIsPpd = true;
      if (tipoComprobante === 'P') {
        relatedPpdIsrRetenido += isrRetenidoMxn;
        relatedPpdIvaRetenido += ivaRetenidoMxn;
        relatedPpdTotal += totalMxn;
      }
    }
  }

  const allowScalarTc = requestedUuidCount <= 1 && foreignCount === 1 && singleForeignTc !== undefined;
  return {
    ...(allowScalarTc ? { relatedOriginalTipoCambio: singleForeignTc } : {}),
    ...(Object.keys(tcMap).length > 0 ? { relatedOriginalTipoCambioByUuid: tcMap } : {}),
    ...(Object.keys(metaMap).length > 0 ? { relatedDocsMetaByUuid: metaMap } : {}),
    ...(relatedIsPpd !== undefined ? { relatedIsPpd } : {}),
    ...(relatedPpdIsrRetenido > 0 ? { relatedPpdIsrRetenido: Number(relatedPpdIsrRetenido.toFixed(2)) } : {}),
    ...(relatedPpdIvaRetenido > 0 ? { relatedPpdIvaRetenido: Number(relatedPpdIvaRetenido.toFixed(2)) } : {}),
    ...(relatedPpdTotal > 0 ? { relatedPpdTotal: Number(relatedPpdTotal.toFixed(2)) } : {})
  };
}

function parseXmlTrasladoDrIvaMxnByDocIndex(xmlRaw: string, headerCur: string, headerTc: number): Map<number, number> {
  const result = new Map<number, number>();
  if (!xmlRaw || !xmlRaw.includes('TrasladoDR')) return result;
  const clean = stripXmlAddenda(xmlRaw);
  const pagoTagRe = /<(?:[A-Za-z_][\w.-]*:)?Pago\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?Pago\s*>/gi;
  let drGlobalIdx = 0;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pagoTagRe.exec(clean)) !== null) {
    const pAttrs = pMatch[1] ?? '';
    const pCur = (/MonedaP=["']([^"']+)["']/i.exec(pAttrs)?.[1] ?? headerCur).toUpperCase();
    const rawTcP = Number.parseFloat(/TipoCambioP=["']([0-9]+(?:\.[0-9]+)?)["']/i.exec(pAttrs)?.[1] ?? '');
    const pTc = pCur === 'MXN' ? 1 : Number.isFinite(rawTcP) && rawTcP > 0 ? rawTcP : headerTc;
    const drRe = /<(?:[A-Za-z_][\w.-]*:)?DoctoRelacionado\b([^>]*)(?:\/>|>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?DoctoRelacionado\s*>)/gi;
    let dMatch: RegExpExecArray | null;
    while ((dMatch = drRe.exec(pMatch[2] ?? '')) !== null) {
      const drAttrs = dMatch[1] ?? '';
      if (!/IdDocumento=["']([^"']+)["']/i.exec(drAttrs)?.[1]?.trim()) continue;
      const drCur = (/MonedaDR=["']([^"']+)["']/i.exec(drAttrs)?.[1] ?? pCur).toUpperCase();
      const eqDr = Number.parseFloat(/EquivalenciaDR=["']([0-9]+(?:\.[0-9]+)?)["']/i.exec(drAttrs)?.[1] ?? '');
      let ivaInDr = 0;
      const tRe = /<(?:[A-Za-z_][\w.-]*:)?TrasladoDR\b([^>]*)\/?>/gi;
      let tMatch: RegExpExecArray | null;
      while ((tMatch = tRe.exec(dMatch[2] ?? '')) !== null) {
        const tAttrs = tMatch[1] ?? '';
        const imp = /ImpuestoDR=["']([^"']+)["']/i.exec(tAttrs)?.[1] ?? '';
        const factor = /TipoFactorDR=["']([^"']+)["']/i.exec(tAttrs)?.[1] ?? '';
        const impVal = Number.parseFloat(/ImporteDR=["']([0-9]+(?:\.[0-9]+)?)["']/i.exec(tAttrs)?.[1] ?? '0') || 0;
        if ((imp === '002' || imp === '') && factor !== 'Exento' && impVal > 0) ivaInDr += impVal;
      }
      if (ivaInDr > 0) {
        const payFactor = drCur === 'MXN' ? 1 : pCur !== drCur && Number.isFinite(eqDr) && eqDr > 0 ? pTc / eqDr : pTc;
        result.set(drGlobalIdx, Math.round(toCents(ivaInDr) * payFactor));
      }
      drGlobalIdx += 1;
    }
  }
  return result;
}

export interface ComputedRepDocEntry {
  docUuid: string;
  meta?: CfdiRelatedDocMeta;
  payMxnCents: number;
  histMxnCents: number;
  payIvaCents: number;
  histIvaCents: number;
  deductiblePct: number;
}

export interface ComputedRepBreakdown {
  counterpartyCents: number;
  totalPayIvaCents: number;
  totalHistIvaCents: number;
  deductiblePayIvaCents: number;
  deductibleHistIvaCents: number;
  entries: ComputedRepDocEntry[];
}

function resolveDrMxnAmounts(
  dr: CfdiRelatedDoc,
  headerCur: string,
  headerTc: number,
  origTc?: number
): { isForeign: boolean; payMxnCents: number; histMxnCents: number } {
  const pCur = (dr.pagoMoneda || headerCur).toUpperCase();
  const pTc = dr.pagoTipoCambio && dr.pagoTipoCambio > 0 ? dr.pagoTipoCambio : pCur !== 'MXN' ? headerTc : 1;
  const drCur = (dr.monedaDr || pCur).toUpperCase();
  const isForeign = drCur !== 'MXN' || pCur !== 'MXN';
  if (drCur === 'MXN') {
    const mxn = toCents(dr.impPagado);
    return { isForeign, payMxnCents: mxn, histMxnCents: mxn };
  }
  const effectivePayRate = pCur === 'MXN' ? 1 : headerTc > 1 ? headerTc : pTc;
  const payMxnCents =
    dr.equivalenciaDr && dr.equivalenciaDr > 0 && pCur !== drCur
      ? Math.round((toCents(dr.impPagado) / dr.equivalenciaDr) * effectivePayRate)
      : Math.round(toCents(dr.impPagado) * effectivePayRate);

  let histMxnCents: number;
  if (origTc && origTc > 0) {
    histMxnCents = Math.round(toCents(dr.impPagado) * origTc);
  } else if (dr.equivalenciaDr && dr.equivalenciaDr > 0 && Math.abs(dr.equivalenciaDr - 1) > 0.0001) {
    histMxnCents = Math.round((toCents(dr.impPagado) / dr.equivalenciaDr) * pTc);
  } else if (dr.pagoTipoCambio && dr.pagoTipoCambio > 0 && headerTc > 1 && Math.abs(dr.pagoTipoCambio - headerTc) > 0.0001) {
    histMxnCents = Math.round(toCents(dr.impPagado) * dr.pagoTipoCambio);
  } else {
    histMxnCents = Math.round(toCents(dr.impPagado) * pTc);
  }
  return { isForeign, payMxnCents, histMxnCents };
}

export function computeRepDocBreakdown(
  cfdi: CfdiDocument,
  totalCents: number,
  ivaCents: number,
  overrides?: AutoPolizaOverrides
): ComputedRepBreakdown {
  const docs = cfdi.relatedDocs;
  const headerCur = (cfdi.moneda || 'MXN').toUpperCase();
  const headerTc = headerCur !== 'MXN' && cfdi.tipoCambio > 0 ? cfdi.tipoCambio : 1;

  if (!docs || docs.length === 0) {
    const relKey = (cfdi.uuidRelacionado || '').trim().toUpperCase();
    const meta = relKey ? overrides?.relatedDocsMetaByUuid?.[relKey] : undefined;
    const origTc =
      meta?.tipoCambio ??
      (relKey ? overrides?.relatedOriginalTipoCambioByUuid?.[relKey] : undefined) ??
      overrides?.relatedOriginalTipoCambio;
    const counterpartyCents =
      headerCur !== 'MXN' && origTc && origTc > 0 ? Math.round(toCents(cfdi.total) * origTc) : totalCents;
    const pct = clampDeductiblePct(overrides?.deductiblePct ?? meta?.deductiblePct);
    const histIvaCents =
      ivaCents > 0 && totalCents > 0 && counterpartyCents !== totalCents
        ? Math.round(ivaCents * (counterpartyCents / totalCents))
        : ivaCents;
    return {
      counterpartyCents,
      totalPayIvaCents: ivaCents,
      totalHistIvaCents: histIvaCents,
      deductiblePayIvaCents: Math.round((ivaCents * pct) / 100),
      deductibleHistIvaCents: Math.round((histIvaCents * pct) / 100),
      entries: []
    };
  }

  const xmlIvaByIdx = parseXmlTrasladoDrIvaMxnByDocIndex(cfdi.xmlRaw, headerCur, headerTc);
  const hasPerUuidOverrides = Boolean(overrides?.relatedDocsMetaByUuid || overrides?.relatedOriginalTipoCambioByUuid);
  let hasForeignDoc = false;
  let sumHistCents = 0;
  const rawEntries: Array<ComputedRepDocEntry & { rawIvaWeight: number }> = [];

  for (let i = 0; i < docs.length; i += 1) {
    const dr = docs[i]!;
    const docUuid = (dr.idDocumento || '').trim().toUpperCase();
    const meta = docUuid ? overrides?.relatedDocsMetaByUuid?.[docUuid] : undefined;
    const origTc =
      meta?.tipoCambio ??
      (docUuid ? overrides?.relatedOriginalTipoCambioByUuid?.[docUuid] : undefined) ??
      (docs.length === 1 || !hasPerUuidOverrides ? overrides?.relatedOriginalTipoCambio : undefined);
    const { isForeign, payMxnCents, histMxnCents } = resolveDrMxnAmounts(dr, headerCur, headerTc, origTc);
    if (isForeign) hasForeignDoc = true;
    sumHistCents += histMxnCents;

    let rawIvaWeight = xmlIvaByIdx.get(i) ?? -1;
    if (rawIvaWeight < 0 && meta?.ivaTrasladadoMxn !== undefined) {
      if (meta.ivaTrasladadoMxn <= 0) {
        rawIvaWeight = 0;
      } else if (meta.totalMxn && meta.totalMxn > 0) {
        const estHistIva = Math.round(toCents(meta.ivaTrasladadoMxn) * (histMxnCents / toCents(meta.totalMxn)));
        rawIvaWeight = histMxnCents > 0 ? Math.round(estHistIva * (payMxnCents / histMxnCents)) : estHistIva;
      }
    }
    rawEntries.push({
      docUuid,
      meta,
      payMxnCents,
      histMxnCents,
      payIvaCents: 0,
      histIvaCents: 0,
      deductiblePct: clampDeductiblePct(overrides?.deductiblePct ?? meta?.deductiblePct),
      rawIvaWeight
    });
  }

  const counterpartyCents =
    !hasForeignDoc || sumHistCents <= 0 || Math.abs(totalCents - sumHistCents) <= 5 ? totalCents : sumHistCents;

  if (ivaCents > 0 && rawEntries.length > 0) {
    const weights = rawEntries.map((e) => (e.rawIvaWeight >= 0 ? e.rawIvaWeight : e.payMxnCents));
    const weightSum = weights.reduce((s, w) => s + w, 0);
    if (weightSum > 0) {
      let allocated = 0;
      const lastNonZeroIdx = weights.reduce((acc, w, idx) => (w > 0 ? idx : acc), -1);
      for (let i = 0; i < rawEntries.length; i += 1) {
        const entry = rawEntries[i]!;
        if (weights[i]! <= 0) {
          entry.payIvaCents = 0;
        } else if (i === lastNonZeroIdx) {
          entry.payIvaCents = Math.max(0, ivaCents - allocated);
        } else {
          entry.payIvaCents = Math.round(ivaCents * (weights[i]! / weightSum));
          allocated += entry.payIvaCents;
        }
        entry.histIvaCents =
          entry.payIvaCents > 0 && entry.payMxnCents > 0 && entry.histMxnCents !== entry.payMxnCents
            ? Math.round(entry.payIvaCents * (entry.histMxnCents / entry.payMxnCents))
            : entry.payIvaCents;
      }
    }
  }

  let totalPayIvaCents = 0;
  let totalHistIvaCents = 0;
  let deductiblePayIvaCents = 0;
  let deductibleHistIvaCents = 0;
  for (const e of rawEntries) {
    totalPayIvaCents += e.payIvaCents;
    totalHistIvaCents += e.histIvaCents;
    deductiblePayIvaCents += Math.round((e.payIvaCents * e.deductiblePct) / 100);
    deductibleHistIvaCents += Math.round((e.histIvaCents * e.deductiblePct) / 100);
  }
  return { counterpartyCents, totalPayIvaCents, totalHistIvaCents, deductiblePayIvaCents, deductibleHistIvaCents, entries: rawEntries };
}
