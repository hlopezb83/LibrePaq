import type { ReactNode } from 'react';
import {
  Users, Building2, ReceiptText, FileCode2, ShieldCheck, ExternalLink,
  Activity, FileKey2, AlertTriangle, UserPlus, ArrowRight
} from 'lucide-react';
import { KpiCard, StatusBadge, getButtonClasses, type BadgeTone, type KpiTone } from '../../components/ui';
import type { AdminPlatformMetrics } from '../../shared/admin-types';
import { AdminErrorBanner } from './AdminErrorBanner';
import { formatAdminTime } from './adminFormatters';

type AdminNavTab = 'metrics' | 'users' | 'companies' | 'ads' | 'sat' | 'broadcast' | 'audit';

export interface SuperAdminMetricsCardsProps {
  metrics?: AdminPlatformMetrics;
  usersCount?: number;
  companiesCount?: number;
  isLoading: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isError?: boolean;
  onNavigateTab?: (tab: AdminNavTab) => void;
  onNavigateFielCompanies?: () => void;
}

interface KpiCardItem {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  iconTone: KpiTone;
  tone?: KpiTone;
  onAction?: () => void;
  actionHint?: string;
}

function getSystemStatus(isError: boolean, isLoading: boolean, metrics?: AdminPlatformMetrics): { label: string; tone: BadgeTone } {
  if (isError || metrics?.supabaseConnected === false) {
    return { label: 'Sin conexión', tone: 'red' };
  }
  if (isLoading && !metrics) {
    return { label: 'Verificando...', tone: 'slate' };
  }
  if ((metrics?.satErrors7d ?? 0) > 0) {
    return { label: 'Atención SAT', tone: 'amber' };
  }
  return { label: 'Sistemas Normales', tone: 'emerald' };
}

