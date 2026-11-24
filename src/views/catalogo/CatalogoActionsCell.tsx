import { BookOpen, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toCents } from '../../shared/accounting-engine';
import type { AccountWithBalance } from '../../shared/types';

interface CatalogoActionsCellProps {
  row: AccountWithBalance;
  isPeriodLocked: boolean;
  isReadOnlyClient?: boolean;
  isDeleting?: boolean;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  onOpenCreateSubaccount: (acc: AccountWithBalance) => void;
  onOpenLedger: (id: string) => void;
  onOpenEditModal: (acc: AccountWithBalance) => void;
  onConfirmDelete: (id: string) => void;
}

export function CatalogoActionsCell({
  row,
  isPeriodLocked,
  isReadOnlyClient = false,
  isDeleting = false,
  confirmDeleteId,
  setConfirmDeleteId,
  onOpenCreateSubaccount,
  onOpenLedger,
  onOpenEditModal,
  onConfirmDelete
}: CatalogoActionsCellProps) {
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;
  const blockedTooltip = isReadOnlyClient
    ? 'Tu rol Cliente (Solo lectura) no permite modificar el catálogo'
    : 'Periodo bloqueado ante el SAT';

  const hasMovements = row.periodCharges > 0 || row.periodCredits > 0;
  const hasInitialBal =
    toCents(row.initialBalance) !== 0 || toCents(row.initialBalanceComputed) !== 0;

  let deleteBlockReason: string | null = null;
  if (isWriteBlocked) {
    deleteBlockReason = blockedTooltip;
  } else if (!row.isAffectable) {
    deleteBlockReason = `No se puede eliminar ${row.code}: es una cuenta acumuladora`;
  } else if (hasMovements) {
    deleteBlockReason = `No se puede eliminar ${row.code}: tiene movimientos en el periodo`;
  } else if (hasInitialBal) {
    deleteBlockReason = `No se puede eliminar ${row.code}: tiene saldo inicial distinto de $0.00`;
  }

  const canDelete = deleteBlockReason === null;

  return (
    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
      {row.level < 4 && (
        <button
          type="button"
          disabled={isWriteBlocked}
          onClick={(e) => {
            e.stopPropagation();
            onOpenCreateSubaccount(row);
          }}
          title={isWriteBlocked ? blockedTooltip : `Crear subcuenta hija bajo ${row.code}`}
          aria-label={`Crear subcuenta bajo ${row.code}`}
          className="min-w-[26px] min-h-[26px] inline-flex items-center justify-center p-1 rounded-lg text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenLedger(row.id);
        }}
        title={`Ver Libro Mayor / Auxiliar de ${row.code}`}
        aria-label={`Ver Libro Mayor de ${row.code}`}
        className="min-h-[26px] inline-flex items-center gap-1 px-1.5 py-1 rounded-lg text-[11px] font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 cursor-pointer"
      >
        <BookOpen className="w-3 h-3" aria-hidden="true" />
        <span>Mayor</span>
      </button>
      <button
        type="button"
        disabled={isWriteBlocked}
        onClick={(e) => {
          e.stopPropagation();
          onOpenEditModal(row);
        }}
        title={isWriteBlocked ? blockedTooltip : `Editar cuenta ${row.code}`}
        aria-label={`Editar cuenta ${row.code}`}
        className="min-w-[26px] min-h-[26px] inline-flex items-center justify-center p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {canDelete && confirmDeleteId === row.id ? (
        <div
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setConfirmDeleteId(null);
            }
          }}
          className="inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-0.5"
        >
          <button
            type="button"
            disabled={isWriteBlocked || isDeleting}
            aria-label={`Confirmar eliminación de cuenta ${row.code}`}
            onClick={(e) => {
              e.stopPropagation();
              onConfirmDelete(row.id);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-red-800 hover:bg-red-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
            <span>{isDeleting ? 'Borrando...' : 'Confirmar'}</span>
          </button>
          <span className="text-slate-400" aria-hidden="true">/</span>
          <button
            type="button"
            autoFocus
            disabled={isDeleting}
            aria-label={`Cancelar eliminación de cuenta ${row.code}`}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDeleteId(null);
            }}
            className="px-2 py-1 rounded text-[10px] font-bold text-slate-700 hover:bg-white cursor-pointer disabled:opacity-50"
          >
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!canDelete}
          onClick={(e) => {
            e.stopPropagation();
            if (canDelete) setConfirmDeleteId(row.id);
          }}
          title={deleteBlockReason ?? 'Eliminar cuenta sin movimientos'}
          aria-label={deleteBlockReason ?? `Eliminar cuenta ${row.code}`}
          className="min-w-[26px] min-h-[26px] inline-flex items-center justify-center p-1 rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-600"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
