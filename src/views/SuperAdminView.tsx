import { useEffect, type ComponentType } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Activity, AlertTriangle, Building2, ClipboardList, Crown, LayoutDashboard,
  Loader2, Megaphone, RefreshCw, ShieldAlert, ShieldCheck, Target, Users
} from 'lucide-react';
import { handleTablistKeyDown } from '../hooks/useTablistKeyboard';
import {
  canDeletePlatformTenants, canManageBillingAndQuotas,
  canManagePlatformRoles, canPublishPlatformBroadcast
} from '../shared/superadmin';
import type { PlatformRole } from '../shared/admin-types';
import { SuperAdminMetricsCards } from './admin/SuperAdminMetricsCards';
import { SuperAdminUsersTab } from './admin/SuperAdminUsersTab';
import { SuperAdminCompaniesTab } from './admin/SuperAdminCompaniesTab';
import { SuperAdminAdsTab } from './admin/SuperAdminAdsTab';
import { SuperAdminSatHealthTab } from './admin/SuperAdminSatHealthTab';
import { SuperAdminBroadcastTab } from './admin/SuperAdminBroadcastTab';
import { SuperAdminAuditTab } from './admin/SuperAdminAuditTab';
import { useSuperAdminManager, type SuperAdminTab } from './admin/useSuperAdminManager';

