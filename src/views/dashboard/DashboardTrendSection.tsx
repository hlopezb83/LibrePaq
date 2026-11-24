import { BarChart3 } from 'lucide-react';
import { EmptyState } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';
import type { DashboardSummary } from '../../shared/types';

export interface DashboardTrendSectionProps {
  companyYear: number;
  currentPeriod: number;
  monthlyTrend: DashboardSummary['monthlyTrend'];
  maxBar: number;
  onUpdatePeriod: (year: number, period: number) => void;
}

export function DashboardTrendSection({
  companyYear,
  currentPeriod,
  monthlyTrend,
  maxBar,
  onUpdatePeriod
}: DashboardTrendSectionProps) {
  const hasTrendData = monthlyTrend.some((m) => m.ingresos > 0 || m.egresos > 0);
  const midBar = Math.round(maxBar / 2);
  const activeItem = monthlyTrend.find((m) => m.periodo === currentPeriod) ?? monthlyTrend[0];
  const activeNeto = activeItem ? activeItem.ingresos - activeItem.egresos : 0;

  return (
    <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5 flex flex-col justify-between min-w-0">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Evolución Ingresos vs Egresos
            </h2>
            <p className="text-xs text-slate-600">
              Haz clic en cualquier mes para cambiar de periodo ({companyYear})
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5 text-slate-800">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-700 inline-block" aria-hidden="true" />
              Ingresos
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-500 inline-block" aria-hidden="true" />
              Egresos
            </span>
          </div>
        </div>

        {!hasTrendData ? (
          <EmptyState
            variant="dashed"
            tone="slate"
            icon={<BarChart3 className="w-5 h-5" aria-hidden="true" />}
            title={`Sin movimientos registrados en ${companyYear}`}
            description="Contabiliza tus CFDIs o captura pólizas para visualizar el comparativo mensual de ingresos y egresos."
          />
        ) : (
          <div className="space-y-2.5">
            <div className="w-full max-w-full overflow-x-clip">
              <div className="relative h-60 w-full flex items-end justify-between gap-0.5 sm:gap-1 pt-20 pb-2 pl-16 pr-1 border-b border-slate-200">
                {/* Líneas horizontales de referencia y escala Y */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-20 bottom-7 flex flex-col justify-between"
                >
                  {[maxBar, midBar, 0].map((val, i) => (
                    <div key={i} className="relative w-full">
                      <span className="absolute -top-2 left-0 w-14 text-right text-[10px] font-mono tabular-nums text-slate-600 truncate">
                        {formatCurrency(val)}
                      </span>
                      <div className="ml-16 border-b border-dashed border-slate-200" />
                    </div>
                  ))}
                </div>

                {monthlyTrend.map((item, idx) => {
                  const ingHeight =
                    item.ingresos > 0 ? Math.max(6, Math.round((item.ingresos / maxBar) * 124)) : 2;
                  const egrHeight =
                    item.egresos > 0 ? Math.max(6, Math.round((item.egresos / maxBar) * 124)) : 2;
                  const isCurrent = item.periodo === currentPeriod;
                  const utilMes = item.ingresos - item.egresos;
                  const tooltipPos =
                    idx <= 1
                      ? 'left-0'
                      : idx >= monthlyTrend.length - 2
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
                      className={`relative z-10 flex-1 min-w-0 flex flex-col items-center gap-1.5 py-1 rounded-lg group cursor-pointer transition ${
                        isCurrent
                          ? 'bg-blue-50/80 ring-1 ring-blue-300'
                          : 'hover:bg-slate-100/70'
                      }`}
                    >
                      {/* Tooltip flotante en Hover o Foco */}
                      <div
                        aria-hidden="true"
                        className={`pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity absolute bottom-full mb-1.5 ${tooltipPos} z-20 bg-white text-slate-900 text-[10px] font-mono tabular-nums rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap border border-slate-300`}
                      >
                        <div className="text-blue-700 font-semibold">
                          Ing: {formatCurrency(item.ingresos)}
                        </div>
                        <div className="text-slate-600">Egr: {formatCurrency(item.egresos)}</div>
                        <div
                          className={`border-t border-slate-200 pt-0.5 mt-0.5 font-bold ${
                            utilMes >= 0 ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          Neto: {formatCurrency(utilMes)}
                        </div>
                      </div>

                      <div
                        className="w-full flex items-end justify-center gap-0.5 h-32"
                        aria-hidden="true"
                      >
                        <div
                          style={{ height: `${ingHeight}px` }}
                          className={`w-1.5 sm:w-2.5 rounded-t-xs transition-all ${
                            isCurrent
                              ? 'bg-blue-700'
                              : 'bg-blue-600/80 group-hover:bg-blue-700'
                          }`}
                        />
                        <div
                          style={{ height: `${egrHeight}px` }}
                          className={`w-1.5 sm:w-2.5 rounded-t-xs transition-all ${
                            isCurrent
                              ? 'bg-slate-700'
                              : 'bg-slate-500 group-hover:bg-slate-700'
                          }`}
                        />
                      </div>
                      <span
                        className={`text-[9px] sm:text-[10px] font-mono whitespace-nowrap ${
                          isCurrent ? 'font-bold text-blue-800' : 'text-slate-600'
                        }`}
                      >
                        {item.mesNombre.slice(0, 3)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeItem && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-slate-800">
                  Periodo activo: {activeItem.mesNombre} {companyYear}
                </span>
                <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
                  <span className="text-blue-800">
                    Ing: <strong>{formatCurrency(activeItem.ingresos)}</strong>
                  </span>
                  <span className="text-slate-700">
                    Egr: <strong>{formatCurrency(activeItem.egresos)}</strong>
                  </span>
                  <span
                    className={
                      activeNeto >= 0 ? 'text-emerald-800 font-bold' : 'text-red-700 font-bold'
                    }
                  >
                    Neto: {formatCurrency(activeNeto)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

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
    </section>
  );
}
