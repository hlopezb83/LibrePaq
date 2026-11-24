import { fromCents, toCents } from '../../shared/engine/invariants-and-math';
import type { CfdiDocument } from '../../shared/types';

export type CfdiTabFilter = 'ALL' | 'EMITIDO' | 'RECIBIDO' | 'PENDING';
export type CfdiTipoFilter = 'ALL' | 'I' | 'E' | 'P' | 'N' | 'RET';
export type CfdiMetodoFilter = 'ALL' | 'PUE' | 'PPD';
export type CfdiStatusSatFilter = 'ALL' | 'VIGENTE' | 'CANCELADO' | 'CANCELADO_CON_POLIZA';
export type CfdiFormaPagoFilter = 'ALL' | '01' | '03' | '04' | '99';

export function isCfdiPendingForPoliza(doc: CfdiDocument): boolean {
  return (
    doc.polizaId === null &&
    doc.statusSat !== 'CANCELADO' &&
    (doc.tipoComprobante as string) !== 'T' &&
    (doc.total > 0 || doc.subtotal > 0)
  );
}

export function filterCfdis(
  cfdis: CfdiDocument[],
  tab: CfdiTabFilter,
  tipoFilter: CfdiTipoFilter,
  searchQuery: string,
  periodScope: 'CURRENT' | 'ALL',
  currentPeriodPrefix: string,
  metodoFilter: CfdiMetodoFilter = 'ALL',
  statusSatFilter: CfdiStatusSatFilter = 'ALL',
  formaPagoFilter: CfdiFormaPagoFilter = 'ALL'
): CfdiDocument[] {
  const yearPrefix = currentPeriodPrefix.slice(0, 4);

  return cfdis.filter((doc) => {
    if (periodScope === 'CURRENT') {
      if (!doc.fecha.startsWith(currentPeriodPrefix)) return false;
    } else if (yearPrefix && !doc.fecha.startsWith(yearPrefix)) {
      return false;
    }

    if (tab === 'EMITIDO' && doc.direction !== 'EMITIDO') return false;
    if (tab === 'RECIBIDO' && doc.direction !== 'RECIBIDO') return false;
    if (tab === 'PENDING' && !isCfdiPendingForPoliza(doc)) return false;

    if (tipoFilter === 'I' && doc.tipoComprobante !== 'I') return false;
    if (tipoFilter === 'E' && doc.tipoComprobante !== 'E') return false;
    if (tipoFilter === 'P' && doc.tipoComprobante !== 'P') return false;
    if (tipoFilter === 'N' && doc.tipoComprobante !== 'N') return false;
    if (tipoFilter === 'RET' && doc.isrRetenido + doc.ivaRetenido <= 0) return false;

    if (metodoFilter === 'PUE' && doc.metodoPago !== 'PUE') return false;
    if (metodoFilter === 'PPD' && doc.metodoPago !== 'PPD') return false;

    if (statusSatFilter === 'VIGENTE' && doc.statusSat === 'CANCELADO') return false;
    if (statusSatFilter === 'CANCELADO' && doc.statusSat !== 'CANCELADO') return false;
    if (
      statusSatFilter === 'CANCELADO_CON_POLIZA' &&
      !(doc.statusSat === 'CANCELADO' && Boolean(doc.polizaId))
    ) {
      return false;
    }

    if (formaPagoFilter !== 'ALL' && (doc.formaPago || '') !== formaPagoFilter) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      doc.uuid.toLowerCase().includes(q) ||
      doc.emisorNombre.toLowerCase().includes(q) ||
      doc.emisorRfc.toLowerCase().includes(q) ||
      doc.receptorNombre.toLowerCase().includes(q) ||
      doc.receptorRfc.toLowerCase().includes(q) ||
      doc.conceptoPrincipal.toLowerCase().includes(q) ||
      `${doc.serie}-${doc.folio}`.toLowerCase().includes(q)
    );
  });
}

/** Calcula totales visibles excluyendo CANCELADO y Traslados (T), y restando Notas de Crédito (E). */
export function computeCfdiTotals(filteredCfdis: CfdiDocument[]) {
  let subtotalCents = 0;
  let ivaCents = 0;
  let retencionesCents = 0;
  let totalCents = 0;

  for (const d of filteredCfdis) {
    if (d.statusSat === 'CANCELADO' || d.tipoComprobante === 'T') continue;
    const sign = d.tipoComprobante === 'E' ? -1 : 1;
    subtotalCents += sign * toCents(d.subtotal);
    ivaCents += sign * toCents(d.ivaTrasladado);
    retencionesCents += sign * toCents(d.isrRetenido + d.ivaRetenido);
    totalCents += sign * toCents(d.total);
  }

  return {
    subtotal: fromCents(subtotalCents),
    iva: fromCents(ivaCents),
    retenciones: fromCents(retencionesCents),
    total: fromCents(totalCents)
  };
}
