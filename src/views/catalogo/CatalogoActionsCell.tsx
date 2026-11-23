import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import type { AccountWithBalance } from '../../shared/types';

interface CatalogoActionsCellProps {
  row: AccountWithBalance;
  isPeriodLocked: boolean;
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
  confirmDeleteId,
  setConfirmDeleteId,
  onOpenCreateSubaccount,
  onOpenLedger,
  onOpenEditModal,
  onConfirmDelete
}: CatalogoActionsCellProps) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {!row.isAffectable && (
        <button
          type="button"
          disabled={isPeriodLocked}
          onClick={(e) => {
            e.stopPropagation();
            onOpenCreateSubaccount(row);
          }}
          title={isPeriodLocked ? 'Periodo bloqueado ante el SAT' : `Crear subcuenta hija bajo ${row.code}`}
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
        disabled={isPeriodLocked}
        onClick={(e) => {
          e.stopPropagation();
          onOpenEditModal(row);
        }}
        title={isPeriodLocked ? 'Periodo bloqueado ante el SAT' : 'Editar cuenta'}
        aria-label={`Editar cuenta ${row.code}`}
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      {row.isAffectable && row.periodCharges === 0 && row.periodCredits === 0 && (
        confirmDeleteId === row.id ? (
          <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-0.5">
            <button
              type="button"
              disabled={isPeriodLocked}
              onClick={(e) => {
                e.stopPropagation();
                onConfirmDelete(row.id);
              }}
              className="text-[10px] font-bold text-red-800 hover:underline cursor-pointer disabled:opacity-50"
            >
              Sí
            </button>
            <span className="text-slate-300">/</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteId(null);
              }}
              className="text-[10px] font-bold text-slate-600 hover:underline cursor-pointer"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isPeriodLocked}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDeleteId(row.id);
            }}
            title={isPeriodLocked ? 'Periodo bloqueado ante el SAT' : 'Eliminar cuenta sin movimientos'}
            aria-label={`Eliminar cuenta ${row.code}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )
      )}
    </div>
  );
}
