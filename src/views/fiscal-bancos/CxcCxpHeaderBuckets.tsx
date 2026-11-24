import { Clock, Wallet } from 'lucide-react';
import { handleTablistKeyDown } from '../../hooks/useTablistKeyboard';
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
                  {usePeriodEndCutoff ? `Usar corte hoy (${formatShortDate(todayIso)})` : `Proyectar fin de periodo (${formatShortDate(periodEndIso)})`}
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Selector de cartera Cuentas por Cobrar o Cuentas por Pagar"
          className="grid grid-cols-2 w-full sm:w-auto items-center gap-1 min-w-0 bg-slate-100 p-1 rounded-xl border border-slate-200"
        >
          {modeTabs.map((t) => {
            const selected = mode === t.id;
            return (
              <button
                key={t.id}
                id={`cxc-cxp-mode-${t.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="cxc-cxp-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => onModeChange(t.id)}
                onKeyDown={(e) => handleTablistKeyDown(e, modeTabs, mode, onModeChange, 'cxc-cxp-mode-')}
                className={`min-w-0 truncate px-3 py-1.5 rounded-lg text-xs font-semibold text-center transition cursor-pointer ${
                  selected ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-white hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {bucketMeta.map((b) => {
          const isActive = bucketFilter === b.key;
          const docCount = bucketCounts[b.key];
          return (
            <button
              key={b.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => onToggleBucket(b.key)}
              title={isActive ? `Quitar filtro ${b.label}` : `Filtrar documentos de ${b.label}`}
              className={`text-left bg-white p-4 rounded-2xl border shadow-2xs cursor-pointer transition min-w-0 ${
                isActive
                  ? 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/30'
                  : 'border-slate-300/90 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase text-slate-600">{b.label}</span>
                <Clock className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} aria-hidden="true" />
              </div>
              <div className="mt-1.5 text-base font-bold font-mono text-slate-900 tabular-nums">
                {formatCurrency(buckets[b.key])}
              </div>
              <div className="mt-0.5 flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-mono">
                  {docCount} {docCount === 1 ? 'doc.' : 'docs.'}
                </span>
                {isActive && <span className="font-semibold text-blue-700">Filtro activo</span>}
              </div>
            </button>
          );
        })}
        <div className="sm:col-span-2 lg:col-span-1 bg-[#0A1120] text-white p-4 rounded-2xl border border-[#1E293B] shadow-2xs min-w-0">
          <span className="text-[11px] font-bold uppercase text-blue-200 block">Total Insoluto MXN</span>
          <div className="mt-1.5 text-lg font-extrabold font-mono text-emerald-300 tabular-nums">
            {formatCurrency(totalInsoluto)}
          </div>
          <span className="text-[11px] text-slate-300">
            {itemsCount} {itemsCount === 1 ? 'documento PPD' : 'documentos PPD'}
          </span>
        </div>
      </div>
    </>
  );
}
