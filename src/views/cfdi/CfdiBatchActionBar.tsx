import { useEffect, useState } from 'react';
import { FileArchive, Loader2, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';

export interface CfdiBatchActionBarProps {
  selectedCfdiIds: Set<string>;
  onClearSelection: () => void;
  isBatchContabilizarPending: boolean;
  batchProgress?: { current: number; total: number } | null;
  onBatchContabilizarSelected: () => void;
  isVerifySatBatchPending?: boolean;
  onVerifySatBatchSelected?: () => void;
  isExportZipPending?: boolean;
  onExportZipSelected?: () => void;
  isBatchDeletePending: boolean;
  onBatchDeleteSelected: () => void;
  isPeriodLocked: boolean;
  isReadOnlyClient?: boolean;
}

export function CfdiBatchActionBar({
  selectedCfdiIds,
  onClearSelection,
  isBatchContabilizarPending,
  batchProgress,
  onBatchContabilizarSelected,
  isVerifySatBatchPending = false,
  onVerifySatBatchSelected,
  isExportZipPending = false,
  onExportZipSelected,
  isBatchDeletePending,
  onBatchDeleteSelected,
  isPeriodLocked,
  isReadOnlyClient = false
}: CfdiBatchActionBarProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;

  useEffect(() => {
    setConfirmDelete(false);
  }, [selectedCfdiIds]);

  if (selectedCfdiIds.size === 0) return null;

  return (
    <div
      role="region"
      aria-label="Acciones en lote para comprobantes seleccionados"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (confirmDelete) {
            setConfirmDelete(false);
          } else {
            onClearSelection();
          }
        }
      }}
      className="dark-surface p-3.5 rounded-2xl bg-[#0A1120] text-white flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2"
    >
      <div className="flex items-center gap-2.5" aria-live="polite">
        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
          {selectedCfdiIds.size}
        </span>
        <span className="text-xs font-medium">
          {selectedCfdiIds.size === 1
            ? '1 comprobante CFDI seleccionado'
            : `${selectedCfdiIds.size} comprobantes CFDI seleccionados`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!isReadOnlyClient && (
          <button
            type="button"
            disabled={isBatchContabilizarPending || isWriteBlocked}
            onClick={onBatchContabilizarSelected}
            title={
              isPeriodLocked
                ? 'Periodo bloqueado ante el SAT. No se pueden generar pólizas.'
                : 'Contabilizar los comprobantes seleccionados en lote'
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white cursor-pointer transition shadow-2xs"
          >
            {isBatchContabilizarPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {isBatchContabilizarPending
              ? batchProgress
                ? `Contabilizando (${batchProgress.current}/${batchProgress.total})...`
                : 'Contabilizando...'
              : 'Contabilizar Seleccionados'}
          </button>
        )}

        {onVerifySatBatchSelected && !isReadOnlyClient && (
          <button
            type="button"
            disabled={isVerifySatBatchPending || isBatchContabilizarPending || isBatchDeletePending}
            onClick={onVerifySatBatchSelected}
            title="Consultar estatus vigente o cancelado ante el SAT y lista 69-B para los CFDIs seleccionados"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white cursor-pointer transition shadow-2xs"
          >
            {isVerifySatBatchPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {isVerifySatBatchPending ? 'Validando SAT...' : 'Validar SAT en Lote'}
          </button>
        )}

        {onExportZipSelected && (
          <button
            type="button"
            disabled={isExportZipPending || isBatchDeletePending}
            onClick={onExportZipSelected}
            title="Descargar los XML originales seleccionados empaquetados en archivo .ZIP"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white cursor-pointer transition shadow-2xs"
          >
            {isExportZipPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <FileArchive className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {isExportZipPending ? 'Empaquetando...' : 'Descargar XML (.zip)'}
          </button>
        )}

        {!isReadOnlyClient && (
          <button
            type="button"
            disabled={isBatchDeletePending || isWriteBlocked}
            onClick={() => {
              if (isWriteBlocked) return;
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              onBatchDeleteSelected();
              setConfirmDelete(false);
            }}
            title={isPeriodLocked ? 'Periodo bloqueado ante el SAT' : 'Eliminar del ADD'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition ${
              isWriteBlocked
                ? 'bg-slate-600 cursor-not-allowed opacity-60'
                : confirmDelete
                ? 'bg-red-700 ring-2 ring-red-400 cursor-pointer animate-pulse'
                : 'bg-red-700 hover:bg-red-800 cursor-pointer'
            }`}
          >
            {isBatchDeletePending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {isBatchDeletePending
              ? 'Eliminando...'
              : confirmDelete
              ? '¿Confirmar eliminación en bloque?'
              : 'Eliminar del ADD'}
          </button>
        )}

        {confirmDelete && (
          <button
            type="button"
            autoFocus
            title="Cancelar eliminación en bloque (Esc)"
            onClick={() => setConfirmDelete(false)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-100 cursor-pointer"
          >
            Cancelar
          </button>
        )}

        <button
          type="button"
          title="Limpiar selección actual (Esc)"
          onClick={() => {
            setConfirmDelete(false);
            onClearSelection();
          }}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer transition"
        >
          Deseleccionar
        </button>
      </div>
    </div>
  );
}