function getRoleBadgeMeta(role: PlatformRole): { label: string; className: string } {
  if (role === 'SUPERADMIN') return { label: 'Dueño de Plataforma', className: 'bg-amber-100 text-amber-900 border-amber-300' };
  if (role === 'BILLING_OPS') return { label: 'Operaciones y Cuotas', className: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
  return { label: 'Soporte Solo Lectura', className: 'bg-blue-100 text-blue-900 border-blue-300' };
}

export function SuperAdminView() {
  const m = useSuperAdminManager();

  useEffect(() => {
    if (!m.hasAdminAccess) return;
    const searchIdByTab: Partial<Record<SuperAdminTab, string>> = {
      users: 'admin-users-search',
      companies: 'admin-companies-search',
      audit: 'admin-audit-search'
    };
    const targetId = searchIdByTab[m.activeTab];
    if (!targetId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        (active.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName))
      ) {
        return;
      }
      if (document.querySelector('dialog[open]')) return;
      const input = document.getElementById(targetId);
      if (input instanceof HTMLElement) {
        e.preventDefault();
        input.focus();
        if (input instanceof HTMLInputElement) input.select();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [m.activeTab, m.hasAdminAccess]);

  if (m.authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-blue-600" aria-hidden="true" />
        <p className="text-xs font-semibold text-slate-600">Verificando permisos administrativos...</p>
      </div>
    );
  }

  if (!m.hasAdminAccess) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 border border-red-200 text-red-600 flex items-center justify-center mb-4 shadow-sm">
          <ShieldAlert className="w-8 h-8" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">Acceso Restringido — Consola de Plataforma</h1>
        <p className="text-xs text-slate-600 max-w-md mb-5 leading-relaxed">
          Esta vista es de uso exclusivo para el equipo autorizado de LibrePaq Pro. Tu cuenta actual ({m.user?.email || 'Visitante'}) no cuenta con un rol administrativo.
        </p>
        <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition">
          Volver al Tablero Contable
        </Link>
      </div>
    );
  }

  const usersCount = m.metrics?.totalUsers ?? m.usersPage?.total ?? 0;
  const companiesCount = m.metrics?.totalCompanies ?? m.companiesPage?.total ?? 0;
  const openAlertsCount = m.openAlertsCount;
  const roleBadge = getRoleBadgeMeta(m.platformRole);

  const adminTabs: Array<{ id: SuperAdminTab; label: string; icon: ComponentType<{ className?: string }> }> = [
    { id: 'metrics', label: 'Métricas SaaS', icon: LayoutDashboard },
    { id: 'users', label: `Usuarios (${usersCount})`, icon: Users },
    { id: 'companies', label: `Empresas (${companiesCount})`, icon: Building2 },
    { id: 'ads', label: 'Google Ads', icon: Target },
    { id: 'sat', label: openAlertsCount > 0 ? `Salud SAT (${openAlertsCount})` : 'Salud SAT', icon: Activity },
    { id: 'broadcast', label: 'Comunicados', icon: Megaphone },
    { id: 'audit', label: 'Auditoría', icon: ClipboardList }
  ];

  const mutatingUserId = m.updateUserStatusMutation.isPending
    ? (m.updateUserStatusMutation.variables?.userId ?? null)
    : m.updateUserRoleMutation.isPending
    ? (m.updateUserRoleMutation.variables?.userId ?? null)
    : null;

  return (
    <div className="space-y-4">
      <header className="bg-white border border-slate-300/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 border border-amber-300 flex items-center justify-center shrink-0 shadow-2xs">
              {m.platformRole === 'SUPERADMIN' ? <Crown className="w-6 h-6 text-amber-600" aria-hidden="true" /> : <ShieldCheck className="w-6 h-6 text-blue-600" aria-hidden="true" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-900">Panel de SuperAdmin LibrePaq Pro</h1>
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${roleBadge.className}`}>
                  {m.platformRole === 'SUPERADMIN' && <Crown className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />}
                  {roleBadge.label}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Sesión activa: <span className="font-semibold text-slate-800">{m.user?.email || 'Admin'}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={m.isRefreshing}
            aria-busy={m.isRefreshing}
            onClick={() => void m.refetchAll()}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-xs font-bold text-slate-700 transition cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${m.isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{m.isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        </div>

        <div role="tablist" aria-label="Secciones de administración de plataforma" className="flex items-center gap-1.5 overflow-x-auto md:flex-wrap md:overflow-visible erp-tab-scroller max-w-full py-0.5 border-t border-slate-100 pt-3">
          {adminTabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = m.activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`admin-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={isSelected ? `admin-panel-${tab.id}` : undefined}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => m.setActiveTab(tab.id)}
                onKeyDown={(e) => handleTablistKeyDown(e, adminTabs, m.activeTab, m.setActiveTab, 'admin-tab-')}
                className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-900 shadow-xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {m.hasError && (
        <div role="alert" className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
            <span>Ocurrió un error al consultar algunos datos administrativos. Verifica la conexión e intenta de nuevo.</span>
          </div>
          <button type="button" onClick={() => void m.refetchAll()} className="px-3 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold cursor-pointer shrink-0">
            Reintentar
          </button>
        </div>
      )}

      <div role="tabpanel" id={`admin-panel-${m.activeTab}`} aria-labelledby={`admin-tab-${m.activeTab}`}>
        {m.activeTab === 'metrics' && (
          <SuperAdminMetricsCards
            metrics={m.metrics}
            usersCount={usersCount}
            companiesCount={companiesCount}
            isLoading={m.loadingMetrics}
            onRefresh={() => void m.refetchAll()}
            isRefreshing={m.isRefreshing}
            isError={m.metricsError}
            onNavigateTab={m.setActiveTab}
            onNavigateFielCompanies={() => {
              m.setCompaniesQuery((prev) => ({ ...prev, page: 1, ownerType: 'ALL', fielFilter: 'WITH_FIEL' }));
              m.setActiveTab('companies');
            }}
          />
        )}

        {m.activeTab === 'users' && (
          <SuperAdminUsersTab
            users={m.usersPage?.items ?? []}
            total={m.usersPage?.total ?? 0}
            page={m.usersPage?.page ?? m.usersQuery.page ?? 1}
            pageSize={m.usersPage?.pageSize ?? m.usersQuery.pageSize ?? 20}
            totalPages={m.usersPage?.totalPages ?? 1}
            query={m.usersQuery}
            onQueryChange={m.setUsersQuery}
            isLoading={m.loadingUsersPage}
            isFetching={m.fetchingUsersPage}
            onViewUserCompanies={(q) => m.setActiveTab('companies', q)}
            onToggleUserStatus={canManageBillingAndQuotas(m.platformRole) ? (userId, status) => m.updateUserStatusMutation.mutate({ userId, status }) : undefined}
            onChangeUserRole={canManagePlatformRoles(m.platformRole) ? (userId, platformRole) => m.updateUserRoleMutation.mutate({ userId, platformRole }) : undefined}
            canManageQuotas={canManageBillingAndQuotas(m.platformRole)}
            mutatingUserId={mutatingUserId}
          />
        )}

        {m.activeTab === 'companies' && (
          <SuperAdminCompaniesTab
            companies={m.companiesPage?.items ?? []}
            total={m.companiesPage?.total ?? 0}
            page={m.companiesPage?.page ?? m.companiesQuery.page ?? 1}
            pageSize={m.companiesPage?.pageSize ?? m.companiesQuery.pageSize ?? 20}
            totalPages={m.companiesPage?.totalPages ?? 1}
            query={m.companiesQuery}
            onQueryChange={m.setCompaniesQuery}
            users={m.users}
            isLoading={m.loadingCompaniesPage}
            isFetching={m.fetchingCompaniesPage}
            platformRole={m.platformRole}
            onDeleteCompany={canDeletePlatformTenants(m.platformRole) ? async (id) => { await m.deleteCompanyMutation.mutateAsync(id); } : undefined}
            isDeletingCompany={m.deleteCompanyMutation.isPending}
          />
        )}

        {m.activeTab === 'ads' && (
          <SuperAdminAdsTab users={m.users} companies={m.companies} isLoading={m.loadingAdsData} isError={m.adsDataError} onRetry={() => void m.refetchAll()} />
        )}

        {m.activeTab === 'sat' && (
          <SuperAdminSatHealthTab
            satHealth={m.satHealth}
            isLoading={m.loadingSatHealth}
            isError={m.satHealthError}
            onRetry={() => void m.refetchSatHealth()}
            alerts={m.alerts}
            alertsStatusFilter={m.alertsStatusFilter}
            onAlertsStatusFilterChange={m.setAlertsStatusFilter}
            loadingAlerts={m.loadingAlerts}
            scanningAlerts={m.scanAlertsMutation.isPending}
            mutatingAlertId={m.updateAlertStatusMutation.isPending ? (m.updateAlertStatusMutation.variables?.alertId ?? null) : null}
            onScanAlerts={() => m.scanAlertsMutation.mutate()}
            onUpdateAlertStatus={(alertId, status) => m.updateAlertStatusMutation.mutate({ alertId, status })}
            onInspectCompanyRfc={(rfc: string) => m.setActiveTab('companies', rfc)}
            onInspectWorkspace={(q: string) => {
              m.setUsersQuery((prev) => ({ ...prev, page: 1, search: q, status: 'ALL', role: 'ALL' }));
              m.setActiveTab('users');
            }}
          />
        )}

        {m.activeTab === 'broadcast' && <SuperAdminBroadcastTab canManage={canPublishPlatformBroadcast(m.platformRole)} />}

        {m.activeTab === 'audit' && (
          <SuperAdminAuditTab
            logs={m.auditPage?.items ?? []}
            total={m.auditPage?.total ?? 0}
            page={m.auditPage?.page ?? m.auditQuery.page ?? 1}
            pageSize={m.auditPage?.pageSize ?? m.auditQuery.pageSize ?? 25}
            totalPages={m.auditPage?.totalPages ?? 1}
            query={m.auditQuery}
            onQueryChange={m.setAuditQuery}
            isLoading={m.loadingAuditPage}
            isFetching={m.fetchingAuditPage}
            isError={m.auditLogsError}
            onRetry={() => void m.refetchAuditLogs()}
          />
        )}
      </div>
    </div>
  );
}
