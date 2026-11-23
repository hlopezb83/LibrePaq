import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';

export interface PolizasTotalsBarProps {
  totalCount: number;
  filteredCount: number;
  totals: { cargos: number; abonos: number };
}

export function PolizasTotalsBar({
  totalCount,
  filteredCount,
  totals
}: PolizasTotalsBarProps) {
  const diffCents = Math.abs(
    Math.round(totals.cargos * 100) - Math.round(totals.abonos * 100)
  );
  const isBalanced = diffCents === 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pt-2.5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
    >
      {/* Conteo de pólizas e indicador de Partida Doble */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-slate-600">
          Mostrando <strong>{filteredCount}</strong> {filteredCount === 1 ? 'póliza' : 'pólizas'} en vista actual
          {filteredCount !== totalCount && (
            <span className="text-slate-600 font-normal"> (de {totalCount} en el periodo)</span>
          )}
        </span>

        {isBalanced ? (
          <span
            title="Principio de Partida Doble verificado: Cargos y Abonos coinciden exactamente al centavo"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span>Sumas Iguales Cuadradas</span>
          </span>
        ) : (
          <span
            title="Alerta Contable: Existe una discrepancia entre el Debe y el Haber del periodo"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
            <span>Descuadre: Diferencia de {formatCurrency(diffCents / 100)}</span>
          </span>
        )}
      </div>

      {/* Sumatorias Monetarias en Formato Contable (Tabular) */}
      <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Total Cargos (Debe):</span>
          <strong className="text-slate-900 font-bold">
            {formatCurrency(totals.cargos)}
          </strong>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Total Abonos (Haber):</span>
          <strong className="text-slate-900 font-bold">
            {formatCurrency(totals.abonos)}
          </strong>
        </div>
      </div>
    </div>
  );
}
