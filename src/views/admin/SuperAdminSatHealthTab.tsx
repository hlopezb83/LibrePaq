import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import type { AdminPlatformAlert, AdminSatHealthResponse, PlatformAlertStatus } from '../../shared/admin-types';
import { AdminErrorBanner } from './AdminErrorBanner';
import { AdminSatFielTable } from './AdminSatFielTable';
import { AdminSatRequestsTable } from './AdminSatRequestsTable';
import { formatAdminDateTime } from './adminFormatters';
import { SuperAdminAlertsPanel } from './SuperAdminAlertsPanel';

export interface SuperAdminSatHealthTabProps {
  satHealth?: AdminSatHealthResponse;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  alerts?: AdminPlatformAlert[];
  alertsStatusFilter?: 'ALL' | PlatformAlertStatus;
  onAlertsStatusFilterChange?: (next: 'ALL' | PlatformAlertStatus) => void;
  loadingAlerts?: boolean;
  scanningAlerts?: boolean;
  mutatingAlertId?: string | null;
  onScanAlerts?: () => void;
  onUpdateAlertStatus?: (alertId: string, status: PlatformAlertStatus) => void;
  onInspectCompanyRfc?: (rfc: string) => void;
  onInspectWorkspace?: (workspaceId: string) => void;
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

export function SuperAdminSatHealthTab({
  satHealth,
  isLoading,
  isError = false,
  onRetry,
  alerts = [],
  alertsStatusFilter = 'open',
  onAlertsStatusFilterChange,
  loadingAlerts = false,
  scanningAlerts = false,
  mutatingAlertId = null,
  onScanAlerts,
  onUpdateAlertStatus,
  onInspectCompanyRfc,
  onInspectWorkspace
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
      {onAlertsStatusFilterChange && onScanAlerts && onUpdateAlertStatus && (
        <SuperAdminAlertsPanel
          alerts={alerts}
          statusFilter={alertsStatusFilter}
          onStatusFilterChange={onAlertsStatusFilterChange}
          isLoading={loadingAlerts}
          isScanning={scanningAlerts}
          isMutatingId={mutatingAlertId}
          onScan={onScanAlerts}
          onUpdateStatus={onUpdateAlertStatus}
          onInspectCompanyRfc={onInspectCompanyRfc}
          onInspectWorkspace={onInspectWorkspace}
        />
      )}
      <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-blue-600" aria-hidden="true" />
              Monitor de Salud SAT y Vigencia e.firma (FIEL)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Telemetría de descargas masivas CFDI (últimos 7 días) y alertas de vencimiento de certificados
              {satHealth?.checkedAtIso ? ` · Verificado: ${formatAdminDateTime(satHealth.checkedAtIso)}` : ''}
            </p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isLoading}
              aria-busy={isLoading}
              title={isLoading ? 'Consultando telemetría SAT...' : 'Actualizar telemetría de salud SAT'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed text-slate-800 border border-slate-300 text-xs font-bold transition cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isLoading ? 'Consultando...' : 'Actualizar Salud SAT'}
            </button>
          )}
        </div>

        {isError && (
          <AdminErrorBanner
            message="No se pudo cargar la telemetría de Salud SAT desde Supabase."
            onRetry={onRetry}
          />
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

      <AdminSatFielTable expiringFiels={satHealth?.expiringFiels} onInspectCompanyRfc={onInspectCompanyRfc} />
      <AdminSatRequestsTable recentRequests={satHealth?.recentRequests} isLoading={isLoading} onInspectCompanyRfc={onInspectCompanyRfc} />
    </div>
  );
}
