import { AlertTriangle, CheckCircle2, Layers, Percent, ShieldAlert, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { FiscalWorkpaperResponse } from '../../shared/types';

export interface ResicoCashBasisBannerProps {
  workpaper: FiscalWorkpaperResponse;
}

const THRESHOLD_STYLES: Record<
  'OK' | 'WARNING_80' | 'CRITICAL_95' | 'EXCEEDED',
  { badge: string; bar: string; border: string; statusText: string }
> = {
  OK: {
    badge: 'bg-emerald-50 text-emerald-900 border-emerald-300',
    bar: 'bg-emerald-600',
    border: 'border-slate-300/90',
    statusText: 'Dentro de límite anual'
  },
  WARNING_80: {
    badge: 'bg-amber-50 text-amber-950 border-amber-300',
    bar: 'bg-amber-500',
    border: 'border-amber-300',
    statusText: 'Precaución ≥ 80% del tope'
  },
  CRITICAL_95: {
    badge: 'bg-orange-50 text-orange-950 border-orange-300',
    bar: 'bg-orange-600',
    border: 'border-orange-300',
    statusText: 'Alerta crítica ≥ 95% del tope'
  },
  EXCEEDED: {
    badge: 'bg-red-50 text-red-950 border-red-300',
    bar: 'bg-red-600',
    border: 'border-red-300',
    statusText: 'Tope anual excedido — Cambio de régimen'
  }
};

export function ResicoCashBasisBanner({ workpaper }: ResicoCashBasisBannerProps) {
  const cash = workpaper.cashBasisSummary;
  const alert = workpaper.resicoThresholdAlert;
  const iva = workpaper.ivaBreakdown;

  const showCashOrResico = Boolean(alert?.applies || cash?.isCashBasisRegime);
  const showIvaBreakdown = Boolean(
    iva && (iva.base8 > 0 || iva.base0 > 0 || iva.baseExento > 0 || iva.prorationFactor < 1)
  );

  if (!showCashOrResico && !showIvaBreakdown) {
    return null;
  }

  const alertStyle = alert ? THRESHOLD_STYLES[alert.status] : THRESHOLD_STYLES.OK;
  const clampedPct = alert ? Math.min(100, Math.max(0, Math.round(alert.utilizationPct))) : 0;

  return (
    <section
      aria-label={alert?.applies ? 'Resumen de flujo de efectivo RESICO y desglose de IVA' : 'Resumen de flujo de efectivo y desglose de IVA'}
      className="space-y-3.5"
    >
      {showCashOrResico && (
        <div className={`bg-white p-4 sm:p-5 rounded-2xl border ${alertStyle.border} shadow-2xs space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Base Flujo de Efectivo ({workpaper.isrProvisional.regimenClave}){alert?.applies ? ' y Control de Topes RESICO' : ''}
                </h3>
                <p className="text-[11px] text-slate-600">
                  Comparativo entre base contable devengada y flujo cobrado/pagado (PUE + Pago 2.0 − Notas de Crédito E)
                </p>
              </div>
            </div>

            {alert?.applies && (
              <span
                role={alert.status === 'EXCEEDED' || alert.status === 'CRITICAL_95' ? 'alert' : 'status'}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold self-start sm:self-auto shrink-0 ${alertStyle.badge}`}
              >
                {alert.status === 'OK' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : alert.status === 'EXCEEDED' ? (
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{alertStyle.statusText}</span>
              </span>
            )}
          </div>

          {cash?.isCashBasisRegime && (
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${cash.retencionResico125 > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 text-xs`}>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
                <span className="text-[11px] font-semibold text-slate-600 block">
                  Base Contable Devengada
                </span>
                <strong className="font-mono text-sm text-slate-900 tabular-nums mt-0.5 block">
                  {formatCurrency(cash.baseContableDevengada)}
                </strong>
                <span className="text-[11px] text-slate-600 block">Total CFDIs emitidos del periodo</span>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 min-w-0">
                <span className="text-[11px] font-semibold text-blue-900 block">
                  Base Fiscal Flujo de Efectivo
                </span>
                <strong className="font-mono text-sm text-blue-950 tabular-nums mt-0.5 block">
                  {formatCurrency(cash.ingresosCobradosFlujo)}
                </strong>
                <span className="text-[11px] text-blue-800 font-mono tabular-nums block">
                  PUE {formatCurrency(cash.pueIngresos)} + REP {formatCurrency(cash.repIngresos)} − NC {formatCurrency(cash.creditNotesRestados)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
                <span className="text-[11px] font-semibold text-slate-600 block">
                  Deducciones Pagadas (Flujo)
                </span>
                <strong className="font-mono text-sm text-emerald-800 tabular-nums mt-0.5 block">
                  {formatCurrency(cash.deduccionesPagadasFlujo)}
                </strong>
                <span className="text-[11px] text-slate-600 block">Egresos PUE y REP pagados</span>
              </div>

              {cash.retencionResico125 > 0 && (
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 min-w-0">
                  <span className="text-[11px] font-semibold text-emerald-900 block">
                    Retención ISR 1.25% RESICO PF
                  </span>
                  <strong className="font-mono text-sm text-emerald-950 tabular-nums mt-0.5 block">
                    {formatCurrency(cash.retencionResico125)}
                  </strong>
                  <span className="text-[11px] text-emerald-800 block">Acreditable Art. 113-J LISR</span>
                </div>
              )}
            </div>
          )}

          {alert?.applies && (
            <div className="space-y-1.5 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-800">
                  {alert.label || 'Tope Anual de Ingresos RESICO'} ({alert.thresholdMxn >= 35000000 ? '$35,000,000 PM' : '$3,500,000 PF'})
                </span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {formatCurrency(alert.accumulatedRevenueMxn)} / {formatCurrency(alert.thresholdMxn)} ({alert.utilizationPct.toFixed(1)}%)
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Utilización del tope anual de ingresos RESICO"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={clampedPct}
                aria-valuetext={`${alert.utilizationPct.toFixed(1)}% utilizado: ${formatCurrency(alert.accumulatedRevenueMxn)} de ${formatCurrency(alert.thresholdMxn)}`}
                className="w-full h-3 rounded-full bg-slate-200 overflow-hidden"
              >
                <div
                  className={`h-full transition-all duration-300 ${alertStyle.bar}`}
                  style={{ width: `${clampedPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {showIvaBreakdown && iva && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Desglose Multi-Tasa de IVA y Factor de Prorrateo (Art. 5 LIVA)
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 self-start sm:self-auto shrink-0">
              <Percent className="w-3 h-3" aria-hidden="true" />
              Factor Prorrateo: {(iva.prorationFactor * 100).toFixed(2)}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
              <span className="text-[11px] font-bold uppercase text-slate-600 block">Base 16%</span>
              <strong className="font-mono text-slate-900 tabular-nums">{formatCurrency(iva.base16)}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
              <span className="text-[11px] font-bold uppercase text-slate-600 block">Base 8% Frontera</span>
              <strong className="font-mono text-slate-900 tabular-nums">{formatCurrency(iva.base8)}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
              <span className="text-[11px] font-bold uppercase text-slate-600 block">Base 0%</span>
              <strong className="font-mono text-slate-900 tabular-nums">{formatCurrency(iva.base0)}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
              <span className="text-[11px] font-bold uppercase text-slate-600 block">Base Exento</span>
              <strong className="font-mono text-slate-900 tabular-nums">{formatCurrency(iva.baseExento)}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
              <span className="text-[11px] font-bold uppercase text-slate-600 block">IEPS Acreditable</span>
              <strong className="font-mono text-slate-900 tabular-nums">{formatCurrency(iva.iepsAcreditable)}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 min-w-0">
              <span className="text-[11px] font-bold uppercase text-emerald-900 block">IVA Acreditable</span>
              <strong className="font-mono text-emerald-950 tabular-nums block">
                {formatCurrency(iva.ivaAcreditableProrrateado)}
              </strong>
              <span className="text-[11px] text-emerald-800 font-mono tabular-nums block">
                Sin prorrateo: {formatCurrency(iva.ivaAcreditableSinProrrateo)}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
