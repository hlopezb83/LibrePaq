import type { CfdiDocument, CfdiRelatedDoc, ThirdPartyRecord } from '../types';
import type { DiotTipoOperacion } from '../types/ronda11.types';
import { fromCents, toCents } from './invariants-and-math';
import { roundArt20Cff } from './sat-dyp-formatter';

export type DiotTipoTercero = '04' | '05' | '15';
export type { DiotTipoOperacion };

export const VALID_DIOT_OPERACIONES: ReadonlySet<DiotTipoOperacion> = new Set([
  '02', '03', '06', '07', '08', '85', '87'
]);

export function normalizeDiotTipoOperacion(
  raw: string | null | undefined,
  tipoTercero: DiotTipoTercero
): DiotTipoOperacion {
  if (tipoTercero === '15') return '87';
  const clean = (raw || '').trim();
  return VALID_DIOT_OPERACIONES.has(clean as DiotTipoOperacion) ? (clean as DiotTipoOperacion) : '85';
}

export interface DiotTxtRowInput {
  rfc: string; nombre: string; tipoTercero: DiotTipoTercero; tipoOperacion: DiotTipoOperacion;
  actosPagados16: number; actosPagados8?: number; actosPagados0?: number; actosExentos?: number;
  actosNoObjeto?: number; actosNoObjetoExtranjero?: number; iepsPagado?: number;
  ivaAcreditable16: number; ivaAcreditable8?: number; ivaRetenido: number;
  idFiscal?: string; pais?: string; nacionalidad?: string; jurisdiccionFiscal?: string;
  regionFronteriza?: 'NORTE' | 'SUR';
  ivaNoAcreditable16?: number; ivaNoAcreditable16Prorrata?: number;
  ivaNoAcreditable8?: number; ivaNoAcreditable8Prorrata?: number;
  ivaNoAcreditableImportacionesTangibles?: number; ivaNoAcreditableImportacionesTangiblesProrrata?: number;
  ivaNoAcreditableImportacionesIntangibles?: number; ivaNoAcreditableImportacionesIntangiblesProrrata?: number;
  importacionesTangibles16?: number; importacionesIntangibles16?: number; importacionesExentas?: number;
  devolucionesMxn?: number; devoluciones8?: number;
  /** Convención SAT DIOT 2025/2026 campo 54: '01' = Sí manifiesta efectos fiscales. */
  manifestacionEfectos?: string;
}

export interface DiotBatchValidationWarning {
  rfc: string; nombre: string; message: string;
}

/**
 * Construye una línea del layout batch oficial SAT DIOT 2025/2026:
 * exactamente 54 campos delimitados por `|` (53 pipes por línea, sin pipes externos).
 */
export function buildDiot54BatchLine(row: DiotTxtRowInput): string {
  const cols = new Array<string>(54).fill('');
  const safeStr = (val: string | undefined) => (val || '').replace(/\|/g, ' ').trim();
  const roundAmt = (val: number | undefined) => {
    const rounded = roundArt20Cff(val || 0);
    return rounded > 0 ? String(rounded) : '';
  };

  cols[0] = row.tipoTercero;
  cols[1] = normalizeDiotTipoOperacion(row.tipoOperacion, row.tipoTercero);

  if (row.tipoTercero === '04') {
    cols[2] = safeStr(row.rfc).toUpperCase();
  } else if (row.tipoTercero === '05') {
    const idFiscal = safeStr(row.idFiscal) || (row.rfc !== 'XEXX010101000' ? safeStr(row.rfc) : '');
    const pais = safeStr(row.pais).toUpperCase() || 'USA';
    cols[3] = idFiscal;
    cols[4] = safeStr(row.nombre);
    cols[5] = pais;
    cols[6] = pais === 'ZZZ' ? safeStr(row.jurisdiccionFiscal || row.nacionalidad) : '';
  }

  if (row.regionFronteriza === 'SUR') {
    cols[9] = roundAmt(row.actosPagados8);
    cols[10] = roundAmt(row.devoluciones8);
    cols[19] = roundAmt(row.ivaAcreditable8);
    cols[31] = roundAmt(row.ivaNoAcreditable8);
    cols[32] = roundAmt(row.ivaNoAcreditable8Prorrata);
  } else {
    cols[7] = roundAmt(row.actosPagados8);
    cols[8] = roundAmt(row.devoluciones8);
    cols[17] = roundAmt(row.ivaAcreditable8);
    cols[27] = roundAmt(row.ivaNoAcreditable8);
    cols[28] = roundAmt(row.ivaNoAcreditable8Prorrata);
  }

  cols[11] = roundAmt(row.actosPagados16);
  cols[12] = roundAmt(row.devolucionesMxn);
  cols[13] = roundAmt(row.importacionesTangibles16);
  cols[15] = roundAmt(row.importacionesIntangibles16);
  cols[21] = roundAmt(row.ivaAcreditable16 > 0 ? row.ivaAcreditable16 : 0);
  cols[35] = roundAmt(row.ivaNoAcreditable16);
  cols[36] = roundAmt(row.ivaNoAcreditable16Prorrata);
  cols[39] = roundAmt(row.ivaNoAcreditableImportacionesTangibles);
  cols[40] = roundAmt(row.ivaNoAcreditableImportacionesTangiblesProrrata);
  cols[44] = roundAmt(row.ivaNoAcreditableImportacionesIntangiblesProrrata);
  cols[46] = roundAmt(row.ivaNoAcreditableImportacionesIntangibles);
  cols[47] = roundAmt(row.ivaRetenido);
  cols[48] = roundAmt(row.importacionesExentas);
  cols[49] = roundAmt(row.actosExentos);
  cols[50] = roundAmt(row.actosPagados0);
  cols[51] = roundAmt(row.actosNoObjeto);
  cols[52] = roundAmt(row.actosNoObjetoExtranjero);
  cols[53] = row.manifestacionEfectos || '01';
  return cols.join('|');
}

