import { AlertTriangle, CheckCircle2, Search } from 'lucide-react';
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
  zeroCount: number;
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
  zeroCount
}: BalanzaToolbarProps) {
  return (
    <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
      <div className="flex flex-wrap items-center gap-3">
        {isTrialBalanced ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            Sumas Iguales Verificadas ✔
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
            Diferencia en Balanza: {formatCurrency(trialDiff)}
          </span>
        )}
        <div className="relative w-56 sm:w-64 no-print">
          <Search
            className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={balanzaSearch}
            onChange={(e) => onSearchChange(e.target.value)}
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
          {LEVEL_OPTIONS.map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              aria-pressed={levelScope === lvl.id}
              onClick={() => onLevelScopeChange(lvl.id)}
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

        <label
          htmlFor="balanza-hide-zero"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer"
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
