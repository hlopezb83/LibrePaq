import type { CfdiDocument } from '../../shared/types';
import { sanitizeSpreadsheetText } from '../../shared/date-utils';

export function exportCfdisCsv(
  cfdis: CfdiDocument[],
  rfcOrId: string,
  year: number,
  period: number,
  toast: { info: (msg: string) => void; success: (msg: string) => void }
) {
  if (cfdis.length === 0) {
    toast.info('No hay CFDIs para exportar con los filtros actuales.');
    return;
  }

  const headers = [
    'Serie-Folio',
    'Fecha',
    'Tipo Comprobante',
    'Direccion',
    'RFC Emisor',
    'Nombre Emisor',
    'RFC Receptor',
    'Nombre Receptor',
    'Metodo Pago',
    'Concepto Principal',
    'Subtotal',
    'IVA 16%',
    'ISR Retenido',
    'IVA Retenido',
    'Total Neto',
    'UUID',
    'Poliza Folio'
  ];

  const escapeCell = (val: string) => `"${sanitizeSpreadsheetText(val).replace(/"/g, '""')}"`;

  const rows = cfdis.map((c) => [
    escapeCell(`${c.serie}-${c.folio}`),
    `"${c.fecha}"`,
    `"${c.tipoComprobante}"`,
    `"${c.direction}"`,
    `"${c.emisorRfc}"`,
    escapeCell(c.emisorNombre || ''),
    `"${c.receptorRfc}"`,
    escapeCell(c.receptorNombre || ''),
    `"${c.metodoPago}"`,
    escapeCell(c.conceptoPrincipal || ''),
    c.subtotal.toFixed(2),
    c.ivaTrasladado.toFixed(2),
    c.isrRetenido.toFixed(2),
    c.ivaRetenido.toFixed(2),
    c.total.toFixed(2),
    `"${c.uuid}"`,
    escapeCell(c.polizaFolio || 'Sin Póliza')
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Boveda_ADD_CFDI_${rfcOrId}_${year}_P${String(period).padStart(2, '0')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exportados ${cfdis.length} comprobantes a Excel (.CSV)`);
}
