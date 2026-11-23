import { useState } from 'react';
import { ShieldCheck, Sparkles, Trash2 } from 'lucide-react';

export interface CfdiBatchActionBarProps {
  selectedCfdiIds: Set<string>;
  onClearSelection: () => void;
  isBatchContabilizarPending: boolean;
  batchProgress?: { current: number; total: number } | null;
  onBatchContabilizarSelected: () => void;
  isVerifySatBatchPending?: boolean;
  onVerifySatBatchSelected?: () => void;
  isBatchDeletePending: boolean;
  onBatchDeleteSelected: () => void;
  isPeriodLocked: boolean;
}

export function CfdiBatchActionBar({
  selectedCfdiIds,
  onClearSelection,
  isBatchContabilizarPending,
  batchProgress,
  onBatchContabilizarSelected,
  isVerifySatBatchPending = false,
  onVerifySatBatchSelected,
  isBatchDeletePending,
  onBatchDeleteSelected,
  isPeriodLocked
}: CfdiBatchActionBarProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (selectedCfdiIds.size === 0) return null;

  return (
    <div className="p-3.5 rounded-2xl bg-[#0A1120] text-white flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-2.5">
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
        <button
          type="button"
          disabled={isBatchContabilizarPending || isPeriodLocked}
          onClick={onBatchContabilizarSelected}
          title={
            isPeriodLocked
              ? 'Periodo bloqueado ante el SAT. No se pueden generar pólizas.'
              : 'Contabilizar los comprobantes seleccionados en lote'
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white cursor-pointer transition shadow-2xs"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isBatchContabilizarPending ? 'animate-spin' : ''}`} aria-hidden="true" />
          {isBatchContabilizarPending
            ? batchProgress
              ? `Contabilizando (${batchProgress.current}/${batchProgress.total})...`
              : 'Contabilizando...'
            : 'Contabilizar Seleccionados'}
        </button>

        {onVerifySatBatchSelected && (
          <button
            type="button"
            disabled={isVerifySatBatchPending || isBatchContabilizarPending || isBatchDeletePending}
            onClick={onVerifySatBatchSelected}
            title="Consultar estatus vigente o cancelado ante el SAT y lista 69-B para los CFDIs seleccionados"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white cursor-pointer transition shadow-2xs"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${isVerifySatBatchPending ? 'animate-pulse' : ''}`} aria-hidden="true" />
            {isVerifySatBatchPending ? 'Validando SAT...' : 'Validar SAT en Lote'}
          </button>
        )}

        <button
          type="button"
          disabled={isBatchDeletePending || isPeriodLocked}
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            onBatchDeleteSelected();
            setConfirmDelete(false);
          }}
          title={isPeriodLocked ? 'Periodo bloqueado ante el SAT' : 'Eliminar del ADD'}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition ${
            isPeriodLocked
              ? 'bg-slate-400 cursor-not-allowed opacity-60'
              : confirmDelete
              ? 'bg-red-700 ring-2 ring-red-400 cursor-pointer animate-pulse'
              : 'bg-red-600/90 hover:bg-red-600 cursor-pointer'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          {confirmDelete ? '¿Confirmar eliminación en bloque?' : 'Eliminar del ADD'}
        </button>

        {confirmDelete && (
          <button
            type="button"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setConfirmDelete(false);
              }
            }}
            onClick={() => setConfirmDelete(false)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200 cursor-pointer"
          >
            Cancelar
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setConfirmDelete(false);
            onClearSelection();
          }}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer transition"
        >
          Deseleccionar
        </button>
      </div>
    </div>
  );
}
