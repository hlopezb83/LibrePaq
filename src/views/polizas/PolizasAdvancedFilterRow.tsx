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

  const minNum = minAmount.trim() !== '' ? Number(minAmount) : null;
  const maxNum = maxAmount.trim() !== '' ? Number(maxAmount) : null;
  const isAmountRangeInvalid =
    minNum !== null &&
    maxNum !== null &&
    Number.isFinite(minNum) &&
    Number.isFinite(maxNum) &&
    minNum > maxNum;

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
            <div className="inline-flex flex-wrap items-center gap-1 ml-1">
              <label htmlFor="polizas-period-from" className="visually-hidden">
                Periodo inicial
              </label>
              <select
                id="polizas-period-from"
                aria-label="Periodo inicial"
                value={periodFrom}
                onChange={(e) => {
                  const nextFrom = Number(e.target.value);
                  setPeriodFrom(nextFrom);
                  if (nextFrom > periodTo) setPeriodTo(nextFrom);
                }}
                className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-mono text-slate-800"
              >
                {MESES_SAT.map((m) => (
                  <option key={m.periodo} value={m.periodo}>
                    P{String(m.periodo).padStart(2, '0')} {m.nombre.slice(0, 3)}
                  </option>
                ))}
              </select>
              <span className="text-slate-500">a</span>
              <label htmlFor="polizas-period-to" className="visually-hidden">
                Periodo final
              </label>
              <select
                id="polizas-period-to"
                aria-label="Periodo final"
                value={periodTo}
                onChange={(e) => {
                  const nextTo = Number(e.target.value);
                  setPeriodTo(nextTo);
                  if (nextTo < periodFrom) setPeriodFrom(nextTo);
                }}
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
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filtro por rango de montos"
        >
          <span className="text-[11px] font-bold text-slate-600">Monto ($):</span>
          {setMinAmount && (
            <>
              <label htmlFor="polizas-min-amount" className="visually-hidden">
                Monto mínimo en pesos
              </label>
              <input
                id="polizas-min-amount"
                aria-label="Monto mínimo"
                aria-invalid={isAmountRangeInvalid}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="Mínimo"
                className={`w-24 px-2 py-1 rounded-lg border bg-white text-[11px] font-mono tabular-nums text-slate-800 placeholder:text-slate-500 ${
                  isAmountRangeInvalid ? 'border-red-500 ring-1 ring-red-500/30' : 'border-slate-300'
                }`}
              />
            </>
          )}
          <span className="text-slate-400">–</span>
          {setMaxAmount && (
            <>
              <label htmlFor="polizas-max-amount" className="visually-hidden">
                Monto máximo en pesos
              </label>
              <input
                id="polizas-max-amount"
                aria-label="Monto máximo"
                aria-invalid={isAmountRangeInvalid}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="Máximo"
                className={`w-24 px-2 py-1 rounded-lg border bg-white text-[11px] font-mono tabular-nums text-slate-800 placeholder:text-slate-500 ${
                  isAmountRangeInvalid ? 'border-red-500 ring-1 ring-red-500/30' : 'border-slate-300'
                }`}
              />
            </>
          )}
          {isAmountRangeInvalid && (
            <span role="alert" className="text-[11px] font-semibold text-red-700">
              El monto mínimo no puede ser mayor al máximo.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
