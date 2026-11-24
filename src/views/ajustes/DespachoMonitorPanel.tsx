import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import {
  fetchDespachoMonitorRows,
  type DespachoClientHealthRow,
  type FielTrafficLightStatus
} from '../../lib/supabase/supabase-despacho-monitor';
import type { Company } from '../../shared/types';
import { DespachoMonitorMobileList } from './DespachoMonitorMobileList';
import { DespachoMonitorTable } from './DespachoMonitorTable';

interface DespachoMonitorPanelProps {
  companies: Company[];
  activeCompanyId: string;
  onSelectCompany: (companyId: string, companyName: string, rfc: string) => void;
  onOpenEfirma?: () => void;
}

type TrafficFilter = 'ALL' | DespachoClientHealthRow['overallTrafficLight'];

const TRAFFIC_PRIORITY: Record<DespachoClientHealthRow['overallTrafficLight'], number> = {
  ROJO: 0,
  AMARILLO: 1,
  VERDE: 2
};

function renderFielBadge(status: FielTrafficLightStatus, daysRemaining: number | null) {
  if (status === 'VIGENTE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
        <KeyRound className="w-3 h-3 text-emerald-600" aria-hidden="true" />
        Vigente ({daysRemaining}d)
      </span>
    );
  }
  if (status === 'POR_VENCER') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-300">
        <AlertTriangle className="w-3 h-3 text-amber-600" aria-hidden="true" />
        Por vencer ({daysRemaining}d)
      </span>
    );
  }
  if (status === 'VENCIDA') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-800 border border-red-300">
        <ShieldAlert className="w-3 h-3 text-red-600" aria-hidden="true" />
        Vencida
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
      Sin FIEL
    </span>
  );
}

function renderOverallPill(status: DespachoClientHealthRow['overallTrafficLight']) {
  if (status === 'VERDE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
        <span className="w-2 h-2 rounded-full bg-emerald-600" aria-hidden="true" />
        Al día
      </span>
    );
  }
  if (status === 'AMARILLO') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
        <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
        Pendientes
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-900 border border-red-300">
      <span className="w-2 h-2 rounded-full bg-red-600" aria-hidden="true" />
      Críticas
    </span>
  );
}

export function DespachoMonitorPanel({
  companies,
  activeCompanyId,
  onSelectCompany,
  onOpenEfirma
}: DespachoMonitorPanelProps) {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<TrafficFilter>('ALL');
  const companyIdsKey = companies.map((c) => `${c.id}:${c.currentYear}:${c.currentPeriod}`).join('|');

  const { data: rows = [], isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['despacho-monitor', companyIdsKey],
    queryFn: () => fetchDespachoMonitorRows(companies),
    enabled: companies.length > 0,
    staleTime: 30_000
  });

  const sortedRows = [...rows].sort(
    (a, b) =>
      TRAFFIC_PRIORITY[a.overallTrafficLight] - TRAFFIC_PRIORITY[b.overallTrafficLight] ||
      a.companyName.localeCompare(b.companyName, 'es')
  );
  const filteredRows =
    statusFilter === 'ALL'
      ? sortedRows
      : sortedRows.filter((r) => r.overallTrafficLight === statusFilter);

  const verdeCount = rows.filter((r) => r.overallTrafficLight === 'VERDE').length;
  const amarilloCount = rows.filter((r) => r.overallTrafficLight === 'AMARILLO').length;
  const rojoCount = rows.filter((r) => r.overallTrafficLight === 'ROJO').length;

  const toggleFilter = (next: DespachoClientHealthRow['overallTrafficLight']) =>
    setStatusFilter((prev) => (prev === next ? 'ALL' : next));

  const handleDrillDown = (row: DespachoClientHealthRow, target: 'ADD' | 'DIA17' | 'EFIRMA') => {
    onSelectCompany(row.companyId, row.companyName, row.rfc);
    if (target === 'ADD') {
      void navigate({ to: '/add' });
    } else if (target === 'DIA17') {
      void navigate({ to: '/fiscal-bancos', search: { tab: 'DIA17' } as unknown as Record<string, string> });
    } else {
      onOpenEfirma?.();
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900">
            Tablero Semáforo Multi-Cliente del Despacho
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Cierre mensual, CFDIs por contabilizar, bancos, Día 17 y vigencia e.firma por RFC. Priorizado por urgencia.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
          <button
            type="button"
            aria-pressed={statusFilter === 'VERDE'}
            onClick={() => toggleFilter('VERDE')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
              statusFilter === 'VERDE'
                ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {verdeCount} Al día
          </button>
          <button
            type="button"
            aria-pressed={statusFilter === 'AMARILLO'}
            onClick={() => toggleFilter('AMARILLO')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
              statusFilter === 'AMARILLO'
                ? 'bg-amber-700 text-white border-amber-800 shadow-2xs'
                : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
            }`}
          >
            {amarilloCount} Pendientes
          </button>
          <button
            type="button"
            aria-pressed={statusFilter === 'ROJO'}
            onClick={() => toggleFilter('ROJO')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
              statusFilter === 'ROJO'
                ? 'bg-red-700 text-white border-red-800 shadow-2xs'
                : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
            }`}
          >
            {rojoCount} Críticas
          </button>
          <button
            type="button"
            disabled={isFetching}
            onClick={() => void refetch()}
            className="font-sans inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div role="status" aria-live="polite" aria-busy="true" className="p-8 text-center text-xs text-slate-600 space-y-2">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600 mx-auto" aria-hidden="true" />
          <p>Consolidando semáforo operativo de {companies.length} empresa(s)...</p>
        </div>
      ) : isError ? (
        <div role="alert" className="p-6 text-center text-xs text-red-800 space-y-3">
          <p className="font-semibold">No se pudo consolidar el tablero semáforo. Intenta actualizar nuevamente.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reintentar</span>
          </button>
        </div>
      ) : filteredRows.length === 0 ? (
        <div role="status" className="p-8 text-center text-xs text-slate-600 space-y-3">
          <p>
            {statusFilter === 'ALL'
              ? 'No hay empresas visibles para consolidar en el semáforo.'
              : 'No hay empresas con este nivel de alerta en el semáforo.'}
          </p>
          {statusFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className="inline-flex items-center px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold border border-blue-200 cursor-pointer"
            >
              Mostrar todas ({rows.length})
            </button>
          )}
        </div>
      ) : (
        <>
          <DespachoMonitorMobileList
            rows={filteredRows}
            activeCompanyId={activeCompanyId}
            onSelectCompany={onSelectCompany}
            onDrillDown={handleDrillDown}
            renderOverallPill={renderOverallPill}
            renderFielBadge={renderFielBadge}
          />
          <DespachoMonitorTable
            rows={filteredRows}
            activeCompanyId={activeCompanyId}
            onSelectCompany={onSelectCompany}
            onDrillDown={handleDrillDown}
            renderOverallPill={renderOverallPill}
            renderFielBadge={renderFielBadge}
          />
        </>
      )}
    </div>
  );
}
