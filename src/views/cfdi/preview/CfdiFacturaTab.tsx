import { useMemo } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../../lib/formatters';
import type { RfcModulo11Result } from '../../../shared/accounting-engine';
import { parseCfdiPreview } from '../../../shared/cfdi-preview-parser';
import { checkRfc69BStatus } from '../../../shared/sat-69b';
import type { CfdiDocument } from '../../../shared/types';
import { CfdiComplementoNominaPanel, CfdiComplementoPagosPanel } from './CfdiComplementoPanels';
import { CfdiFacturaStampFooter } from './CfdiFacturaStampFooter';

function formatObjetoImpLabel(objetoImp: string): string {
  if (objetoImp === '01') return '01 (No objeto)';
  if (objetoImp === '02') return '02 (Sí objeto de impuesto)';
  if (objetoImp === '03') return '03 (Sí objeto y no obligado)';
  if (objetoImp === '04') return '04 (Sí objeto y no causa)';
  return objetoImp;
}

function RfcCheckBadge({ rfcCheck }: { rfcCheck: RfcModulo11Result | null }) {
  if (rfcCheck?.isValidCheckDigit) {
    return (
      <span
        className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-0.5"
        title="Dígito verificador SAT (Módulo 11)"
      >
        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" aria-hidden="true" />
        RFC Válido
      </span>
    );
  }
  return (
    <span
      className="text-[11px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-flex items-center gap-0.5"
      title="Dígito verificador SAT (Módulo 11)"
    >
      <AlertCircle className="w-2.5 h-2.5 text-amber-600" aria-hidden="true" />
      RFC Revisar
    </span>
  );
}

interface CfdiFacturaTabProps {
  cfdi: CfdiDocument;
  tipoLabel: string;
  emisorRfcCheck: RfcModulo11Result | null;
  receptorRfcCheck: RfcModulo11Result | null;
  isLoadingXml?: boolean;
}

export function CfdiFacturaTab({
  cfdi,
  tipoLabel,
  emisorRfcCheck,
  receptorRfcCheck,
  isLoadingXml = false
}: CfdiFacturaTabProps) {
  const counterpartyRfc = cfdi.direction === 'EMITIDO' ? cfdi.receptorRfc : cfdi.emisorRfc;
  const efosCheck = checkRfc69BStatus(counterpartyRfc);
  const preview = useMemo(() => parseCfdiPreview(cfdi), [cfdi]);
  const folioDisplay = [cfdi.serie, cfdi.folio].filter(Boolean).join('-') || 'S/F';

  return (
    <div className="border border-slate-300 rounded-2xl p-3.5 sm:p-6 lg:p-8 bg-white shadow-2xs space-y-6 text-slate-900 print:border-none print:p-0">
      {!preview.hasXmlRaw && (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 flex items-center gap-2 text-xs text-amber-950"
        >
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
          <span>
            {isLoadingXml
              ? 'Cargando XML original desde Bóveda Digital ADD...'
              : 'Vista reconstruida con metadatos de bóveda (No disponible sin XML original para campos exclusivos del timbre o domicilio).'}
          </span>
        </div>
      )}

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
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              CFDI Versión 4.0
            </span>
            <span className="text-xs font-mono font-bold text-slate-700">
              {cfdi.direction === 'EMITIDO' ? 'FACTURA EMITIDA' : 'FACTURA RECIBIDA'}
            </span>
            {cfdi.polizaId ? (
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" /> Contabilizado
              </span>
            ) : (
              <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                Pendiente en Bóveda
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900 leading-tight pt-1 break-words">
            {cfdi.emisorNombre}
          </h3>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-600 flex-wrap">
            <span>
              RFC: <strong className="text-slate-900">{cfdi.emisorRfc}</strong>
            </span>
            <RfcCheckBadge rfcCheck={emisorRfcCheck} />
          </div>
          <p className="text-xs text-slate-600">
            Tipo de Comprobante: <strong className="text-slate-800">{tipoLabel}</strong>
          </p>
        </div>

        <div className="sm:text-right space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-200 min-w-0">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Folio Fiscal / Serie
          </div>
          <div className="text-base font-bold font-mono text-blue-900 break-words">
            {folioDisplay}
          </div>
          <div className="text-[11px] font-mono text-slate-600 break-all">
            UUID: {cfdi.uuid}
          </div>
          <div className="flex sm:justify-end items-center gap-2 text-xs text-slate-600 pt-1">
            <Calendar className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />
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
        <div className="min-w-0">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
            Datos del Receptor
          </span>
          <div className="font-bold text-slate-900 text-sm break-words">{cfdi.receptorNombre}</div>
          <div className="flex items-center gap-2 font-mono text-slate-700 mt-0.5 flex-wrap">
            <span>
              RFC: <strong className="text-slate-900">{cfdi.receptorRfc}</strong>
            </span>
            <RfcCheckBadge rfcCheck={receptorRfcCheck} />
          </div>
        </div>
        <div className="sm:text-right space-y-0.5 min-w-0">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
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
                    <div className="text-[11px] text-slate-500 font-normal">
                      No. ID: {concepto.noIdentificacion}
                    </div>
                  )}
                </td>
                <td className="py-3 px-3 align-top">
                  <div className="font-medium text-slate-900">{concepto.descripcion}</div>
                  <div className="text-[11px] text-slate-500">
                    {concepto.unidad || 'Unidad'} ({concepto.claveUnidad}){' '}
                    <span aria-hidden="true">•</span> ObjetoImp:{' '}
                    {formatObjetoImpLabel(concepto.objetoImp)}
                    {concepto.descuento > 0 && (
                      <>
                        {' '}
                        <span aria-hidden="true">•</span> Desc: {formatCurrency(concepto.descuento)}
                      </>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-800 align-top tabular-nums">
                  {Number.isInteger(concepto.cantidad)
                    ? concepto.cantidad.toFixed(2)
                    : String(concepto.cantidad)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-800 align-top tabular-nums">
                  {formatCurrency(concepto.valorUnitario)}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 align-top tabular-nums">
                  {formatCurrency(concepto.importe)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview.pagos && preview.pagos.length > 0 && (
        <CfdiComplementoPagosPanel pagos={preview.pagos} />
      )}

      {preview.nomina && <CfdiComplementoNominaPanel nomina={preview.nomina} />}

      <CfdiFacturaStampFooter cfdi={cfdi} preview={preview} />
    </div>
  );
}
