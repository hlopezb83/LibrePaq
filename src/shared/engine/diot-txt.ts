import type { CfdiDocument, CfdiRelatedDoc, ThirdPartyRecord } from '../types';
import { fromCents, toCents } from './invariants-and-math';
import { roundArt20Cff } from './sat-dyp-formatter';

export type DiotTipoTercero = '04' | '05' | '15';

export interface DiotTxtRowInput {
  rfc: string;
  nombre: string;
  tipoTercero: DiotTipoTercero;
  tipoOperacion: '03' | '06' | '85';
  actosPagados16: number;
  actosPagados8?: number;
  actosPagados0?: number;
  actosExentos?: number;
  iepsPagado?: number;
  ivaAcreditable16: number;
  ivaAcreditable8?: number;
  ivaRetenido: number;
  idFiscal?: string;
  pais?: string;
  nacionalidad?: string;
  jurisdiccionFiscal?: string;
  regionFronteriza?: 'NORTE' | 'SUR';
  ivaNoAcreditable16?: number;
  ivaNoAcreditable8?: number;
  ivaNoAcreditableImportacionesIntangibles?: number;
  importacionesTangibles16?: number;
  importacionesIntangibles16?: number;
  importacionesExentas?: number;
  devolucionesMxn?: number;
  devoluciones8?: number;
  /** Convención SAT DIOT 2025/2026 campo 54: '01' = Sí manifiesta efectos fiscales. */
  manifestacionEfectos?: string;
}

/**
 * Construye una línea del layout batch oficial SAT DIOT 2025/2026:
 * exactamente 54 campos delimitados por `|` (53 pipes por línea, sin pipes externos).
 *
 * Mapa resumido de campos (base 1 -> base 0 en `cols`):
 *  1 (`cols[0]`): Tipo Tercero ('04' Nacional | '05' Extranjero | '15' Global)
 *  2 (`cols[1]`): Tipo Operación ('03' | '06' | '85')
 *  3 (`cols[2]`): RFC (solo '04')
 *  4 (`cols[3]`): ID Fiscal extranjero (solo '05')
 *  5 (`cols[4]`): Nombre extranjero (solo '05')
 *  6 (`cols[5]`): País residencia (solo '05'; campo `pais` real o 'USA' como último fallback)
 *  7 (`cols[6]`): Nacionalidad (solo '05')
 *  8 (`cols[7]`): Actos pagados Región Frontera Norte 8% | 9 (`cols[8]`): Devoluciones / IVA no acred. FN 8%
 * 10 (`cols[9]`): Actos pagados Región Frontera Sur 8% | 11 (`cols[10]`): Devoluciones / IVA no acred. FS 8%
 * 12 (`cols[11]`): Actos pagados 16% nacional | 13 (`cols[12]`): Devoluciones/descuentos 16%
 * 14 (`cols[13]`): Importaciones tangibles 16% | 16 (`cols[15]`): Importaciones intangibles y servicios 16%
 * 18 (`cols[17]`): IVA acreditable 8% FN | 20 (`cols[19]`): IVA acreditable 8% FS | 22 (`cols[21]`): IVA acreditable 16%
 * 28-31 (`cols[27..30]`): IVA no acreditable FN 8% | 32-35 (`cols[31..34]`): IVA no acreditable FS 8%
 * 36-39 (`cols[35..38]`): IVA no acreditable Tasa 16%
 * 47 (`cols[46]`): IVA no acreditable importaciones intangibles | 48 (`cols[47]`): IVA retenido por el contribuyente
 * 49 (`cols[48]`): Importaciones exentas | 50 (`cols[49]`): Actos exentos | 51 (`cols[50]`): Actos pagados 0%
 * 54 (`cols[53]`): Manifestación efectos fiscales ('01')
 */
