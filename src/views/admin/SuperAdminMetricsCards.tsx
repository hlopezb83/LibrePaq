import type { ComponentType } from 'react';
import {
  Users,
  Building2,
  ReceiptText,
  FileCode2,
  ShieldCheck,
  ExternalLink,
  Activity,
  FileKey2,
  AlertTriangle,
  UserPlus,
  ArrowRight
} from 'lucide-react';
import type { AdminPlatformMetrics } from '../../shared/admin-types';

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
  icon: ComponentType<{ className?: string }>;
  accentClass: string;
  onAction?: () => void;
  actionHint?: string;
}

function formatSyncTime(iso?: string): string {
  if (!iso) return 'Sin sincronización reciente';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Sin sincronización reciente';
  return `Actualizado: ${parsed.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })}`;
}

function getSystemStatus(isError: boolean, isLoading: boolean, metrics?: AdminPlatformMetrics) {
  if (isError || metrics?.supabaseConnected === false) {
    return { label: 'Sin conexión', badgeClass: 'bg-red-500/20 text-red-200 border-red-400/50', dotClass: 'bg-red-400' };
  }
  if (isLoading && !metrics) {
    return { label: 'Verificando...', badgeClass: 'bg-slate-500/25 text-slate-200 border-slate-400/40', dotClass: 'bg-slate-300 animate-pulse' };
  }
  if ((metrics?.satErrors7d ?? 0) > 0) {
    return { label: 'Atención SAT', badgeClass: 'bg-amber-500/25 text-amber-200 border-amber-400/50', dotClass: 'bg-amber-400 animate-pulse' };
  }
  return { label: 'Sistemas Normales', badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40', dotClass: 'bg-emerald-400 animate-pulse' };
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

  const row1Cards: KpiCardItem[] = [
    {
      title: 'Usuarios',
      value: formatMetric(finalUsers),
      subtitle: metrics?.newUsers7d != null ? `+${metrics.newUsers7d.toLocaleString('es-MX')} últimos 7d` : 'Cuentas registradas en Supabase Auth',
      icon: Users,
      accentClass: 'bg-blue-50 border-blue-200 text-blue-700',
      onAction: onNavigateTab ? () => onNavigateTab('users') : undefined,
      actionHint: onNavigateTab ? 'Ver usuarios' : undefined
    },
    {
      title: 'Empresas',
      value: formatMetric(finalCompanies),
      subtitle: metrics?.activeCompaniesCount != null ? `${metrics.activeCompaniesCount.toLocaleString('es-MX')} activas` : 'Empresas fiscales registradas',
      icon: Building2,
      accentClass: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      onAction: onNavigateTab ? () => onNavigateTab('companies') : undefined,
      actionHint: onNavigateTab ? 'Ver empresas' : undefined
    },
    {
      title: 'Pólizas',
      value: formatMetric(metrics?.totalPolizas),
      subtitle: 'Asientos de diario, ingresos y egresos',
      icon: ReceiptText,
      accentClass: 'bg-indigo-50 border-indigo-200 text-indigo-700'
    },
    {
      title: 'CFDIs',
      value: formatMetric(metrics?.totalCfdis),
      subtitle: 'Comprobantes fiscales XML procesados',
      icon: FileCode2,
      accentClass: 'bg-purple-50 border-purple-200 text-purple-700'
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
      icon: Activity,
      accentClass: 'bg-cyan-50 border-cyan-200 text-cyan-800'
    },
    {
      title: 'Empresas con e.firma',
      value: formatMetric(metrics?.companiesWithFielCount),
      subtitle: 'Certificados FIEL vigentes o cargados',
      icon: FileKey2,
      accentClass: 'bg-teal-50 border-teal-200 text-teal-700',
      onAction: onNavigateFielCompanies,
      actionHint: onNavigateFielCompanies ? 'Ver con e.firma' : undefined
    },
    {
      title: 'Errores SAT 7d',
      value: formatMetric(metrics?.satErrors7d),
      subtitle: satErrors > 0 ? 'Solicitudes SAT con incidencia reciente' : 'Descargas masivas sin fallos críticos',
      icon: AlertTriangle,
      accentClass: satErrors > 0 ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-700',
      onAction: onNavigateTab ? () => onNavigateTab('sat') : undefined,
      actionHint: onNavigateTab ? 'Ver Salud SAT' : undefined
    },
    {
      title: 'Registros 30d',
      value: formatMetric(metrics?.newUsers30d),
      subtitle: 'Nuevas cuentas creadas en 30 días',
      icon: UserPlus,
      accentClass: 'bg-sky-50 border-sky-200 text-sky-700'
    }
  ];

  const renderCard = (card: KpiCardItem) => {
    const Icon = card.icon;
    const inner = (
      <>
        <div className="min-w-0 text-left">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{card.title}</p>
          <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{card.value}</p>
          <p className="text-[11px] text-slate-600 mt-0.5">{card.subtitle}</p>
          {card.actionHint && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 mt-1.5">
              {card.actionHint}
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </span>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${card.accentClass}`}>
          <Icon className="w-6 h-6" aria-hidden="true" />
        </div>
      </>
    );

    if (card.onAction) {
      return (
        <button
          key={card.title}
          type="button"
          onClick={card.onAction}
          aria-label={`${card.title}: ${card.value}. ${card.actionHint || 'Ir a la pestaña correspondiente'}`}
          className="w-full bg-white border border-slate-300/80 hover:border-blue-400 hover:shadow-sm rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {inner}
        </button>
      );
    }

    return (
      <div key={card.title} className="bg-white border border-slate-300/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3">
        {inner}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-900/60 rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-cyan-300 shrink-0">
            <ShieldCheck className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-white">Infraestructura Cloud en Producción</h2>
              <span role="status" className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusConfig.badgeClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`} aria-hidden="true" />
                {statusConfig.label}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              librepaq.com · Supabase PostgreSQL · Google Firebase Hosting · {formatSyncTime(metrics?.lastSyncIso)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-100 border border-white/15 transition cursor-pointer">
            Supabase Console
            <span className="visually-hidden"> (abre en nueva pestaña)</span>
            <ExternalLink className="w-3 h-3 text-slate-200" aria-hidden="true" />
          </a>
          <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-100 border border-white/15 transition cursor-pointer">
            Firebase Console
            <span className="visually-hidden"> (abre en nueva pestaña)</span>
            <ExternalLink className="w-3 h-3 text-slate-200" aria-hidden="true" />
          </a>
        </div>
      </div>

      {isError && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold">No se pudieron actualizar algunas métricas de la plataforma en Supabase.</span>
          {onRefresh && (
            <button type="button" onClick={onRefresh} className="px-3 py-1 rounded-lg bg-white border border-red-300 text-red-800 font-bold hover:bg-red-100 cursor-pointer">
              Reintentar
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{row1Cards.map(renderCard)}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{row2Cards.map(renderCard)}</div>
    </div>
  );
}
