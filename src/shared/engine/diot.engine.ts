import type {
  AccountWithBalance,
  CfdiDocument,
  CfdiRelatedDoc,
  Company,
  DiotReportResponse,
  DiotSupplierRow,
  ThirdPartyRecord
} from '../types';
import { fromCents, sumCents, toCents } from './invariants-and-math';
import {
  buildDiot54BatchLine,
  generateDiotTxt,
  type DiotTipoTercero,
  type DiotTxtRowInput
} from './diot-txt';

export { buildDiot54BatchLine, generateDiotTxt, type DiotTipoTercero, type DiotTxtRowInput };

export interface DiotComputationParams {
  company: Company;
  ejercicio: number;
  periodo: number;
  cfdis: readonly CfdiDocument[];
  polizaIdsInPeriod: ReadonlySet<string>;
  trialBalance: readonly AccountWithBalance[];
  thirdParties?: readonly ThirdPartyRecord[];
}

type InternalDiotRow = DiotSupplierRow & {
  pais?: string;
  nacionalidad?: string;
  idFiscal?: string;
  devolucionesMxn?: number;
};

type ExtendedThirdParty = ThirdPartyRecord & {
  pais?: string;
  nacionalidad?: string;
  idFiscal?: string;
};

function resolveDrPaidMxn(dr: CfdiRelatedDoc, doc: CfdiDocument, fallbackTc: number): number {
  const imp = Number(dr.impPagado || 0);
  if (imp <= 0) return 0;
  if (dr.monedaDr === 'MXN') return imp;
  if (dr.pagoMoneda && dr.pagoMoneda !== 'MXN' && (dr.pagoTipoCambio || 0) > 0) {
    const tcP = dr.pagoTipoCambio!;
    if (!dr.monedaDr || dr.monedaDr === dr.pagoMoneda) return imp * tcP;
    if (dr.equivalenciaDr && dr.equivalenciaDr > 0) {
      return (dr.equivalenciaDr < 1 ? imp / dr.equivalenciaDr : imp * dr.equivalenciaDr) * tcP;
    }
    return imp * tcP;
  }
  return doc.moneda && doc.moneda !== 'MXN' ? imp * fallbackTc : imp;
}

