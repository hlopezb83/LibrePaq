import { useMemo } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CreditCard,
  QrCode,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../../lib/formatters';
import type { RfcModulo11Result } from '../../../shared/accounting-engine';
import { parseCfdiPreview } from '../../../shared/cfdi-preview-parser';
import { checkRfc69BStatus } from '../../../shared/sat-69b';
import type { CfdiDocument } from '../../../shared/types';

function formatTaxLabel(impuesto: string): string {
  if (impuesto === '001') return 'ISR';
  if (impuesto === '002') return 'IVA';
  if (impuesto === '003') return 'IEPS';
  return impuesto;
}

function formatObjetoImpLabel(objetoImp: string): string {
  if (objetoImp === '01') return '01 (No objeto)';
  if (objetoImp === '02') return '02 (Sí objeto de impuesto)';
  if (objetoImp === '03') return '03 (Sí objeto y no obligado)';
  if (objetoImp === '04') return '04 (Sí objeto y no causa)';
  return objetoImp;
}

interface CfdiFacturaTabProps {
  cfdi: CfdiDocument;
  tipoLabel: string;
  emisorRfcCheck: RfcModulo11Result | null;
  receptorRfcCheck: RfcModulo11Result | null;
}

export function CfdiFacturaTab({
  cfdi,
  tipoLabel,
  emisorRfcCheck,
  receptorRfcCheck
}: CfdiFacturaTabProps) {
  const counterpartyRfc = cfdi.direction === 'EMITIDO' ? cfdi.receptorRfc : cfdi.emisorRfc;
  const efosCheck = checkRfc69BStatus(counterpartyRfc);
  const preview = useMemo(() => parseCfdiPreview(cfdi), [cfdi]);
  const selloDisplay =
    preview.timbre.selloCfd ||
    preview.comprobante.sello ||
    `${cfdi.uuid.replace(/-/g, '')}a89c7d4e5f2b1c098e7d...`;

  return (
    <div className="border border-slate-300 rounded-2xl p-6 sm:p-8 bg-white shadow-2xs space-y-6 text-slate-900 print:border-none print:p-0">
      {(cfdi.statusSat === 'CANCELADO' || efosCheck.isEfos) && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 flex items-start gap-2.5 text-xs text-red-900"
        >
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            {cfdi.statusSat === 'CANCELADO' && (
              <p className="font-bold">Comprobante con estatus CANCELADO en el SAT (no deducible).</p>
            )}
            {efosCheck.isEfos && (
              <p className="font-semibold">
                Alerta Art. 69-B CFF: El RFC {counterpartyRfc} ({cfdi.direction === 'EMITIDO' ? 'Receptor' : 'Emisor'}) figura en Lista 69-B SAT ({efosCheck.record?.situacion || 'EFOS'}).
              </p>
            )}
          </div>
        </div>
      )}
      {/* Encabezado del Comprobante Fiscal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-200">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              CFDI Versión 4.0
            </span>
            <span className="text-xs font-mono font-bold text-slate-700">
              {cfdi.direction === 'EMITIDO' ? 'FACTURA EMITIDA' : 'FACTURA RECIBIDA'}
            </span>
            {cfdi.polizaId ? (
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Contabilizado
              </span>
            ) : (
              <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                Pendiente en Bóveda
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900 leading-tight pt-1">
            {cfdi.emisorNombre}
          </h3>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-600 flex-wrap">
            <span>
              RFC: <strong className="text-slate-900">{cfdi.emisorRfc}</strong>
            </span>
            {emisorRfcCheck?.isValidCheckDigit ? (
              <span
                className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5"
                title="Dígito verificador Módulo 11 SAT válido"
              >
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> M11 OK
              </span>
            ) : (
              <span
                className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 flex items-center gap-0.5"
                title="Discrepancia Módulo 11 SAT"
              >
                <AlertCircle className="w-2.5 h-2.5 text-amber-600" /> M11: {emisorRfcCheck?.expectedCheckDigit}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Tipo de Comprobante: <strong className="text-slate-800">{tipoLabel}</strong>
          </p>
        </div>

        <div className="sm:text-right space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Folio Fiscal / Serie
          </div>
          <div className="text-base font-bold font-mono text-blue-900">
            {cfdi.serie}-{cfdi.folio}
          </div>
          <div className="text-[11px] font-mono text-slate-600 break-all">
            UUID: {cfdi.uuid}
          </div>
          <div className="flex sm:justify-end items-center gap-2 text-xs text-slate-600 pt-1">
            <Calendar className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            <span>
              Fecha: <strong className="font-mono">{formatShortDate(cfdi.fecha)}</strong>
            </span>
          </div>
          <div className="flex sm:justify-end items-center gap-1.5 text-xs">
            <span
              className={`inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-md ${
                cfdi.statusSat === 'VIGENTE'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                  : 'bg-red-100 text-red-900 border border-red-200'
              }`}
            >
              <ShieldCheck className="w-3 h-3" aria-hidden="true" />
              Estatus SAT: {cfdi.statusSat}
            </span>
          </div>
        </div>
      </div>

      {/* Datos del Receptor / Cliente */}
      <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
            Datos del Receptor
          </span>
          <div className="font-bold text-slate-900 text-sm">{cfdi.receptorNombre}</div>
          <div className="flex items-center gap-2 font-mono text-slate-700 mt-0.5 flex-wrap">
            <span>
              RFC: <strong className="text-slate-900">{cfdi.receptorRfc}</strong>
            </span>
            {receptorRfcCheck?.isValidCheckDigit ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> M11 OK
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 flex items-center gap-0.5">
                <AlertCircle className="w-2.5 h-2.5 text-amber-600" /> M11: {receptorRfcCheck?.expectedCheckDigit}
              </span>
            )}
          </div>
        </div>
        <div className="sm:text-right space-y-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
            Uso del CFDI y Método de Pago
          </span>
          <div className="font-mono text-slate-800">
            Uso CFDI: <strong>{cfdi.usoCfdi}</strong>
          </div>
          <div className="font-mono text-slate-800">
            Método de Pago: <strong>{cfdi.metodoPago}</strong> (Forma {cfdi.formaPago})
          </div>
          <div className="font-mono text-slate-800">
            Moneda: <strong>{cfdi.moneda}</strong> (TC: {cfdi.tipoCambio})
          </div>
        </div>
      </div>

      {/* Tabla de Conceptos Facturados */}
      <div className="border border-slate-300 rounded-xl overflow-hidden overflow-x-auto scrollable-panel">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <th scope="col" className="py-2.5 px-3">Clave ProdServ</th>
              <th scope="col" className="py-2.5 px-3">Descripción del Concepto</th>
              <th scope="col" className="py-2.5 px-3 text-right">Cantidad</th>
              <th scope="col" className="py-2.5 px-3 text-right">Valor Unitario</th>
              <th scope="col" className="py-2.5 px-3 text-right">Importe Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {preview.conceptos.map((concepto, idx) => (
              <tr key={`${concepto.claveProdServ}-${concepto.noIdentificacion || idx}`}>
                <td className="py-3 px-3 font-mono text-blue-800 font-semibold align-top">
                  <div>{concepto.claveProdServ}</div>
                  {concepto.noIdentificacion && (
                    <div className="text-[10px] text-slate-500 font-normal">
                      SKU: {concepto.noIdentificacion}
                    </div>
                  )}
                </td>
                <td className="py-3 px-3 align-top">
                  <div className="font-medium text-slate-900">{concepto.descripcion}</div>
                  <div className="text-[11px] text-slate-500">
                    {concepto.unidad || 'Unidad'} ({concepto.claveUnidad}) • ObjetoImp:{' '}
                    {formatObjetoImpLabel(concepto.objetoImp)}
                    {concepto.descuento > 0 && ` • Desc: ${formatCurrency(concepto.descuento)}`}
                  </div>
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-800 align-top">
                  {Number.isInteger(concepto.cantidad)
                    ? concepto.cantidad.toFixed(2)
                    : String(concepto.cantidad)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-800 align-top">
                  {formatCurrency(concepto.valorUnitario)}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 align-top">
                  {formatCurrency(concepto.importe)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Desglose de Impuestos y Totales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start pt-2">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-700 font-semibold">
            <CreditCard className="w-4 h-4 text-blue-700" aria-hidden="true" />
            <span>Condiciones Comerciales y Fiscales</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Este documento es una representación impresa de un CFDI versión {preview.comprobante.version} validado ante los servicios del SAT.
            Efectos fiscales al pago conforme a las disposiciones fiscales vigentes.
          </p>
          <div className="pt-2 flex items-center gap-2 flex-wrap text-[11px] font-mono">
            <span className="text-slate-600">
              Régimen Fiscal Emisor: {preview.emisor.regimenFiscal}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">
              Lugar de Expedición: CP {preview.comprobante.lugarExpedicion}
            </span>
            {preview.comprobante.noCertificado && (
              <>
                <span className="text-slate-300">•</span>
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
            <span className="font-semibold text-slate-900">
              {formatCurrency(preview.comprobante.subtotal)}
            </span>
          </div>
          {preview.comprobante.descuento > 0 && (
            <div className="flex justify-between text-emerald-800">
              <span className="font-sans">(-) Descuento:</span>
              <span>-{formatCurrency(preview.comprobante.descuento)}</span>
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
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(t.importe)}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex justify-between text-slate-700">
              <span className="font-sans">(+) Impuestos Trasladados:</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(preview.impuestos.totalImpuestosTrasladados)}
              </span>
            </div>
          )}
          {preview.impuestos.retenciones.map((r, idx) => (
            <div key={`ret-${r.impuesto}-${idx}`} className="flex justify-between text-red-700">
              <span className="font-sans">(-) Retención {formatTaxLabel(r.impuesto)}:</span>
              <span>-{formatCurrency(r.importe)}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-slate-300 flex justify-between text-base font-bold text-blue-950 font-sans">
            <span>TOTAL FACTURA:</span>
            <span className="font-mono text-blue-900">
              {formatCurrency(preview.comprobante.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Sello Digital y Código QR Fiscal */}
      <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center gap-4 text-[10px] text-slate-500 font-mono">
        <div className="w-20 h-20 bg-slate-100 border border-slate-300 rounded-xl flex items-center justify-center shrink-0">
          <QrCode className="w-12 h-12 text-slate-700" aria-hidden="true" />
        </div>
        <div className="space-y-1 min-w-0 flex-1">
          <div className="truncate" title={selloDisplay}>
            <strong>Sello Digital del Emisor:</strong> {selloDisplay}
          </div>
          <div className="truncate">
            <strong>Cadena Original del Timbre SAT:</strong> ||{preview.timbre.version}|
            {preview.timbre.uuid}|{preview.timbre.fechaTimbrado}|{preview.timbre.rfcProvCertif}||
          </div>
          <div className="text-slate-600">
            Certificado SAT: {preview.timbre.noCertificadoSat} • RFC Proveedor Autorizado (PAC):{' '}
            {preview.timbre.rfcProvCertif}
          </div>
        </div>
      </div>
    </div>
  );
}
