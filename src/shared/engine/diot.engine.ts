import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  DiotReportResponse,
  DiotSupplierRow,
  ThirdPartyRecord
} from '../types';
import { parseCalendarDate } from '../date-utils';
import { fromCents, sumCents, toCents } from './invariants-and-math';
import {
  buildDiot54BatchLine,
  generateDiotTxt,
  resolveDiotDocAmounts,
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
  jurisdiccionFiscal?: string;
  idFiscal?: string;
  devolucionesMxn?: number;
  devoluciones8?: number;
  ivaAcreditable16Only: number;
  ivaAcreditable8: number;
};

type ExtendedThirdParty = ThirdPartyRecord & {
  pais?: string | null;
  nacionalidad?: string | null;
  jurisdiccionFiscal?: string | null;
  idFiscal?: string | null;
};

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
  const foreignThirdParties: ExtendedThirdParty[] = [];
  for (const tp of thirdParties ?? []) {
    if (!tp.rfc) continue;
    const upper = tp.rfc.trim().toUpperCase();
    const ext = tp as ExtendedThirdParty;
    if (upper === 'XEXX010101000' || upper.startsWith('XEXX') || tp.tipoTerceroDiot === '05') {
      foreignThirdParties.push(ext);
    }
    if (!thirdPartyByRfc.has(upper)) {
      thirdPartyByRfc.set(upper, ext);
    }
  }

  let unpostedPaidCfdisCount = 0;
  for (const c of cfdis) {
    if (
      c.direction !== 'RECIBIDO' ||
      c.statusSat === 'CANCELADO' ||
      c.tipoComprobante === 'T' ||
      c.tipoComprobante === 'N'
    ) {
      continue;
    }
    const isPaid = c.metodoPago === 'PUE' || c.tipoComprobante === 'P';
    if (!isPaid) continue;
    const effectiveDate = c.tipoComprobante === 'P' ? (c.fechaPago || c.fecha) : c.fecha;
    const cal = parseCalendarDate(effectiveDate, ejercicio, periodo);
    if (cal.year === ejercicio && cal.month === periodo && (!c.polizaId || !polizaIdsInPeriod.has(c.polizaId))) {
      unpostedPaidCfdisCount += 1;
    }
  }

  const byRfcOp = new Map<string, InternalDiotRow>();

  for (const doc of paidRecibidos) {
    const rfc = doc.emisorRfc.trim().toUpperCase();
    const docNameUpper = doc.emisorNombre.trim().toUpperCase();
    const isGenericForeignRfc = rfc === 'XEXX010101000' || rfc.startsWith('XEXX');
    const matchedForeignTp = isGenericForeignRfc
      ? foreignThirdParties.find(
          (tp) => tp.rfc.trim().toUpperCase() === rfc && tp.nombre.trim().toUpperCase() === docNameUpper
        ) ?? (foreignThirdParties.length === 1 ? foreignThirdParties[0] : undefined)
      : undefined;
    const thirdParty = matchedForeignTp ?? thirdPartyByRfc.get(rfc);
    const tpOpt = thirdParty;
    const concLower = doc.conceptoPrincipal.toLowerCase();
    let tipoOperacion: '03' | '06' | '85' = thirdParty?.tipoOperacionDiot ?? '85';
    if (!thirdParty?.tipoOperacionDiot) {
      if (concLower.includes('renta') || concLower.includes('arrendamiento')) tipoOperacion = '06';
      else if (concLower.includes('honorario') || concLower.includes('auditor') || concLower.includes('consultor')) {
        tipoOperacion = '03';
      }
    }

    const amt = resolveDiotDocAmounts(doc, thirdParty);
    const sign = amt.isCreditNote ? -1 : 1;
    const tipoTercero: DiotTipoTercero =
      thirdParty?.tipoTerceroDiot ??
      (isGenericForeignRfc ? '05' : '04');
    const isForeign = tipoTercero === '05' || isGenericForeignRfc;
    const foreignDiscriminator = isForeign ? (tpOpt?.idFiscal?.trim() || docNameUpper) : '';
    const groupKey = isForeign ? `${rfc}::${foreignDiscriminator}::${tipoOperacion}` : `${rfc}::${tipoOperacion}`;
    const existing = byRfcOp.get(groupKey);

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
        pais: tpOpt?.pais ?? undefined,
        nacionalidad: tpOpt?.nacionalidad ?? undefined,
        jurisdiccionFiscal: tpOpt?.jurisdiccionFiscal ?? undefined,
        idFiscal: tpOpt?.idFiscal ?? undefined,
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
      jurisdiccionFiscal: _jf,
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

  const ivaTrasladadoAccs = trialBalance.filter(
    (a) =>
      a.isAffectable !== false &&
      (a.satGroupCode === '208.01' || a.satGroupCode?.startsWith('208.01') || a.code.startsWith('208-01'))
  );
  const ivaTrasladadoCobrado = fromCents(
    Math.max(0, sumCents(ivaTrasladadoAccs.map((a) => a.periodCredits - a.periodCharges)))
  );
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
    filename: `DIOT_${company.rfc}_${ejercicio}_${mesStr}.txt`,
    unpostedPaidCfdisCount
  };
}
