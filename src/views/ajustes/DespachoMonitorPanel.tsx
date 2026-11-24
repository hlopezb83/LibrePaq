import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Landmark,
  Lock,
  LockOpen,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import {
  fetchDespachoMonitorRows,
  type DespachoClientHealthRow,
  type FielTrafficLightStatus
} from '../../lib/supabase/supabase-despacho-monitor';
import type { Company } from '../../shared/types';

interface DespachoMonitorPanelProps {
  companies: Company[];
  activeCompanyId: string;
  onSelectCompany: (companyId: string, companyName: string, rfc: string) => void;
}

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
      Atención
    </span>
  );
}

export function DespachoMonitorPanel({
  companies,
  activeCompanyId,
  onSelectCompany
}: DespachoMonitorPanelProps) {
  const companyIdsKey = companies.map((c) => `${c.id}:${c.currentYear}:${c.currentPeriod}`).join('|');

  const { data: rows = [], isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['despacho-monitor', companyIdsKey],
    queryFn: () => fetchDespachoMonitorRows(companies),
    enabled: companies.length > 0,
    staleTime: 30_000
  });

  const verdeCount = rows.filter((r) => r.overallTrafficLight === 'VERDE').length;
  const amarilloCount = rows.filter((r) => r.overallTrafficLight === 'AMARILLO').length;
  const rojoCount = rows.filter((r) => r.overallTrafficLight === 'ROJO').length;

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900">
            Tablero Semáforo Multi-Cliente del Despacho
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Cierre mensual, CFDIs por contabilizar, bancos, Día 17 y vigencia e.firma por RFC. Haz clic en una fila para conmutar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            {verdeCount} Al día
          </span>
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
            {amarilloCount} Pendientes
          </span>
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-800 border border-red-200">
            {rojoCount} Críticas
          </span>
          <button
            type="button"
            disabled={isFetching}
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div role="status" className="p-8 text-center text-xs text-slate-600">
          Consolidando semáforo operativo de {companies.length} empresa(s)...
        </div>
      ) : isError ? (
        <div role="alert" className="p-6 text-center text-xs text-red-700">
          No se pudo consolidar el tablero semáforo. Intenta actualizar nuevamente.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th scope="col" className="py-3 px-4">Empresa / RFC</th>
                <th scope="col" className="py-3 px-3">Periodo / Candado</th>
                <th scope="col" className="py-3 px-3 text-center">CFDIs Pend.</th>
                <th scope="col" className="py-3 px-3 text-center">Bancos Pend.</th>
                <th scope="col" className="py-3 px-3">Día 17 / DIOT</th>
                <th scope="col" className="py-3 px-3">e.firma SAT</th>
                <th scope="col" className="py-3 px-3 text-center">Semáforo</th>
                <th scope="col" className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => {
                const isActive = row.companyId === activeCompanyId;
                return (
                  <tr
                    key={row.companyId}
                    onClick={() => onSelectCompany(row.companyId, row.companyName, row.rfc)}
                    className={`cursor-pointer transition-colors ${
                      isActive ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{row.companyName}</span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                            Activa
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-slate-600">{row.rfc}</div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="font-bold text-slate-800">
                          P{String(row.periodo).padStart(2, '0')}/{row.ejercicio}
                        </span>
                        {row.periodLockStatus === 'BLOQUEADO_SAT' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                            <Lock className="w-3 h-3" aria-hidden="true" />
                            Bloqueado SAT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-semibold">
                            <LockOpen className="w-3 h-3" aria-hidden="true" />
                            Abierto
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold ${
                          row.pendingCfdisCount === 0
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {row.pendingCfdisCount}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${
                          row.pendingBankLinesCount === 0
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        <Landmark className="w-3 h-3" aria-hidden="true" />
                        {row.pendingBankLinesCount}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {row.dia17Ready ? (
                        <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                          Listo ({formatCurrency(row.ivaNetoAPagar)} IVA)
                        </span>
                      ) : (
                        <span className="text-amber-800 font-medium">
                          {row.hasSavedTaxParams ? 'Sin cálculo del periodo' : 'Faltan parámetros'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {renderFielBadge(row.fielStatus, row.fielDaysRemaining)}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {renderOverallPill(row.overallTrafficLight)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCompany(row.companyId, row.companyName, row.rfc);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 cursor-pointer"
                      >
                        <span>{isActive ? 'En uso' : 'Abrir'}</span>
                        <ArrowRight className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
