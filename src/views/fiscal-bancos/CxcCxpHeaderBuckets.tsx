import { Clock, Wallet } from 'lucide-react';
import { KpiCard, TabBar } from '../../components/ui';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { CxcCxpAgingBucket } from '../../shared/types';
import type { BucketMeta } from './CxcCxpTable';

export type AgingMode = 'CXC' | 'CXP';

export interface CxcCxpHeaderBucketsProps {
  mode: AgingMode;
  onModeChange: (mode: AgingMode) => void;
  modeTabs: ReadonlyArray<{ id: AgingMode; label: string }>;
  asOfDate: string;
  hasCutoffToggle: boolean;
  usePeriodEndCutoff: boolean;
  onToggleCutoff: () => void;
  todayIso: string;
  periodEndIso?: string;
  bucketMeta: readonly BucketMeta[];
  bucketFilter: CxcCxpAgingBucket | null;
  onToggleBucket: (key: CxcCxpAgingBucket) => void;
  bucketCounts: Record<CxcCxpAgingBucket, number>;
  buckets: Record<CxcCxpAgingBucket, number>;
  totalInsoluto: number;
  itemsCount: number;
}

export function CxcCxpHeaderBuckets({
  mode,
  onModeChange,
  modeTabs,
  asOfDate,
  hasCutoffToggle,
  usePeriodEndCutoff,
  onToggleCutoff,
  todayIso,
  periodEndIso,
  bucketMeta,
  bucketFilter,
  onToggleBucket,
  bucketCounts,
  buckets,
  totalInsoluto,
  itemsCount
}: CxcCxpHeaderBucketsProps) {
  return (
    <>
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-300/90 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Control de Cartera PPD y Complementos de Pago 2.0</h2>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-600">Antigüedad de saldos insolutos al corte {formatShortDate(asOfDate)}</p>
              {hasCutoffToggle && periodEndIso && (
                <button
                  type="button"
                  onClick={onToggleCutoff}
                  className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                >
                  {usePeriodEndCutoff
                    ? `Usar corte hoy (${formatShortDate(todayIso)})`
                    : `Proyectar fin de periodo (${formatShortDate(periodEndIso)})`}
                </button>
              )}
            </div>
          </div>
        </div>

        <TabBar
          tabs={modeTabs}
          activeId={mode}
          onSelect={onModeChange}
          idPrefix="cxc-cxp-mode-"
          ariaLabel="Selector de cartera Cuentas por Cobrar o Cuentas por Pagar"
          panelId="cxc-cxp-panel"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {bucketMeta.map((b) => {
          const isActive = bucketFilter === b.key;
          const docCount = bucketCounts[b.key];
          return (
            <KpiCard
              key={b.key}
              label={b.label}
              value={formatCurrency(buckets[b.key])}
              active={isActive}
              onClick={() => onToggleBucket(b.key)}
              icon={<Clock className="w-3.5 h-3.5" aria-hidden="true" />}
              iconTone={isActive ? 'blue' : 'default'}
              hint={
                <span className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono text-slate-600">
                    {docCount} {docCount === 1 ? 'doc.' : 'docs.'}
                  </span>
                  {isActive && <span className="font-semibold text-blue-700">Filtro activo</span>}
                </span>
              }
              className="p-4 sm:p-4"
            />
          );
        })}

        <KpiCard
          tone="blue"
          label="Total Insoluto MXN"
          value={formatCurrency(totalInsoluto)}
          valueClassName="text-blue-900"
          hint={
            <span className="text-[11px] text-slate-700">
              {itemsCount} {itemsCount === 1 ? 'documento PPD' : 'documentos PPD'}
            </span>
          }
          className="sm:col-span-2 lg:col-span-1 p-4 sm:p-4"
        />
      </div>
    </>
  );
}
