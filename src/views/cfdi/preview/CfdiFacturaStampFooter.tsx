import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
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

function formatTrasladoFactor(tipoFactor: string, tasaOCuota?: string): string {
  if (tipoFactor === 'Exento') return 'Exento';
  const rawRate = Number.parseFloat(tasaOCuota ?? '');
  if (Number.isFinite(rawRate)) {
    const pct = Number((rawRate * 100).toFixed(2));
    return `${tipoFactor || 'Tasa'} ${pct}%`;
  }
  return tipoFactor || 'Tasa';
}

interface CfdiFacturaStampFooterProps {
  cfdi: CfdiDocument;
  preview: CfdiPreviewData;
}

export function CfdiFacturaStampFooter({ cfdi, preview }: CfdiFacturaStampFooterProps) {
  const unavailable = 'No disponible sin XML original';
  const selloDisplay = preview.timbre.selloCfd || preview.comprobante.sello || unavailable;
  const selloSatDisplay = preview.timbre.selloSat || unavailable;
  const cadenaOriginal =
    preview.hasXmlRaw && preview.timbre.fechaTimbrado
      ? `||${preview.timbre.version}|${preview.timbre.uuid}|${preview.timbre.fechaTimbrado}|${preview.timbre.rfcProvCertif || 'N/D'}|${preview.timbre.selloCfd || preview.comprobante.sello || 'N/D'}|${preview.timbre.noCertificadoSat || 'N/D'}||`
      : unavailable;

  const satVerifUrl = useMemo(() => {
    const params = new URLSearchParams({
      id: preview.timbre.uuid || cfdi.uuid,
      re: preview.emisor.rfc || cfdi.emisorRfc,
      rr: preview.receptor.rfc || cfdi.receptorRfc,
      tt: cfdi.tipoComprobante === 'P' ? '0' : String(preview.comprobante.total)
    });
    const fe = (preview.timbre.selloCfd || preview.comprobante.sello || '').slice(-8);
    if (fe) params.set('fe', fe);
    return `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?${params.toString()}`;
  }, [cfdi.emisorRfc, cfdi.receptorRfc, cfdi.tipoComprobante, cfdi.uuid, preview]);

  const [qrSvgSrc, setQrSvgSrc] = useState<string>('');
  useEffect(() => {
    let active = true;
    QRCode.toString(satVerifUrl, { type: 'svg', margin: 1, width: 120, errorCorrectionLevel: 'M' })
      .then((svg) => {
        if (active) setQrSvgSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (active) setQrSvgSrc('');
      });
    return () => {
      active = false;
    };
  }, [satVerifUrl]);

  const locales = preview.impuestos.locales ?? [];

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
              Régimen Fiscal Emisor: {preview.emisor.regimenFiscal || unavailable}
            </span>
            <span className="text-slate-300" aria-hidden="true">•</span>
            <span className="text-slate-600">
              Lugar de Expedición: {preview.comprobante.lugarExpedicion ? `CP ${preview.comprobante.lugarExpedicion}` : unavailable}
            </span>
            {preview.comprobante.noCertificado && (
              <>
                <span className="text-slate-300" aria-hidden="true">•</span>
                <span className="text-slate-600">CSD: {preview.comprobante.noCertificado}</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs font-mono">
          <div className="flex justify-between text-slate-700">
            <span className="font-sans">Subtotal:</span>
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
            preview.impuestos.traslados.map((t, idx) => (
              <div key={`tras-${t.impuesto}-${idx}`} className="flex justify-between gap-2 text-slate-700">
                <span className="font-sans">
                  (+) {formatTaxLabel(t.impuesto)} Trasladado ({formatTrasladoFactor(t.tipoFactor, t.tasaOCuota)}
                  {t.base > 0 ? ` • Base ${formatCurrency(t.base)}` : ''}):
                </span>
                <span className="font-semibold text-slate-900 tabular-nums shrink-0">
                  {formatCurrency(t.importe)}
                </span>
              </div>
            ))
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
          {locales.map((loc, idx) => (
            <div
              key={`loc-${loc.tipo}-${loc.impuesto}-${idx}`}
              className={`flex justify-between ${loc.tipo === 'Retencion' ? 'text-red-700' : 'text-slate-700'}`}
            >
              <span className="font-sans">
                ({loc.tipo === 'Retencion' ? '-' : '+'}) {loc.impuesto}
                {loc.tasa ? ` (${loc.tasa}%)` : ''}:
              </span>
              <span className="tabular-nums">
                {loc.tipo === 'Retencion' ? '-' : ''}
                {formatCurrency(loc.importe)}
              </span>
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

      <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start gap-4 text-[11px] text-slate-600 font-mono avoid-page-break">
        <a
          href={satVerifUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Verificar CFDI en el portal del SAT"
          aria-label="Verificar CFDI en el portal del SAT (abre en nueva pestaña)"
          className="w-28 h-28 print:w-32 print:h-32 bg-white border border-slate-300 rounded-xl flex items-center justify-center shrink-0 p-1 hover:border-blue-500 transition"
        >
          {qrSvgSrc ? (
            <img src={qrSvgSrc} alt="Código QR de verificación SAT" className="w-full h-full object-contain" />
          ) : (
            <QrCode className="w-12 h-12 text-slate-700" aria-hidden="true" />
          )}
        </a>
        <div className="space-y-1.5 w-full sm:flex-1 min-w-0">
          <div className="break-all">
            <strong>Sello Digital del Emisor (SelloCFD):</strong> {selloDisplay}
          </div>
          <div className="break-all">
            <strong>Sello Digital del SAT (SelloSAT):</strong> {selloSatDisplay}
          </div>
          <div className="break-all">
            <strong>Cadena Original del Complemento de Certificación Digital del SAT:</strong> {cadenaOriginal}
          </div>
          <div className="text-slate-600 break-words">
            No. Serie Certificado SAT: {preview.timbre.noCertificadoSat || unavailable}{' '}
            <span aria-hidden="true">•</span> Fecha Timbrado: {preview.timbre.fechaTimbrado || unavailable}{' '}
            <span aria-hidden="true">•</span> RFC PAC: {preview.timbre.rfcProvCertif || unavailable}
          </div>
        </div>
      </div>
    </>
  );
}
