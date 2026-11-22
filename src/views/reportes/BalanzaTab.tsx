import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  flexRender,
  useTable,
  type SortingState
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Search
} from 'lucide-react';
import type { AccountWithBalance, Company } from '../../shared/types';
import { balanzaTableFeatures, useBalanzaColumns } from './useBalanzaColumns';
import { BalanzaTotalsFooter } from './BalanzaTotalsFooter';

interface BalanzaTabProps {
  trialBalance: AccountWithBalance[];
  company: Company;
  ejercicio: number;
  mesNombre: string;
  onSelectAccount: (accountId: string) => void;
}

export function BalanzaTab({
  trialBalance,
  company,
  ejercicio,
  mesNombre,
  onSelectAccount
}: BalanzaTabProps) {
  const [levelScope, setLevelScope] = useState<'ALL' | 'MAYOR' | 'SUBCUENTAS' | 'AFECTABLES'>('ALL');
  const [hideZeroBalances, setHideZeroBalances] = useState(false);
  const [balanzaSearch, setBalanzaSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);

  const zeroCount = useMemo(() => {
    return trialBalance.filter(
      (r) =>
        Math.abs(r.initialBalanceComputed) < 0.01 &&
        Math.abs(r.periodCharges) < 0.01 &&
        Math.abs(r.periodCredits) < 0.01 &&
        Math.abs(r.finalBalance) < 0.01
    ).length;
  }, [trialBalance]);

  const balanzaRows = useMemo(() => {
    return trialBalance.filter((r) => {
      if (levelScope === 'MAYOR' && r.level !== 1) return false;
      if (levelScope === 'SUBCUENTAS' && r.level > 2) return false;
      if (levelScope === 'AFECTABLES' && !r.isAffectable) return false;
      if (
        hideZeroBalances &&
        Math.abs(r.initialBalanceComputed) < 0.01 &&
        Math.abs(r.periodCharges) < 0.01 &&
        Math.abs(r.periodCredits) < 0.01 &&
        Math.abs(r.finalBalance) < 0.01
      ) {
        return false;
      }
      if (balanzaSearch.trim()) {
        const q = balanzaSearch.toLowerCase();
        if (
          !r.code.toLowerCase().includes(q) &&
          !r.name.toLowerCase().includes(q) &&
          !r.satGroupCode.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [trialBalance, levelScope, hideZeroBalances, balanzaSearch]);

  const filteredBalanzaTotals = useMemo(() => {
    return balanzaRows.reduce(
      (acc, r) => {
        if (r.isAffectable) {
          if (r.nature === 'DEUDORA') {
            acc.initialDeudor += r.initialBalanceComputed;
            acc.finalDeudor += r.finalBalance;
          } else {
            acc.initialAcreedor += r.initialBalanceComputed;
            acc.finalAcreedor += r.finalBalance;
          }
          acc.cargos += r.periodCharges;
          acc.abonos += r.periodCredits;
        }
        return acc;
      },
      {
        initialDeudor: 0,
        initialAcreedor: 0,
        cargos: 0,
        abonos: 0,
        finalDeudor: 0,
        finalAcreedor: 0
      }
    );
  }, [balanzaRows]);

  const columns = useBalanzaColumns(onSelectAccount);

  const table = useTable({
    features: balanzaTableFeatures,
    data: balanzaRows,
    columns,
    state: {
      sorting
    },
    onSortingChange: setSorting
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            Sumas Iguales Verificadas ✔
          </span>
          <div className="relative w-56 sm:w-64 no-print">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={balanzaSearch}
              onChange={(e) => setBalanzaSearch(e.target.value)}
              aria-label="Buscar cuenta o agrupador SAT en la balanza"
              placeholder="Buscar cuenta o agrupador SAT..."
              className="w-full pl-8 pr-3 py-1 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 no-print max-w-full overflow-x-auto">
          <div
            className="inline-flex items-center rounded-xl bg-slate-200/70 p-0.5 border border-slate-300 text-xs shadow-2xs shrink-0"
            role="group"
            aria-label="Filtrar por nivel contable"
          >
            {[
              { id: 'ALL' as const, label: 'Todas' },
              { id: 'MAYOR' as const, label: 'Solo Mayor (N1)' },
              { id: 'SUBCUENTAS' as const, label: 'Hasta N2' },
              { id: 'AFECTABLES' as const, label: 'Afectables (N3)' }
            ].map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                aria-pressed={levelScope === lvl.id}
                onClick={() => setLevelScope(lvl.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                  levelScope === lvl.id
                    ? 'bg-white text-blue-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>

          <label htmlFor="balanza-hide-zero" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              id="balanza-hide-zero"
              type="checkbox"
              checked={hideZeroBalances}
              onChange={(e) => setHideZeroBalances(e.target.checked)}
              className="rounded text-blue-700"
            />
            <span>Ocultar saldo $0.00 {zeroCount > 0 && `(${zeroCount})`}</span>
          </label>
        </div>
      </div>

      <div ref={parentRef} className="overflow-auto max-h-[480px] rounded-xl border border-slate-200 shadow-2xs">
        <table className="w-full text-left border-collapse erp-sticky-table">
          <caption className="visually-hidden">
            Balanza de comprobación de {company.name} en {mesNombre} {ejercicio}
          </caption>
          <thead className="sticky top-0 z-20">
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600 shadow-2xs"
              >
                {hg.headers.map((header) => {
                  const isSortable = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={`py-3 px-4 ${
                        isSortable
                          ? 'cursor-pointer select-none hover:bg-slate-100 transition'
                          : ''
                      }`}
                      onClick={isSortable ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {isSortable && (
                          <span className="text-slate-400">
                            {sorted === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-blue-700" />
                            ) : sorted === 'desc' ? (
                              <ArrowDown className="w-3.5 h-3.5 text-blue-700" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-300" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {paddingTop > 0 && (
              <tr>
                <td
                  colSpan={table.getAllLeafColumns().length}
                  style={{ height: `${paddingTop}px` }}
                />
              </tr>
            )}
            {virtualItems.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              const lvl = row.original.level;
              return (
                <tr
                  key={row.id}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  className={
                    lvl === 1
                      ? 'bg-slate-100'
                      : lvl === 2
                      ? 'bg-slate-50/70'
                      : 'hover:bg-blue-50/30'
                  }
                >
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="py-2.5 px-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td
                  colSpan={table.getAllLeafColumns().length}
                  style={{ height: `${paddingBottom}px` }}
                />
              </tr>
            )}
          </tbody>
          <BalanzaTotalsFooter
            balanzaSearch={balanzaSearch}
            onlyAffectable={levelScope === 'AFECTABLES'}
            hideZeroBalances={hideZeroBalances}
            affectableFilteredCount={balanzaRows.filter((r) => r.isAffectable).length}
            filteredBalanzaTotals={filteredBalanzaTotals}
          />
        </table>
      </div>
    </div>
  );
}
