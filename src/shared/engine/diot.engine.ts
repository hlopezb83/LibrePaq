import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  DiotReportResponse,
  DiotSupplierRow,
  ThirdPartyRecord
} from '../types';
import { fromCents, sumCents, toCents } from './invariants-and-math';
import {
  buildDiot54BatchLine,
  computePago20BasesWithoutBreakdown,
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
  devoluciones8?: number;
  ivaAcreditable16Only: number;
  ivaAcreditable8: number;
};

type ExtendedThirdParty = ThirdPartyRecord & {
  pais?: string;
  nacionalidad?: string;
  idFiscal?: string;
};

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

  const subtotal16 = hasBreakdown
    ? tb.base16 * tc
    : !isCreditNote && !isExemptOrZero && !inferredIsRate8
      ? netBase
      : 0;
  const subtotal8 = hasBreakdown
    ? tb.base8 * tc
    : !isCreditNote && !isExemptOrZero && inferredIsRate8
      ? netBase
      : 0;
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

  const ncIsRate8 = isCreditNote && ((tb != null && tb.iva8 > 0 && tb.iva16 === 0) || inferredIsRate8);

  return {
    isCreditNote,
    subtotal16,
    subtotal8,
    baseCero,
    baseExenta,
    iepsPagado,
    devolucion16: isCreditNote && !ncIsRate8 ? netBase : 0,
    devolucion8: isCreditNote && ncIsRate8 ? netBase : 0,
    iva16Mxn,
    iva8Mxn,
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
  const ppdInvoiceUuids = new Set<string>();
  const paidDocUuidsInPeriod = new Set<string>();
  for (const c of cfdis) {
    if (c.direction !== 'RECIBIDO' || c.statusSat === 'CANCELADO') continue;
    const upperUuid = (c.uuid || '').trim().toUpperCase();
    if (c.metodoPago === 'PPD' && c.tipoComprobante !== 'E' && upperUuid) {
      ppdInvoiceUuids.add(upperUuid);
    }
    if (c.polizaId && polizaIdsInPeriod.has(c.polizaId)) {
      if (c.tipoComprobante === 'P') {
        if (c.uuidRelacionado) paidDocUuidsInPeriod.add(c.uuidRelacionado.trim().toUpperCase());
        for (const dr of c.relatedDocs ?? []) {
          if (dr.idDocumento) paidDocUuidsInPeriod.add(dr.idDocumento.trim().toUpperCase());
        }
      } else if (c.metodoPago === 'PUE' && c.tipoComprobante !== 'E' && upperUuid) {
        paidDocUuidsInPeriod.add(upperUuid);
      }
    }
  }

  const paidRecibidos = cfdis.filter((c) => {
    if (
      c.direction !== 'RECIBIDO' ||
      c.statusSat === 'CANCELADO' ||
      c.tipoComprobante === 'T' ||
      c.tipoComprobante === 'N' ||
      !c.polizaId ||
      !polizaIdsInPeriod.has(c.polizaId)
    ) {
      return false;
    }
    if (c.tipoComprobante === 'E') {
      if (c.metodoPago === 'PPD') return false;
      const relList = (c.uuidRelacionado || '')
        .split(/[\s,;]+/)
        .map((u) => u.trim().toUpperCase())
        .filter(Boolean);
      if (relList.some((u) => ppdInvoiceUuids.has(u) && !paidDocUuidsInPeriod.has(u))) {
        return false;
      }
      return true;
    }
    return c.metodoPago === 'PUE' || c.tipoComprobante === 'P';
  });

  const thirdPartyByRfc = new Map<string, ExtendedThirdParty>();
  for (const tp of thirdParties ?? []) {
    if (tp.rfc) thirdPartyByRfc.set(tp.rfc.trim().toUpperCase(), tp as ExtendedThirdParty);
  }

  const byRfcOp = new Map<string, InternalDiotRow>();

  for (const doc of paidRecibidos) {
    const rfc = doc.emisorRfc.trim().toUpperCase();
    const thirdParty = thirdPartyByRfc.get(rfc);
    const tpOpt = thirdParty as { pais?: string; nacionalidad?: string; idFiscal?: string } | undefined;
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

    const iva16Signed = fromCents(toCents(sign * amt.iva16Mxn));
    const iva8Signed = fromCents(toCents(sign * amt.iva8Mxn));
    const ivaTotalSigned = fromCents(toCents(iva16Signed) + toCents(iva8Signed));

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
        ivaAcreditable16: ivaTotalSigned,
        ivaAcreditable16Only: iva16Signed,
        ivaAcreditable8: iva8Signed,
        ivaRetenido: fromCents(toCents(sign * amt.ivaRetenidoMxn)),
        isrRetenido: fromCents(toCents(sign * amt.isrRetenidoMxn)),
        totalPagado: fromCents(toCents(sign * amt.totalMxn)),
        cfdiCount: 1,
        batchLine: '',
        pais: tpOpt?.pais,
        nacionalidad: tpOpt?.nacionalidad,
        idFiscal: tpOpt?.idFiscal,
        devolucionesMxn: amt.devolucion16,
        devoluciones8: amt.devolucion8
      });
    } else {
      existing.actosPagados16 = fromCents(toCents(existing.actosPagados16) + toCents(amt.subtotal16));
      existing.actosPagados8 = fromCents(toCents(existing.actosPagados8) + toCents(amt.subtotal8));
      existing.actosPagados0 = fromCents(toCents(existing.actosPagados0) + toCents(amt.baseCero));
      existing.actosExentos = fromCents(toCents(existing.actosExentos) + toCents(amt.baseExenta));
      existing.iepsPagado = fromCents(toCents(existing.iepsPagado) + toCents(amt.iepsPagado));
      existing.ivaAcreditable16Only = fromCents(toCents(existing.ivaAcreditable16Only) + toCents(iva16Signed));
      existing.ivaAcreditable8 = fromCents(toCents(existing.ivaAcreditable8) + toCents(iva8Signed));
      existing.ivaAcreditable16 = fromCents(toCents(existing.ivaAcreditable16Only) + toCents(existing.ivaAcreditable8));
      existing.ivaRetenido = fromCents(toCents(existing.ivaRetenido) + toCents(sign * amt.ivaRetenidoMxn));
      existing.isrRetenido = fromCents(toCents(existing.isrRetenido) + toCents(sign * amt.isrRetenidoMxn));
      existing.totalPagado = fromCents(toCents(existing.totalPagado) + toCents(sign * amt.totalMxn));
      existing.devolucionesMxn = fromCents(toCents(existing.devolucionesMxn) + toCents(amt.devolucion16));
      existing.devoluciones8 = fromCents(toCents(existing.devoluciones8) + toCents(amt.devolucion8));
      existing.cfdiCount += 1;
    }
  }

  const rows: DiotSupplierRow[] = Array.from(byRfcOp.values()).map((r) => {
    const batchLine = buildDiot54BatchLine({ ...r, ivaAcreditable16: r.ivaAcreditable16Only });
    const {
      pais: _p,
      nacionalidad: _n,
      idFiscal: _id,
      devolucionesMxn: _dev,
      devoluciones8: _dev8,
      ivaAcreditable16Only: _i16,
      ivaAcreditable8: _i8,
      ...publicRow
    } = r;
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