export function SuperAdminMetricsCards({
  metrics,
  usersCount,
  companiesCount,
  isLoading,
  onRefresh,
  isError = false,
  onNavigateTab,
  onNavigateFielCompanies
}: SuperAdminMetricsCardsProps) {
  const finalUsers = usersCount ?? metrics?.totalUsers;
  const finalCompanies = companiesCount ?? metrics?.totalCompanies;
  const formatMetric = (val?: number | null) =>
    isLoading && val == null ? '...' : val != null ? val.toLocaleString('es-MX') : '—';

  const satErrors = metrics?.satErrors7d ?? 0;
  const statusConfig = getSystemStatus(isError, isLoading, metrics);
  const denomCompanies = metrics?.totalCompanies ?? finalCompanies ?? 0;
  const activationPct =
    denomCompanies > 0 && metrics?.activeCompaniesCount != null
      ? Math.min(100, Math.round((metrics.activeCompaniesCount / denomCompanies) * 100))
      : null;
  const syncTime = formatAdminTime(metrics?.lastSyncIso);

  const row1Cards: KpiCardItem[] = [
    {
      title: 'Usuarios',
      value: formatMetric(finalUsers),
      subtitle: metrics?.newUsers7d != null ? `+${metrics.newUsers7d.toLocaleString('es-MX')} últimos 7d` : 'Cuentas registradas en Supabase Auth',
      icon: <Users className="w-4 h-4" aria-hidden="true" />,
      iconTone: 'blue',
      onAction: onNavigateTab ? () => onNavigateTab('users') : undefined,
      actionHint: onNavigateTab ? 'Ver usuarios' : undefined
    },
    {
      title: 'Empresas',
      value: formatMetric(finalCompanies),
      subtitle: metrics?.activeCompaniesCount != null ? `${metrics.activeCompaniesCount.toLocaleString('es-MX')} activas` : 'Empresas fiscales registradas',
      icon: <Building2 className="w-4 h-4" aria-hidden="true" />,
      iconTone: 'emerald',
      onAction: onNavigateTab ? () => onNavigateTab('companies') : undefined,
      actionHint: onNavigateTab ? 'Ver empresas' : undefined
    },
    {
      title: 'Pólizas',
      value: formatMetric(metrics?.totalPolizas),
      subtitle: 'Asientos de diario, ingresos y egresos',
      icon: <ReceiptText className="w-4 h-4" aria-hidden="true" />,
      iconTone: 'blue'
    },
    {
      title: 'CFDIs',
      value: formatMetric(metrics?.totalCfdis),
      subtitle: 'Comprobantes fiscales XML procesados',
      icon: <FileCode2 className="w-4 h-4" aria-hidden="true" />,
      iconTone: 'default'
    }
  ];

  const row2Cards: KpiCardItem[] = [
    {
      title: 'Tasa de Activación',
      value: isLoading && activationPct == null ? '...' : activationPct != null ? `${activationPct}%` : '—',
      subtitle:
        metrics?.activeCompaniesCount != null
          ? `${metrics.activeCompaniesCount.toLocaleString('es-MX')} de ${denomCompanies.toLocaleString('es-MX')} con operación`
          : 'Empresas con movimiento contable',
      icon: <Activity className="w-4 h-4" aria-hidden="true" />,
      iconTone: 'blue'
    },
    {
      title: 'Empresas con e.firma',
      value: formatMetric(metrics?.companiesWithFielCount),
      subtitle: 'Certificados FIEL vigentes o cargados',
      icon: <FileKey2 className="w-4 h-4" aria-hidden="true" />,
      iconTone: 'emerald',
      onAction: onNavigateFielCompanies,
      actionHint: onNavigateFielCompanies ? 'Ver con e.firma' : undefined
    },
    {
      title: 'Errores SAT 7d',
      value: formatMetric(metrics?.satErrors7d),
      subtitle: satErrors > 0 ? 'Solicitudes SAT con incidencia reciente' : 'Descargas masivas sin fallos críticos',
      icon: <AlertTriangle className="w-4 h-4" aria-hidden="true" />,
      iconTone: satErrors > 0 ? 'amber' : 'default',
      tone: satErrors > 0 ? 'amber' : 'default',
      onAction: onNavigateTab ? () => onNavigateTab('sat') : undefined,
      actionHint: onNavigateTab ? 'Ver Salud SAT' : undefined
    },
    {
      title: 'Registros 30d',
      value: formatMetric(metrics?.newUsers30d),
      subtitle: 'Nuevas cuentas creadas en 30 días',
      icon: <UserPlus className="w-4 h-4" aria-hidden="true" />,
      iconTone: 'blue'
    }
  ];

  const renderCard = (card: KpiCardItem) => (
    <KpiCard
      key={card.title}
      label={card.title}
      value={card.value}
      icon={card.icon}
      iconTone={card.iconTone}
      tone={card.tone}
      hint={card.subtitle}
      onClick={card.onAction}
      footer={
        card.actionHint ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700">
            {card.actionHint}
            <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </span>
        ) : undefined
      }
    />
  );

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-300/90 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">Infraestructura Cloud en Producción</h2>
              <StatusBadge tone={statusConfig.tone} dot>
                {statusConfig.label}
              </StatusBadge>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 font-mono tabular-nums">
              librepaq.com · Supabase PostgreSQL · Firebase Hosting · {syncTime ? `Actualizado: ${syncTime}` : 'Sin sincronización reciente'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className={getButtonClasses('secondary', 'sm')}
          >
            Supabase Console
            <span className="visually-hidden"> (abre en nueva pestaña)</span>
            <ExternalLink className="w-3 h-3 text-slate-500" aria-hidden="true" />
          </a>
          <a
            href="https://console.firebase.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className={getButtonClasses('secondary', 'sm')}
          >
            Firebase Console
            <span className="visually-hidden"> (abre en nueva pestaña)</span>
            <ExternalLink className="w-3 h-3 text-slate-500" aria-hidden="true" />
          </a>
        </div>
      </div>

      {isError && (
        <AdminErrorBanner
          message="No se pudieron actualizar algunas métricas de la plataforma en Supabase."
          onRetry={onRefresh}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{row1Cards.map(renderCard)}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{row2Cards.map(renderCard)}</div>
    </div>
  );
}
