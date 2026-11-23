import { Link } from '@tanstack/react-router';
import {
  ArrowRight,
  FileCode2,
  Landmark,
  Scale,
  Sparkles,
  Zap
} from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { CfdiDocument, DashboardSummary, DashboardTrialBalanceSummary, BankReconciliationResponse } from '../../shared/types';

export interface DashboardAuditBarProps {
  mesActualNombre: string;
  companyYear: number;
  kpis: DashboardSummary['kpis'];
  isBankReconciled: boolean;
  bankRec: BankReconciliationResponse | null | undefined;
  isTrialBalanced: boolean;
  trialBalanceSummary: DashboardTrialBalanceSummary | null | undefined;
  pendingCfdis: CfdiDocument[];
  isBatchAutoPolizaPending: boolean;
  onBatchAutoPoliza: (ids: string[]) => void;
  isPeriodLocked?: boolean;
}

export function DashboardAuditBar({
  mesActualNombre,
  companyYear,
  kpis,
  isBankReconciled,
  bankRec,
  isTrialBalanced,
  trialBalanceSummary,
  pendingCfdis,
  isBatchAutoPolizaPending,
  onBatchAutoPoliza,
  isPeriodLocked = false
}: DashboardAuditBarProps) {
  return (
    <section
      aria-label="Accesos directos a módulos pendientes y auditoría fiscal"
      className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
            <Zap className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Auditoría y Tareas Prioritarias del Periodo ({mesActualNombre} {companyYear})
            </h2>
            <p className="text-[11px] text-slate-500">
              Acceso directo en 1 clic a los módulos con comprobantes o partidas pendientes
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* 1. Módulo Bóveda ADD: CFDIs sin contabilizar */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
            kpis.cfdisPendientesContabilizar > 0
              ? 'bg-amber-50/70 border-amber-300/90 shadow-xs'
              : 'bg-emerald-50/50 border-emerald-200 shadow-2xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                <FileCode2
                  aria-hidden="true"
                  className={`w-4 h-4 ${
                    kpis.cfdisPendientesContabilizar > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                />
                <span>CFDIs en Bóveda ADD</span>
              </span>
              <span
                className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                  kpis.cfdisPendientesContabilizar > 0
                    ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                }`}
              >
                {kpis.cfdisPendientesContabilizar > 0
                  ? `${kpis.cfdisPendientesContabilizar} pendientes`
                  : '100% Cuadrado'}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-snug">
              {kpis.cfdisPendientesContabilizar > 0
                ? `Existen ${kpis.cfdisPendientesContabilizar} factura(s) XML esperando ser contabilizadas en póliza.`
                : 'Todos los comprobantes CFDI 4.0 del periodo han sido transformados en pólizas cuadradas.'}
            </p>
          </div>

          <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
            {kpis.cfdisPendientesContabilizar >= 1 && (
              <button
                type="button"
                disabled={isBatchAutoPolizaPending || isPeriodLocked}
                onClick={() => onBatchAutoPoliza(pendingCfdis.map((c) => c.id))}
                title={
                  isPeriodLocked
                    ? 'Periodo cerrado con candado fiscal'
                    : 'Generar pólizas de todos los XMLs pendientes en 1 clic'
                }
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-amber-100" aria-hidden="true" />
                <span>
                  {isBatchAutoPolizaPending ? 'Contabilizando...' : 'Auto-contabilizar'}
                </span>
              </button>
            )}
            <Link
              to="/add"
              className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                kpis.cfdisPendientesContabilizar > 0
                  ? 'bg-white hover:bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-white hover:bg-emerald-100 text-emerald-900 border-emerald-200'
              }`}
            >
              <span>Ir al ADD (Alt+2)</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* 2. Módulo Tesorería: Conciliación Bancaria */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
            !isBankReconciled
              ? 'bg-amber-50/70 border-amber-300/90 shadow-xs'
              : 'bg-emerald-50/50 border-emerald-200 shadow-2xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                <Landmark
                  aria-hidden="true"
                  className={`w-4 h-4 ${
                    !isBankReconciled ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                />
                <span>Conciliación Bancaria</span>
              </span>
              <span
                className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                  !isBankReconciled
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                }`}
              >
                {!isBankReconciled
                  ? `${
                      (bankRec?.summary.movimientosPendientesBanco ?? 0) +
                      (bankRec?.summary.movimientosPendientesLibros ?? 0)
                    } por conciliar`
                  : 'Conciliado 100%'}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-snug">
              {!isBankReconciled
                ? 'Partidas bancarias pendientes de cruzar con libros. Cruza depósitos y cheques para cerrar bancos.'
                : `Extracto bancario verificado contra libro mayor. Saldo disponible: ${formatCurrency(
                    kpis.efectivoBancos
                  )}.`}
            </p>
          </div>

          <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-slate-500">
              Atajo: <kbd className="bg-white px-1 rounded border border-slate-300">Alt+5</kbd>
            </span>
            <Link
              to="/fiscal-bancos"
              className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                !isBankReconciled
                  ? 'bg-amber-700 hover:bg-amber-800 text-white border-amber-800'
                  : 'bg-white hover:bg-emerald-100 text-emerald-900 border-emerald-200'
              }`}
            >
              <span>{!isBankReconciled ? 'Conciliar Bancos' : 'Ver Cédula Bancaria'}</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* 3. Módulo Estados Financieros: Balanza de Comprobación Anexo 24 */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
            !isTrialBalanced
              ? 'bg-red-50/70 border-red-300 shadow-xs'
              : 'bg-emerald-50/50 border-emerald-200 shadow-2xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                <Scale
                  aria-hidden="true"
                  className={`w-4 h-4 ${
                    !isTrialBalanced ? 'text-red-700' : 'text-emerald-700'
                  }`}
                />
                <span>Balanza de Comprobación</span>
              </span>
              <span
                className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                  !isTrialBalanced
                    ? 'bg-red-100 text-red-900 border-red-300'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                }`}
              >
                {isTrialBalanced ? 'Partida Doble ✔' : 'Descuadrada'}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-snug">
              {isTrialBalanced
                ? 'Sumas iguales en Cargos y Abonos verificadas. Lista para exportar en XML SAT Anexo 24.'
                : `Alerta: Existe una discrepancia de ${formatCurrency(
                    trialBalanceSummary?.difference || 0
                  )} entre cargos y abonos del mes.`}
            </p>
          </div>

          <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-slate-500">
              Atajo: <kbd className="bg-white px-1 rounded border border-slate-300">Alt+6</kbd>
            </span>
            <Link
              to="/reportes"
              className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                !isTrialBalanced
                  ? 'bg-red-700 hover:bg-red-800 text-white border-red-800'
                  : 'bg-white hover:bg-emerald-100 text-emerald-900 border-emerald-200'
              }`}
            >
              <span>{!isTrialBalanced ? 'Auditar Descuadre' : 'Ver Balanza Anexo 24'}</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
