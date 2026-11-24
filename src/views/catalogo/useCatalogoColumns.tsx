import { useMemo } from 'react';
import { createColumnHelper, tableFeatures } from '@tanstack/react-table';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy
} from 'lucide-react';
import { StatusBadge } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';
import type { AccountWithBalance } from '../../shared/types';
import { CatalogoActionsCell } from './CatalogoActionsCell';

export const catalogoTableFeatures = tableFeatures({});
const columnHelper = createColumnHelper<typeof catalogoTableFeatures, AccountWithBalance>();

export interface UseCatalogoColumnsProps {
  collapsedCodes: Record<string, boolean>;
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  deletingAccountId?: string | null;
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
  isReadOnlyClient = false,
  deletingAccountId = null,
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
            const levelTone =
              row.level === 1
                ? 'slate'
                : row.level === 2
                ? 'blue'
                : row.level === 3
                ? 'emerald'
                : 'purple';
            return (
              <div className="flex items-center gap-1">
                {row.level > 1 && (
                  <div
                    style={{ width: `${(row.level - 1) * 14}px` }}
                    className="shrink-0 flex items-center justify-end select-none pr-0.5"
                    aria-hidden="true"
                  >
                    <span className="font-mono text-slate-500 font-bold text-xs whitespace-nowrap">
                      {row.level === 2 ? '├─' : row.level === 3 ? '│ ├─' : '│ └─'}
                    </span>
                  </div>
                )}

                <span title={`Nivel jerárquico ${row.level}`} className="shrink-0">
                  <StatusBadge tone={levelTone} shape="tag" className="text-[9px]! px-1!">
                    N{row.level}
                  </StatusBadge>
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
                    className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 ml-1 mr-0.5 inline-block"
                  >
                    <span className="sr-only">Afectable</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAccount(row.id);
                    onOpenLedger(row.id);
                  }}
                  title="Ver Tarjeta Auxiliar / Libro Mayor"
                  className="font-mono text-xs text-blue-800 hover:text-blue-950 underline decoration-dotted underline-offset-2 cursor-pointer font-semibold whitespace-nowrap tabular-nums"
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
                title={row.name}
                aria-label={`Ver Libro Mayor de ${row.code} ${row.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAccount(row.id);
                  onOpenLedger(row.id);
                }}
                className={`text-left hover:text-blue-800 cursor-pointer block truncate max-w-[150px] lg:max-w-[165px] xl:max-w-[180px] ${
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
          cell: (info) => {
            const val = info.getValue()?.trim();
            if (!val) {
              return (
                <span title="Cuenta sin código agrupador SAT Anexo 24 asignado">
                  <StatusBadge tone="amber" shape="tag">
                    Sin SAT
                  </StatusBadge>
                </span>
              );
            }
            return (
              <StatusBadge tone="slate" shape="tag" className="font-semibold">
                SAT {val}
              </StatusBadge>
            );
          }
        }),
        columnHelper.accessor('type', {
          header: 'Rubro / Nat.',
          cell: (info) => {
            const row = info.row.original;
            return (
              <div className="flex items-center gap-1 whitespace-nowrap">
                {row.type === 'ORDEN' ? (
                  <StatusBadge tone="purple" shape="tag">
                    ORDEN
                  </StatusBadge>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-700">{row.type}</span>
                )}
                <span
                  title={
                    row.nature === 'DEUDORA'
                      ? 'Naturaleza Deudora (D)'
                      : 'Naturaleza Acreedora (A)'
                  }
                >
                  <StatusBadge
                    tone={row.nature === 'DEUDORA' ? 'blue' : 'slate'}
                    shape="tag"
                    className="px-1!"
                  >
                    {row.nature === 'DEUDORA' ? 'D' : 'A'}
                  </StatusBadge>
                </span>
              </div>
            );
          }
        }),
        columnHelper.accessor('initialBalanceComputed', {
          header: () => <div className="text-right whitespace-nowrap">Saldo Inicial</div>,
          cell: (info) => (
            <div className="text-right font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
              {formatCurrency(info.getValue())}
            </div>
          )
        }),
        columnHelper.accessor('finalBalance', {
          header: () => <div className="text-right whitespace-nowrap">Saldo Final</div>,
          cell: (info) => {
            const row = info.row.original;
            const isInverted = row.isAffectable && row.finalBalance < 0;
            return (
              <div className="text-right font-mono tabular-nums text-xs flex items-center justify-end gap-1 whitespace-nowrap">
                {isInverted && (
                  <span title="Alerta Contable: Saldo contrario a la naturaleza de la cuenta">
                    <StatusBadge tone="red" shape="tag" className="text-[9px]! uppercase tracking-wider">
                      Saldo Rojo
                    </StatusBadge>
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
          header: () => <div className="text-right whitespace-nowrap min-w-[128px] pr-1">Auxiliar / Acciones</div>,
          cell: (info) => (
            <CatalogoActionsCell
              row={info.row.original}
              isPeriodLocked={isPeriodLocked}
              isReadOnlyClient={isReadOnlyClient}
              isDeleting={deletingAccountId === info.row.original.id}
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
      isReadOnlyClient,
      deletingAccountId,
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