/** Valida que Campo 13 <= Campo 12 (y devoluciones 8% <= actos 8%) en líneas DIOT de 54 campos. */
export function validateDiotBatchLines(
  rows: ReadonlyArray<{ rfc: string; nombre: string; batchLine: string }>
): DiotBatchValidationWarning[] {
  const warnings: DiotBatchValidationWarning[] = [];
  for (const r of rows) {
    const cols = r.batchLine.split('|');
    const checks: Array<[number, number, string]> = [
      [12, 11, 'Campo 13 devoluciones 16% supera Campo 12 actos pagados 16%'],
      [8, 7, 'Campo 9 devoluciones FN 8% supera Campo 8 actos FN 8%'],
      [10, 9, 'Campo 11 devoluciones FS 8% supera Campo 10 actos FS 8%']
    ];
    for (const [devIdx, actIdx, label] of checks) {
      const dev = Number(cols[devIdx] || 0);
      const act = Number(cols[actIdx] || 0);
      if (dev > act) warnings.push({ rfc: r.rfc, nombre: r.nombre, message: `${label} ($${dev} > $${act}).` });
    }
  }
  return warnings;
}

/** Genera el contenido TXT completo del layout DIOT SAT 2025/2026 (54 campos delimitados por `|`). */
export function generateDiotTxt(rows: readonly DiotTxtRowInput[]): string {
  return rows.map((r) => buildDiot54BatchLine(r)).join('\n');
}

export function resolveDrPaidMxnForDiot(dr: CfdiRelatedDoc, doc: CfdiDocument, fallbackTc: number): number {
  const imp = Number(dr.impPagado || 0);
  if (imp <= 0) return 0;
  const monedaDr = dr.monedaDr?.toUpperCase();
  if (monedaDr === 'MXN') return imp;
  const pagoMoneda = (dr.pagoMoneda || doc.moneda || 'MXN').toUpperCase();
  if (pagoMoneda === 'MXN') {
    return monedaDr && monedaDr !== 'MXN' && dr.equivalenciaDr && dr.equivalenciaDr > 0 ? imp / dr.equivalenciaDr : imp;
  }
  if ((dr.pagoTipoCambio || 0) > 0) {
    const tcP = dr.pagoTipoCambio!;
    if (!monedaDr || monedaDr === pagoMoneda) return imp * tcP;
    return dr.equivalenciaDr && dr.equivalenciaDr > 0 ? (imp / dr.equivalenciaDr) * tcP : imp * tcP;
  }
  return doc.moneda && doc.moneda !== 'MXN' ? imp * fallbackTc : imp;
}

