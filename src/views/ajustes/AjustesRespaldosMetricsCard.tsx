import { CheckCircle2, Database, FileCode2, Layers, ReceiptText, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button, KpiCard } from '../../components/ui';

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
  const formatCount = (n: number) =>
    isLoadingMetrics ? '...' : isErrorMetrics ? '—' : n.toLocaleString('es-MX');

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-700" aria-hidden="true" />
          Métricas de Almacenamiento Contable ({companyRfc})
        </h3>
        {isErrorMetrics && refetchMetrics && (
          <Button
            variant="danger-outline"
            size="sm"
            leftIcon={<RefreshCw className="w-3 h-3" aria-hidden="true" />}
            onClick={refetchMetrics}
          >
            Reintentar métricas
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
        <KpiCard
          label="Cuentas en Catálogo"
          value={formatCount(accountsCount)}
          icon={<Layers className="w-4 h-4" aria-hidden="true" />}
          iconTone="blue"
        />
        <KpiCard
          label="Pólizas del Periodo"
          value={formatCount(polizasCount)}
          icon={<ReceiptText className="w-4 h-4" aria-hidden="true" />}
          iconTone="blue"
        />
        <KpiCard
          label="CFDIs 4.0 en Bóveda"
          value={formatCount(cfdisCount)}
          icon={<FileCode2 className="w-4 h-4" aria-hidden="true" />}
          iconTone="default"
        />
        <KpiCard
          label="Estado de Bóveda"
          value={
            isLoadingMetrics
              ? 'Consultando...'
              : isErrorMetrics
                ? 'Error al consultar'
                : 'Sincronizado • 100% OK'
          }
          valueClassName={
            isLoadingMetrics
              ? 'text-sm text-slate-600 font-sans'
              : isErrorMetrics
                ? 'text-sm text-red-700 font-sans'
                : 'text-sm text-emerald-700 font-sans'
          }
          tone={isErrorMetrics ? 'red' : isLoadingMetrics ? 'default' : 'emerald'}
          iconTone={isErrorMetrics ? 'red' : isLoadingMetrics ? 'default' : 'emerald'}
          icon={
            isErrorMetrics ? (
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            )
          }
        />
      </div>
    </div>
  );
}
