import { Link } from '@tanstack/react-router';
import { ArrowRight, CheckCircle2, Scale } from 'lucide-react';
import { AlertBanner, getButtonClasses } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';
import type { ThreeWayTieoutResult } from '../../shared/engine/three-way-tieout.engine';

interface DashboardTieoutDetailProps {
  tieout: ThreeWayTieoutResult;
  hasTieoutActivity: boolean;
}

export function DashboardTieoutDetail({ tieout, hasTieoutActivity }: DashboardTieoutDetailProps) {
  return (
    <div id="dashboard-tieout-detail" className="border-t border-slate-200 bg-slate-50/70 p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-1.5 min-w-0">
          <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5">
            1. SAT ADD (Flujo PUE + REP)
          </div>
          <div className="flex justify-between gap-2 min-w-0">
            <span className="text-slate-600 truncate">Ingresos cobrados netos:</span>
            <span className="font-mono font-bold tabular-nums text-slate-900 shrink-0">{formatCurrency(tieout.satAdd.ingresosNetos)}</span>
          </div>
          <div className="flex justify-between gap-2 min-w-0">
            <span className="text-slate-600 truncate">Gastos pagados netos:</span>
            <span className="font-mono font-bold tabular-nums text-slate-900 shrink-0">{formatCurrency(tieout.satAdd.gastosNetos)}</span>
          </div>
          <div className="flex justify-between gap-2 min-w-0">
            <span className="text-slate-600 truncate">IVA Trasladado ADD:</span>
            <span className="font-mono font-bold tabular-nums text-slate-900 shrink-0">{formatCurrency(tieout.satAdd.ivaTrasladado)}</span>
          </div>
          <div className="flex justify-between gap-2 min-w-0">
            <span className="text-slate-600 truncate">IVA Acreditable ADD:</span>
            <span className="font-mono font-bold tabular-nums text-slate-900 shrink-0">{formatCurrency(tieout.satAdd.ivaAcreditable)}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-1.5 min-w-0">
          <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5">
            2. Contabilidad (Libros)
          </div>
          <div className="flex justify-between gap-2 min-w-0">
            <span className="text-slate-600 truncate">Ingresos (401/402):</span>
            <span className="font-mono font-bold tabular-nums text-slate-900 shrink-0">{formatCurrency(tieout.contabilidad.ingresos401_402)}</span>
          </div>
          <div className="flex justify-between gap-2 min-w-0">
            <span className="text-slate-600 truncate">Costos y Gastos (501/601):</span>
            <span className="font-mono font-bold tabular-nums text-slate-900 shrink-0">{formatCurrency(tieout.contabilidad.gastos501_601)}</span>
          </div>
          <div className="flex justify-between gap-2 min-w-0">
            <span className="text-slate-600 truncate">IVA Cobrado (208):</span>
            <span className="font-mono font-bold tabular-nums text-slate-900 shrink-0">{formatCurrency(tieout.contabilidad.ivaCobrado208)}</span>
          </div>
          <div className="flex justify-between gap-2 min-w-0">
            <span className="text-slate-600 truncate">IVA Pagado (118):</span>
            <span className="font-mono font-bold tabular-nums text-slate-900 shrink-0">{formatCurrency(tieout.contabilidad.ivaPagado118)}</span>
          </div>
          <div className="flex justify-between gap-2 min-w-0 pt-1 border-t border-slate-100">
            <span className="text-slate-600 truncate">Flujo Bancos (102 Neto):</span>
            <span className="font-mono font-bold tabular-nums text-blue-900 shrink-0">{formatCurrency(tieout.contabilidad.bancos102Neto)}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-1.5 min-w-0">
          <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5">
            3. DIOT ({tieout.diot.suppliersCount} proveedores)
          </div>
          <div className="flex justify-between gap-2 min-w-0">
            <span className="text-slate-600 truncate">Actos pagados totales:</span>
            <span className="font-mono font-bold tabular-nums text-slate-900 shrink-0">{formatCurrency(tieout.diot.actosPagadosTotal)}</span>
          </div>
          <div className="flex justify-between gap-2 min-w-0">
            <span className="text-slate-600 truncate">Actos gravados 16%/8%:</span>
            <span className="font-mono font-bold tabular-nums text-slate-900 shrink-0">{formatCurrency(tieout.diot.actosGravados16y8)}</span>
          </div>
          <div className="flex justify-between gap-2 min-w-0">
            <span className="text-slate-600 truncate">IVA Acreditable DIOT:</span>
            <span className="font-mono font-bold tabular-nums text-slate-900 shrink-0">{formatCurrency(tieout.diot.ivaAcreditablePagado)}</span>
          </div>
          <div className="flex justify-between gap-2 min-w-0 pt-1 border-t border-slate-100">
            <span className="text-slate-600 truncate">Dif. IVA Libros vs DIOT:</span>
            <span className="font-mono font-bold tabular-nums text-slate-900 shrink-0">{formatCurrency(tieout.deltas.deltaIvaAcreditableDiot)}</span>
          </div>
        </div>
      </div>

      {tieout.causes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-800">Causas por revisar detectadas:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {tieout.causes.map((cause) => (
              <div
                key={cause.code}
                className={`rounded-xl border p-3 flex items-start justify-between gap-3 ${
                  cause.severity === 'HIGH'
                    ? 'bg-red-50/80 border-red-200 text-red-950'
                    : 'bg-amber-50/80 border-amber-200 text-amber-950'
                }`}
              >
                <div className="space-y-0.5 text-xs min-w-0">
                  <p className="font-bold">{cause.title}</p>
                  <p className="text-[11px] opacity-90">{cause.detail}</p>
                </div>
                <Link
                  to={cause.targetRoute}
                  search={
                    cause.targetRoute === '/fiscal-bancos'
                      ? ({ tab: 'DIOT' } as unknown as Record<string, string>)
                      : undefined
                  }
                  className={getButtonClasses('secondary', 'sm')}
                >
                  <span>Revisar</span>
                  <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : !hasTieoutActivity ? (
        <AlertBanner tone="info" icon={<Scale className="w-4 h-4" aria-hidden="true" />}>
          Sin movimientos fiscales ni contables registrados en este periodo.
        </AlertBanner>
      ) : (
        <AlertBanner tone="success" icon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}>
          Sin discrepancias entre SAT ADD, Contabilidad y DIOT para el periodo activo.
        </AlertBanner>
      )}
    </div>
  );
}
