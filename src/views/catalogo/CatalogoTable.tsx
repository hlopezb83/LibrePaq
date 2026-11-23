import { useEffect, useRef } from 'react';
import {
  flexRender,
  useTable
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { AccountWithBalance } from '../../shared/types';
import { catalogoTableFeatures, useCatalogoColumns } from './useCatalogoColumns';

export interface CatalogoTableProps {
  filteredAccounts: AccountWithBalance[];
  isLoading: boolean;
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  copiedCode?: string | null;
  selectedAccountId: string | null;
  onSelectAccount: (id: string) => void;
  collapsedCodes: Record<string, boolean>;
  onToggleNodeCollapse: (code: string) => void;
  onOpenLedger: (id: string) => void;
  onOpenCreateSubaccount: (acc: AccountWithBalance) => void;
  onOpenEditModal: (acc: AccountWithBalance) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  onConfirmDelete: (id: string) => void;
  onCopyCode: (code: string) => void;
  onResetFilters?: () => void;
}

export function CatalogoTable({
  filteredAccounts,
  isLoading,
  isPeriodLocked = false,
  isReadOnlyClient = false,
  copiedCode = null,
  selectedAccountId,
  onSelectAccount,
  collapsedCodes,
  onToggleNodeCollapse,
  onOpenLedger,
  onOpenCreateSubaccount,
  onOpenEditModal,
  confirmDeleteId,
  setConfirmDeleteId,
  onConfirmDelete,
  onCopyCode,
  onResetFilters
}: CatalogoTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const columns = useCatalogoColumns({
    collapsedCodes,
    isPeriodLocked,
    isReadOnlyClient,
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
  });

  const table = useTable({
    features: catalogoTableFeatures,
    data: filteredAccounts,
    columns
  });

  const rows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10
  });

  useEffect(() => {
    if (!selectedAccountId) return;
    const index = rows.findIndex((r) => r.original.id === selectedAccountId);
    if (index !== -1) {
      rowVirtualizer.scrollToIndex(index, { align: 'auto' });
      const active = document.activeElement;
      if (active === document.body || active?.closest('[data-catalogo-table]')) {
        requestAnimationFrame(() => {
          document.getElementById(`acc-row-${selectedAccountId}`)?.focus({ preventScroll: true });
        });
      }
    }
  }, [selectedAccountId, rows, rowVirtualizer]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  return (
    <div
      ref={parentRef}
      data-catalogo-table="true"
      className="overflow-auto min-h-[300px] max-h-[calc(100vh-280px)]"
    >
      <table className="w-full text-left border-collapse erp-sticky-table">
        <caption className="visually-hidden">
          Catálogo de cuentas contables SAT Anexo 24
        </caption>
        <thead className="sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="border-b border-slate-200 text-[11px] font-bold text-slate-600 bg-slate-50/90"
            >
              {headerGroup.headers.map((header) => (
                <th key={header.id} scope="col" className="py-2.5 px-3">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          {isLoading ? (
            <tr>
              <td
                colSpan={columns.length}
                role="status"
                aria-live="polite"
                className="py-12 text-center text-slate-600"
              >
                Cargando catálogo contable Anexo 24...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-500">
                <p>No se encontraron cuentas contables que coincidan con los filtros aplicados.</p>
                {onResetFilters && (
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="mt-2 inline-flex items-center px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-blue-800 transition cursor-pointer"
                  >
                    Limpiar filtros
                  </button>
                )}
              </td>
            </tr>
          ) : (
            <>
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) return null;
                const acc = row.original;
                const isSelected = selectedAccountId === acc.id;
                const isRovingTarget = isSelected || (!selectedAccountId && virtualRow.index === 0);
                return (
                  <tr
                    id={`acc-row-${acc.id}`}
                    key={row.id}
                    onClick={() => onSelectAccount(acc.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectAccount(acc.id);
                      }
                    }}
                    tabIndex={isRovingTarget ? 0 : -1}
                    aria-level={acc.level}
                    aria-selected={isSelected}
                    className={`transition group cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/90 ring-1 ring-blue-500/50 shadow-2xs'
                        : acc.level === 1
                        ? 'bg-slate-100/70 font-bold hover:bg-slate-100 border-t-2 border-slate-200'
                        : acc.level === 2
                        ? 'bg-white font-semibold hover:bg-slate-50'
                        : 'bg-white hover:bg-blue-50/30'
                    }`}
                  >
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id} className="py-2 px-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