export function buildDiot54BatchLine(row: DiotTxtRowInput): string {
  const cols = new Array<string>(54).fill('');
  const safeStr = (val: string | undefined) => (val || '').replace(/\|/g, ' ').trim();
  const roundAmt = (val: number | undefined) => {
    const rounded = roundArt20Cff(val || 0);
    return rounded > 0 ? String(rounded) : '';
  };

  cols[0] = row.tipoTercero;
  cols[1] = row.tipoOperacion;

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
  } else {
    cols[7] = roundAmt(row.actosPagados8);
    cols[8] = roundAmt(row.devoluciones8);
    cols[17] = roundAmt(row.ivaAcreditable8);
    cols[27] = roundAmt(row.ivaNoAcreditable8);
  }

  cols[11] = roundAmt(row.actosPagados16);
  cols[12] = roundAmt(row.devolucionesMxn);
  cols[13] = roundAmt(row.importacionesTangibles16);
  cols[15] = roundAmt(row.importacionesIntangibles16);
  cols[21] = roundAmt(row.ivaAcreditable16 > 0 ? row.ivaAcreditable16 : 0);
  cols[35] = roundAmt(row.ivaNoAcreditable16);

  cols[46] = roundAmt(row.ivaNoAcreditableImportacionesIntangibles);
  cols[47] = roundAmt(row.ivaRetenido);
  cols[48] = roundAmt(row.importacionesExentas);
  cols[49] = roundAmt(row.actosExentos);
  cols[50] = roundAmt(row.actosPagados0);
  // Campo 54: '01' indica que sí se da efectos fiscales a los comprobantes (convención DIOT 2025/2026)
  cols[53] = row.manifestacionEfectos || '01';

  return cols.join('|');
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
    if (monedaDr && monedaDr !== 'MXN' && dr.equivalenciaDr && dr.equivalenciaDr > 0) {
      return imp / dr.equivalenciaDr;
    }
    return imp;
  }
  if ((dr.pagoTipoCambio || 0) > 0) {
    const tcP = dr.pagoTipoCambio!;
    if (!monedaDr || monedaDr === pagoMoneda) return imp * tcP;
    if (dr.equivalenciaDr && dr.equivalenciaDr > 0) {
      return (imp / dr.equivalenciaDr) * tcP;
    }
    return imp * tcP;
  }
  return doc.moneda && doc.moneda !== 'MXN' ? imp * fallbackTc : imp;
}

export function computePago20BasesWithoutBreakdown(
  doc: CfdiDocument,
  tc: number,
  concLower: string,
  thirdParty?: ThirdPartyRecord
) {
  const drTotalMxn = (doc.relatedDocs ?? []).reduce(
    (sum, dr) => sum + resolveDrPaidMxnForDiot(dr, doc, tc),
    0
  );
  const rawTotalMxn = doc.total > 0 ? doc.total * tc : doc.subtotal * tc;
  const paidTotalMxn = drTotalMxn > 0 ? drTotalMxn : rawTotalMxn;
  if (paidTotalMxn <= 0) {
    return { base16: 0, base8: 0, base0: 0, baseExenta: 0, ivaMxn: 0, paidTotalMxn: 0 };
  }
  if (doc.ivaTrasladado > 0) {
    const ivaMxn = doc.ivaTrasladado * tc;
    const base = doc.subtotal > 0 ? doc.subtotal * tc : Math.max(0, paidTotalMxn - ivaMxn);
    const ratio = base > 0 ? ivaMxn / base : 0.16;
    if (Math.abs(ratio - 0.08) < 0.015) {
      return { base16: 0, base8: base, base0: 0, baseExenta: 0, ivaMxn, paidTotalMxn };
    }
    return { base16: base, base8: 0, base0: 0, baseExenta: 0, ivaMxn, paidTotalMxn };
  }
  const rate = thirdParty?.tasaIvaDefault;
  if (rate === 0) return { base16: 0, base8: 0, base0: paidTotalMxn, baseExenta: 0, ivaMxn: 0, paidTotalMxn };
  if (concLower.includes('exento') && rate === undefined) {
    return { base16: 0, base8: 0, base0: 0, baseExenta: paidTotalMxn, ivaMxn: 0, paidTotalMxn };
  }
  const paidCents = toCents(paidTotalMxn);
  if (rate === 8) {
    const baseCents = Math.round(paidCents / 1.08);
    return { base16: 0, base8: fromCents(baseCents), base0: 0, baseExenta: 0, ivaMxn: fromCents(paidCents - baseCents), paidTotalMxn };
  }
  const baseCents = Math.round(paidCents / 1.16);
  return { base16: fromCents(baseCents), base8: 0, base0: 0, baseExenta: 0, ivaMxn: fromCents(paidCents - baseCents), paidTotalMxn };
}

