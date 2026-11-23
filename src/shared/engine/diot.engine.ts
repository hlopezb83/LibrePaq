import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  DiotReportResponse,
  DiotSupplierRow,
  ThirdPartyRecord
} from '../types';
import { fromCents, sumCents, toCents } from './invariants-and-math';

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
  devolucionesMxn?: number;
};

/**
 * Motor único de cálculo y generación de layout DIOT (Formato SAT A-29)
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

  const thirdPartyByRfc = new Map<string, ThirdPartyRecord>();
  for (const tp of thirdParties ?? []) {
    if (tp.rfc) thirdPartyByRfc.set(tp.rfc.trim().toUpperCase(), tp);
  }

  const byRfcOp = new Map<string, InternalDiotRow>();

  for (const doc of paidRecibidos) {
    const rfc = doc.emisorRfc.trim().toUpperCase();
    const thirdParty = thirdPartyByRfc.get(rfc);
    const concLower = doc.conceptoPrincipal.toLowerCase();
    let tipoOperacion: '03' | '06' | '85' = thirdParty?.tipoOperacionDiot ?? '85';
    if (!thirdParty?.tipoOperacionDiot) {
      if (concLower.includes('renta') || concLower.includes('arrendamiento')) {
        tipoOperacion = '06';
      } else if (
        concLower.includes('honorario') ||
        concLower.includes('auditor') ||
        concLower.includes('consultor')
      ) {
        tipoOperacion = '03';
      }
    }
    const groupKey = `${rfc}::${tipoOperacion}`;
    const existing = byRfcOp.get(groupKey);

    const tc =
      doc.moneda && doc.moneda !== 'MXN' && (doc.tipoCambio || 1) > 0
        ? doc.tipoCambio || 1
        : 1;
    const netBase = Math.max(0, doc.subtotal - (doc.descuento || 0)) * tc;
    const isCreditNote = doc.tipoComprobante === 'E';
    const tb = doc.taxBreakdown;
    const hasBreakdown =
      !isCreditNote &&
      tb != null &&
      (tb.base16 > 0 || tb.base8 > 0 || tb.base0 > 0 || tb.baseExento > 0 || tb.ieps > 0);

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
    const devolucion = isCreditNote ? netBase : 0;

    const ivaTrasladadoMxn = hasBreakdown && (tb.iva16 + tb.iva8) > 0
      ? (tb.iva16 + tb.iva8) * tc
      : doc.ivaTrasladado * tc;
    const ivaRetenidoMxn = doc.ivaRetenido * tc;
    const isrRetenidoMxn = doc.isrRetenido * tc;
    const totalMxn = doc.total * tc;
    const tipoTercero: '04' | '05' =
      thirdParty?.tipoTerceroDiot ??
      (rfc === 'XEXX010101000' || rfc.startsWith('XEXX') ? '05' : '04');

    if (!existing) {
      byRfcOp.set(groupKey, {
        rfc,
        nombre: doc.emisorNombre,
        tipoTercero,
        tipoOperacion,
        actosPagados16: fromCents(toCents(subtotal16)),
        actosPagados8: fromCents(toCents(subtotal8)),
        actosPagados0: fromCents(toCents(baseCero)),
        actosExentos: fromCents(toCents(baseExenta)),
        iepsPagado: fromCents(toCents(iepsPagado)),
        ivaAcreditable16: fromCents(toCents(isCreditNote ? -ivaTrasladadoMxn : ivaTrasladadoMxn)),
        ivaRetenido: fromCents(toCents(isCreditNote ? -ivaRetenidoMxn : ivaRetenidoMxn)),
        isrRetenido: fromCents(toCents(isCreditNote ? -isrRetenidoMxn : isrRetenidoMxn)),
        totalPagado: fromCents(toCents(isCreditNote ? -totalMxn : totalMxn)),
        cfdiCount: 1,
        batchLine: '',
        devolucionesMxn: devolucion
      });
    } else {
      existing.actosPagados16 = fromCents(
        toCents(existing.actosPagados16) + toCents(subtotal16)
      );
      existing.actosPagados8 = fromCents(
        toCents(existing.actosPagados8) + toCents(subtotal8)
      );
      existing.actosPagados0 = fromCents(
        toCents(existing.actosPagados0) + toCents(baseCero)
      );
      existing.actosExentos = fromCents(
        toCents(existing.actosExentos) + toCents(baseExenta)
      );
      existing.iepsPagado = fromCents(
        toCents(existing.iepsPagado) + toCents(iepsPagado)
      );
      existing.ivaAcreditable16 = fromCents(
        toCents(existing.ivaAcreditable16) + toCents(isCreditNote ? -ivaTrasladadoMxn : ivaTrasladadoMxn)
      );
      existing.ivaRetenido = fromCents(
        toCents(existing.ivaRetenido) + toCents(isCreditNote ? -ivaRetenidoMxn : ivaRetenidoMxn)
      );
      existing.isrRetenido = fromCents(
        toCents(existing.isrRetenido) + toCents(isCreditNote ? -isrRetenidoMxn : isrRetenidoMxn)
      );
      existing.totalPagado = fromCents(
        toCents(existing.totalPagado) + toCents(isCreditNote ? -totalMxn : totalMxn)
      );
      existing.devolucionesMxn = (existing.devolucionesMxn || 0) + devolucion;
      existing.cfdiCount += 1;
    }
  }

  const rows: DiotSupplierRow[] = Array.from(byRfcOp.values()).map((r) => {
    const base16Rounded = Math.round(r.actosPagados16);
    const base8Rounded = Math.round(r.actosPagados8 || 0);
    const base0Rounded = Math.round(r.actosPagados0 || 0);
    const baseExentaRounded = Math.round(r.actosExentos || 0);
    const ivaRetRounded = Math.round(r.ivaRetenido);
    const safeNombre = (r.nombre || '').replace(/\|/g, ' ').trim();
    // SAT DEM Formato A-29: 20 campos delimitados por 19 plecas (|), sin plecas externas
    const cols = new Array(20).fill('');
    cols[0] = r.tipoTercero;
    cols[1] = r.tipoOperacion;
    cols[2] = r.tipoTercero === '05' ? '' : r.rfc;
    if (r.tipoTercero === '05') {
      cols[3] = r.rfc === 'XEXX010101000' ? '' : r.rfc;
      cols[4] = safeNombre;
      cols[5] = 'USA';
    }
    cols[7] = base16Rounded > 0 ? String(base16Rounded) : '';
    cols[8] = base8Rounded > 0 ? String(base8Rounded) : '';
    cols[10] = base0Rounded > 0 ? String(base0Rounded) : '';
    cols[11] = baseExentaRounded > 0 ? String(baseExentaRounded) : '';
    cols[15] = (r.devolucionesMxn || 0) > 0 ? String(Math.round(r.devolucionesMxn!)) : '';
    cols[18] = ivaRetRounded > 0 ? String(ivaRetRounded) : '';
    const { devolucionesMxn: _dev, ...publicRow } = r;
    return { ...publicRow, batchLine: cols.join('|') };
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