export function computePago20BasesWithoutBreakdown(
  doc: CfdiDocument, tc: number, concLower: string, thirdParty?: ThirdPartyRecord
) {
  const drTotalMxn = (doc.relatedDocs ?? []).reduce((sum, dr) => sum + resolveDrPaidMxnForDiot(dr, doc, tc), 0);
  const rawTotalMxn = doc.total > 0 ? doc.total * tc : doc.subtotal * tc;
  const paidTotalMxn = drTotalMxn > 0 ? drTotalMxn : rawTotalMxn;
  if (paidTotalMxn <= 0) return { base16: 0, base8: 0, base0: 0, baseExenta: 0, ivaMxn: 0, paidTotalMxn: 0 };
  if (doc.ivaTrasladado > 0) {
    const ivaMxn = doc.ivaTrasladado * tc;
    const base = doc.subtotal > 0 ? doc.subtotal * tc : Math.max(0, paidTotalMxn - ivaMxn);
    const ratio = base > 0 ? ivaMxn / base : 0.16;
    return Math.abs(ratio - 0.08) < 0.015
      ? { base16: 0, base8: base, base0: 0, baseExenta: 0, ivaMxn, paidTotalMxn }
      : { base16: base, base8: 0, base0: 0, baseExenta: 0, ivaMxn, paidTotalMxn };
  }
  const rate = thirdParty?.tasaIvaDefault;
  if (rate === 0) return { base16: 0, base8: 0, base0: paidTotalMxn, baseExenta: 0, ivaMxn: 0, paidTotalMxn };
  if (concLower.includes('exento') && rate === undefined) {
    return { base16: 0, base8: 0, base0: 0, baseExenta: paidTotalMxn, ivaMxn: 0, paidTotalMxn };
  }
  const paidCents = toCents(paidTotalMxn);
  const div = rate === 8 ? 1.08 : 1.16;
  const baseCents = Math.round(paidCents / div);
  const ivaMxn = fromCents(paidCents - baseCents);
  return rate === 8
    ? { base16: 0, base8: fromCents(baseCents), base0: 0, baseExenta: 0, ivaMxn, paidTotalMxn }
    : { base16: fromCents(baseCents), base8: 0, base0: 0, baseExenta: 0, ivaMxn, paidTotalMxn };
}

function applyIvaCreditability(rawIva: number, dedPct: number, prorationFactor: number) {
  if (rawIva <= 0) return { acreditable: 0, noDed: 0, prorrata: 0 };
  const afterDed = rawIva * (dedPct / 100);
  const acreditable = afterDed * prorationFactor;
  return { acreditable, noDed: Math.max(0, rawIva - afterDed), prorrata: Math.max(0, afterDed - acreditable) };
}

