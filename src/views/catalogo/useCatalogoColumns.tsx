import { useMemo } from 'react';
import { createColumnHelper, tableFeatures } from '@tanstack/react-table';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Copy,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { AccountWithBalance } from '../../shared/types';

export const catalogoTableFeatures = tableFeatures({});
const columnHelper = createColumnHelper<typeof catalogoTableFeatures, AccountWithBalance>();

export interface UseCatalogoColumnsProps {
  collapsedCodes: Record<string, boolean>;
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
                  className="p-0.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
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
                title="Copiar código contable"
                aria-label={`Copiar código ${row.code}`}
                className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer opacity-70 hover:opacity-100"
              >
                <Copy className="w-2.5 h-2.5" aria-hidden="true" />
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
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              {!row.isAffectable && (
                <button
                  type="button"
                  onClick={() => onOpenCreateSubaccount(row)}
                  title={`Crear subcuenta hija bajo ${row.code}`}
                  aria-label={`Crear subcuenta bajo ${row.code}`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                  + Subcuenta
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenLedger(row.id)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 cursor-pointer"
              >
                <BookOpen className="w-3 h-3" aria-hidden="true" />
                Mayor
              </button>
              <button
                type="button"
                onClick={() => onOpenEditModal(row)}
                title="Editar cuenta"
                aria-label={`Editar cuenta ${row.code}`}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              {row.isAffectable && row.periodCharges === 0 && row.periodCredits === 0 && (
                confirmDeleteId === row.id ? (
                  <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-0.5">
                    <button
                      type="button"
                      onClick={() => onConfirmDelete(row.id)}
                      className="text-[10px] font-bold text-red-800 hover:underline cursor-pointer"
                    >
                      Sí
                    </button>
                    <span className="text-slate-300">/</span>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[10px] font-bold text-slate-600 hover:underline cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(row.id)}
                    title="Eliminar cuenta sin movimientos"
                    aria-label={`Eliminar cuenta ${row.code}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )
              )}
            </div>
          );
        }
      })
    ]),
    [
      collapsedCodes,
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
