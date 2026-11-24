import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Clock, FileCheck2, RefreshCw, Search, Wallet, X } from 'lucide-react';
import { handleTablistKeyDown } from '../../hooks/useTablistKeyboard';
import { apiClient } from '../../lib/api-client';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { CxcCxpAgingBucket, CxcCxpAgingResponse } from '../../shared/types';
import { CxcCxpTable, type BucketMeta } from './CxcCxpTable';

export interface CxcCxpTabProps {
  activeCompanyId: string;
}

type AgingMode = 'CXC' | 'CXP';
type CxcCxpApiClient = typeof apiClient & {
  getCxcCxpAging?: (companyId: string) => Promise<CxcCxpAgingResponse>;
};

const BUCKET_META: readonly BucketMeta[] = [
  { key: '0_30', label: '0–30 días', badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
  { key: '31_60', label: '31–60 días', badgeClass: 'bg-amber-50 text-amber-900 border-amber-200' },
  { key: '61_90', label: '61–90 días', badgeClass: 'bg-orange-50 text-orange-950 border-orange-300' },
  { key: '90_PLUS', label: '+90 días', badgeClass: 'bg-red-50 text-red-900 border-red-300' }
];

export function CxcCxpTab({ activeCompanyId }: CxcCxpTabProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AgingMode>('CXC');
  const [bucketFilter, setBucketFilter] = useState<CxcCxpAgingBucket | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setBucketFilter(null);
    setSearchQuery('');
    setExpandedIds(new Set());
  }, [activeCompanyId]);

  const { data, isLoading, isError, error, refetch } = useQuery<CxcCxpAgingResponse>({
    queryKey: ['cxc-cxp', activeCompanyId],
    queryFn: () => {
      const client = apiClient as CxcCxpApiClient;
      if (typeof client.getCxcCxpAging !== 'function') {
        throw new Error('El servicio de antigüedad de saldos CxC / CxP no está disponible temporalmente.');
      }
      return client.getCxcCxpAging(activeCompanyId);
    },
    enabled: Boolean(activeCompanyId)
  });

  const toggleExpanded = (cfdiId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cfdiId)) next.delete(cfdiId);
      else next.add(cfdiId);
      return next;
    });
  };

  const items = useMemo(
    () => (data ? (mode === 'CXC' ? data.cxcItems : data.cxpItems) : []),
    [data, mode]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((row) => {
      if (bucketFilter && row.bucket !== bucketFilter) return false;
      if (!q) return true;
      return (
        row.rfc.toLowerCase().includes(q) ||
        row.nombre.toLowerCase().includes(q) ||
        (row.serieFolio ?? '').toLowerCase().includes(q) ||
        row.uuid.toLowerCase().includes(q)
      );
    });
  }, [items, bucketFilter, searchQuery]);

  if (isError) {
    return (
      <div role="alert" className="p-8 text-center bg-white rounded-2xl border border-red-200 shadow-2xs space-y-4 max-w-lg mx-auto my-8">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 text-base">Error al consultar antigüedad de saldos PPD</h2>
          <p className="text-xs text-slate-600 mt-1">
            {error instanceof Error ? error.message : 'Error de conexión con el servidor contable.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reintentar consulta</span>
        </button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-600">
        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-blue-600" aria-hidden="true" />
        Calculando antigüedad de saldos CxC / CxP y complementos Pago 2.0...
      </div>
    );
  }

  const modeTabs: ReadonlyArray<{ id: AgingMode; label: string }> = [
    { id: 'CXC', label: `CxC — Emitidos PPD (${data.cxcItems.length})` },
    { id: 'CXP', label: `CxP — Recibidos PPD (${data.cxpItems.length})` }
  ];

  const handleModeChange = (nextMode: AgingMode) => {
    setMode(nextMode);
    setBucketFilter(null);
  };

  const bucketCounts = useMemo(() => {
    const counts: Record<CxcCxpAgingBucket, number> = { '0_30': 0, '31_60': 0, '61_90': 0, '90_PLUS': 0 };
    for (const row of items) {
      counts[row.bucket] = (counts[row.bucket] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const buckets = mode === 'CXC' ? data.cxcBuckets : data.cxpBuckets;
  const totalInsoluto = mode === 'CXC' ? data.cxcTotal : data.cxpTotal;
  const otherMode: AgingMode = mode === 'CXC' ? 'CXP' : 'CXC';
  const otherCount = mode === 'CXC' ? data.cxpItems.length : data.cxcItems.length;
  const hasFilters = bucketFilter !== null || searchQuery.trim() !== '';

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-300/90 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Control de Cartera PPD y Complementos de Pago 2.0</h2>
            <p className="text-xs text-slate-600">Antigüedad de saldos insolutos al corte {formatShortDate(data.asOfDate)}</p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Selector de cartera Cuentas por Cobrar o Cuentas por Pagar"
          className="erp-tab-scroller flex flex-nowrap items-center gap-1.5 min-w-0 max-w-full bg-slate-100 p-1 rounded-xl border border-slate-200"
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
                onClick={() => handleModeChange(t.id)}
                onKeyDown={(e) => handleTablistKeyDown(e, modeTabs, mode, handleModeChange, 'cxc-cxp-mode-')}
                className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
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
        {BUCKET_META.map((b) => {
          const isActive = bucketFilter === b.key;
          const docCount = bucketCounts[b.key];
          return (
            <button
              key={b.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => setBucketFilter((prev) => (prev === b.key ? null : b.key))}
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
            {items.length} {items.length === 1 ? 'documento PPD' : 'documentos PPD'}
          </span>
        </div>
      </div>

      <div id="cxc-cxp-panel" role="tabpanel" aria-labelledby={`cxc-cxp-mode-${mode}`} className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
        {items.length > 0 && (
          <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <label htmlFor="cxc-cxp-search" className="visually-hidden">
                Buscar por RFC, nombre, serie-folio o UUID
              </label>
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                id="cxc-cxp-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por RFC, razón social, serie-folio o UUID..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={() => { setBucketFilter(null); setSearchQuery(''); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer transition"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Limpiar filtros ({filteredItems.length}/{items.length})</span>
              </button>
            )}
          </div>
        )}

        {filteredItems.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <FileCheck2 className="w-9 h-9 text-emerald-600 mx-auto" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">
              {hasFilters
                ? 'Sin comprobantes PPD que coincidan con el filtro'
                : mode === 'CXC'
                  ? 'Sin facturas emitidas PPD con saldo pendiente'
                  : 'Sin facturas recibidas PPD con saldo pendiente'}
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              {hasFilters
                ? 'Ajusta los criterios de búsqueda o el rango de antigüedad seleccionado.'
                : 'No hay comprobantes con método de pago PPD en esta cartera o todos han sido liquidados con Complementos de Pago 2.0.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {hasFilters && (
                <button type="button" onClick={() => { setBucketFilter(null); setSearchQuery(''); }} className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition">
                  Limpiar filtros
                </button>
              )}
              {!hasFilters && otherCount > 0 && (
                <button type="button" onClick={() => setMode(otherMode)} className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition">
                  Ver {otherMode === 'CXP' ? 'Cuentas por Pagar (CxP)' : 'Cuentas por Cobrar (CxC)'} ({otherCount})
                </button>
              )}
              {!hasFilters && (
                <button type="button" onClick={() => void navigate({ to: '/add' })} className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold cursor-pointer transition">
                  Ir a Bóveda CFDI (ADD)
                </button>
              )}
            </div>
          </div>
        ) : (
          <CxcCxpTable
            mode={mode}
            items={filteredItems}
            bucketMeta={BUCKET_META}
            expandedIds={expandedIds}
            onToggleExpanded={toggleExpanded}
          />
        )}
      </div>
    </div>
  );
}
