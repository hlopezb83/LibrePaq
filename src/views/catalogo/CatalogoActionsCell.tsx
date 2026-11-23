import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import type { AccountWithBalance } from '../../shared/types';

interface CatalogoActionsCellProps {
  row: AccountWithBalance;
  isPeriodLocked: boolean;
  isReadOnlyClient?: boolean;
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

  return (
    <div className="flex items-center justify-end gap-1.5">
      {!row.isAffectable && (
        <button
          type="button"
          disabled={isWriteBlocked}
          onClick={(e) => {
            e.stopPropagation();
            onOpenCreateSubaccount(row);
          }}
          title={isWriteBlocked ? blockedTooltip : `Crear subcuenta hija bajo ${row.code}`}
          aria-label={`Crear subcuenta bajo ${row.code}`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3 h-3 text-emerald-600" aria-hidden="true" />
          Subcuenta
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenLedger(row.id);
        }}
        aria-label={`Ver Libro Mayor de ${row.code}`}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 cursor-pointer"
      >
        <BookOpen className="w-3 h-3" aria-hidden="true" />
        Mayor
      </button>
      <button
        type="button"
        disabled={isWriteBlocked}
        onClick={(e) => {
          e.stopPropagation();
          onOpenEditModal(row);
        }}
        title={isWriteBlocked ? blockedTooltip : 'Editar cuenta'}
        aria-label={`Editar cuenta ${row.code}`}
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      {row.isAffectable && row.periodCharges === 0 && row.periodCredits === 0 && (
        confirmDeleteId === row.id ? (
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
              disabled={isWriteBlocked}
              onClick={(e) => {
                e.stopPropagation();
                onConfirmDelete(row.id);
              }}
              className="px-2 py-1 rounded text-[10px] font-bold text-red-800 hover:bg-red-100 cursor-pointer disabled:opacity-50"
            >
              Confirmar
            </button>
            <span className="text-slate-400" aria-hidden="true">/</span>
            <button
              type="button"
              autoFocus
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteId(null);
              }}
              className="px-2 py-1 rounded text-[10px] font-bold text-slate-700 hover:bg-white cursor-pointer"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isWriteBlocked}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDeleteId(row.id);
            }}
            title={isWriteBlocked ? blockedTooltip : 'Eliminar cuenta sin movimientos'}
            aria-label={`Eliminar cuenta ${row.code}`}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )
      )}
    </div>
  );
}
