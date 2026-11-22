import { useMemo } from 'react';
import { Calendar, CalendarDays, CalendarRange, Sparkles } from 'lucide-react';
import { getFirstDateForPeriod, getLastDateForPeriod } from '../../../lib/formatters';
import { MESES_SAT } from '../../../shared/sat-catalog';

export interface SatDatePresetBarProps {
  currentYear: number;
  currentPeriod: number;
  fechaInicial: string;
  fechaFinal: string;
  onSelectRange: (ini: string, fin: string) => void;
}

export function SatDatePresetBar({
  currentYear,
  currentPeriod,
  fechaInicial,
  fechaFinal,
  onSelectRange
}: SatDatePresetBarProps) {
  const presets = useMemo(() => {
    const safeYear = currentYear >= 2000 && currentYear <= 2100 ? currentYear : 2026;
    const safePeriod = currentPeriod >= 1 && currentPeriod <= 12 ? currentPeriod : 8;
    const todayStr = new Date().toISOString().slice(0, 10);
    const clampToToday = (dateStr: string) => (dateStr > todayStr ? todayStr : dateStr);

    // 1. Mes Actual (con límite a la fecha de hoy para evitar error 301 del SAT)
    const rawMesActualIni = getFirstDateForPeriod(safeYear, safePeriod);
    const mesActualIni = rawMesActualIni > todayStr ? todayStr : rawMesActualIni;
    const mesActualFin = clampToToday(getLastDateForPeriod(safeYear, safePeriod));
    const mesActualNombre = MESES_SAT[safePeriod - 1]?.nombre || `P${String(safePeriod).padStart(2, '0')}`;

    // 2. Mes Anterior
    const prevPeriod = safePeriod > 1 ? safePeriod - 1 : 12;
    const prevYear = safePeriod > 1 ? safeYear : safeYear - 1;
    const mesAnteriorIni = getFirstDateForPeriod(prevYear, prevPeriod);
    const mesAnteriorFin = clampToToday(getLastDateForPeriod(prevYear, prevPeriod));
    const mesAnteriorNombre = MESES_SAT[prevPeriod - 1]?.nombre || `P${String(prevPeriod).padStart(2, '0')}`;

    // 3. Bimestre Actual (RESICO / P. Físicas)
    const bimonthStart = Math.floor((safePeriod - 1) / 2) * 2 + 1;
    const bimonthEnd = bimonthStart + 1;
    const bimestreIni = getFirstDateForPeriod(safeYear, bimonthStart);
    const bimestreFin = clampToToday(getLastDateForPeriod(safeYear, bimonthEnd));

    // 4. Todo el Ejercicio Fiscal (hasta hoy si es el año en curso)
    const ejercicioIni = `${safeYear}-01-01`;
    const ejercicioFin = clampToToday(`${safeYear}-12-31`);

    return [
      {
        id: 'mes-actual',
        label: `Mes Actual (${mesActualNombre})`,
        icon: Sparkles,
        ini: mesActualIni,
        fin: mesActualFin
      },
      {
        id: 'mes-anterior',
        label: `Mes Anterior (${mesAnteriorNombre})`,
        icon: Calendar,
        ini: mesAnteriorIni,
        fin: mesAnteriorFin
      },
      {
        id: 'bimestre',
        label: `Bimestre (${safePeriod % 2 === 0 ? 'Cierre Bimestral' : 'Bimestre Actual'})`,
        icon: CalendarDays,
        ini: bimestreIni,
        fin: bimestreFin
      },
      {
        id: 'ejercicio',
        label: `Todo el ${safeYear}`,
        icon: CalendarRange,
        ini: ejercicioIni,
        fin: ejercicioFin
      }
    ];
  }, [currentYear, currentPeriod]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-slate-700 font-semibold">
        <span>Atajos Fiscales Rápidos:</span>
        <span className="text-[11px] text-slate-500 font-normal hidden sm:inline">
          Selecciona un periodo contable en 1 clic
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((p) => {
          const isActive = fechaInicial === p.ini && fechaFinal === p.fin;
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectRange(p.ini, p.fin)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs border border-blue-600 ring-2 ring-blue-500/20'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-blue-600'}`} aria-hidden="true" />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
