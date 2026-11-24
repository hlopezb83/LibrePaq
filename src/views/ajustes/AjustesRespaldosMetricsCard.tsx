import { Database, RefreshCw } from 'lucide-react';

interface AjustesRespaldosMetricsCardProps {
  companyRfc: string;
  accountsCount: number;
  polizasCount: number;
  cfdisCount: number;
  isLoadingMetrics: boolean;
  isErrorMetrics: boolean;
  refetchMetrics?: () => void;
}

export function AjustesRespaldosMetricsCard({
  companyRfc,
  accountsCount,
  polizasCount,
  cfdisCount,
  isLoadingMetrics,
  isErrorMetrics,
  refetchMetrics,
}: AjustesRespaldosMetricsCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-700" aria-hidden="true" />
          Métricas de Almacenamiento Contable ({companyRfc})
        </h3>
        {isErrorMetrics && refetchMetrics && (
          <button
            type="button"
            onClick={refetchMetrics}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            Reintentar métricas
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-600 block">Cuentas en Catálogo</span>
          <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
            {isLoadingMetrics ? '...' : isErrorMetrics ? '—' : accountsCount}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-600 block">Pólizas del Periodo</span>
          <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
            {isLoadingMetrics ? '...' : isErrorMetrics ? '—' : polizasCount}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-600 block">CFDIs 4.0 en Bóveda</span>
          <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
            {isLoadingMetrics ? '...' : isErrorMetrics ? '—' : cfdisCount}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-600 block">Estado de Bóveda</span>
          {isLoadingMetrics ? (
            <span className="text-xs font-bold text-slate-600 block mt-1.5">Consultando registros...</span>
          ) : isErrorMetrics ? (
            <span className="text-xs font-bold text-red-700 block mt-1.5">Error al consultar</span>
          ) : (
            <span className="text-sm font-bold text-emerald-700 block mt-1">Sincronizado • 100% OK</span>
          )}
        </div>
      </div>
    </div>
  );
}
