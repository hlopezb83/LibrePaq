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
    'Estatus SAT',
    'RFC Emisor',
    'Nombre Emisor',
    'RFC Receptor',
    'Nombre Receptor',
    'Metodo Pago',
    'Forma de Pago',
    'Uso CFDI',
    'Moneda',
    'Tipo Cambio',
    'Concepto Principal',
    'Base 16%',
    'Base 8%',
    'Base 0%',
    'Exento',
    'IEPS',
    'Subtotal',
    'IVA 16%',
    'ISR Retenido',
    'IVA Retenido',
    'Total Neto',
    'UUID',
    'UUID Relacionado',
    'Poliza Folio'
  ];

  const escapeCell = (val: string) => `"${sanitizeSpreadsheetText(val).replace(/"/g, '""')}"`;

  const rows = cfdis.map((c) => [
    escapeCell(`${c.serie}-${c.folio}`),
    `"${c.fecha}"`,
    `"${c.tipoComprobante}"`,
    `"${c.direction}"`,
    `"${c.statusSat || 'VIGENTE'}"`,
    `"${c.emisorRfc}"`,
    escapeCell(c.emisorNombre || ''),
    `"${c.receptorRfc}"`,
    escapeCell(c.receptorNombre || ''),
    `"${c.metodoPago}"`,
    `"${c.formaPago || ''}"`,
    `"${c.usoCfdi || ''}"`,
    `"${c.moneda || 'MXN'}"`,
    Number(c.tipoCambio || 1).toFixed(4),
    escapeCell(c.conceptoPrincipal || ''),
    Number(c.taxBreakdown?.base16 ?? 0).toFixed(2),
    Number(c.taxBreakdown?.base8 ?? 0).toFixed(2),
    Number(c.taxBreakdown?.base0 ?? 0).toFixed(2),
    Number(c.taxBreakdown?.baseExento ?? 0).toFixed(2),
    Number(c.taxBreakdown?.ieps ?? 0).toFixed(2),
    c.subtotal.toFixed(2),
    c.ivaTrasladado.toFixed(2),
    c.isrRetenido.toFixed(2),
    c.ivaRetenido.toFixed(2),
    c.total.toFixed(2),
    `"${c.uuid}"`,
    `"${c.uuidRelacionado || ''}"`,
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
