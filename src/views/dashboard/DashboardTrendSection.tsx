import { BookOpen, Scale, Wallet } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { DashboardSummary } from '../../shared/types';

export interface DashboardTrendSectionProps {
  companyYear: number;
  currentPeriod: number;
  monthlyTrend: DashboardSummary['monthlyTrend'];
  maxBar: number;
  onUpdatePeriod: (year: number, period: number) => void;
  cuentasPorCobrar: number;
  cuentasPorPagar: number;
  onOpenLedger: (id: string) => void;
  activeCompanyId: string;
}

export function DashboardTrendSection({
  companyYear,
  currentPeriod,
  monthlyTrend,
  maxBar,
  onUpdatePeriod,
  cuentasPorCobrar,
  cuentasPorPagar,
  onOpenLedger,
  activeCompanyId
}: DashboardTrendSectionProps) {
  return (
    <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5 flex flex-col justify-between min-w-0">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Evolución Ingresos vs Egresos
            </h2>
            <p className="text-xs text-slate-500">
              Haz clic en cualquier mes para cambiar de periodo ({companyYear})
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5 text-slate-800">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-700 inline-block" />
              Ingresos
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 inline-block" />
              Egresos
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className={`relative h-48 flex items-end justify-between gap-1 sm:gap-2 pt-8 pb-2 px-1 sm:px-2 border-b border-slate-200 ${monthlyTrend.length > 6 ? 'min-w-[340px]' : ''}`}>
          {/* Líneas horizontales de referencia */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-1 sm:inset-x-2 top-8 bottom-7 flex flex-col justify-between"
          >
            <div className="border-b border-dashed border-slate-200 w-full" />
            <div className="border-b border-dashed border-slate-200 w-full" />
            <div className="border-b border-dashed border-slate-200 w-full" />
          </div>

          {monthlyTrend.map((item, idx) => {
            const ingHeight = Math.max(8, Math.round((item.ingresos / maxBar) * 124));
            const egrHeight = Math.max(8, Math.round((item.egresos / maxBar) * 124));
            const isCurrent = item.periodo === currentPeriod;
            const utilMes = item.ingresos - item.egresos;
            const tooltipPos =
              idx === 0
                ? 'left-0'
                : idx === monthlyTrend.length - 1
                ? 'right-0'
                : 'left-1/2 -translate-x-1/2';
            return (
              <button
                key={item.periodo}
                type="button"
                aria-pressed={isCurrent}
                onClick={() => onUpdatePeriod(companyYear, item.periodo)}
                aria-label={`Cambiar a ${item.mesNombre}: Ingresos ${formatCurrency(
                  item.ingresos
                )}, Egresos ${formatCurrency(item.egresos)}`}
                className={`relative z-10 flex-1 min-w-0 flex flex-col items-center gap-1.5 py-1 rounded-xl group cursor-pointer transition ${
                  isCurrent
                    ? 'bg-blue-50/80 ring-1 ring-blue-300'
                    : 'hover:bg-slate-100/70'
                }`}
              >
                {/* Tooltip flotante en Hover o Foco */}
                <div className={`pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity absolute -top-14 ${tooltipPos} z-20 bg-[#0A1120] text-white text-[10px] font-mono rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap border border-slate-700`}>
                  <div className="text-blue-300">Ing: {formatCurrency(item.ingresos)}</div>
                  <div className="text-slate-300">Egr: {formatCurrency(item.egresos)}</div>
                  <div
                    className={`border-t border-slate-700 pt-0.5 mt-0.5 font-bold ${
                      utilMes >= 0 ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    Neto: {formatCurrency(utilMes)}
                  </div>
                </div>

                <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-32">
                  <div
                    style={{ height: `${ingHeight}px` }}
                    className={`w-2.5 sm:w-3.5 rounded-t-xs transition-all ${
                      isCurrent
                        ? 'bg-blue-700'
                        : 'bg-blue-600/75 group-hover:bg-blue-700'
                    }`}
                  />
                  <div
                    style={{ height: `${egrHeight}px` }}
                    className={`w-2.5 sm:w-3.5 rounded-t-xs transition-all ${
                      isCurrent
                        ? 'bg-slate-600'
                        : 'bg-slate-400 group-hover:bg-slate-600'
                    }`}
                  />
                </div>
                <span
                  className={`text-[10px] sm:text-[11px] font-mono truncate ${
                    isCurrent ? 'font-bold text-blue-800' : 'text-slate-600'
                  }`}
                >
                  {item.mesNombre}
                </span>
              </button>
            );
          })}
          </div>
        </div>

        <div className="visually-hidden">
          <table>
            <caption>Evolución mensual de ingresos y egresos {companyYear}</caption>
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col">Ingresos</th>
                <th scope="col">Egresos</th>
                <th scope="col">Resultado Neto</th>
              </tr>
            </thead>
            <tbody>
              {monthlyTrend.map((item) => (
                <tr key={item.periodo}>
                  <th scope="row">{item.mesNombre}</th>
                  <td>{formatCurrency(item.ingresos)}</td>
                  <td>{formatCurrency(item.egresos)}</td>
                  <td>{formatCurrency(item.ingresos - item.egresos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2.5 sm:gap-3 pt-4">
        <button
          type="button"
          onClick={() => onOpenLedger(`${activeCompanyId}_105-00-000`)}
          className="p-2.5 sm:p-3 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 text-left transition cursor-pointer min-w-0"
        >
          <div className="flex items-center justify-between gap-1 text-xs text-slate-600">
            <span className="flex items-center gap-1 font-semibold truncate">
              <Wallet className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />
              <span className="truncate">Clientes (CxC)</span>
            </span>
            <BookOpen className="w-3 h-3 text-blue-700 shrink-0" aria-hidden="true" />
          </div>
          <div className="mt-1 text-xs sm:text-sm font-bold font-mono text-slate-900 truncate">
            {formatCurrency(cuentasPorCobrar)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpenLedger(`${activeCompanyId}_201-00-000`)}
          className="p-2.5 sm:p-3 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 text-left transition cursor-pointer min-w-0"
        >
          <div className="flex items-center justify-between gap-1 text-xs text-slate-600">
            <span className="flex items-center gap-1 font-semibold truncate">
              <Scale className="w-3.5 h-3.5 text-slate-700 shrink-0" aria-hidden="true" />
              <span className="truncate">Proveedores (CxP)</span>
            </span>
            <BookOpen className="w-3 h-3 text-blue-700 shrink-0" aria-hidden="true" />
          </div>
          <div className="mt-1 text-xs sm:text-sm font-bold font-mono text-slate-900 truncate">
            {formatCurrency(cuentasPorPagar)}
          </div>
        </button>
      </div>
    </section>
  );
}
