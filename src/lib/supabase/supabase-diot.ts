import { supabase } from '../supabase';
import {
  fromCents,
  sumCents,
  toCents
} from '../../shared/accounting-engine';
import type {
  DiotReportResponse,
  DiotSupplierRow
} from '../../shared/types';
import { supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import { supabasePolizasAndCfdi } from './supabase-polizas-cfdi';

export const supabaseDiot = {
  async getDiotReport(
    companyId: string,
    year?: number,
    period?: number
  ): Promise<DiotReportResponse> {
    if (!supabase) throw new Error('Supabase no disponible');
    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const company = companyId ? companies.find((c) => c.id === companyId) : companies[0];
    if (!company) throw new Error(`Empresa no encontrada: ${companyId || 'sin ID'}`);

    const currentYear = year || company.currentYear;
    const currentPeriod = period || company.currentPeriod;

    const cfdis = await supabasePolizasAndCfdi.getCfdis(company.id);
    const polizas = await supabasePolizasAndCfdi.getPolizas(company.id, currentYear, currentPeriod);
    const polizaIdsInPeriod = new Set(polizas.map((p) => p.id));

    const paidRecibidos = cfdis.filter(
      (c) =>
        c.direction === 'RECIBIDO' &&
        c.statusSat !== 'CANCELADO' &&
        c.tipoComprobante !== 'T' &&
        c.polizaId &&
        polizaIdsInPeriod.has(c.polizaId) &&
        (c.metodoPago === 'PUE' || c.tipoComprobante === 'P' || c.tipoComprobante === 'E')
    );

    const byRfc = new Map<string, DiotSupplierRow & { devolucionesMxn?: number; baseExentaMxn?: number; baseCeroMxn?: number }>();

    for (const doc of paidRecibidos) {
      const rfc = doc.emisorRfc.toUpperCase();
      const existing = byRfc.get(rfc);
      const concLower = doc.conceptoPrincipal.toLowerCase();
      let tipoOperacion: '03' | '06' | '85' = '85';
      if (concLower.includes('renta') || concLower.includes('arrendamiento')) {
        tipoOperacion = '06';
      } else if (
        concLower.includes('honorario') ||
        concLower.includes('auditor') ||
        concLower.includes('consultor')
      ) {
        tipoOperacion = '03';
      }

      const tc =
        doc.moneda && doc.moneda !== 'MXN' && (doc.tipoCambio || 1) > 0
          ? doc.tipoCambio || 1
          : 1;
      const netBase = Math.max(0, doc.subtotal - (doc.descuento || 0)) * tc;
      const ivaTrasladadoMxn = doc.ivaTrasladado * tc;
      const ivaRetenidoMxn = doc.ivaRetenido * tc;
      const isrRetenidoMxn = doc.isrRetenido * tc;
      const totalMxn = doc.total * tc;
      const isCreditNote = doc.tipoComprobante === 'E';
      const isExemptOrZero = doc.ivaTrasladado === 0 && !isCreditNote;

      const subtotal16 = (!isCreditNote && !isExemptOrZero) ? netBase : 0;
      const devolucion = isCreditNote ? netBase : 0;
      const baseExenta = isExemptOrZero && concLower.includes('exento') ? netBase : 0;
      const baseCero = isExemptOrZero && !concLower.includes('exento') ? netBase : 0;
      const tipoTercero: '04' | '05' =
        rfc === 'XEXX010101000' || rfc.startsWith('XEXX') ? '05' : '04';

      if (!existing) {
        byRfc.set(rfc, {
          rfc,
          nombre: doc.emisorNombre,
          tipoTercero,
          tipoOperacion,
          actosPagados16: fromCents(toCents(subtotal16)),
          ivaAcreditable16: fromCents(toCents(isCreditNote ? -ivaTrasladadoMxn : ivaTrasladadoMxn)),
          ivaRetenido: fromCents(toCents(ivaRetenidoMxn)),
          isrRetenido: fromCents(toCents(isrRetenidoMxn)),
          totalPagado: fromCents(toCents(isCreditNote ? -totalMxn : totalMxn)),
          cfdiCount: 1,
          batchLine: '',
          devolucionesMxn: devolucion,
          baseExentaMxn: baseExenta,
          baseCeroMxn: baseCero
        });
      } else {
        existing.actosPagados16 = fromCents(
          toCents(existing.actosPagados16) + toCents(subtotal16)
        );
        existing.ivaAcreditable16 = fromCents(
          toCents(existing.ivaAcreditable16) + toCents(isCreditNote ? -ivaTrasladadoMxn : ivaTrasladadoMxn)
        );
        existing.ivaRetenido = fromCents(
          toCents(existing.ivaRetenido) + toCents(ivaRetenidoMxn)
        );
        existing.isrRetenido = fromCents(
          toCents(existing.isrRetenido) + toCents(isrRetenidoMxn)
        );
        existing.totalPagado = fromCents(
          toCents(existing.totalPagado) + toCents(isCreditNote ? -totalMxn : totalMxn)
        );
        existing.devolucionesMxn = (existing.devolucionesMxn || 0) + devolucion;
        existing.baseExentaMxn = (existing.baseExentaMxn || 0) + baseExenta;
        existing.baseCeroMxn = (existing.baseCeroMxn || 0) + baseCero;
        existing.cfdiCount += 1;
      }
    }

    const rows: DiotSupplierRow[] = Array.from(byRfc.values()).map((r) => {
      const baseRounded = Math.round(r.actosPagados16);
      const ivaRetRounded = Math.round(r.ivaRetenido);
      // SAT DEM Formato A-29: 20 campos delimitados por 19 plepas (|), sin plepas externas
      const cols = new Array(20).fill('');
      cols[0] = r.tipoTercero;
      cols[1] = r.tipoOperacion;
      cols[2] = r.tipoTercero === '05' ? '' : r.rfc;
      if (r.tipoTercero === '05') {
        cols[3] = r.rfc === 'XEXX010101000' ? '' : r.rfc;
        cols[4] = r.nombre;
        cols[5] = 'USA';
      }
      cols[7] = baseRounded > 0 ? String(baseRounded) : '';
      cols[10] = (r.baseCeroMxn || 0) > 0 ? String(Math.round(r.baseCeroMxn!)) : '';
      cols[11] = (r.baseExentaMxn || 0) > 0 ? String(Math.round(r.baseExentaMxn!)) : '';
      cols[15] = (r.devolucionesMxn || 0) > 0 ? String(Math.round(r.devolucionesMxn!)) : '';
      cols[18] = ivaRetRounded > 0 ? String(ivaRetRounded) : '';
      const batchLine = cols.join('|');
      return { ...r, batchLine };
    });

    const actosPagados16 = fromCents(sumCents(rows.map((r) => r.actosPagados16)));
    const ivaAcreditable16 = fromCents(sumCents(rows.map((r) => r.ivaAcreditable16)));
    const ivaRetenido = fromCents(sumCents(rows.map((r) => r.ivaRetenido)));
    const isrRetenido = fromCents(sumCents(rows.map((r) => r.isrRetenido)));

    const accounts = await supabaseCompaniesAndAccounts.getAccounts(
      company.id,
      currentYear,
      currentPeriod
    );
    const ivaTrasladadoAcc = accounts.find((a) => a.code === '208-01-001');
    const ivaTrasladadoCobrado = ivaTrasladadoAcc ? ivaTrasladadoAcc.periodCredits : 0;
    const ivaNetoCargoFavor = fromCents(toCents(ivaTrasladadoCobrado) - toCents(ivaAcreditable16));
    const mesStr = String(currentPeriod).padStart(2, '0');

    return {
      company,
      ejercicio: currentYear,
      periodo: currentPeriod,
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
      filename: `DIOT_${company.rfc}_${currentYear}_${mesStr}.txt`
    };
  }
};
