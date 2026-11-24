import { MESES_SAT } from '../../shared/sat-constants';
import type { PolizaPeriodScope } from './filterPolizas';

interface PolizasAdvancedFilterRowProps {
  currentPeriod?: number;
  periodScope: PolizaPeriodScope;
  setPeriodScope?: (s: PolizaPeriodScope) => void;
  periodFrom: number;
  setPeriodFrom?: (p: number) => void;
  periodTo: number;
  setPeriodTo?: (p: number) => void;
  minAmount: string;
  setMinAmount?: (v: string) => void;
  maxAmount: string;
  setMaxAmount?: (v: string) => void;
}

export function PolizasAdvancedFilterRow({
  currentPeriod,
  periodScope,
  setPeriodScope,
  periodFrom,
  setPeriodFrom,
  periodTo,
  setPeriodTo,
  minAmount,
  setMinAmount,
  maxAmount,
  setMaxAmount
}: PolizasAdvancedFilterRowProps) {
  if (!setPeriodScope && !setMinAmount && !setMaxAmount) return null;

  return (
    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
      {setPeriodScope && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Rango de periodos">
          <span className="text-[11px] font-bold text-slate-600">Periodo:</span>
          {[
            { id: 'CURRENT' as const, label: `Mes Actual (P${String(currentPeriod ?? 1).padStart(2, '0')})` },
            { id: 'YTD' as const, label: `Ene–P${String(currentPeriod ?? 12).padStart(2, '0')}` },
            { id: 'RANGE' as const, label: 'Rango' }
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={periodScope === opt.id}
              onClick={() => setPeriodScope(opt.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                periodScope === opt.id
                  ? 'bg-indigo-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {periodScope === 'RANGE' && setPeriodFrom && setPeriodTo && (
            <div className="inline-flex items-center gap-1 ml-1">
              <select
                aria-label="Periodo inicial"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(Number(e.target.value))}
                className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-mono text-slate-800"
              >
                {MESES_SAT.map((m) => (
                  <option key={m.periodo} value={m.periodo}>
                    P{String(m.periodo).padStart(2, '0')} {m.nombre.slice(0, 3)}
                  </option>
                ))}
              </select>
              <span className="text-slate-500">a</span>
              <select
                aria-label="Periodo final"
                value={periodTo}
                onChange={(e) => setPeriodTo(Number(e.target.value))}
                className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-mono text-slate-800"
              >
                {MESES_SAT.map((m) => (
                  <option key={m.periodo} value={m.periodo}>
                    P{String(m.periodo).padStart(2, '0')} {m.nombre.slice(0, 3)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {(setMinAmount || setMaxAmount) && (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-600">Monto ($):</span>
          {setMinAmount && (
            <input
              aria-label="Monto mínimo"
              type="number"
              min="0"
              step="0.01"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="Mínimo"
              className="w-24 px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-mono text-slate-800 placeholder:text-slate-400"
            />
          )}
          <span className="text-slate-400">–</span>
          {setMaxAmount && (
            <input
              aria-label="Monto máximo"
              type="number"
              min="0"
              step="0.01"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              placeholder="Máximo"
              className="w-24 px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-mono text-slate-800 placeholder:text-slate-400"
            />
          )}
        </div>
      )}
    </div>
  );
}
