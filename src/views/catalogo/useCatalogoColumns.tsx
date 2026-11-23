import { useMemo } from 'react';
import { createColumnHelper, tableFeatures } from '@tanstack/react-table';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy
} from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { AccountWithBalance } from '../../shared/types';
import { CatalogoActionsCell } from './CatalogoActionsCell';

export const catalogoTableFeatures = tableFeatures({});
const columnHelper = createColumnHelper<typeof catalogoTableFeatures, AccountWithBalance>();

export interface UseCatalogoColumnsProps {
  collapsedCodes: Record<string, boolean>;
  isPeriodLocked?: boolean;
  copiedCode?: string | null;
  onToggleNodeCollapse: (code: string) => void;
  onSelectAccount: (id: string) => void;
  onOpenLedger: (id: string) => void;
  onCopyCode: (code: string) => void;
  onOpenCreateSubaccount: (acc: AccountWithBalance) => void;
  onOpenEditModal: (acc: AccountWithBalance) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  onConfirmDelete: (id: string) => void;
}

export function useCatalogoColumns({
  collapsedCodes,
  isPeriodLocked = false,
  copiedCode = null,
  onToggleNodeCollapse,
  onSelectAccount,
  onOpenLedger,
  onCopyCode,
  onOpenCreateSubaccount,
  onOpenEditModal,
  confirmDeleteId,
  setConfirmDeleteId,
  onConfirmDelete
}: UseCatalogoColumnsProps) {
  return useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('code', {
        header: 'Código Cuenta',
        cell: (info) => {
          const row = info.row.original;
          const isCollapsed = Boolean(collapsedCodes[row.code]);
          const isParent = !row.isAffectable;
          return (
            <div className="flex items-center gap-1.5">
              {row.level > 1 && (
                <div
                  style={{ width: `${(row.level - 1) * 18}px` }}
                  className="shrink-0 flex items-center justify-end select-none pr-0.5"
                  aria-hidden="true"
                >
                  <span className="font-mono text-slate-400 font-bold text-xs">
                    {row.level === 2 ? '├─' : '└─'}
                  </span>
                </div>
              )}

              <span
                title={`Nivel jerárquico ${row.level}`}
                className={`inline-flex items-center justify-center font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                  row.level === 1
                    ? 'bg-slate-200 text-slate-800 border-slate-300'
                    : row.level === 2
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : row.level === 3
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-purple-50 text-purple-700 border-purple-200'
                }`}
              >
                N{row.level}
              </span>

              {isParent ? (
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleNodeCollapse(row.code);
                    onSelectAccount(row.id);
                  }}
                  title={isCollapsed ? 'Expandir subcuentas' : 'Contraer subcuentas'}
                  aria-label={
                    isCollapsed
                      ? `Expandir subcuentas de ${row.code}`
                      : `Contraer subcuentas de ${row.code}`
                  }
                  className="min-w-[24px] min-h-[24px] inline-flex items-center justify-center p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                </button>
              ) : (
                <span
                  title="Cuenta Afectable (registra pólizas)"
                  className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 ml-1 mr-0.5"
                />
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAccount(row.id);
                  onOpenLedger(row.id);
                }}
                title="Ver Tarjeta Auxiliar / Libro Mayor"
                className="font-mono text-xs text-blue-800 hover:text-blue-950 underline decoration-dotted underline-offset-2 cursor-pointer font-semibold"
              >
                {info.getValue()}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyCode(row.code);
                }}
                title={copiedCode === row.code ? 'Código copiado' : 'Copiar código contable'}
                aria-label={`Copiar código ${row.code}`}
                className="min-w-[24px] min-h-[24px] inline-flex items-center justify-center p-1 rounded text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer"
              >
                {copiedCode === row.code ? (
                  <Check className="w-2.5 h-2.5 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Copy className="w-2.5 h-2.5" aria-hidden="true" />
                )}
              </button>
            </div>
          );
        }
      }),
      columnHelper.accessor('name', {
        header: 'Nombre de la Cuenta Contable',
        cell: (info) => {
          const row = info.row.original;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectAccount(row.id);
                onOpenLedger(row.id);
              }}
              className={`text-left hover:text-blue-800 cursor-pointer block truncate max-w-md ${
                row.level === 1
                  ? 'font-bold text-slate-900 uppercase tracking-tight text-xs'
                  : row.level === 2
                  ? 'font-semibold text-slate-800 text-xs'
                  : 'text-slate-700 text-xs pl-1'
              }`}
            >
              {info.getValue()}
            </button>
          );
        }
      }),
      columnHelper.accessor('satGroupCode', {
        header: 'Agrupador SAT',
        cell: (info) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            SAT {info.getValue()}
          </span>
        )
      }),
      columnHelper.accessor('type', {
        header: 'Rubro / Naturaleza',
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-700">{row.type}</span>
              <span className="text-slate-300">•</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                  row.nature === 'DEUDORA'
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : 'bg-slate-100 text-slate-800 border-slate-300'
                }`}
              >
                {row.nature === 'DEUDORA' ? 'Deudora (D)' : 'Acreedora (A)'}
              </span>
            </div>
          );
        }
      }),
      columnHelper.accessor('initialBalanceComputed', {
        header: () => <div className="text-right">Saldo Inicial</div>,
        cell: (info) => (
          <div className="text-right font-mono text-xs text-slate-700">
            {formatCurrency(info.getValue())}
          </div>
        )
      }),
      columnHelper.accessor('finalBalance', {
        header: () => <div className="text-right">Saldo Final</div>,
        cell: (info) => {
          const row = info.row.original;
          const isInverted = row.isAffectable && row.finalBalance < 0;
          return (
            <div className="text-right font-mono text-xs flex items-center justify-end gap-1.5">
              {isInverted && (
                <span
                  title="Alerta Contable: Saldo contrario a la naturaleza de la cuenta"
                  className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-300"
                >
                  Saldo Rojo
                </span>
              )}
              <span
                className={`${
                  isInverted
                    ? 'font-bold text-red-700'
                    : row.level < 3
                    ? 'font-bold text-slate-900'
                    : 'font-semibold text-blue-900'
                }`}
              >
                {formatCurrency(info.getValue())}
              </span>
            </div>
          );
        }
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <div className="text-right whitespace-nowrap min-w-[140px] pr-1">Auxiliar / Acciones</div>,
        cell: (info) => (
          <CatalogoActionsCell
            row={info.row.original}
            isPeriodLocked={isPeriodLocked}
            confirmDeleteId={confirmDeleteId}
            setConfirmDeleteId={setConfirmDeleteId}
            onOpenCreateSubaccount={onOpenCreateSubaccount}
            onOpenLedger={onOpenLedger}
            onOpenEditModal={onOpenEditModal}
            onConfirmDelete={onConfirmDelete}
          />
        )
      })
    ]),
    [
      collapsedCodes,
      isPeriodLocked,
      copiedCode,
      onToggleNodeCollapse,
      onSelectAccount,
      onOpenLedger,
      onCopyCode,
      onOpenCreateSubaccount,
      onOpenEditModal,
      confirmDeleteId,
      setConfirmDeleteId,
      onConfirmDelete
    ]
  );
}
