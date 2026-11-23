import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Landmark,
  TrendingUp
} from 'lucide-react';
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
  onNavigateReportes: () => void;
}

export function DashboardKpisGrid({
  kpis,
  mesActualNombre,
  activeCompanyId,
  proporcionGastoIngreso,
  margenOperativo,
  razonCoberturaBancos,
  onOpenLedger,
  onNavigateReportes
}: DashboardKpisGridProps) {
  return (
    <>
      {/* Tarjetas de KPIs Principales con Razones Financieras e Hipervínculo a Libro Mayor */}
      <section
        aria-label="Indicadores financieros principales"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
      >
        <button
          type="button"
          onClick={() => onOpenLedger(`${activeCompanyId}_400-00-000`)}
          className="group text-left bg-white rounded-2xl p-4 sm:p-5 border border-slate-300/90 hover:border-blue-600 hover:shadow-md transition shadow-2xs cursor-pointer erp-card-pad"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Ingresos del Periodo
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:scale-105 transition">
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2.5 text-xl sm:text-2xl font-bold font-mono text-slate-900">
            {formatCurrency(kpis.ingresosPeriodo)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Base 100% Ingresos ({mesActualNombre})</span>
            <span className="text-[11px] font-semibold text-blue-700 inline-flex items-center gap-1">
              <BookOpen className="w-3 h-3" aria-hidden="true" />
              Auxiliar
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpenLedger(`${activeCompanyId}_600-00-000`)}
          className="group text-left bg-white rounded-2xl p-4 sm:p-5 border border-slate-300/90 hover:border-blue-600 hover:shadow-md transition shadow-2xs cursor-pointer erp-card-pad"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Costos y Gastos
            </span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center group-hover:scale-105 transition">
              <ArrowDownRight className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2.5 text-xl sm:text-2xl font-bold font-mono text-slate-900">
            {formatCurrency(kpis.egresosPeriodo)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              Absorción:{' '}
              <strong className="font-mono text-slate-900">{proporcionGastoIngreso}%</strong> s/venta
            </span>
            <span className="text-[11px] font-semibold text-blue-700 inline-flex items-center gap-1">
              <BookOpen className="w-3 h-3" aria-hidden="true" />
              Auxiliar
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onNavigateReportes}
          className="group text-left bg-white rounded-2xl p-4 sm:p-5 border border-slate-300/90 hover:border-blue-600 hover:shadow-md transition shadow-2xs cursor-pointer erp-card-pad"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Utilidad Neta
            </span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center group-hover:scale-105 transition">
              <TrendingUp className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <div
            className={`mt-2.5 text-xl sm:text-2xl font-bold font-mono ${
              kpis.utilidadNeta >= 0 ? 'text-slate-900' : 'text-red-700'
            }`}
          >
            {formatCurrency(kpis.utilidadNeta)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              Margen Neto:{' '}
              <strong
                className={`font-mono ${
                  kpis.utilidadNeta >= 0 ? 'text-emerald-800' : 'text-red-700'
                }`}
              >
                {margenOperativo}%
              </strong>
            </span>
            <span className="text-[11px] font-semibold text-blue-700">Resultados →</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpenLedger(`${activeCompanyId}_102-00-000`)}
          className="group text-left bg-white rounded-2xl p-4 sm:p-5 border border-slate-300/90 hover:border-blue-600 hover:shadow-md transition shadow-2xs cursor-pointer erp-card-pad"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Efectivo en Bancos
            </span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center group-hover:scale-105 transition">
              <Landmark className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-2.5 text-xl sm:text-2xl font-bold font-mono text-slate-900">
            {formatCurrency(kpis.efectivoBancos)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              Cobertura s/Pasivo:{' '}
              <strong className="font-mono text-slate-900">{razonCoberturaBancos}x</strong>
            </span>
            <span className="text-[11px] font-semibold text-blue-700 inline-flex items-center gap-1">
              <BookOpen className="w-3 h-3" aria-hidden="true" />
              Auxiliar
            </span>
          </div>
        </button>
      </section>

      {/* Cédula Rápida de Posición Financiera y Estatus Fiscal SAT */}
      <section className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-3.5 sm:p-4 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:divide-x divide-slate-200">
          <button
            type="button"
            onClick={() => onOpenLedger('105-01-001')}
            title="Consultar auxiliar de Clientes en Libro Mayor"
            className="text-left space-y-1 hover:bg-slate-50 rounded-lg p-1 -m-1 transition cursor-pointer"
          >
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Cuentas por Cobrar (Clientes)</span>
            <div className="font-mono font-bold text-sm text-slate-900">{formatCurrency(kpis.cuentasPorCobrar)}</div>
            <span className="text-[10px] text-blue-700 font-medium">Ver auxiliar →</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenLedger('201-01-001')}
            title="Consultar auxiliar de Proveedores en Libro Mayor"
            className="text-left space-y-1 sm:pl-3 hover:bg-slate-50 rounded-lg p-1 -m-1 sm:m-0 transition cursor-pointer"
          >
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Cuentas por Pagar (Proveedores)</span>
            <div className="font-mono font-bold text-sm text-slate-900">{formatCurrency(kpis.cuentasPorPagar)}</div>
            <span className="text-[10px] text-blue-700 font-medium">Ver auxiliar →</span>
          </button>
          <div className="space-y-1 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0 sm:pl-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">IVA Neto del Mes (SAT)</span>
            <div
              className={`font-mono font-bold text-sm ${
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
            <span className="text-[10px] text-slate-500">Proyección liquidación Día 17</span>
          </div>
          <div className="space-y-1 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0 sm:pl-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Bóveda Digital ADD</span>
            <div className="font-mono font-bold text-sm text-slate-900">
              {kpis.cfdisTotalesPeriodo} {kpis.cfdisTotalesPeriodo === 1 ? 'CFDI Registrado' : 'CFDIs Registrados'}
            </div>
            <div className="flex items-center justify-between text-[10px]">
              {kpis.cfdisPendientesContabilizar === 0 ? (
                <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" /> 100% Contabilizado
                </span>
              ) : (
                <span className="text-amber-800 font-semibold inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" aria-hidden="true" /> {kpis.cfdisPendientesContabilizar} por Contabilizar
                </span>
              )}
              <Link to="/add" className="text-blue-700 hover:underline font-semibold ml-auto">
                Bóveda →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
