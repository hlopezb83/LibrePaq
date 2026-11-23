import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileKey2,
  RefreshCw,
  ShieldAlert,
  XCircle
} from 'lucide-react';
import type { AdminSatHealthResponse } from '../../shared/admin-types';

export interface SuperAdminSatHealthTabProps {
  satHealth?: AdminSatHealthResponse;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const SAT_CODE_HINTS: Record<string, string> = {
  '5000': 'Solicitud recibida con éxito',
  '5001': 'Tercero no autorizado',
  '5002': 'Límite de solicitudes de por vida agotado',
  '5003': 'Tope máximo de registros superado',
  '5004': 'No se encontró información solicitada',
  '5005': 'Solicitud duplicada vigente',
  '301': 'XML mal formado o inválido',
  '305': 'Certificado e.firma inválido o revocado'
};

function formatDateTimeEsMx(iso?: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function getFielExpiryBadge(daysRemaining: number): { label: string; className: string } {
  if (daysRemaining <= 0) {
    return { label: `Vencida (${Math.abs(daysRemaining)}d)`, className: 'bg-red-100 text-red-900 border-red-300' };
  }
  if (daysRemaining <= 15) {
    return { label: `Crítico: ${daysRemaining}d`, className: 'bg-red-100 text-red-900 border-red-300' };
  }
  if (daysRemaining <= 30) {
    return { label: `Por vencer: ${daysRemaining}d`, className: 'bg-amber-100 text-amber-950 border-amber-300' };
  }
  return { label: `${daysRemaining}d restantes`, className: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
}

function getRequestStatusBadge(estado: string): string {
  const lower = estado.toLowerCase();
  if (lower.includes('termin') || lower.includes('complet') || lower === '3') {
    return 'bg-emerald-100 text-emerald-900 border-emerald-300';
  }
  if (lower.includes('error') || lower.includes('rechaz') || lower.includes('fall') || lower === '4' || lower === '5') {
    return 'bg-red-100 text-red-900 border-red-300';
  }
  return 'bg-amber-100 text-amber-950 border-amber-300';
}

export function SuperAdminSatHealthTab({
  satHealth,
  isLoading,
  isError = false,
  onRetry
}: SuperAdminSatHealthTabProps) {
  const formatCount = (value?: number) =>
    isLoading && value == null ? '...' : value != null ? value.toLocaleString('es-MX') : '—';

  const kpis = [
    { label: 'Solicitudes (7d)', value: formatCount(satHealth?.totalRequests7d), icon: Activity, boxClass: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Completadas', value: formatCount(satHealth?.completedRequests7d), icon: CheckCircle2, boxClass: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { label: 'Pendientes', value: formatCount(satHealth?.pendingRequests7d), icon: Clock, boxClass: 'bg-amber-50 border-amber-200 text-amber-800' },
    { label: 'Fallidas', value: formatCount(satHealth?.failedRequests7d), icon: XCircle, boxClass: 'bg-red-50 border-red-200 text-red-700' }
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-blue-600" aria-hidden="true" />
              Monitor de Salud SAT y Vigencia e.firma (FIEL)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Telemetría de descargas masivas CFDI (últimos 7 días) y alertas de vencimiento de certificados
              {satHealth?.checkedAtIso ? ` · Verificado: ${formatDateTimeEsMx(satHealth.checkedAtIso)}` : ''}
            </p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-800 border border-slate-300 text-xs font-bold transition cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isLoading ? 'Consultando...' : 'Actualizar Salud SAT'}
            </button>
          )}
        </div>

        {isError && (
          <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold">No se pudo cargar la telemetría de Salud SAT desde Supabase.</span>
            {onRetry && (
              <button type="button" onClick={onRetry} className="px-3 py-1 rounded-lg bg-white border border-red-300 text-red-800 font-bold hover:bg-red-100 cursor-pointer">
                Reintentar
              </button>
            )}
          </div>
        )}

        {isLoading && !satHealth && (
          <p role="status" className="text-xs text-slate-600">Analizando solicitudes SAT y certificados e.firma...</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{kpi.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${kpi.boxClass}`}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-1 space-y-2">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
            Desglose de Códigos de Respuesta SAT (7 días)
          </h3>
          {!satHealth?.errorCodeBreakdown || satHealth.errorCodeBreakdown.length === 0 ? (
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
              Sin códigos de error SAT registrados en los últimos 7 días.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {satHealth.errorCodeBreakdown.map((item) => (
                <div key={item.code} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs">
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-slate-900">Código {item.code}</p>
                    <p className="text-[11px] text-slate-600 truncate" title={SAT_CODE_HINTS[item.code] || ''}>
                      {SAT_CODE_HINTS[item.code] || 'Respuesta reportada por WebService SAT'}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-950 border border-amber-300 tabular-nums shrink-0">
                    {item.count.toLocaleString('es-MX')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileKey2 className="w-4 h-4 text-teal-700" aria-hidden="true" />
            Certificados e.firma (FIEL) Próximos a Vencer o Vencidos
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">Empresas que requieren renovación ante el SAT para no interrumpir descargas XML</p>
        </div>

        {!satHealth?.expiringFiels || satHealth.expiringFiels.length === 0 ? (
          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-4">
            No hay certificados e.firma vencidos o próximos a vencer registrados.
          </p>
        ) : (
          <div tabIndex={0} role="region" aria-label="Certificados e.firma próximos a vencer" className="overflow-x-auto max-h-[45vh] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40">
            <table className="w-full text-left text-xs border-separate border-spacing-0">
              <caption className="visually-hidden">Certificados e.firma próximos a vencer o vencidos por empresa</caption>
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Empresa / RFC</th>
                  <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">RFC Titular</th>
                  <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">No. Serie</th>
                  <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Vence</th>
                  <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">Vigencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {satHealth.expiringFiels.map((fiel) => {
                  const badge = getFielExpiryBadge(fiel.daysRemaining);
                  return (
                    <tr key={`${fiel.companyId}-${fiel.numeroSerie}`} className="hover:bg-slate-50/80">
                      <th scope="row" className="py-2.5 px-3.5 text-left font-normal">
                        <p className="font-bold text-slate-900">{fiel.companyName}</p>
                        <p className="font-mono text-[11px] text-slate-600">{fiel.companyRfc}</p>
                      </th>
                      <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700">{fiel.rfcTitular}</td>
                      <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700">{fiel.numeroSerie}</td>
                      <td className="py-2.5 px-3.5 text-slate-700">{formatDateTimeEsMx(fiel.validTo)}</td>
                      <td className="py-2.5 px-3.5 text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.className}`}>{badge.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Solicitudes de Descarga Masiva Recientes</h3>
          <p className="text-xs text-slate-600 mt-0.5">Últimas peticiones enviadas al WebService del SAT</p>
        </div>

        <div tabIndex={0} role="region" aria-label="Solicitudes SAT recientes" className="overflow-x-auto max-h-[55vh] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <caption className="visually-hidden">Solicitudes recientes al servicio de descarga masiva del SAT</caption>
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Empresa / RFC</th>
                <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Tipo</th>
                <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Estado</th>
                <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Código / Mensaje SAT</th>
                <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">CFDIs</th>
                <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {!satHealth?.recentRequests || satHealth.recentRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-600">
                    {isLoading ? 'Cargando solicitudes recientes...' : 'No hay solicitudes SAT recientes registradas.'}
                  </td>
                </tr>
              ) : (
                satHealth.recentRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80">
                    <th scope="row" className="py-2.5 px-3.5 text-left font-normal">
                      <p className="font-bold text-slate-900">{req.companyName}</p>
                      <p className="font-mono text-[11px] text-slate-600">{req.companyRfc}</p>
                    </th>
                    <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700">{req.tipoSolicitud}</td>
                    <td className="py-2.5 px-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${getRequestStatusBadge(req.estadoSolicitud)}`}>
                        {req.estadoSolicitud}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 max-w-xs">
                      <span className="font-mono font-bold text-slate-900 mr-1.5">{req.codigoEstadoSat || '—'}</span>
                      <span className="text-[11px] text-slate-700 line-clamp-2" title={req.mensajeSat}>
                        {req.mensajeSat || 'Sin mensaje adicional'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-semibold tabular-nums">{req.cfdisDescargados.toLocaleString('es-MX')}</td>
                    <td className="py-2.5 px-3.5 text-right text-slate-700 whitespace-nowrap">{formatDateTimeEsMx(req.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
