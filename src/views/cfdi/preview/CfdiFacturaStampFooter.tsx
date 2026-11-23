import { CreditCard, QrCode } from 'lucide-react';
import { formatCurrency } from '../../../lib/formatters';
import type { CfdiPreviewData } from '../../../shared/cfdi-preview-parser';
import type { CfdiDocument } from '../../../shared/types';

function formatTaxLabel(impuesto: string): string {
  if (impuesto === '001') return 'ISR';
  if (impuesto === '002') return 'IVA';
  if (impuesto === '003') return 'IEPS';
  return impuesto;
}

interface CfdiFacturaStampFooterProps {
  cfdi: CfdiDocument;
  preview: CfdiPreviewData;
}

export function CfdiFacturaStampFooter({ cfdi, preview }: CfdiFacturaStampFooterProps) {
  const selloDisplay =
    preview.timbre.selloCfd ||
    preview.comprobante.sello ||
    'No disponible (adjunta el XML original para ver el sello)';
  const cadenaOriginal = `||${preview.timbre.version}|${preview.timbre.uuid}|${preview.timbre.fechaTimbrado}|${preview.timbre.rfcProvCertif}||`;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start pt-2">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-700 font-semibold">
            <CreditCard className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
            <span>Condiciones Comerciales y Fiscales</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {cfdi.statusSat === 'CANCELADO'
              ? `Este documento es una representación impresa de un CFDI versión ${preview.comprobante.version} con estatus CANCELADO ante los servicios del SAT (sin efectos fiscales deducibles ni acreditables).`
              : `Este documento es una representación impresa de un CFDI versión ${preview.comprobante.version} validado ante los servicios del SAT. Efectos fiscales al pago conforme a las disposiciones fiscales vigentes.`}
          </p>
          <div className="pt-2 flex items-center gap-2 flex-wrap text-[11px] font-mono">
            <span className="text-slate-600">
              Régimen Fiscal Emisor: {preview.emisor.regimenFiscal}
            </span>
            <span className="text-slate-300" aria-hidden="true">•</span>
            <span className="text-slate-600">
              Lugar de Expedición: CP {preview.comprobante.lugarExpedicion}
            </span>
            {preview.comprobante.noCertificado && (
              <>
                <span className="text-slate-300" aria-hidden="true">•</span>
                <span className="text-slate-600">
                  CSD: {preview.comprobante.noCertificado}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs font-mono">
          <div className="flex justify-between text-slate-700">
            <span className="font-sans">Subtotal Gravado:</span>
            <span className="font-semibold text-slate-900 tabular-nums">
              {formatCurrency(preview.comprobante.subtotal)}
            </span>
          </div>
          {preview.comprobante.descuento > 0 && (
            <div className="flex justify-between text-emerald-800">
              <span className="font-sans">(-) Descuento:</span>
              <span className="tabular-nums">-{formatCurrency(preview.comprobante.descuento)}</span>
            </div>
          )}
          {preview.impuestos.traslados.length > 0 ? (
            preview.impuestos.traslados.map((t, idx) => {
              const rawRate = Number.parseFloat(t.tasaOCuota ?? '');
              const pct = Number.isFinite(rawRate) ? ` (${Number((rawRate * 100).toFixed(2))}%)` : '';
              return (
                <div key={`tras-${t.impuesto}-${idx}`} className="flex justify-between text-slate-700">
                  <span className="font-sans">
                    (+) {formatTaxLabel(t.impuesto)} Trasladado{pct}:
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(t.importe)}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex justify-between text-slate-700">
              <span className="font-sans">(+) Impuestos Trasladados:</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {formatCurrency(preview.impuestos.totalImpuestosTrasladados)}
              </span>
            </div>
          )}
          {preview.impuestos.retenciones.map((r, idx) => (
            <div key={`ret-${r.impuesto}-${idx}`} className="flex justify-between text-red-700">
              <span className="font-sans">(-) Retención {formatTaxLabel(r.impuesto)}:</span>
              <span className="tabular-nums">-{formatCurrency(r.importe)}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-slate-300 flex justify-between text-base font-bold text-blue-950 font-sans">
            <span>TOTAL FACTURA:</span>
            <span className="font-mono text-blue-900 tabular-nums">
              {formatCurrency(preview.comprobante.total)}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center gap-4 text-[11px] text-slate-600 font-mono">
        <div className="w-20 h-20 bg-slate-100 border border-slate-300 rounded-xl flex items-center justify-center shrink-0">
          <QrCode className="w-12 h-12 text-slate-700" aria-hidden="true" />
        </div>
        <div className="space-y-1 w-full sm:flex-1 min-w-0">
          <div className="truncate" title={selloDisplay}>
            <strong>Sello Digital del Emisor:</strong> {selloDisplay}
          </div>
          <div className="truncate" title={cadenaOriginal}>
            <strong>Cadena Original del Timbre SAT:</strong> {cadenaOriginal}
          </div>
          <div className="text-slate-600 break-words">
            Certificado SAT: {preview.timbre.noCertificadoSat}{' '}
            <span aria-hidden="true">•</span> RFC Proveedor Autorizado (PAC):{' '}
            {preview.timbre.rfcProvCertif}
          </div>
        </div>
      </div>
    </>
  );
}
