import { Link } from '@tanstack/react-router';
import { AlertCircle, CheckCircle2, ClipboardCheck, Printer } from 'lucide-react';
import { parseNavTarget } from '../../components/shell/parseNavTarget';

export interface DashboardClosingCycleStep {
  id: string;
  stepNum: string;
  label: string;
  detail: string;
  done: boolean;
  to: string;
}

export interface DashboardClosingCycleProps {
  mesActualNombre: string;
  companyYear: number;
  closingChecks: DashboardClosingCycleStep[];
  completedChecks: number;
  onOpenDeliverables: () => void;
}

function renderDetailWithAmounts(detail: string) {
  const parts = detail.split(/(\$[\d,]+(?:\.\d{2})?)/g);
  return parts.map((part, idx) =>
    part.startsWith('$') ? (
      <span key={idx} className="font-mono tabular-nums font-semibold text-slate-800">
        {part}
      </span>
    ) : (
      part
    )
  );
}

export function DashboardClosingCycle({
  mesActualNombre,
  companyYear,
  closingChecks,
  completedChecks,
  onOpenDeliverables
}: DashboardClosingCycleProps) {
  return (
    <section className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-blue-700" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-900">
            Ciclo Contable Mensual y Cierre ({mesActualNombre} {companyYear})
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
              completedChecks === 5
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : 'bg-slate-100 text-slate-800 border-slate-300'
            }`}
          >
            {completedChecks === 5
              ? '✓ 5 de 5 Etapas Cuadradas'
              : `${completedChecks} de 5 etapas completadas`}
          </span>
          <button
            type="button"
            onClick={onOpenDeliverables}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-semibold transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            Generar Entregables
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5">
        {closingChecks.map((check) => {
          const parsedTarget = parseNavTarget(check.to);
          return (
          <Link
            key={check.id}
            to={parsedTarget.to}
            search={parsedTarget.search as unknown as Record<string, string>}
            className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2.5 group min-w-0 ${
              check.done
                ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-400 hover:shadow-xs'
                : 'bg-amber-50/70 border-amber-300 hover:border-amber-400 hover:shadow-xs'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {check.done ? (
                <CheckCircle2
                  className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              ) : (
                <AlertCircle
                  className="w-4 h-4 text-amber-700 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 line-clamp-2" title={check.label}>
                  {check.label}
                </div>
                <div
                  className="text-[11px] text-slate-600 line-clamp-2 mt-0.5"
                  title={check.detail}
                >
                  {renderDetailWithAmounts(check.detail)}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-semibold">
              <span className={check.done ? 'text-emerald-700' : 'text-amber-800'}>
                {check.done ? 'Completado ✔' : 'Pendiente revisión'}
              </span>
              <span className="text-blue-700 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
                Ir al paso →
              </span>
            </div>
          </Link>
          );
        })}
      </div>
    </section>
  );
}
