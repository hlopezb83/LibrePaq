import { AlertTriangle, Bell, CheckCircle2, Info, Loader2, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import type {
  AdminPlatformAlert,
  PlatformAlertCategory,
  PlatformAlertSeverity,
  PlatformAlertStatus
} from '../../shared/admin-types';
import { formatAdminDateTime } from './adminFormatters';

export interface SuperAdminAlertsPanelProps {
  alerts: AdminPlatformAlert[];
  statusFilter: 'ALL' | PlatformAlertStatus;
  onStatusFilterChange: (s: 'ALL' | PlatformAlertStatus) => void;
  isLoading: boolean;
  isScanning: boolean;
  isMutatingId: string | null;
  onScan: () => void;
  onUpdateStatus: (alertId: string, status: PlatformAlertStatus) => void;
  onInspectCompanyRfc?: (rfc: string) => void;
  onInspectWorkspace?: (workspaceId: string) => void;
}

const FILTER_PILLS: ReadonlyArray<{ value: 'ALL' | PlatformAlertStatus; label: string }> = [
  { value: 'open', label: 'Abiertas' },
  { value: 'acknowledged', label: 'Reconocidas' },
  { value: 'resolved', label: 'Resueltas' },
  { value: 'ALL', label: 'Todas' }
];

const SEVERITY_META: Record<
  PlatformAlertSeverity,
  { label: string; badgeClass: string; icon: typeof ShieldAlert }
> = {
  critical: {
    label: 'Crítica',
    badgeClass: 'bg-red-100 text-red-900 border-red-300',
    icon: ShieldAlert
  },
  warning: {
    label: 'Preventiva',
    badgeClass: 'bg-amber-100 text-amber-950 border-amber-300',
    icon: AlertTriangle
  },
  info: {
    label: 'Info',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
    icon: Info
  }
};

const CATEGORY_LABELS: Record<PlatformAlertCategory, string> = {
  fiel_expiry: 'Vigencia e.firma (FIEL)',
  sat_error_spike: 'Errores WebService SAT',
  quota_limit: 'Límite de Cuota',
  system: 'Sistema'
};

function formatDateTimeEsMx(iso?: string | null): string {
  return formatAdminDateTime(iso);
}

export function SuperAdminAlertsPanel({
  alerts,
  statusFilter,
  onStatusFilterChange,
  isLoading,
  isScanning,
  isMutatingId,
  onScan,
  onUpdateStatus,
  onInspectCompanyRfc,
  onInspectWorkspace
}: SuperAdminAlertsPanelProps) {
  const visibleAlerts = statusFilter === 'ALL' ? alerts : alerts.filter((a) => a.status === statusFilter);

  return (
    <section
      aria-label="Alertas proactivas de plataforma"
      className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-600" aria-hidden="true" />
            Alertas Proactivas de Plataforma
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Detección temprana de certificados e.firma por vencer, picos de rechazo SAT y saturación de cuotas
          </p>
        </div>

        <button
          type="button"
          onClick={onScan}
          disabled={isScanning}
          aria-busy={isScanning}
          title={isScanning ? 'Escaneando salud de plataforma...' : 'Ejecutar escaneo proactivo de alertas SAT y cuotas'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold transition cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} aria-hidden="true" />
          {isScanning ? 'Escaneando...' : 'Escanear Ahora'}
        </button>
      </div>

      <div role="group" aria-label="Filtrar alertas por estado" className="flex flex-wrap items-center gap-2">
        {FILTER_PILLS.map((pill) => {
          const active = statusFilter === pill.value;
          return (
            <button
              key={pill.value}
              type="button"
              aria-pressed={active}
              onClick={() => onStatusFilterChange(pill.value)}
              className={`px-3 py-1 rounded-full text-xs font-bold border transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                active
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <ul role="status" aria-label="Cargando alertas operativas de la plataforma..." className="space-y-2.5">
          {[0, 1, 2].map((idx) => (
            <li key={idx} aria-hidden="true" className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-pulse motion-reduce:animate-none">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2"><div className="h-4 w-16 rounded-full bg-slate-200" /><div className="h-4 w-28 rounded bg-slate-200" /></div>
                <div className="h-3.5 w-2/3 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-200" />
              </div>
              <div className="flex items-center gap-1.5"><div className="h-7 w-20 rounded-lg bg-slate-200" /><div className="h-7 w-20 rounded-lg bg-slate-200" /></div>
            </li>
          ))}
        </ul>
      ) : visibleAlerts.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p>No hay alertas registradas para el filtro seleccionado.</p>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {statusFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => onStatusFilterChange('ALL')}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Ver todas las alertas
              </button>
            )}
            <button
              type="button"
              onClick={onScan}
              disabled={isScanning}
              aria-busy={isScanning}
              title={isScanning ? 'Escaneando salud de plataforma...' : 'Ejecutar escaneo proactivo de alertas'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isScanning ? 'Escaneando...' : 'Escanear plataforma'}
            </button>
          </div>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visibleAlerts.map((alert) => {
            const sev = SEVERITY_META[alert.severity];
            const SevIcon = sev.icon;
            const isBusy = isMutatingId === alert.id;
            const companyRfc =
              alert.targetType === 'company' && typeof alert.metadata?.rfc === 'string'
                ? alert.metadata.rfc.trim()
                : '';
            const workspaceId =
              alert.targetType === 'workspace'
                ? alert.targetId?.trim() || (typeof alert.metadata?.workspaceId === 'string' ? alert.metadata.workspaceId.trim() : '')
                : '';

            return (
              <li
                key={alert.id}
                className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${sev.badgeClass}`}
                    >
                      <SevIcon className="w-3 h-3" aria-hidden="true" />
                      {sev.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                      {CATEGORY_LABELS[alert.category]}
                    </span>
                    <span className="font-mono text-[11px] text-slate-600">{alert.code}</span>
                  </div>

                  <p className="text-xs font-bold text-slate-900">{alert.title}</p>
                  <p className="text-xs text-slate-700">{alert.message}</p>
                  <p className="text-[11px] text-slate-600">
                    Detectada: {formatDateTimeEsMx(alert.detectedAt)}
                    {alert.resolvedAt ? ` · Resuelta: ${formatDateTimeEsMx(alert.resolvedAt)}` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {onInspectCompanyRfc && companyRfc && (
                    <button
                      type="button"
                      onClick={() => onInspectCompanyRfc(companyRfc)}
                      aria-label={`Ver empresa ${companyRfc} en directorio`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      Ver empresa
                    </button>
                  )}
                  {onInspectWorkspace && workspaceId && (
                    <button
                      type="button"
                      onClick={() => onInspectWorkspace(workspaceId)}
                      aria-label={`Ver despacho ${workspaceId} en usuarios`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      Ver despacho
                    </button>
                  )}

                  {alert.status === 'open' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      aria-busy={isBusy}
                      title={isBusy ? 'Actualizando alerta...' : 'Marcar alerta como reconocida'}
                      onClick={() => onUpdateStatus(alert.id, 'acknowledged')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed text-amber-950 border border-amber-300 text-xs font-bold transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                      Reconocer<span className="visually-hidden"> alerta {alert.title}</span>
                    </button>
                  )}

                  {alert.status !== 'resolved' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      aria-busy={isBusy}
                      title={isBusy ? 'Actualizando alerta...' : 'Marcar alerta como resuelta'}
                      onClick={() => onUpdateStatus(alert.id, 'resolved')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-950 border border-emerald-300 text-xs font-bold transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      Resolver<span className="visually-hidden"> alerta {alert.title}</span>
                    </button>
                  )}

                  {alert.status !== 'open' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      aria-busy={isBusy}
                      title={isBusy ? 'Actualizando alerta...' : 'Reabrir alerta para seguimiento'}
                      onClick={() => onUpdateStatus(alert.id, 'open')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 border border-slate-300 text-xs font-bold transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      Reabrir<span className="visually-hidden"> alerta {alert.title}</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
