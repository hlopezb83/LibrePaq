import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ClearFiltersButton, SearchInput, StatusBadge } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';

export type BalanzaLevelScope = 'ALL' | 'MAYOR' | 'SUBCUENTAS' | 'AFECTABLES';

interface BalanzaToolbarProps {
  isTrialBalanced: boolean;
  trialDiff: number;
  balanzaSearch: string;
  onSearchChange: (value: string) => void;
  levelScope: BalanzaLevelScope;
  onLevelScopeChange: (scope: BalanzaLevelScope) => void;
  hideZeroBalances: boolean;
  onToggleHideZero: (hide: boolean) => void;
  onClearFilters: () => void;
  zeroCount: number;
  filteredCount: number;
  totalCount: number;
}

const LEVEL_OPTIONS: ReadonlyArray<{ id: BalanzaLevelScope; label: string }> = [
  { id: 'ALL', label: 'Todas' },
  { id: 'MAYOR', label: 'Solo Mayor (N1)' },
  { id: 'SUBCUENTAS', label: 'Hasta N2' },
  { id: 'AFECTABLES', label: 'Afectables (N3)' }
];

export function BalanzaToolbar({
  isTrialBalanced,
  trialDiff,
  balanzaSearch,
  onSearchChange,
  levelScope,
  onLevelScopeChange,
  hideZeroBalances,
  onToggleHideZero,
  onClearFilters,
  zeroCount,
  filteredCount,
  totalCount
}: BalanzaToolbarProps) {
  const activeFilterCount =
    (balanzaSearch.trim() ? 1 : 0) + (levelScope !== 'ALL' ? 1 : 0) + (hideZeroBalances ? 1 : 0);

  return (
    <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
        {isTrialBalanced ? (
          <StatusBadge tone="emerald" icon={<CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}>
            Sumas Iguales Verificadas ✔
          </StatusBadge>
        ) : (
          <StatusBadge tone="amber" icon={<AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />}>
            Diferencia en Balanza: {formatCurrency(trialDiff)}
          </StatusBadge>
        )}
        <SearchInput
          id="balanza-search-input"
          size="sm"
          value={balanzaSearch}
          onChange={onSearchChange}
          placeholder="Buscar cuenta o agrupador SAT..."
          aria-label="Buscar cuenta o agrupador SAT en la balanza"
          clearLabel="Limpiar búsqueda en balanza"
          containerClassName="w-full sm:w-64 no-print"
        />
        <span aria-live="polite" className="text-[11px] font-mono text-slate-600 no-print whitespace-nowrap">
          Mostrando {filteredCount} de {totalCount} cuentas
        </span>
        {activeFilterCount > 0 && (
          <ClearFiltersButton
            onClick={onClearFilters}
            count={activeFilterCount}
            className="no-print"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 no-print max-w-full">
        <div
          className="inline-flex items-center rounded-xl bg-slate-200/70 p-0.5 border border-slate-300 text-xs shadow-2xs erp-tab-scroller max-w-full"
          role="group"
          aria-label="Filtrar por nivel contable"
        >
          {LEVEL_OPTIONS.map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              aria-pressed={levelScope === lvl.id}
              onClick={() => onLevelScopeChange(lvl.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition cursor-pointer ${
                levelScope === lvl.id
                  ? 'bg-white text-blue-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lvl.label}
            </button>
          ))}
        </div>

        <label
          htmlFor="balanza-hide-zero"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
        >
          <input
            id="balanza-hide-zero"
            type="checkbox"
            checked={hideZeroBalances}
            onChange={(e) => onToggleHideZero(e.target.checked)}
            className="rounded text-blue-700"
          />
          <span>Ocultar saldo $0.00 {zeroCount > 0 && `(${zeroCount})`}</span>
        </label>
      </div>
    </div>
  );
}
