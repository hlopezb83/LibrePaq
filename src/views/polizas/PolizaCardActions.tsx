import {
  Check,
  Copy,
  CopyPlus,
  Loader2,
  Pencil,
  Printer,
  RotateCcw,
  Trash2
} from 'lucide-react';
import type { Poliza } from '../../shared/types';

interface PolizaCardActionsProps {
  pol: Poliza;
  isWriteBlocked: boolean;
  isReadOnlyClient: boolean;
  isPeriodLocked: boolean;
  isDeleting?: boolean;
  isReversing?: boolean;
  copiedPolizaId: string | null;
  confirmDeleteId: string | null;
  onCopyPoliza: (pol: Poliza) => void;
  onPrintPoliza?: (pol: Poliza) => void;
  onDuplicate: (pol: Poliza) => void;
  onReverse?: (pol: Poliza) => void;
  onEdit: (pol: Poliza) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  onRequestDelete: (id: string) => void;
}

export function PolizaCardActions({
  pol,
  isWriteBlocked,
  isReadOnlyClient,
  isPeriodLocked,
  isDeleting = false,
  isReversing = false,
  copiedPolizaId,
  confirmDeleteId,
  onCopyPoliza,
  onPrintPoliza,
  onDuplicate,
  onReverse,
  onEdit,
  onConfirmDelete,
  onCancelDelete,
  onRequestDelete
}: PolizaCardActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 no-print">
      {onPrintPoliza && (
        <button
          type="button"
          onClick={() => onPrintPoliza(pol)}
          title="Imprimir / Exportar póliza en PDF formal"
          aria-label={`Imprimir PDF de póliza ${pol.tipo} #${pol.folio}`}
          className="min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <span className="hidden sm:inline">PDF</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => onCopyPoliza(pol)}
        title="Copiar asiento contable al portapapeles (texto formal con sumas iguales)"
        aria-label={`Copiar asiento de póliza ${pol.tipo} #${pol.folio}`}
        className="min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
      >
        {copiedPolizaId === pol.id ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span className="text-emerald-700 font-semibold">Copiado</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span className="hidden sm:inline">Copiar Asiento</span>
          </>
        )}
      </button>

      <button
        type="button"
        disabled={isWriteBlocked}
        onClick={() => onDuplicate(pol)}
        title={
          isReadOnlyClient
            ? 'Tu rol Cliente (Solo lectura) no permite duplicar pólizas'
            : isPeriodLocked
            ? 'Periodo bloqueado ante el SAT'
            : 'Duplicar esta póliza como plantilla para un nuevo registro'
        }
        aria-label={`Duplicar póliza ${pol.tipo} #${pol.folio}`}
        className={`min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
          isWriteBlocked
            ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
            : 'text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 cursor-pointer'
        }`}
      >
        <CopyPlus className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Duplicar</span>
      </button>

      {onReverse && (
        <button
          type="button"
          disabled={isWriteBlocked || isReversing}
          onClick={() => onReverse(pol)}
          title={
            isReadOnlyClient
              ? 'Tu rol Cliente (Solo lectura) no permite generar pólizas inversas'
              : isPeriodLocked
              ? 'Periodo bloqueado ante el SAT'
              : 'Generar Póliza Inversa (Reversión)'
          }
          aria-label={`Generar Póliza Inversa (Reversión) de ${pol.tipo} #${pol.folio}`}
          className={`min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
            isWriteBlocked || isReversing
              ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
              : 'text-amber-900 bg-amber-50 border border-amber-200 hover:bg-amber-100 cursor-pointer'
          }`}
        >
          {isReversing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">Revertir</span>
        </button>
      )}

      <button
        type="button"
        disabled={isWriteBlocked}
        onClick={() => onEdit(pol)}
        title={
          isReadOnlyClient
            ? 'Tu rol Cliente (Solo lectura) no permite editar pólizas'
            : isPeriodLocked
            ? 'Periodo bloqueado ante el SAT'
            : 'Editar póliza'
        }
        aria-label={`Editar póliza ${pol.tipo} #${pol.folio}`}
        className={`min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
          isWriteBlocked
            ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
            : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 cursor-pointer'
        }`}
      >
        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Editar</span>
      </button>

      {confirmDeleteId === pol.id ? (
        <div
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              onCancelDelete();
            }
          }}
          className="inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-1"
        >
          <button
            type="button"
            disabled={isWriteBlocked || isDeleting}
            aria-label={`Confirmar eliminación de póliza ${pol.tipo} #${pol.folio}`}
            onClick={() => onConfirmDelete(pol.id)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-red-800 hover:bg-red-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
            <span>{isDeleting ? 'Borrando...' : 'Confirmar'}</span>
          </button>
          <span className="text-red-300" aria-hidden="true">|</span>
          <button
            type="button"
            autoFocus
            disabled={isDeleting}
            aria-label={`Cancelar eliminación de póliza ${pol.tipo} #${pol.folio}`}
            onClick={onCancelDelete}
            className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 hover:bg-white cursor-pointer disabled:opacity-50"
          >
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={isWriteBlocked}
          onClick={() => {
            if (!isWriteBlocked) onRequestDelete(pol.id);
          }}
          title={
            isReadOnlyClient
              ? 'Tu rol Cliente (Solo lectura) no permite eliminar pólizas'
              : isPeriodLocked
              ? 'Periodo bloqueado ante el SAT'
              : 'Eliminar póliza'
          }
          aria-label={`Eliminar póliza ${pol.tipo} #${pol.folio}`}
          className={`min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center p-1.5 rounded-lg transition ${
            isWriteBlocked
              ? 'opacity-40 cursor-not-allowed text-slate-400'
              : 'text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer'
          }`}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