function computePago20BasesWithoutBreakdown(
  doc: CfdiDocument,
  tc: number,
  concLower: string,
  thirdParty?: ExtendedThirdParty
) {
  const drTotalMxn = (doc.relatedDocs ?? []).reduce(
    (sum, dr) => sum + resolveDrPaidMxn(dr, doc, tc),
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
  if (rate === 0) {
    return { base16: 0, base8: 0, base0: paidTotalMxn, baseExenta: 0, ivaMxn: 0, paidTotalMxn };
  }
  if (concLower.includes('exento') && rate === undefined) {
    return { base16: 0, base8: 0, base0: 0, baseExenta: paidTotalMxn, ivaMxn: 0, paidTotalMxn };
  }
  const paidCents = toCents(paidTotalMxn);
  if (rate === 8) {
    const baseCents = Math.round(paidCents / 1.08);
    return {
      base16: 0,
      base8: fromCents(baseCents),
      base0: 0,
      baseExenta: 0,
      ivaMxn: fromCents(paidCents - baseCents),
      paidTotalMxn
    };
  }
  const baseCents = Math.round(paidCents / 1.16);
  return {
    base16: fromCents(baseCents),
    base8: 0,
    base0: 0,
    baseExenta: 0,
    ivaMxn: fromCents(paidCents - baseCents),
    paidTotalMxn
  };
}

function resolveDocAmounts(doc: CfdiDocument, thirdParty?: ExtendedThirdParty) {
  const concLower = doc.conceptoPrincipal.toLowerCase();
  const tc = doc.moneda && doc.moneda !== 'MXN' && (doc.tipoCambio || 1) > 0 ? doc.tipoCambio || 1 : 1;
  const netBase = Math.max(0, doc.subtotal - (doc.descuento || 0)) * tc;
  const isCreditNote = doc.tipoComprobante === 'E';
  const tb = doc.taxBreakdown;
  const hasBreakdown =
    !isCreditNote &&
    tb != null &&
    (tb.base16 > 0 || tb.base8 > 0 || tb.base0 > 0 || tb.baseExento > 0 || tb.ieps > 0);

  if (doc.tipoComprobante === 'P' && !hasBreakdown) {
    const p20 = computePago20BasesWithoutBreakdown(doc, tc, concLower, thirdParty);
    return {
      isCreditNote: false,
      subtotal16: p20.base16,
      subtotal8: p20.base8,
      baseCero: p20.base0,
      baseExenta: p20.baseExenta,
      iepsPagado: 0,
      devolucion: 0,
      ivaTrasladadoMxn: p20.ivaMxn,
      ivaRetenidoMxn: doc.ivaRetenido * tc,
      isrRetenidoMxn: doc.isrRetenido * tc,
      totalMxn: p20.paidTotalMxn > 0 ? p20.paidTotalMxn : doc.total * tc
    };
  }

  const isExemptOrZero = doc.ivaTrasladado === 0 && !isCreditNote;
  const subtotal16 = hasBreakdown
    ? tb.base16 * tc
    : !isCreditNote && !isExemptOrZero
      ? netBase
      : 0;
  const subtotal8 = hasBreakdown ? tb.base8 * tc : 0;
  const baseCero = hasBreakdown
    ? tb.base0 * tc
    : isExemptOrZero && !concLower.includes('exento')
      ? netBase
      : 0;
  const baseExenta = hasBreakdown
    ? tb.baseExento * tc
    : isExemptOrZero && concLower.includes('exento')
      ? netBase
      : 0;
  const iepsPagado = hasBreakdown ? tb.ieps * tc : 0;
  const ivaTrasladadoMxn =
    hasBreakdown && tb.iva16 + tb.iva8 > 0 ? (tb.iva16 + tb.iva8) * tc : doc.ivaTrasladado * tc;

  return {
    isCreditNote,
    subtotal16,
    subtotal8,
    baseCero,
    baseExenta,
    iepsPagado,
    devolucion: isCreditNote ? netBase : 0,
    ivaTrasladadoMxn,
    ivaRetenidoMxn: doc.ivaRetenido * tc,
    isrRetenidoMxn: doc.isrRetenido * tc,
    totalMxn: doc.total * tc
  };
}

/**
 * Motor único de cálculo y generación de layout DIOT (Formato SAT 2025/2026 de 54 campos)
 * compartido entre SQLite local y Supabase Cloud.
 */
export function computeDiotReportData({
  company,
  ejercicio,
  periodo,
  cfdis,
  polizaIdsInPeriod,
  trialBalance,
  thirdParties
}: DiotComputationParams): DiotReportResponse {
  const paidRecibidos = cfdis.filter(
    (c) =>
      c.direction === 'RECIBIDO' &&
      c.statusSat !== 'CANCELADO' &&
      c.tipoComprobante !== 'T' &&
      c.tipoComprobante !== 'N' &&
      c.polizaId &&
      polizaIdsInPeriod.has(c.polizaId) &&
      (c.metodoPago === 'PUE' || c.tipoComprobante === 'P' || c.tipoComprobante === 'E')
  );

  const thirdPartyByRfc = new Map<string, ExtendedThirdParty>();
  for (const tp of thirdParties ?? []) {
    if (tp.rfc) thirdPartyByRfc.set(tp.rfc.trim().toUpperCase(), tp as ExtendedThirdParty);
  }

  const byRfcOp = new Map<string, InternalDiotRow>();

  for (const doc of paidRecibidos) {
    const rfc = doc.emisorRfc.trim().toUpperCase();
    const thirdParty = thirdPartyByRfc.get(rfc);
    const concLower = doc.conceptoPrincipal.toLowerCase();
    let tipoOperacion: '03' | '06' | '85' = thirdParty?.tipoOperacionDiot ?? '85';
    if (!thirdParty?.tipoOperacionDiot) {
      if (concLower.includes('renta') || concLower.includes('arrendamiento')) tipoOperacion = '06';
      else if (concLower.includes('honorario') || concLower.includes('auditor') || concLower.includes('consultor')) {
        tipoOperacion = '03';
      }
    }

    const groupKey = `${rfc}::${tipoOperacion}`;
    const existing = byRfcOp.get(groupKey);
    const amt = resolveDocAmounts(doc, thirdParty);
    const sign = amt.isCreditNote ? -1 : 1;
    const tipoTercero: '04' | '05' =
      thirdParty?.tipoTerceroDiot ??
      (rfc === 'XEXX010101000' || rfc.startsWith('XEXX') ? '05' : '04');

    if (!existing) {
      byRfcOp.set(groupKey, {
        rfc,
        nombre: doc.emisorNombre,
        tipoTercero,
        tipoOperacion,
        actosPagados16: fromCents(toCents(amt.subtotal16)),
        actosPagados8: fromCents(toCents(amt.subtotal8)),
        actosPagados0: fromCents(toCents(amt.baseCero)),
        actosExentos: fromCents(toCents(amt.baseExenta)),
        iepsPagado: fromCents(toCents(amt.iepsPagado)),
        ivaAcreditable16: fromCents(toCents(sign * amt.ivaTrasladadoMxn)),
        ivaRetenido: fromCents(toCents(sign * amt.ivaRetenidoMxn)),
        isrRetenido: fromCents(toCents(sign * amt.isrRetenidoMxn)),
        totalPagado: fromCents(toCents(sign * amt.totalMxn)),
        cfdiCount: 1,
        batchLine: '',
        pais: thirdParty?.pais,
        nacionalidad: thirdParty?.nacionalidad,
        idFiscal: thirdParty?.idFiscal,
        devolucionesMxn: amt.devolucion
      });
    } else {
      existing.actosPagados16 = fromCents(toCents(existing.actosPagados16) + toCents(amt.subtotal16));
      existing.actosPagados8 = fromCents(toCents(existing.actosPagados8) + toCents(amt.subtotal8));
      existing.actosPagados0 = fromCents(toCents(existing.actosPagados0) + toCents(amt.baseCero));
      existing.actosExentos = fromCents(toCents(existing.actosExentos) + toCents(amt.baseExenta));
      existing.iepsPagado = fromCents(toCents(existing.iepsPagado) + toCents(amt.iepsPagado));
      existing.ivaAcreditable16 = fromCents(
        toCents(existing.ivaAcreditable16) + toCents(sign * amt.ivaTrasladadoMxn)
      );
      existing.ivaRetenido = fromCents(toCents(existing.ivaRetenido) + toCents(sign * amt.ivaRetenidoMxn));
      existing.isrRetenido = fromCents(toCents(existing.isrRetenido) + toCents(sign * amt.isrRetenidoMxn));
      existing.totalPagado = fromCents(toCents(existing.totalPagado) + toCents(sign * amt.totalMxn));
      existing.devolucionesMxn = fromCents(toCents(existing.devolucionesMxn) + toCents(amt.devolucion));
      existing.cfdiCount += 1;
    }
  }

  const rows: DiotSupplierRow[] = Array.from(byRfcOp.values()).map((r) => {
    const batchLine = buildDiot54BatchLine(r);
    const { pais: _p, nacionalidad: _n, idFiscal: _id, devolucionesMxn: _dev, ...publicRow } = r;
    return { ...publicRow, batchLine };
  });

  const actosPagados16 = fromCents(
    sumCents(rows.map((r) => r.actosPagados16)) + sumCents(rows.map((r) => r.actosPagados8 || 0))
  );
  const ivaAcreditable16 = fromCents(sumCents(rows.map((r) => r.ivaAcreditable16)));
  const ivaRetenido = fromCents(sumCents(rows.map((r) => r.ivaRetenido)));
  const isrRetenido = fromCents(sumCents(rows.map((r) => r.isrRetenido)));

  const ivaTrasladadoAcc = trialBalance.find((a) => a.code === '208-01-001');
  const ivaTrasladadoCobrado = ivaTrasladadoAcc ? ivaTrasladadoAcc.periodCredits : 0;
  const ivaNetoCargoFavor = fromCents(toCents(ivaTrasladadoCobrado) - toCents(ivaAcreditable16));
  const mesStr = String(periodo).padStart(2, '0');

  return {
    company,
    ejercicio,
    periodo,
    rows,
    totals: {
      actosPagados16,
      ivaAcreditable16,
      ivaRetenido,
      isrRetenido,
      ivaTrasladadoCobrado,
      ivaNetoCargoFavor
    },
    batchTxtContent: rows.map((r) => r.batchLine).join('\n'),
    filename: `DIOT_${company.rfc}_${ejercicio}_${mesStr}.txt`
  };
}
