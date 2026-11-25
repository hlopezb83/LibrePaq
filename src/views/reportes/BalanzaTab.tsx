import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { flexRender, useTable, type SortingState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { AlertBanner, ClearFiltersButton, EmptyState } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../lib/formatters';
import { toCents } from '../../shared/accounting-engine';
import type { CancelledCfdiWithLivePoliza } from '../../shared/engine/three-way-tieout.helpers';
import type { AccountWithBalance, Company } from '../../shared/types';
import { exportBalanzaXlsx } from './balanzaExcelExport';
import { exportBalanzaCsvOnly } from './reportesCsvExport';
import { balanzaTableFeatures, useBalanzaColumns } from './useBalanzaColumns';
import { BalanzaToolbar, type BalanzaLevelScope } from './BalanzaToolbar';
import { BalanzaTotalsFooter } from './BalanzaTotalsFooter';

interface BalanzaTabProps {
  trialBalance: AccountWithBalance[];
  company: Company;
  ejercicio: number;
  periodo?: number;
  mesNombre: string;
  onSelectAccount: (accountId: string) => void;
  cancelledCfdisWithPoliza?: ReadonlyArray<CancelledCfdiWithLivePoliza>;
}

export function BalanzaTab({
  trialBalance,
  company,
  ejercicio,
  periodo,
  mesNombre,
  onSelectAccount,
  cancelledCfdisWithPoliza = []
}: BalanzaTabProps) {
  const toast = useToast();
  const [levelScope, setLevelScope] = useState<BalanzaLevelScope>('ALL');
  const [hideZeroBalances, setHideZeroBalances] = useState(false);
  const [balanzaSearch, setBalanzaSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);

  const { zeroCount, trialDiff } = useMemo(() => {
    let zeros = 0;
    let initDeudorCents = 0;
    let initAcreedorCents = 0;
    let cargosCents = 0;
    let abonosCents = 0;
    let finalDeudorCents = 0;
    let finalAcreedorCents = 0;

    const codes = new Set(trialBalance.map((a) => a.code));
    for (const r of trialBalance) {
      if (
        Math.abs(r.initialBalanceComputed) < 0.01 &&
        Math.abs(r.periodCharges) < 0.01 &&
        Math.abs(r.periodCredits) < 0.01 &&
        Math.abs(r.finalBalance) < 0.01
      ) {
        zeros += 1;
      }
      if (!r.parentCode || !codes.has(r.parentCode)) {
        cargosCents += toCents(r.periodCharges);
        abonosCents += toCents(r.periodCredits);
        if (r.nature === 'DEUDORA') {
          initDeudorCents += toCents(r.initialBalanceComputed);
          finalDeudorCents += toCents(r.finalBalance);
        } else {
          initAcreedorCents += toCents(r.initialBalanceComputed);
          finalAcreedorCents += toCents(r.finalBalance);
        }
      }
    }
    const maxDiffCents = Math.max(
      Math.abs(initDeudorCents - initAcreedorCents),
      Math.abs(cargosCents - abonosCents),
      Math.abs(finalDeudorCents - finalAcreedorCents)
    );
    return { zeroCount: zeros, trialDiff: maxDiffCents / 100 };
  }, [trialBalance]);
  const isTrialBalanced = trialDiff < 0.01;

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

  const { filteredBalanzaTotals, rootRowsCount } = useMemo(() => {
    const visibleCodes = new Set(balanzaRows.map((r) => r.code));
    const rootRows = balanzaRows.filter((r) => !r.parentCode || !visibleCodes.has(r.parentCode));
    const totals = rootRows.reduce(
      (acc, r) => {
        if (r.nature === 'DEUDORA') {
          acc.initialDeudor += r.initialBalanceComputed;
          acc.finalDeudor += r.finalBalance;
        } else {
          acc.initialAcreedor += r.initialBalanceComputed;
          acc.finalAcreedor += r.finalBalance;
        }
        acc.cargos += r.periodCharges;
        acc.abonos += r.periodCredits;
        return acc;
      },
      { initialDeudor: 0, initialAcreedor: 0, cargos: 0, abonos: 0, finalDeudor: 0, finalAcreedor: 0 }
    );
    return { filteredBalanzaTotals: totals, rootRowsCount: rootRows.length };
  }, [balanzaRows]);

  const columns = useBalanzaColumns(onSelectAccount);
  const table = useTable({
    features: balanzaTableFeatures,
    data: balanzaRows,
    columns,
    state: { sorting },
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

  const handleClearFilters = () => {
    setLevelScope('ALL');
    setHideZeroBalances(false);
    setBalanzaSearch('');
  };

  const targetPeriodo = periodo ?? company.currentPeriod ?? 1;
  const exportOpts = { levelScope, omitZeroAccounts: hideZeroBalances };

  const handleExportCsv = () => {
    toast.success(exportBalanzaCsvOnly({ company, ejercicio, periodo: targetPeriodo, trialBalance, balanzaOptions: exportOpts }));
  };

  const handleExportXlsx = () => {
    void exportBalanzaXlsx({
      company,
      ejercicio,
      periodo: targetPeriodo,
      mesNombre,
      trialBalance,
      options: exportOpts
    }).then((count) => toast.success(`Balanza exportada a Excel (${count} cuentas)`));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      <BalanzaToolbar
        isTrialBalanced={isTrialBalanced}
        trialDiff={trialDiff}
        balanzaSearch={balanzaSearch}
        onSearchChange={setBalanzaSearch}
        levelScope={levelScope}
        onLevelScopeChange={setLevelScope}
        hideZeroBalances={hideZeroBalances}
        onToggleHideZero={setHideZeroBalances}
        onClearFilters={handleClearFilters}
        zeroCount={zeroCount}
        filteredCount={rows.length}
        totalCount={trialBalance.length}
        cancelledCount={cancelledCfdisWithPoliza.length}
        onExportCsv={handleExportCsv}
        onExportXlsx={handleExportXlsx}
      />

      {cancelledCfdisWithPoliza.length > 0 && (
        <div className="mx-4 my-3">
          <AlertBanner
            tone="danger"
            title={`${cancelledCfdisWithPoliza.length} CFDI(s) cancelado(s) ante el SAT siguen vinculados a póliza viva`}
          >
            <ul className="list-disc pl-4 text-[11px] space-y-0.5 font-mono">
              {cancelledCfdisWithPoliza.slice(0, 8).map((c) => (
                <li key={c.uuid}>
                  {c.uuid} • {c.polizaFolio ?? c.polizaId} ({c.direction}) • {formatCurrency(c.total)}
                </li>
              ))}
            </ul>
          </AlertBanner>
        </div>
      )}

      <div
        ref={parentRef}
        tabIndex={0}
        role="region"
        aria-label="Tabla de Balanza de Comprobación"
        className="overflow-auto max-h-[min(480px,55dvh)] rounded-xl border border-slate-200 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
      >
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
                      aria-sort={
                        isSortable
                          ? sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
                          : undefined
                      }
                      className="py-3 px-4 whitespace-nowrap"
                    >
                      {isSortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="w-full flex items-center gap-1.5 uppercase tracking-wider font-bold text-left hover:text-blue-800 transition cursor-pointer"
                        >
                          <span className="flex-1">
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          <span className="text-slate-600 shrink-0" aria-hidden="true">
                            {sorted === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                            ) : sorted === 'desc' ? (
                              <ArrowDown className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-500" aria-hidden="true" />
                            )}
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span>
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={table.getAllLeafColumns().length} className="py-6 px-4">
                  <EmptyState
                    icon={<Search className="w-5 h-5" aria-hidden="true" />}
                    tone="slate"
                    title="Sin cuentas en la balanza"
                    description="No se encontraron cuentas con los filtros actuales."
                    actions={<ClearFiltersButton onClick={handleClearFilters} />}
                  />
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr aria-hidden="true" data-spacer="true">
                    <td data-spacer="true" colSpan={table.getAllLeafColumns().length} style={{ height: `${paddingTop}px` }} />
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
                      className={lvl === 1 ? 'bg-slate-100' : lvl === 2 ? 'bg-slate-50/70' : 'hover:bg-blue-50/30'}
                    >
                      {row.getAllCells().map((cell) => (
                        <td key={cell.id} className="py-2.5 px-4 whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr aria-hidden="true" data-spacer="true">
                    <td data-spacer="true" colSpan={table.getAllLeafColumns().length} style={{ height: `${paddingBottom}px` }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
          <BalanzaTotalsFooter
            balanzaSearch={balanzaSearch}
            levelScope={levelScope}
            onlyAffectable={levelScope !== 'ALL'}
            hideZeroBalances={hideZeroBalances}
            affectableFilteredCount={rootRowsCount}
            filteredBalanzaTotals={filteredBalanzaTotals}
          />
        </table>
      </div>
    </div>
  );
}
