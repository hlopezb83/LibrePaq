import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { MESES_SAT } from '../../shared/sat-constants';

interface AppShellTopHeaderPeriodProps {
  currentPeriod: number;
  currentYear: number;
  stepPeriod: (delta: number) => void;
  updatePeriod: (year: number, period: number) => void;
}

export function AppShellTopHeaderPeriod({
  currentPeriod,
  currentYear,
  stepPeriod,
  updatePeriod
}: AppShellTopHeaderPeriodProps) {
  const years = Array.from(new Set([2022, 2023, 2024, 2025, 2026, 2027, currentYear])).sort((a, b) => a - b);

  return (
    <div className="flex items-center gap-0.5 bg-slate-50 border border-slate-300/90 rounded-xl px-1 py-0.5 min-w-0 shrink">
      <button
        type="button"
        onClick={() => stepPeriod(-1)}
        disabled={currentPeriod <= 1}
        title={currentPeriod <= 1 ? 'Ya estás en el primer periodo del ejercicio (Enero)' : 'Periodo anterior'}
        aria-label="Cambiar al periodo contable anterior"
        className="min-h-[28px] min-w-[28px] inline-flex items-center justify-center p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
      >
        <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      <Calendar className="w-3 h-3 text-blue-700 shrink-0 hidden @[380px]:block mx-0.5" aria-hidden="true" />

      <div className="flex items-center gap-0.5 min-w-0">
        <label htmlFor="period-selector" className="visually-hidden">
          Periodo Contable
        </label>
        <select
          id="period-selector"
          name="currentPeriod"
          value={currentPeriod}
          onChange={(e) => updatePeriod(currentYear, Number(e.target.value))}
          className="text-[11px] sm:text-xs font-bold text-slate-800 bg-transparent cursor-pointer w-[94px] @[420px]:w-[112px] @[760px]:w-[126px] truncate"
        >
          {MESES_SAT.map((m) => (
            <option key={m.periodo} value={m.periodo}>
              P{String(m.periodo).padStart(2, '0')} - {m.periodo === 13 ? 'Cierre Anual' : m.nombre}
            </option>
          ))}
        </select>
        <span className="text-slate-300 text-xs">/</span>
        <label htmlFor="year-selector" className="visually-hidden">
          Ejercicio Fiscal
        </label>
        <select
          id="year-selector"
          name="currentYear"
          value={currentYear}
          onChange={(e) => updatePeriod(Number(e.target.value), currentPeriod)}
          className="text-[11px] sm:text-xs font-bold font-mono text-blue-800 bg-transparent cursor-pointer shrink-0"
        >
          {years.map((yr) => (
            <option key={yr} value={yr}>
              {yr}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => stepPeriod(1)}
        disabled={currentPeriod >= 13}
        title={currentPeriod >= 13 ? 'Ya estás en el último periodo (Cierre Anual P13)' : 'Periodo siguiente'}
        aria-label="Cambiar al periodo contable siguiente"
        className="min-h-[28px] min-w-[28px] inline-flex items-center justify-center p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
      >
        <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
