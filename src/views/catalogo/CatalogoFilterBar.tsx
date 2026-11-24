import { AlertTriangle, Filter, ShieldCheck } from 'lucide-react';
import { ClearFiltersButton, SearchInput, TabBar } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';

export type QuickFilterType =
  | 'ALL'
  | 'AFFECTABLE'
  | 'ACTIVE_BALANCE'
  | 'WITH_MOVEMENTS'
  | 'RED_BALANCES';

export interface CatalogoFilterBarProps {
  globalFilter: string;
  setGlobalFilter: (q: string) => void;
  expandAllNodes: () => void;
  collapseToMayor: () => void;
  levelFilter: 'ALL' | 'AFFECTABLE' | 'MAYOR';
  setLevelFilter: (lv: 'ALL' | 'AFFECTABLE' | 'MAYOR') => void;
  filteredCount: number;
  totalCount: number;
  selectedType: string;
  setSelectedType: (type: string) => void;
  typeFilters: Array<{ id: string; label: string }>;
  quickFilter: QuickFilterType;
  setQuickFilter: (qf: QuickFilterType) => void;
  quickFilterCounts: {
    ALL: number;
    AFFECTABLE: number;
    ACTIVE_BALANCE: number;
    WITH_MOVEMENTS: number;
    RED_BALANCES: number;
  };
  filteredSummaryTotals: {
    countAffectable: number;
    cargos: number;
    abonos: number;
  };
  onResetFilters?: () => void;
}

export function CatalogoFilterBar({
  globalFilter,
  setGlobalFilter,
  expandAllNodes,
  collapseToMayor,
  levelFilter,
  setLevelFilter,
  filteredCount,
  totalCount,
  selectedType,
  setSelectedType,
  typeFilters,
  quickFilter,
  setQuickFilter,
  quickFilterCounts,
  filteredSummaryTotals,
  onResetFilters
}: CatalogoFilterBarProps) {
  const hasActiveFilters =
    Boolean(globalFilter.trim()) ||
    selectedType !== 'ALL' ||
    quickFilter !== 'ALL' ||
    levelFilter !== 'ALL';
  const hasFlatFilterActive =
    Boolean(globalFilter.trim()) || quickFilter !== 'ALL' || levelFilter !== 'ALL';
  const quickFilterPills = [
    { id: 'ALL' as QuickFilterType, label: 'Todas', count: quickFilterCounts.ALL },
    { id: 'AFFECTABLE' as QuickFilterType, label: 'Solo Afectables', count: quickFilterCounts.AFFECTABLE },
    { id: 'ACTIVE_BALANCE' as QuickFilterType, label: 'Con Saldo Activo', count: quickFilterCounts.ACTIVE_BALANCE },
    {
      id: 'WITH_MOVEMENTS' as QuickFilterType,
      label: 'Con Movimientos del Periodo',
      count: quickFilterCounts.WITH_MOVEMENTS
    },
    {
      id: 'RED_BALANCES' as QuickFilterType,
      label: 'Saldos Rojos / Invertidos',
      count: quickFilterCounts.RED_BALANCES
    }
  ];

  return (
    <div className="bg-white p-3.5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-2.5 no-print">
      <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-2.5">
        <div className="flex-1 min-w-0 max-w-2xl">
          <label htmlFor="search-accounts" className="visually-hidden">
            Buscar cuenta por código, nombre o código agrupador SAT
          </label>
          <SearchInput
            id="search-accounts"
            value={globalFilter}
            onChange={setGlobalFilter}
            clearLabel="Limpiar búsqueda de cuentas"
            hintKey="F3"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Buscar por código (102-01), nombre o código SAT (Atajo: F3)..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Expandir o contraer árbol de cuentas"
            className="inline-flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs"
          >
            <button
              type="button"
              disabled={hasFlatFilterActive}
              onClick={expandAllNodes}
              title={
                hasFlatFilterActive
                  ? 'Disponible en vista de árbol sin filtros planos activos'
                  : 'Desplegar todas las subcuentas del catálogo contable (niveles 1 a 4)'
              }
              aria-label="Desplegar todas las subcuentas del catálogo contable"
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-white transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              Expandir Todo
            </button>
            <button
              type="button"
              disabled={hasFlatFilterActive}
              onClick={collapseToMayor}
              title={
                hasFlatFilterActive
                  ? 'Disponible en vista de árbol sin filtros planos activos'
                  : 'Contraer árbol contable a cuentas de Mayor (niveles 1 y 2)'
              }
              aria-label="Contraer árbol a cuentas de Mayor"
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-white transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              Contraer a Mayor
            </button>
          </div>

          <div
            className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs"
            role="group"
            aria-label="Nivel de visualización del catálogo"
          >
            {[
              { id: 'ALL' as const, label: 'Árbol' },
              { id: 'MAYOR' as const, label: 'Mayor (N1-N2)' }
            ].map((lv) => (
              <button
                key={lv.id}
                type="button"
                aria-pressed={levelFilter === lv.id}
                onClick={() => setLevelFilter(lv.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                  levelFilter === lv.id
                    ? 'bg-white text-blue-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lv.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
            <span className="font-mono tabular-nums text-[11px]">
              <strong>{filteredCount}</strong>/{totalCount}
            </span>
          </div>
        </div>
      </div>

      <TabBar
        mode="group"
        tabs={typeFilters}
        activeId={selectedType}
        onSelect={setSelectedType}
        idPrefix="catalogo-type-tab-"
        ariaLabel="Filtrar por rubro contable oficial SAT"
      />

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-0.5 flex items-center gap-1.5 shrink-0">
          <Filter className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          Filtros Rápidos:
        </span>
        {quickFilterPills.map((pill) => {
          const isActive = quickFilter === pill.id;
          const isRedPill = pill.id === 'RED_BALANCES';
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => setQuickFilter(pill.id)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer border ${
                isActive
                  ? isRedPill
                    ? 'bg-red-700 text-white border-red-700 shadow-2xs'
                    : 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                  : isRedPill && pill.count > 0
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/80'
              }`}
            >
              {isRedPill && pill.count > 0 && (
                <AlertTriangle
                  className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-amber-600'}`}
                  aria-hidden="true"
                />
              )}
              <span>{pill.label}</span>
              <span
                className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full font-mono tabular-nums text-[10px] font-bold ${
                  isActive
                    ? isRedPill
                      ? 'bg-red-800 text-red-100'
                      : 'bg-blue-800 text-blue-100'
                    : isRedPill && pill.count > 0
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {pill.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span role="status" aria-live="polite" className="text-slate-600 font-mono tabular-nums text-[11px]">
            Mostrando <strong>{filteredCount}</strong> cuentas en pantalla (
            <strong>{filteredSummaryTotals.countAffectable}</strong> cuentas afectables)
          </span>
          {hasActiveFilters && onResetFilters && (
            <ClearFiltersButton onClick={onResetFilters} />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono tabular-nums text-[11px]">
          <span className="text-slate-600">
            Cargos del Periodo: <strong className="text-slate-900">{formatCurrency(filteredSummaryTotals.cargos)}</strong>
          </span>
          <span className="text-slate-600">
            Abonos del Periodo: <strong className="text-slate-900">{formatCurrency(filteredSummaryTotals.abonos)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