export function resolveDiotDocAmounts(
  doc: CfdiDocument,
  thirdParty?: ThirdPartyRecord,
  options?: { prorationFactor?: number; tipoOperacion?: DiotTipoOperacion; isForeign?: boolean }
) {
  const concLower = doc.conceptoPrincipal.toLowerCase();
  const tc = doc.moneda && doc.moneda !== 'MXN' && (doc.tipoCambio || 1) > 0 ? doc.tipoCambio || 1 : 1;
  const netBase = Math.max(0, doc.subtotal - (doc.descuento || 0)) * tc;
  const isCreditNote = doc.tipoComprobante === 'E';
  const tb = doc.taxBreakdown;
  const hasBreakdown = tb != null && (tb.base16 > 0 || tb.base8 > 0 || tb.base0 > 0 || tb.baseExento > 0 || tb.ieps > 0);
  const dedPct = Math.max(0, Math.min(100, doc.deductiblePct ?? thirdParty?.deductiblePct ?? 100));
  const prorationFactor = Math.max(0, Math.min(1, options?.prorationFactor ?? 1));
  const op = options?.tipoOperacion;
  const isTangibleImport = op === '07' || /\b(pedimento|aduana|importaci[oó]n\s+(de\s+)?bienes|despacho\s+aduanal)\b/i.test(concLower);
  const isIntangibleImport = !isTangibleImport && (op === '08' || /\b(importaci[oó]n\s+(de\s+)?servicios|intangibles?\s+extranjero)\b/i.test(concLower));

  let subtotal16 = 0, subtotal8 = 0, baseCero = 0, baseExenta = 0;
  let actosNoObjeto = 0, actosNoObjetoExtranjero = 0, iepsPagado = 0, devolucion16 = 0, devolucion8 = 0;
  let rawIva16 = 0, rawIva8 = 0, totalMxn = doc.total * tc;

  if (doc.tipoComprobante === 'P' && !hasBreakdown) {
    const p20 = computePago20BasesWithoutBreakdown(doc, tc, concLower, thirdParty);
    const isP20Rate8 = p20.base8 > 0 && p20.base16 === 0;
    subtotal16 = p20.base16; subtotal8 = p20.base8; baseCero = p20.base0; baseExenta = p20.baseExenta;
    rawIva16 = isP20Rate8 ? 0 : p20.ivaMxn; rawIva8 = isP20Rate8 ? p20.ivaMxn : 0;
    totalMxn = p20.paidTotalMxn > 0 ? p20.paidTotalMxn : doc.total * tc;
  } else {
    const isExemptOrZero = doc.ivaTrasladado === 0 && !isCreditNote;
    const rawIvaMxn = doc.ivaTrasladado * tc;
    const inferredRatio = netBase > 0 ? rawIvaMxn / netBase : 0.16;
    const inferredIsRate8 = Math.abs(inferredRatio - 0.08) < 0.015 || (thirdParty?.tasaIvaDefault === 8 && rawIvaMxn > 0 && Math.abs(inferredRatio - 0.16) >= 0.015);
    const isObjetoImp01 = !isCreditNote && tb?.objetoImp === '01' && tb.iva16 + tb.iva8 === 0 && doc.ivaTrasladado === 0;

    if (!isCreditNote) {
      subtotal16 = hasBreakdown ? tb.base16 * tc : !isExemptOrZero && !inferredIsRate8 ? netBase : 0;
      subtotal8 = hasBreakdown ? tb.base8 * tc : !isExemptOrZero && inferredIsRate8 ? netBase : 0;
      if (isObjetoImp01) {
        const noObjAmt = hasBreakdown ? (tb.baseExento || tb.base0 || 0) * tc || netBase : netBase;
        if (options?.isForeign) actosNoObjetoExtranjero = noObjAmt;
        else actosNoObjeto = noObjAmt;
      } else {
        baseCero = hasBreakdown ? tb.base0 * tc : isExemptOrZero && !concLower.includes('exento') ? netBase : 0;
        baseExenta = hasBreakdown ? tb.baseExento * tc : isExemptOrZero && concLower.includes('exento') ? netBase : 0;
      }
      iepsPagado = hasBreakdown ? tb.ieps * tc : 0;
    }

    if (hasBreakdown && tb.iva16 + tb.iva8 > 0) {
      rawIva16 = tb.iva16 * tc; rawIva8 = tb.iva8 * tc;
    } else if (rawIvaMxn > 0) {
      const is8 = hasBreakdown ? tb.base8 > 0 && tb.base16 === 0 : inferredIsRate8;
      if (is8) rawIva8 = rawIvaMxn; else rawIva16 = rawIvaMxn;
    }

    if (isCreditNote) {
      if (hasBreakdown) { devolucion16 = tb.base16 * tc; devolucion8 = tb.base8 * tc; }
      else if (doc.ivaTrasladado > 0) { if (inferredIsRate8) devolucion8 = netBase; else devolucion16 = netBase; }
    }
  }

  let importacionesTangibles16 = 0, importacionesIntangibles16 = 0, importacionesExentas = 0;
  if (isTangibleImport) {
    importacionesTangibles16 = subtotal16; subtotal16 = 0; importacionesExentas = baseExenta; baseExenta = 0;
  } else if (isIntangibleImport) {
    importacionesIntangibles16 = subtotal16; subtotal16 = 0; importacionesExentas = baseExenta; baseExenta = 0;
  }

  const c16 = applyIvaCreditability(rawIva16, dedPct, prorationFactor);
  const c8 = applyIvaCreditability(rawIva8, dedPct, prorationFactor);
  return {
    isCreditNote, subtotal16, subtotal8, importacionesTangibles16, importacionesIntangibles16,
    importacionesExentas, baseCero, baseExenta, actosNoObjeto, actosNoObjetoExtranjero,
    iepsPagado, devolucion16, devolucion8, iva16Mxn: c16.acreditable, iva8Mxn: c8.acreditable,
    ivaNoAcreditable16: !isTangibleImport && !isIntangibleImport ? c16.noDed : 0,
    ivaNoAcreditable16Prorrata: !isTangibleImport && !isIntangibleImport ? c16.prorrata : 0,
    ivaNoAcreditable8: c8.noDed, ivaNoAcreditable8Prorrata: c8.prorrata,
    ivaNoAcreditableImportacionesTangibles: isTangibleImport ? c16.noDed : 0,
    ivaNoAcreditableImportacionesTangiblesProrrata: isTangibleImport ? c16.prorrata : 0,
    ivaNoAcreditableImportacionesIntangibles: isIntangibleImport ? c16.noDed : 0,
    ivaNoAcreditableImportacionesIntangiblesProrrata: isIntangibleImport ? c16.prorrata : 0,
    ivaRetenidoMxn: doc.ivaRetenido * tc, isrRetenidoMxn: doc.isrRetenido * tc, totalMxn
  };
}
