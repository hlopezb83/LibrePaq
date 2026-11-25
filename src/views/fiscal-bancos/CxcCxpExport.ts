import writeXlsx, { type SheetData } from 'write-excel-file/browser';
import { formatCurrency } from '../../lib/formatters';
import { sanitizeSpreadsheetText } from '../../shared/date-utils';
import type { CxcCxpPartyStatementGroup } from '../../shared/engine/cxc-cxp-helpers';
import type { CxcCxpDocumentRow } from '../../shared/types';
import type { AgingMode } from './CxcCxpHeaderBuckets';

const sCell = (val: string | number | null | undefined, bold = false) => ({
  type: String as typeof String,
  value: sanitizeSpreadsheetText(String(val ?? '')),
  ...(bold ? { fontWeight: 'bold' as const } : {})
});
const nCell = (val: number, bold = false) => ({
  type: Number as typeof Number,
  value: Number(val.toFixed(2)),
  format: '$#,##0.00',
  ...(bold ? { fontWeight: 'bold' as const } : {})
});

export async function exportCxcCxpStatementXlsx(params: {
  companyName: string;
  companyRfc: string;
  mode: AgingMode;
  asOfDate: string;
  groups: readonly CxcCxpPartyStatementGroup[];
  items: readonly CxcCxpDocumentRow[];
  amarre: { saldoBalanza: number; saldoCarteraPpd: number; diferencia: number; prefix: string };
}): Promise<void> {
  const { companyName, companyRfc, mode, asOfDate, groups, items, amarre } = params;
  const label = mode === 'CXC' ? 'Cuentas por Cobrar (Clientes)' : 'Cuentas por Pagar (Proveedores)';

  const summarySheet: SheetData = [
    [sCell(`ESTADO DE CUENTA AGRUPADO — ${label.toUpperCase()}`, true)],
    [sCell(`${companyRfc} — ${companyName}`), sCell(`Corte: ${asOfDate}`)],
    [sCell(`Balanza ${amarre.prefix}:`), nCell(amarre.saldoBalanza), sCell('Cartera PPD:'), nCell(amarre.saldoCarteraPpd), sCell('Diferencia:'), nCell(amarre.diferencia)],
    [],
    [
      sCell('RFC', true), sCell(mode === 'CXC' ? 'Cliente' : 'Proveedor', true), sCell('Docs', true),
      sCell('0-30 días', true), sCell('31-60 días', true), sCell('61-90 días', true), sCell('+90 días', true),
      sCell('Total Original', true), sCell('Pagado', true), sCell('Saldo Insoluto', true)
    ],
    ...groups.map((g) => [
      sCell(g.rfc), sCell(g.nombre), { type: Number, value: g.docCount },
      nCell(g.buckets['0_30']), nCell(g.buckets['31_60']), nCell(g.buckets['61_90']), nCell(g.buckets['90_PLUS']),
      nCell(g.totalOriginalMxn), nCell(g.totalPagadoMxn), nCell(g.saldoInsolutoMxn, true)
    ])
  ];

  const detailSheet: SheetData = [
    [sCell(`DETALLE DE DOCUMENTOS PPD (${mode})`, true)],
    [sCell('RFC'), sCell('Razón Social'), sCell('Serie-Folio'), sCell('UUID'), sCell('Fecha'), sCell('Días'), sCell('Total MXN'), sCell('Pagado MXN'), sCell('Saldo Insoluto')],
    ...items.map((r) => [
      sCell(r.rfc), sCell(r.nombre), sCell(r.serieFolio), sCell(r.uuid), sCell(r.fecha),
      { type: Number, value: r.daysPast }, nCell(r.totalOriginalMxn), nCell(r.totalPagadoMxn), nCell(r.saldoInsolutoMxn)
    ])
  ];

  await writeXlsx([
    { sheet: 'Estado de Cuenta', data: summarySheet },
    { sheet: 'Detalle CFDIs PPD', data: detailSheet }
  ]).toFile(`Estado_Cuenta_${mode}_${companyRfc}_${asOfDate}.xlsx`);
}

function escapeHtml(raw: string): string {
  return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function printCxcCxpStatementPdf(params: {
  companyName: string;
  companyRfc: string;
  mode: AgingMode;
  asOfDate: string;
  groups: readonly CxcCxpPartyStatementGroup[];
  amarre: { saldoBalanza: number; saldoCarteraPpd: number; diferencia: number; prefix: string };
}): boolean {
  const { companyName, companyRfc, mode, asOfDate, groups, amarre } = params;
  const win = window.open('', '_blank', 'width=980,height=760');
  if (!win) return false;
  const title = mode === 'CXC' ? 'Estado de Cuenta de Clientes (CxC PPD)' : 'Estado de Cuenta de Proveedores (CxP PPD)';

  const sectionsHtml = groups
    .map(
      (g) => `
      <div class="party">
        <h3>${escapeHtml(g.rfc)} — ${escapeHtml(g.nombre)} (Saldo Insoluto: ${formatCurrency(g.saldoInsolutoMxn)})</h3>
        <table>
          <thead><tr><th>Fecha</th><th>Serie-Folio</th><th>UUID</th><th class="num">Días</th><th class="num">Total</th><th class="num">Pagado</th><th class="num">Insoluto</th></tr></thead>
          <tbody>
            ${g.documents
              .map(
                (d) =>
                  `<tr><td>${escapeHtml(d.fecha)}</td><td>${escapeHtml(d.serieFolio)}</td><td class="mono">${escapeHtml(d.uuid)}</td><td class="num">${d.daysPast}</td><td class="num">${formatCurrency(d.totalOriginalMxn)}</td><td class="num">${formatCurrency(d.totalPagadoMxn)}</td><td class="num">${formatCurrency(d.saldoInsolutoMxn)}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
    )
    .join('');

  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
  <style>body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a;font-size:11px}h1{font-size:16px;margin:0 0 4px}h3{font-size:12px;margin:14px 0 4px}table{width:100%;border-collapse:collapse;margin-bottom:10px}th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left}th{background:#f1f5f9;font-size:10px;text-transform:uppercase}.num{text-align:right;font-family:monospace}.mono{font-family:monospace;font-size:9px}.amarre{background:#f8fafc;border:1px solid #cbd5e1;padding:8px 10px;margin:10px 0}</style>
  </head><body>
  <h1>${escapeHtml(title)}</h1>
  <div><strong>${escapeHtml(companyRfc)} — ${escapeHtml(companyName)}</strong> | Corte: ${escapeHtml(asOfDate)}</div>
  <div class="amarre"><strong>Amarre Balanza ${escapeHtml(amarre.prefix)}:</strong> Balanza ${formatCurrency(amarre.saldoBalanza)} · Cartera PPD ${formatCurrency(amarre.saldoCarteraPpd)} · Diferencia ${formatCurrency(amarre.diferencia)}</div>
  ${sectionsHtml || '<p>Sin documentos pendientes.</p>'}
  </body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
