import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Download, FileCheck2, RefreshCw } from 'lucide-react';
import { Button, ClearFiltersButton, EmptyState, SearchInput } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import { downloadCsvFile } from '../../lib/formatters';
import { getLastDateForPeriod, getTodayLocalIso } from '../../shared/date-utils';
import type { CxcCxpAgingBucket, CxcCxpAgingResponse } from '../../shared/types';
import { CxcCxpHeaderBuckets, type AgingMode } from './CxcCxpHeaderBuckets';
import { CxcCxpTable, type BucketMeta } from './CxcCxpTable';

export interface CxcCxpTabProps {
  activeCompanyId: string;
  currentYear?: number;
  currentPeriod?: number;
}

type CxcCxpApiClient = typeof apiClient & {
  getCxcCxpAging?: (companyId: string, asOfIso?: string) => Promise<CxcCxpAgingResponse>;
};

const BUCKET_META: readonly BucketMeta[] = [
  { key: '0_30', label: '0–30 días', badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
  { key: '31_60', label: '31–60 días', badgeClass: 'bg-amber-50 text-amber-900 border-amber-200' },
  { key: '61_90', label: '61–90 días', badgeClass: 'bg-orange-50 text-orange-950 border-orange-300' },
  { key: '90_PLUS', label: '+90 días', badgeClass: 'bg-red-50 text-red-900 border-red-300' }
];

export function CxcCxpTab({ activeCompanyId, currentYear, currentPeriod }: CxcCxpTabProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<AgingMode>('CXC');
  const [bucketFilter, setBucketFilter] = useState<CxcCxpAgingBucket | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [usePeriodEndCutoff, setUsePeriodEndCutoff] = useState(false);

  const todayIso = useMemo(() => getTodayLocalIso(), []);
  const periodEndIso = useMemo(
    () => (currentYear && currentPeriod ? getLastDateForPeriod(currentYear, currentPeriod) : undefined),
    [currentYear, currentPeriod]
  );
  const hasCutoffToggle = Boolean(periodEndIso && todayIso < periodEndIso);
  const asOfIso = useMemo(() => {
    if (!periodEndIso) return todayIso;
    if (!hasCutoffToggle) return periodEndIso;
    return usePeriodEndCutoff ? periodEndIso : todayIso;
  }, [periodEndIso, todayIso, hasCutoffToggle, usePeriodEndCutoff]);

  useEffect(() => {
    setBucketFilter(null);
    setSearchQuery('');
    setExpandedIds(new Set());
  }, [activeCompanyId, asOfIso]);

  useEffect(() => {
    setUsePeriodEndCutoff(false);
  }, [activeCompanyId, currentYear, currentPeriod]);

  const { data, isLoading, isError, error, refetch } = useQuery<CxcCxpAgingResponse>({
    queryKey: ['cxc-cxp', activeCompanyId, asOfIso ?? 'today'],
    queryFn: () => {
      const client = apiClient as CxcCxpApiClient;
      if (typeof client.getCxcCxpAging !== 'function') {
        throw new Error('El servicio de antigüedad de saldos CxC / CxP no está disponible temporalmente.');
      }
      return client.getCxcCxpAging(activeCompanyId, asOfIso);
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

  const bucketCounts = useMemo(() => {
    const counts: Record<CxcCxpAgingBucket, number> = { '0_30': 0, '31_60': 0, '61_90': 0, '90_PLUS': 0 };
    for (const row of items) {
      counts[row.bucket] = (counts[row.bucket] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  if (isError) {
    return (
      <div role="alert" className="max-w-lg mx-auto my-8">
        <EmptyState
          variant="card"
          tone="red"
          icon={<AlertCircle className="w-6 h-6" aria-hidden="true" />}
          title="Error al consultar antigüedad de saldos PPD"
          description={error instanceof Error ? error.message : 'Error de conexión con el servidor contable.'}
          actions={
            <Button variant="primary" onClick={() => void refetch()} leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}>
              Reintentar consulta
            </Button>
          }
        />
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
    { id: 'CXC', label: `CxC PPD (${data.cxcItems.length})` },
    { id: 'CXP', label: `CxP PPD (${data.cxpItems.length})` }
  ];

  const handleModeChange = (nextMode: AgingMode) => {
    setMode(nextMode);
    setBucketFilter(null);
  };

  const handleExportCsv = () => {
    const bucketLabelMap = Object.fromEntries(BUCKET_META.map((b) => [b.key, b.label])) as Record<CxcCxpAgingBucket, string>;
    const headers = ['Cartera', 'RFC', 'RazonSocial', 'SerieFolio', 'UUID', 'Fecha', 'Moneda', 'TotalMXN', 'PagadoMXN', 'SaldoInsolutoMXN', 'DiasAntiguedad', 'Rango'];
    const rows = filteredItems.map((r) => [
      mode, r.rfc, r.nombre, r.serieFolio, r.uuid, r.fecha, r.moneda,
      r.totalOriginalMxn.toFixed(2), r.totalPagadoMxn.toFixed(2), r.saldoInsolutoMxn.toFixed(2),
      r.daysPast, bucketLabelMap[r.bucket] ?? r.bucket
    ]);
    downloadCsvFile(`Antiguedad_${mode}_${data.asOfDate}.csv`, headers, rows);
    toast.success(`Cartera ${mode} exportada en CSV (${filteredItems.length} registros).`);
  };

  const buckets = mode === 'CXC' ? data.cxcBuckets : data.cxpBuckets;
  const totalInsoluto = mode === 'CXC' ? data.cxcTotal : data.cxpTotal;
  const otherMode: AgingMode = mode === 'CXC' ? 'CXP' : 'CXC';
  const otherCount = mode === 'CXC' ? data.cxpItems.length : data.cxcItems.length;
  const hasFilters = bucketFilter !== null || searchQuery.trim() !== '';

  return (
    <div className="space-y-4">
      <CxcCxpHeaderBuckets
        mode={mode}
        onModeChange={handleModeChange}
        modeTabs={modeTabs}
        asOfDate={data.asOfDate}
        hasCutoffToggle={hasCutoffToggle}
        usePeriodEndCutoff={usePeriodEndCutoff}
        onToggleCutoff={() => setUsePeriodEndCutoff((prev) => !prev)}
        todayIso={todayIso}
        periodEndIso={periodEndIso}
        bucketMeta={BUCKET_META}
        bucketFilter={bucketFilter}
        onToggleBucket={(key) => setBucketFilter((prev) => (prev === key ? null : key))}
        bucketCounts={bucketCounts}
        buckets={buckets}
        totalInsoluto={totalInsoluto}
        itemsCount={items.length}
      />

      <div id="cxc-cxp-panel" role="tabpanel" aria-labelledby={`cxc-cxp-mode-${mode}`} className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
        {items.length > 0 && (
          <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
            <div className="flex-1 min-w-[220px] max-w-md">
              <label htmlFor="cxc-cxp-search" className="visually-hidden">
                Buscar por RFC, nombre, serie-folio o UUID
              </label>
              <SearchInput
                id="cxc-cxp-search"
                size="sm"
                value={searchQuery}
                onChange={setSearchQuery}
                clearLabel="Limpiar búsqueda de cartera"
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && searchQuery) {
                    e.preventDefault();
                    setSearchQuery('');
                  }
                }}
                placeholder="Buscar por RFC, razón social, serie-folio o UUID..."
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasFilters && (
                <ClearFiltersButton
                  onClick={() => { setBucketFilter(null); setSearchQuery(''); }}
                  label={`Limpiar filtros (${filteredItems.length}/${items.length})`}
                />
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={handleExportCsv}
                disabled={filteredItems.length === 0}
                title={filteredItems.length === 0 ? 'Sin registros filtrados para exportar' : 'Exportar cartera filtrada a CSV / Excel'}
                leftIcon={<Download className="w-3.5 h-3.5" aria-hidden="true" />}
              >
                Exportar CSV / Excel
              </Button>
            </div>
          </div>
        )}

        {filteredItems.length === 0 ? (
          <EmptyState
            icon={<FileCheck2 className="w-6 h-6" aria-hidden="true" />}
            tone="emerald"
            title={
              hasFilters
                ? 'Sin comprobantes PPD que coincidan con el filtro'
                : mode === 'CXC'
                  ? 'Sin facturas emitidas PPD con saldo pendiente'
                  : 'Sin facturas recibidas PPD con saldo pendiente'
            }
            description={
              hasFilters
                ? 'Ajusta los criterios de búsqueda o el rango de antigüedad seleccionado.'
                : 'No hay comprobantes con método de pago PPD en esta cartera o todos han sido liquidados con Complementos de Pago 2.0.'
            }
            actions={
              <>
                {hasFilters && (
                  <ClearFiltersButton onClick={() => { setBucketFilter(null); setSearchQuery(''); }} />
                )}
                {!hasFilters && otherCount > 0 && (
                  <Button size="sm" variant="primary" onClick={() => setMode(otherMode)}>
                    Ver {otherMode === 'CXP' ? 'Cuentas por Pagar (CxP)' : 'Cuentas por Cobrar (CxC)'} ({otherCount})
                  </Button>
                )}
                {!hasFilters && (
                  <Button size="sm" variant="secondary" onClick={() => void navigate({ to: '/add' })}>
                    Ir a Bóveda CFDI (ADD)
                  </Button>
                )}
              </>
            }
          />
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
