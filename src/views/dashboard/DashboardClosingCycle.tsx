import { Link } from '@tanstack/react-router';
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardCheck, Clock, Printer } from 'lucide-react';
import { Button, StatusBadge } from '../../components/ui';
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
  hasActivity?: boolean;
  onOpenDeliverables: () => void;
}

function renderDetailWithAmounts(detail: string) {
  const parts = detail.split(/(-?\$[\d,]+(?:\.\d{2})?|\$-?[\d,]+(?:\.\d{2})?)/g);
  return parts.map((part, idx) =>
    part.includes('$') ? (
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
  hasActivity = completedChecks > 0,
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
          <StatusBadge
            tone={completedChecks === 5 ? 'emerald' : 'slate'}
            icon={
              completedChecks === 5 ? (
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              ) : undefined
            }
            className="font-mono tabular-nums"
          >
            {completedChecks === 5
              ? '5 de 5 Etapas Cuadradas'
              : `${completedChecks} de 5 etapas completadas`}
          </StatusBadge>
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenDeliverables}
            leftIcon={<Printer className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />}
          >
            Generar Entregables
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5">
        {closingChecks.map((check) => {
          const parsedTarget = parseNavTarget(check.to);
          const isUnstarted = !hasActivity && !check.done;
          return (
            <Link
              key={check.id}
              to={parsedTarget.to}
              search={parsedTarget.search as unknown as Record<string, string>}
              className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2.5 group min-w-0 ${
                check.done
                  ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-400 hover:shadow-xs'
                  : isUnstarted
                  ? 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:shadow-xs'
                  : 'bg-amber-50/70 border-amber-300 hover:border-amber-400 hover:shadow-xs'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {check.done ? (
                  <CheckCircle2
                    className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                ) : isUnstarted ? (
                  <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
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

              <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold">
                <StatusBadge
                  tone={check.done ? 'emerald' : isUnstarted ? 'slate' : 'amber'}
                >
                  {check.done ? 'Completado' : isUnstarted ? 'Por iniciar' : 'Pendiente revisión'}
                </StatusBadge>
                <span className="text-blue-700 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5 shrink-0">
                  <span>Ir al paso</span>
                  <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
