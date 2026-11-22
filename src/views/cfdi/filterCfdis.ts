import type { CfdiDocument } from '../../shared/types';

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
  tab: 'ALL' | 'EMITIDO' | 'RECIBIDO' | 'PENDING',
  tipoFilter: 'ALL' | 'I' | 'P' | 'N' | 'RET',
  searchQuery: string,
  periodScope: 'CURRENT' | 'ALL',
  currentPeriodPrefix: string,
  metodoFilter: 'ALL' | 'PUE' | 'PPD' = 'ALL'
): CfdiDocument[] {
  return cfdis.filter((doc) => {
    if (periodScope === 'CURRENT' && !doc.fecha.startsWith(currentPeriodPrefix)) {
      return false;
    }
    if (tab === 'EMITIDO' && doc.direction !== 'EMITIDO') return false;
    if (tab === 'RECIBIDO' && doc.direction !== 'RECIBIDO') return false;
    if (tab === 'PENDING' && !isCfdiPendingForPoliza(doc)) {
      return false;
    }

    if (tipoFilter === 'I' && doc.tipoComprobante !== 'I' && doc.tipoComprobante !== 'E')
      return false;
    if (tipoFilter === 'P' && doc.tipoComprobante !== 'P') return false;
    if (tipoFilter === 'N' && doc.tipoComprobante !== 'N') return false;
    if (tipoFilter === 'RET' && doc.isrRetenido + doc.ivaRetenido <= 0) return false;

    if (metodoFilter === 'PUE' && doc.metodoPago !== 'PUE') return false;
    if (metodoFilter === 'PPD' && doc.metodoPago !== 'PPD') return false;

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

export function computeCfdiTotals(filteredCfdis: CfdiDocument[]) {
  return filteredCfdis.reduce(
    (acc, d) => {
      acc.subtotal += d.subtotal;
      acc.iva += d.ivaTrasladado;
      acc.retenciones += d.isrRetenido + d.ivaRetenido;
      acc.total += d.total;
      return acc;
    },
    { subtotal: 0, iva: 0, retenciones: 0, total: 0 }
  );
}
