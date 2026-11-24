import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, X } from 'lucide-react';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { formatCurrency } from '../../lib/formatters';
import {
  downloadCatalogoTemplateCsv,
  type CatalogoCsvImportPreview
} from './catalogoCsvIo';

const FORMAT_LABELS: Record<NonNullable<CatalogoCsvImportPreview['fileFormat']>, string> = {
  CSV: 'CSV / Excel',
  CONTPAQI_TXT: 'CONTPAQi® TXT (C ...)',
  ANEXO24_CT_XML: 'Anexo 24 CT.xml (Catálogo SAT)',
  ANEXO24_BN_XML: 'Anexo 24 BN.xml (Balanza / Saldos Iniciales)'
};

interface CatalogoCsvImportPreviewModalProps {
  preview: CatalogoCsvImportPreview | null;
  isImporting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CatalogoCsvImportPreviewModal({
  preview,
  isImporting,
  onClose,
  onConfirm
}: CatalogoCsvImportPreviewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [fechaInicioOp, setFechaInicioOp] = useState(preview?.fechaInicioOperaciones ?? '');
  useDialogLightDismiss(dialogRef, onClose, { isOpen: Boolean(preview) });

  useEffect(() => {
    setFechaInicioOp(preview?.fechaInicioOperaciones ?? '');
  }, [preview]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (preview) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [preview]);

  if (!preview) return null;

  const canConfirm = preview.allValidRows.length > 0 && !isImporting;

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="csv-preview-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-2xl max-h-[92dvh] open:flex open:flex-col overflow-hidden backdrop:bg-slate-900/60 p-0 m-auto"
    >
      <header className="p-4 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="csv-preview-title" className="text-sm font-bold text-slate-900 truncate">
                Vista Previa de Importación de Catálogo
              </h2>
              {preview.fileFormat && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                  {FORMAT_LABELS[preview.fileFormat]}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate">{preview.fileName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isImporting}
          aria-label="Cerrar vista previa de importación"
          className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer disabled:opacity-40"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 block">Cuentas Nuevas</span>
            <span className="text-lg font-mono font-bold text-emerald-950">{preview.toCreate.length}</span>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <span className="text-[11px] font-bold text-blue-800 block">A Actualizar</span>
            <span className="text-lg font-mono font-bold text-blue-950">{preview.toUpdate.length}</span>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-[11px] font-bold text-amber-800 block">Filas Omitidas</span>
            <span className="text-lg font-mono font-bold text-amber-950">{preview.skipped.length}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <label htmlFor="mig-fecha-inicio" className="text-[11px] font-semibold text-slate-700">
            Fecha de inicio de operaciones (opcional, ej. AAAA-MM):
          </label>
          <input
            id="mig-fecha-inicio"
            type="month"
            value={fechaInicioOp}
            onChange={(e) => setFechaInicioOp(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-800"
          />
        </div>

        {preview.balanzaValidation && (
          <div
            className={`p-3 rounded-xl border space-y-1.5 ${
              preview.balanzaValidation.isBalanced
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-red-50 border-red-300 text-red-950'
            }`}
          >
            <div className="flex items-center justify-between gap-2 font-bold">
              <span>
                {preview.balanzaValidation.isBalanced
                  ? 'Validación Balanza BN.xml: Deudor === Acreedor (Cuadrada)'
                  : `Descuadre detectado en BN.xml (${formatCurrency(preview.balanzaValidation.difference)})`}
              </span>
              {preview.balanzaValidation.anio && preview.balanzaValidation.mes && (
                <span className="font-mono text-[11px]">
                  P{preview.balanzaValidation.mes}/{preview.balanzaValidation.anio}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div>Saldo Ini Deudor: <strong>{formatCurrency(preview.balanzaValidation.totalDeudor)}</strong></div>
              <div>Saldo Ini Acreedor: <strong>{formatCurrency(preview.balanzaValidation.totalAcreedor)}</strong></div>
              <div>Debe: <strong>{formatCurrency(preview.balanzaValidation.totalDebe)}</strong></div>
              <div>Haber: <strong>{formatCurrency(preview.balanzaValidation.totalHaber)}</strong></div>
            </div>
          </div>
        )}

        {preview.skipped.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
              <span>Filas omitidas por formato o datos incompletos ({preview.skipped.length})</span>
            </div>
            <ul className="max-h-32 overflow-y-auto space-y-1 text-[11px] text-amber-900 font-mono">
              {preview.skipped.map((item) => (
                <li key={item.lineNumber}>
                  <strong>Línea {item.lineNumber}:</strong> {item.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {preview.allValidRows.length > 0 ? (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 font-bold text-slate-700">
              Muestra de cuentas listas para importar ({preview.allValidRows.length})
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
              {preview.allValidRows.slice(0, 50).map((r) => {
                const isUpdate = preview.toUpdate.some((u) => u.code === r.code);
                return (
                  <div key={r.code} className="px-3 py-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-blue-900 shrink-0">{r.code}</span>
                      <span className="truncate text-slate-800">{r.name}</span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        isUpdate
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isUpdate ? 'Actualizar' : 'Nueva'}
                    </span>
                  </div>
                );
              })}
              {preview.allValidRows.length > 50 && (
                <div className="px-3 py-1.5 text-[11px] text-slate-500 text-center">
                  ... y {preview.allValidRows.length - 50} cuentas adicionales
                </div>
              )}
            </div>
          </div>
        ) : (
          <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900">
            No se detectaron filas válidas para importar. Descarga la plantilla CSV oficial para verificar el formato.
          </div>
        )}
      </div>

      <footer className="p-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={downloadCatalogoTemplateCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          Descargar plantilla CSV
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isImporting}
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200/70 cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            )}
            <span>
              {isImporting
                ? 'Importando...'
                : `Importar ${preview.allValidRows.length} cuentas`}
            </span>
          </button>
        </div>
      </footer>
    </dialog>
  );
}
