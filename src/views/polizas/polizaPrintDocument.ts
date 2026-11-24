import { formatCurrency, formatShortDate } from '../../lib/formatters';
import { MESES_SAT } from '../../shared/sat-constants';
import type { Company, Poliza } from '../../shared/types';

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolvePolizaUuids(pol: Poliza): string[] {
  const seen = new Set<string>();
  if (pol.cfdiUuids) {
    for (const u of pol.cfdiUuids) {
      const clean = u.trim().toUpperCase();
      if (clean) seen.add(clean);
    }
  }
  if (pol.cfdiUuid) seen.add(pol.cfdiUuid.trim().toUpperCase());
  for (const m of pol.movements) {
    if (m.cfdiUuid) seen.add(m.cfdiUuid.trim().toUpperCase());
  }
  return Array.from(seen);
}

function renderPolizaSection(pol: Poliza, company?: Company | null): string {
  const uuids = resolvePolizaUuids(pol);
  const mesNombre =
    MESES_SAT.find((m) => m.periodo === pol.periodo)?.nombre ?? `Periodo ${pol.periodo}`;
  const rowsHtml = pol.movements
    .map(
      (m) => `
      <tr>
        <td class="mono bold">${escapeHtml(m.accountCode)}</td>
        <td>${escapeHtml(m.accountName)}</td>
        <td class="mono">${escapeHtml(m.referencia || '—')}</td>
        <td>
          ${escapeHtml(m.concepto || pol.concepto)}
          ${m.cfdiUuid ? `<div class="uuid-mini">UUID: ${escapeHtml(m.cfdiUuid)}</div>` : ''}
        </td>
        <td class="mono right">${m.cargo > 0 ? escapeHtml(formatCurrency(m.cargo)) : '—'}</td>
        <td class="mono right">${m.abono > 0 ? escapeHtml(formatCurrency(m.abono)) : '—'}</td>
      </tr>`
    )
    .join('');

  return `
  <section class="poliza-doc">
    <header class="letterhead">
      <div>
        <div class="company-name">${escapeHtml(company?.name || 'Empresa Contable')}</div>
        <div class="company-meta">
          RFC: <strong>${escapeHtml(company?.rfc || 'XAXX010101000')}</strong>
          ${company?.regimenFiscal ? ` · ${escapeHtml(company.regimenFiscal)}` : ''}
          · Ejercicio ${escapeHtml(pol.ejercicio)} · ${escapeHtml(mesNombre)}
        </div>
      </div>
      <div class="poliza-badge-box">
        <div class="poliza-folio">${escapeHtml(pol.tipo)} #${escapeHtml(pol.folio)}</div>
        <div class="poliza-date">Fecha: ${escapeHtml(formatShortDate(pol.fecha))} · ${
          pol.origin === 'ADD_AUTO' ? 'Origen: Bóveda ADD' : 'Origen: Póliza Manual'
        }</div>
      </div>
    </header>

    <div class="concept-bar">
      <div><strong>Concepto General:</strong> ${escapeHtml(pol.concepto)}</div>
      <div class="uuids-list">
        <strong>CFDIs Asociados (${uuids.length}):</strong>
        ${
          uuids.length > 0
            ? uuids.map((u) => `<span class="uuid-chip">${escapeHtml(u)}</span>`).join(' ')
            : '<span>Sin comprobante fiscal vinculado</span>'
        }
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 14%">Cuenta</th>
          <th style="width: 22%">Nombre de la Cuenta</th>
          <th style="width: 11%">Referencia</th>
          <th style="width: 29%">Concepto / UUID Partida</th>
          <th class="right" style="width: 12%">Debe (Cargo)</th>
          <th class="right" style="width: 12%">Haber (Abono)</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="4" class="right bold">SUMAS IGUALES (${pol.isBalanced ? 'PÓLIZA CUADRADA' : 'DESCUADRE'}):</td>
          <td class="mono right bold">${escapeHtml(formatCurrency(pol.totalCargos))}</td>
          <td class="mono right bold">${escapeHtml(formatCurrency(pol.totalAbonos))}</td>
        </tr>
      </tfoot>
    </table>

    <footer class="signatures">
      <div class="sig-col"><div class="sig-line">ELABORÓ</div><span>Auxiliar / Capturista</span></div>
      <div class="sig-col"><div class="sig-line">REVISÓ</div><span>Contador General / Auditoría</span></div>
      <div class="sig-col"><div class="sig-line">AUTORIZÓ</div><span>Dirección / Representante Legal</span></div>
    </footer>
  </section>`;
}

/**
 * Abre una ventana de impresión formal lista para guardar como PDF o imprimir,
 * incluyendo membrete RFC, partidas completas, UUIDs asociados y bloque de firmas.
 */
export function printPolizasFormalPdf(
  polizas: readonly Poliza[],
  company?: Company | null,
  documentTitle = 'Pólizas Contables'
): boolean {
  if (typeof window === 'undefined' || polizas.length === 0) return false;
  const win = window.open('', '_blank', 'width=980,height=820');
  if (!win) return false;

  const sections = polizas.map((p) => renderPolizaSection(p, company)).join('');
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(documentTitle)} - ${escapeHtml(company?.rfc || '')}</title>
  <style>
    @page { size: letter portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 0; font-size: 11px; }
    .poliza-doc { page-break-after: always; break-after: page; padding-bottom: 12px; }
    .poliza-doc:last-child { page-break-after: auto; break-after: auto; }
    .letterhead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; gap: 12px; }
    .company-name { font-size: 15px; font-weight: 800; text-transform: uppercase; }
    .company-meta { font-size: 10px; color: #475569; margin-top: 2px; }
    .poliza-badge-box { text-align: right; }
    .poliza-folio { font-family: monospace; font-size: 14px; font-weight: 800; color: #1e3a8a; }
    .poliza-date { font-size: 10px; color: #475569; margin-top: 2px; }
    .concept-bar { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; display: grid; gap: 4px; }
    .uuids-list { font-size: 10px; color: #334155; }
    .uuid-chip { display: inline-block; font-family: monospace; font-size: 9.5px; background: #e2e8f0; padding: 1px 5px; border-radius: 4px; margin: 1px 2px 1px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; vertical-align: top; }
    thead th { background: #f1f5f9; font-size: 9.5px; text-transform: uppercase; text-align: left; }
    tfoot td { background: #f1f5f9; border-top: 2px solid #0f172a; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .right { text-align: right; }
    .bold { font-weight: 700; }
    .uuid-mini { font-family: monospace; font-size: 8.5px; color: #475569; margin-top: 2px; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 28px; text-align: center; font-size: 10px; color: #475569; page-break-inside: avoid; }
    .sig-line { border-top: 1px solid #334155; padding-top: 4px; font-weight: 700; color: #0f172a; }
  </style>
</head>
<body>${sections}</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 200);
  return true;
}
