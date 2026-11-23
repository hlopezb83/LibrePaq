import { Check, Copy, Download, FileSpreadsheet, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { formatCurrency } from '../../lib/formatters';
import { checkRfc69BStatus } from '../../shared/sat-69b';
import { MESES_SAT } from '../../shared/sat-constants';
import type { DiotReportResponse } from '../../shared/types';

export interface DiotDeclaracionTabProps {
  isLoadingDiot: boolean;
  diotData: DiotReportResponse | null | undefined;
  isErrorDiot?: boolean;
  onRetryDiot?: () => void;
  onExportDiotCsv: () => void;
  onDownloadDiotTxt: () => void;
  copiedBatch: boolean;
  setCopiedBatch: (b: boolean) => void;
}

export function DiotDeclaracionTab({
  isLoadingDiot,
  diotData,
  isErrorDiot,
  onRetryDiot,
  onExportDiotCsv,
  onDownloadDiotTxt,
  copiedBatch,
  setCopiedBatch
}: DiotDeclaracionTabProps) {
  const { copiedKey, copy: copyDiotText } = useCopyToClipboard<'diot'>(2000);
  const isCopied = copiedBatch || copiedKey === 'diot';

  if (isErrorDiot) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-red-200 shadow-2xs space-y-4 max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">Error al generar la Declaración DIOT</h3>
          <p className="text-xs text-slate-600 mt-1">No se pudo cargar la información de operaciones con terceros.</p>
        </div>
        {onRetryDiot && (
          <button
            type="button"
            onClick={onRetryDiot}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Reintentar cálculo
          </button>
        )}
      </div>
    );
  }

  if (isLoadingDiot || !diotData) {
    return (
      <div className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-500">
        Calculando operaciones con terceros y determinación de IVA...
      </div>
    );
  }

  const mesName = MESES_SAT.find((m) => m.periodo === diotData.periodo)?.nombre || `Mes ${diotData.periodo}`;

  const rowsWithEfos = diotData.rows.map((r) => {
    const efosCheck = checkRfc69BStatus(r.rfc);
    return {
      ...r,
      isEfos: efosCheck.isEfos || efosCheck.status !== 'LIMPIO',
      efosStatus: efosCheck.status
    };
  });
  const efosCount = rowsWithEfos.filter((r) => r.isEfos).length;

  return (
    <div className="space-y-5">
      {/* Tarjetas de Determinación Mensual de IVA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-2xs">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            IVA Trasladado Cobrado (16%)
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-slate-900">
            {formatCurrency(diotData.totals.ivaTrasladadoCobrado)}
          </div>
          <div className="text-[10px] text-slate-500">Causado por cobros del mes</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-2xs">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            (-) IVA Acreditable Pagado DIOT
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-emerald-800">
            {formatCurrency(diotData.totals.ivaAcreditable16)}
          </div>
          <div className="text-[10px] text-slate-500">
            Base pagada: {formatCurrency(diotData.totals.actosPagados16)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-2xs">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            (=) IVA Neto a Cargo / Favor
          </div>
          <div
            className={`mt-1 text-lg font-bold font-mono ${
              diotData.totals.ivaNetoCargoFavor >= 0 ? 'text-blue-800' : 'text-emerald-800'
            }`}
          >
            {formatCurrency(diotData.totals.ivaNetoCargoFavor)}
          </div>
          <div className="text-[10px] text-slate-500">
            {diotData.totals.ivaNetoCargoFavor >= 0
              ? 'Impuesto a cargo en pago provisional'
              : 'Saldo a favor del periodo'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-2xs">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Retenciones (ISR + IVA)
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-red-700">
            {formatCurrency(diotData.totals.isrRetenido + diotData.totals.ivaRetenido)}
          </div>
          <div className="text-[10px] text-slate-500">
            ISR: {formatCurrency(diotData.totals.isrRetenido)} | IVA:{' '}
            {formatCurrency(diotData.totals.ivaRetenido)}
          </div>
        </div>
      </div>

      {/* Padrón de Proveedores DIOT */}
      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-700" aria-hidden="true" />
                Declaración Informativa de Operaciones con Terceros (DIOT Formato A-29)
              </h2>
              {efosCount === 0 ? (
                <span
                  title="Todos los RFCs de proveedores fueron verificados contra la base de datos oficial del Art. 69-B del CFF"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  <span>0 EFOS 69-B</span>
                </span>
              ) : (
                <span
                  role="status"
                  title="Atención: Se detectaron proveedores con publicación presunta o definitiva en la lista negra del SAT"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-900 border border-red-300 shadow-2xs"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />
                  <span>{efosCount} Proveedor(es) en Lista 69-B</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Proveedores con CFDIs pagados y contabilizados en {mesName} {diotData.ejercicio} ({diotData.rows.length} terceros reportables)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onExportDiotCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 cursor-pointer transition shadow-2xs"
            >
              <Download className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span>Exportar Excel (.CSV)</span>
            </button>
            <button
              type="button"
              onClick={onDownloadDiotTxt}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white shadow-2xs cursor-pointer transition"
            >
              <Download className="w-4 h-4 text-blue-200" aria-hidden="true" />
              <span>Descargar Carga Batch ({diotData.filename})</span>
            </button>
          </div>
        </div>

        {efosCount > 0 && (
          <div
            role="alert"
            className="mx-5 mt-4 p-3.5 rounded-xl bg-red-50 border border-red-300 flex items-start gap-2.5 text-xs text-red-950"
          >
            <ShieldAlert className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong className="block font-bold text-red-900">
                Alerta Art. 69-B CFF: {efosCount} proveedor(es) listado(s) como EFOS en esta DIOT
              </strong>
              <span className="text-[11px] text-red-800">
                Verifica materialidad y estatus en el padrón oficial del SAT antes de acreditar este IVA en tu declaración mensual.
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse erp-sticky-table">
            <caption className="visually-hidden">
              Padrón de terceros para la declaración DIOT del SAT
            </caption>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th scope="col" className="py-3 px-4">Tercero / Operación</th>
                <th scope="col" className="py-3 px-4">RFC Proveedor</th>
                <th scope="col" className="py-3 px-4">Nombre / Razón Social</th>
                <th scope="col" className="py-3 px-4 text-right">Actos Pagados 16%</th>
                <th scope="col" className="py-3 px-4 text-right">IVA Acreditable 16%</th>
                <th scope="col" className="py-3 px-4 text-right">IVA Retenido</th>
                <th scope="col" className="py-3 px-4 text-right">ISR Retenido</th>
                <th scope="col" className="py-3 px-4">Línea Batch SAT (.txt)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {rowsWithEfos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 px-4 text-center text-slate-500">
                    No se registraron operaciones pagadas y contabilizadas con proveedores en {mesName} {diotData.ejercicio}.
                  </td>
                </tr>
              ) : (
                rowsWithEfos.map((r) => (
                  <tr
                    key={r.rfc}
                    className={
                      r.isEfos ? 'bg-red-50/70 hover:bg-red-50 transition' : 'hover:bg-blue-50/30 transition'
                    }
                  >
                  <td className="py-3 px-4 font-mono">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-[11px]">
                      {r.tipoTercero} / {r.tipoOperacion}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-blue-800">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{r.rfc}</span>
                      {r.isEfos && (
                        <span
                          title={`Proveedor publicado en lista negra del SAT Art. 69-B (${r.efosStatus})`}
                          className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-900 border border-red-300"
                        >
                          69-B {r.efosStatus}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {r.nombre}{' '}
                    <span className="text-[11px] text-slate-500 font-normal">
                      ({r.cfdiCount} CFDI)
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                    {formatCurrency(r.actosPagados16)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-900 font-semibold">
                    {formatCurrency(r.ivaAcreditable16)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-red-700">
                    {formatCurrency(r.ivaRetenido)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-red-700">
                    {formatCurrency(r.isrRetenido)}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                    <code>{r.batchLine}</code>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Visor del Archivo Batch .TXT DIOT */}
        <div className="p-4 bg-[#0A1120] text-slate-200 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-slate-400">
              Vista Previa Carga Batch SAT ({diotData.filename})
            </span>
            <button
              type="button"
              onClick={() => {
                void copyDiotText(diotData.batchTxtContent, 'diot').then((ok) => {
                  if (ok) {
                    setCopiedBatch(true);
                    setTimeout(() => setCopiedBatch(false), 2000);
                  }
                });
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#111C35] hover:bg-slate-800 text-emerald-300 border border-slate-700 cursor-pointer transition shadow-2xs"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <span>¡Copiado al Portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <span>Copiar Contenido .TXT</span>
                </>
              )}
            </button>
          </div>
          <span className="visually-hidden" aria-live="polite">
            {isCopied ? 'Contenido DIOT copiado al portapapeles' : ''}
          </span>
          <pre className="text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed">
            <code>{diotData.batchTxtContent || '// Sin operaciones gravadas pagadas en este periodo'}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