export function resolveDiotDocAmounts(doc: CfdiDocument, thirdParty?: ThirdPartyRecord) {
  const concLower = doc.conceptoPrincipal.toLowerCase();
  const tc = doc.moneda && doc.moneda !== 'MXN' && (doc.tipoCambio || 1) > 0 ? doc.tipoCambio || 1 : 1;
  const netBase = Math.max(0, doc.subtotal - (doc.descuento || 0)) * tc;
  const isCreditNote = doc.tipoComprobante === 'E';
  const tb = doc.taxBreakdown;
  const hasBreakdown =
    tb != null &&
    (tb.base16 > 0 || tb.base8 > 0 || tb.base0 > 0 || tb.baseExento > 0 || tb.ieps > 0);

  if (doc.tipoComprobante === 'P' && !hasBreakdown) {
    const p20 = computePago20BasesWithoutBreakdown(doc, tc, concLower, thirdParty);
    const isP20Rate8 = p20.base8 > 0 && p20.base16 === 0;
    return {
      isCreditNote: false,
      subtotal16: p20.base16,
      subtotal8: p20.base8,
      baseCero: p20.base0,
      baseExenta: p20.baseExenta,
      iepsPagado: 0,
      devolucion16: 0,
      devolucion8: 0,
      iva16Mxn: isP20Rate8 ? 0 : p20.ivaMxn,
      iva8Mxn: isP20Rate8 ? p20.ivaMxn : 0,
      ivaRetenidoMxn: doc.ivaRetenido * tc,
      isrRetenidoMxn: doc.isrRetenido * tc,
      totalMxn: p20.paidTotalMxn > 0 ? p20.paidTotalMxn : doc.total * tc
    };
  }

  const isExemptOrZero = doc.ivaTrasladado === 0 && !isCreditNote;
  const rawIvaMxn = doc.ivaTrasladado * tc;
  const inferredRatio = netBase > 0 ? rawIvaMxn / netBase : 0.16;
  const inferredIsRate8 =
    Math.abs(inferredRatio - 0.08) < 0.015 ||
    (thirdParty?.tasaIvaDefault === 8 && rawIvaMxn > 0 && Math.abs(inferredRatio - 0.16) >= 0.015);

  const subtotal16 = isCreditNote
    ? 0
    : hasBreakdown
      ? tb.base16 * tc
      : !isExemptOrZero && !inferredIsRate8
        ? netBase
        : 0;
  const subtotal8 = isCreditNote
    ? 0
    : hasBreakdown
      ? tb.base8 * tc
      : !isExemptOrZero && inferredIsRate8
        ? netBase
        : 0;
  const baseCero = isCreditNote
    ? 0
    : hasBreakdown
      ? tb.base0 * tc
      : isExemptOrZero && !concLower.includes('exento')
        ? netBase
        : 0;
  const baseExenta = isCreditNote
    ? 0
    : hasBreakdown
      ? tb.baseExento * tc
      : isExemptOrZero && concLower.includes('exento')
        ? netBase
        : 0;
  const iepsPagado = !isCreditNote && hasBreakdown ? tb.ieps * tc : 0;

  let iva16Mxn = 0;
  let iva8Mxn = 0;
  if (hasBreakdown && tb.iva16 + tb.iva8 > 0) {
    iva16Mxn = tb.iva16 * tc;
    iva8Mxn = tb.iva8 * tc;
  } else if (rawIvaMxn > 0) {
    const is8 = hasBreakdown ? tb.base8 > 0 && tb.base16 === 0 : inferredIsRate8;
    if (is8) iva8Mxn = rawIvaMxn;
    else iva16Mxn = rawIvaMxn;
  }

  const ncIsRate8 =
    isCreditNote &&
    (hasBreakdown ? tb.iva8 > 0 && tb.iva16 === 0 && tb.base8 > 0 && tb.base16 === 0 : inferredIsRate8);
  const devolucion16 = !isCreditNote
    ? 0
    : hasBreakdown
      ? (tb.base16 + tb.base0 + tb.baseExento) * tc
      : !ncIsRate8
        ? netBase
        : 0;
  const devolucion8 = !isCreditNote
    ? 0
    : hasBreakdown
      ? tb.base8 * tc
      : ncIsRate8
        ? netBase
        : 0;

  return {
    isCreditNote,
    subtotal16,
    subtotal8,
    baseCero,
    baseExenta,
    iepsPagado,
    devolucion16,
    devolucion8,
    iva16Mxn,
    iva8Mxn,
    ivaRetenidoMxn: doc.ivaRetenido * tc,
    isrRetenidoMxn: doc.isrRetenido * tc,
    totalMxn: doc.total * tc
  };
}
