import React from 'react';
import { ArrowRightLeft, Download, FolderTree, Lock, Plus, Upload } from 'lucide-react';

export interface CatalogoHeaderBarProps {
  csvImportRef: React.RefObject<HTMLInputElement | null>;
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  onImportCsv: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportCsv: () => void;
  onOpenReclassify?: () => void;
  onOpenCreateModal: () => void;
}

export function CatalogoHeaderBar({
  csvImportRef,
  isPeriodLocked = false,
  isReadOnlyClient = false,
  onImportCsv,
  onExportCsv,
  onOpenReclassify,
  onOpenCreateModal
}: CatalogoHeaderBarProps) {
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;
  const blockedReason = isReadOnlyClient
    ? 'Tu rol Cliente (Solo lectura) no permite modificar el catálogo'
    : 'Periodo fiscal bloqueado ante el SAT';
  return (
    <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-300/90 shadow-2xs">
      <div className="flex items-start gap-3.5 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
          <FolderTree className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-900">
            Catálogo de Cuentas SAT (Anexo 24) y Libro Mayor
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Árbol jerárquico plegable: haz clic en <strong>▼/▶</strong> para contraer nodos o en cualquier cuenta para abrir su <strong>Libro Mayor</strong>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
        <label
          htmlFor="catalogo-import-csv"
          title={
            isWriteBlocked
              ? blockedReason
              : 'Importar catálogo de cuentas desde archivo CSV, TXT CONTPAQi o XML Anexo 24'
          }
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-1 ${
            isWriteBlocked
              ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
              : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 cursor-pointer'
          }`}
        >
          <input
            id="catalogo-import-csv"
            ref={csvImportRef}
            type="file"
            accept=".csv,.txt,.xml,text/csv,text/xml,application/xml"
            disabled={isWriteBlocked}
            onChange={onImportCsv}
            className="visually-hidden"
          />
          <Upload className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <span>Importar CSV / CONTPAQi / XML</span>
        </label>

        {onOpenReclassify && (
          <button
            type="button"
            disabled={isWriteBlocked}
            onClick={onOpenReclassify}
            title={
              isWriteBlocked
                ? blockedReason
                : 'Reclasificar masivamente movimientos entre cuentas afectables'
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed border border-amber-200 text-xs font-semibold text-amber-900 transition cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
            <span>Reclasificar</span>
          </button>
        )}

        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          Exportar Excel (.CSV)
        </button>

        <button
          type="button"
          disabled={isWriteBlocked}
          onClick={onOpenCreateModal}
          title={
            isWriteBlocked
              ? blockedReason
              : 'Dar de alta nueva cuenta contable (Alt+N o Insert)'
          }
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-semibold text-white shadow-xs transition cursor-pointer shrink-0"
        >
          {isWriteBlocked ? (
            <Lock className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Plus className="w-4 h-4 text-blue-100" aria-hidden="true" />
          )}
          <span>Nueva Cuenta</span>
          {!isWriteBlocked && (
            <kbd className="hidden sm:inline font-mono text-[9px] bg-blue-800 px-1 py-0.5 rounded border border-blue-400/50 text-blue-100">
              Alt+N
            </kbd>
          )}
        </button>
      </div>
    </div>
  );
}
