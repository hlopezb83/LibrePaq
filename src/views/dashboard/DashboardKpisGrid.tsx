import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Landmark,
  TrendingUp
} from 'lucide-react';
import { KpiCard, StatusBadge } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';
import type { DashboardSummary } from '../../shared/types';

export interface DashboardKpisGridProps {
  kpis: DashboardSummary['kpis'];
  mesActualNombre: string;
  activeCompanyId: string;
  proporcionGastoIngreso: string;
  margenOperativo: string;
  razonCoberturaBancos: string;
  onOpenLedger: (id: string) => void;
}

export function DashboardKpisGrid({
  kpis,
  mesActualNombre,
  activeCompanyId,
  proporcionGastoIngreso,
  margenOperativo,
  razonCoberturaBancos,
  onOpenLedger
}: DashboardKpisGridProps) {
  return (
    <>
      {/* Tarjetas de KPIs Principales con Razones Financieras e Hipervínculo a Libro Mayor */}
      <section
        aria-label="Indicadores financieros principales"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
      >
        <KpiCard
          label="Ingresos del Periodo"
          value={formatCurrency(kpis.ingresosPeriodo)}
          icon={<ArrowUpRight className="w-4 h-4" aria-hidden="true" />}
          iconTone="emerald"
          onClick={() => onOpenLedger(`${activeCompanyId}_400-00-000`)}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-1.5 min-w-0 text-xs text-slate-600">
              <span className="min-w-0">Base 100% Ingresos ({mesActualNombre})</span>
              <span className="text-[11px] font-semibold text-blue-700 inline-flex items-center gap-1 shrink-0">
                <BookOpen className="w-3 h-3" aria-hidden="true" />
                Auxiliar
              </span>
            </div>
          }
        />

        <KpiCard
          label="Costos y Gastos"
          value={formatCurrency(kpis.egresosPeriodo)}
          icon={<ArrowDownRight className="w-4 h-4" aria-hidden="true" />}
          iconTone="default"
          onClick={() => onOpenLedger(`${activeCompanyId}_600-00-000`)}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-1.5 min-w-0 text-xs text-slate-600">
              <span className="min-w-0">
                Absorción:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {proporcionGastoIngreso}%
                </strong>{' '}
                s/venta
              </span>
              <span className="text-[11px] font-semibold text-blue-700 inline-flex items-center gap-1 shrink-0">
                <BookOpen className="w-3 h-3" aria-hidden="true" />
                Auxiliar
              </span>
            </div>
          }
        />

        <Link
          to="/reportes"
          search={{ tab: 'RESULTADOS' } as unknown as Record<string, string>}
          className="block min-w-0 rounded-2xl group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <KpiCard
            label="Utilidad Neta"
            value={formatCurrency(kpis.utilidadNeta)}
            valueClassName={kpis.utilidadNeta >= 0 ? 'text-slate-900' : 'text-red-700'}
            icon={<TrendingUp className="w-4 h-4" aria-hidden="true" />}
            iconTone={kpis.utilidadNeta >= 0 ? 'blue' : 'red'}
            className="h-full group-hover:border-blue-500 group-hover:shadow-sm"
            footer={
              <div className="flex flex-wrap items-center justify-between gap-1.5 min-w-0 text-xs text-slate-600">
                <span className="min-w-0">
                  Margen Neto:{' '}
                  <strong
                    className={`font-mono tabular-nums ${
                      kpis.utilidadNeta >= 0 ? 'text-emerald-800' : 'text-red-700'
                    }`}
                  >
                    {margenOperativo}%
                  </strong>
                </span>
                <span className="text-[11px] font-semibold text-blue-700 inline-flex items-center gap-1 shrink-0">
                  <span>Resultados</span>
                  <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </span>
              </div>
            }
          />
        </Link>

        <KpiCard
          label="Efectivo en Bancos"
          value={formatCurrency(kpis.efectivoBancos)}
          icon={<Landmark className="w-4 h-4" aria-hidden="true" />}
          iconTone="blue"
          onClick={() => onOpenLedger(`${activeCompanyId}_102-00-000`)}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-1.5 min-w-0 text-xs text-slate-600">
              <span className="min-w-0">
                Cobertura s/Pasivo:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {razonCoberturaBancos === 'S/D' ? 'S/D' : `${razonCoberturaBancos}x`}
                </strong>
              </span>
              <span className="text-[11px] font-semibold text-blue-700 inline-flex items-center gap-1 shrink-0">
                <BookOpen className="w-3 h-3" aria-hidden="true" />
                Auxiliar
              </span>
            </div>
          }
        />
      </section>

      {/* Cédula Rápida de Posición Financiera y Estatus Fiscal SAT */}
      <section
        aria-label="Posición financiera y estatus fiscal SAT"
        className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-3.5 sm:p-4 text-xs"
      >
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-3 sm:divide-x divide-slate-200">
          <button
            type="button"
            onClick={() => onOpenLedger(`${activeCompanyId}_105-00-000`)}
            title="Consultar auxiliar de Clientes en Libro Mayor"
            className="min-w-0 text-left space-y-1 hover:bg-slate-50 rounded-lg p-1 -m-1 transition cursor-pointer"
          >
            <span className="text-[10px] uppercase font-bold text-slate-600 block">
              Cuentas por Cobrar (Clientes)
            </span>
            <div className="font-mono font-bold text-sm tabular-nums break-words text-slate-900">
              {formatCurrency(kpis.cuentasPorCobrar)}
            </div>
            <span className="text-[10px] text-blue-700 font-medium inline-flex items-center gap-0.5">
              <span>Ver auxiliar</span>
              <ArrowRight className="w-2.5 h-2.5" aria-hidden="true" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenLedger(`${activeCompanyId}_201-00-000`)}
            title="Consultar auxiliar de Proveedores en Libro Mayor"
            className="min-w-0 text-left space-y-1 border-t border-slate-100 pt-2 min-[420px]:border-t-0 min-[420px]:pt-0 sm:pl-3 hover:bg-slate-50 rounded-lg p-1 -m-1 sm:m-0 transition cursor-pointer"
          >
            <span className="text-[10px] uppercase font-bold text-slate-600 block">
              Cuentas por Pagar (Proveedores)
            </span>
            <div className="font-mono font-bold text-sm tabular-nums break-words text-slate-900">
              {formatCurrency(kpis.cuentasPorPagar)}
            </div>
            <span className="text-[10px] text-blue-700 font-medium inline-flex items-center gap-0.5">
              <span>Ver auxiliar</span>
              <ArrowRight className="w-2.5 h-2.5" aria-hidden="true" />
            </span>
          </button>

          <Link
            to="/fiscal-bancos"
            search={{ tab: 'DIA17' } as unknown as Record<string, string>}
            title="Abrir Cédula Fiscal Día 17 e impuestos mensuales ante el SAT"
            className="min-w-0 space-y-1 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0 sm:pl-3 block hover:bg-slate-50 rounded-lg p-1 -m-1 sm:m-0 transition cursor-pointer"
          >
            <span className="text-[10px] uppercase font-bold text-slate-600 block">
              IVA Neto del Mes (SAT)
            </span>
            <div
              className={`font-mono font-bold text-sm tabular-nums break-words ${
                kpis.ivaPorPagarNeto > 0
                  ? 'text-amber-800'
                  : kpis.ivaPorPagarNeto < 0
                  ? 'text-emerald-800'
                  : 'text-slate-700'
              }`}
            >
              {formatCurrency(Math.abs(kpis.ivaPorPagarNeto))}{' '}
              {kpis.ivaPorPagarNeto > 0
                ? '(A Cargo)'
                : kpis.ivaPorPagarNeto < 0
                ? '(A Favor)'
                : '(En ceros)'}
            </div>
            <span className="text-[10px] text-blue-700 font-medium inline-flex items-center gap-0.5">
              <span>Ver Cédula Día 17</span>
              <ArrowRight className="w-2.5 h-2.5" aria-hidden="true" />
            </span>
          </Link>

          <div className="min-w-0 space-y-1 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0 sm:pl-3">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">
              Bóveda Digital ADD
            </span>
            <div className="font-mono font-bold text-sm tabular-nums text-slate-900">
              {kpis.cfdisTotalesPeriodo}{' '}
              {kpis.cfdisTotalesPeriodo === 1 ? 'CFDI Registrado' : 'CFDIs Registrados'}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1.5 min-w-0 text-[10px]">
              {kpis.cfdisTotalesPeriodo === 0 ? (
                <StatusBadge tone="slate">Sin CFDIs en el periodo</StatusBadge>
              ) : kpis.cfdisPendientesContabilizar === 0 ? (
                <StatusBadge
                  tone="emerald"
                  icon={<CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
                >
                  100% Contabilizado
                </StatusBadge>
              ) : (
                <StatusBadge
                  tone="amber"
                  icon={<AlertTriangle className="w-3 h-3" aria-hidden="true" />}
                >
                  {kpis.cfdisPendientesContabilizar} por Contabilizar
                </StatusBadge>
              )}
              <Link
                to="/add"
                className="text-blue-700 hover:underline font-semibold ml-auto inline-flex items-center gap-0.5"
              >
                <span>Bóveda</span>
                <ArrowRight className="w-2.5 h-2.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
