import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Activity, Building2, ClipboardList, Crown, LayoutDashboard,
  Loader2, Megaphone, RefreshCw, ShieldAlert, ShieldCheck, Target, Users
} from 'lucide-react';
import {
  AlertBanner,
  Button,
  PageHeader,
  StatusBadge,
  TabBar,
  getButtonClasses,
  type BadgeTone,
  type TabBarItem
} from '../components/ui';
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

function getRoleBadgeMeta(role: PlatformRole): { label: string; tone: BadgeTone } {
  if (role === 'SUPERADMIN') return { label: 'Dueño de Plataforma', tone: 'amber' };
  if (role === 'BILLING_OPS') return { label: 'Operaciones y Cuotas', tone: 'emerald' };
  return { label: 'Soporte Solo Lectura', tone: 'blue' };
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
        <Link to="/" className={getButtonClasses('primary', 'md')}>
          Volver al Tablero Contable
        </Link>
      </div>
    );
  }

  const usersCount = m.metrics?.totalUsers ?? m.usersPage?.total ?? 0;
  const companiesCount = m.metrics?.totalCompanies ?? m.companiesPage?.total ?? 0;
  const openAlertsCount = m.openAlertsCount;
  const roleBadge = getRoleBadgeMeta(m.platformRole);

  const adminTabs: Array<TabBarItem<SuperAdminTab>> = [
    { id: 'metrics', label: 'Métricas SaaS', icon: <LayoutDashboard className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
    { id: 'users', label: 'Usuarios', count: usersCount, icon: <Users className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
    { id: 'companies', label: 'Empresas', count: companiesCount, icon: <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
    { id: 'ads', label: 'Google Ads', icon: <Target className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
    {
      id: 'sat',
      label: 'Salud SAT',
      count: openAlertsCount > 0 ? openAlertsCount : undefined,
      icon: <Activity className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
    },
    { id: 'broadcast', label: 'Comunicados', icon: <Megaphone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
    { id: 'audit', label: 'Auditoría', icon: <ClipboardList className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> }
  ];

  const mutatingUserId = m.updateUserStatusMutation.isPending
    ? (m.updateUserStatusMutation.variables?.userId ?? null)
    : m.updateUserRoleMutation.isPending
    ? (m.updateUserRoleMutation.variables?.userId ?? null)
    : null;

  const tabShowsOwnError =
    (m.activeTab === 'metrics' && m.metricsError) ||
    (m.activeTab === 'ads' && m.adsDataError) ||
    (m.activeTab === 'sat' && m.satHealthError) ||
    (m.activeTab === 'audit' && m.auditLogsError);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={
          m.platformRole === 'SUPERADMIN' ? (
            <Crown className="w-5 h-5" aria-hidden="true" />
          ) : (
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          )
        }
        iconTone={m.platformRole === 'SUPERADMIN' ? 'amber' : 'blue'}
        title={
          m.platformRole === 'SUPERADMIN'
            ? 'Panel de SuperAdmin LibrePaq Pro'
            : 'Consola Administrativa LibrePaq Pro'
        }
        titleBadge={
          <StatusBadge
            tone={roleBadge.tone}
            icon={m.platformRole === 'SUPERADMIN' ? <Crown className="w-3 h-3" aria-hidden="true" /> : undefined}
          >
            {roleBadge.label}
          </StatusBadge>
        }
        subtitle={
          <>
            Sesión activa: <span className="font-semibold text-slate-800">{m.user?.email || 'Admin'}</span>
          </>
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={m.isRefreshing}
            loading={m.isRefreshing}
            title={m.isRefreshing ? 'Actualizando datos administrativos...' : 'Actualizar datos de la consola'}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${m.isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />}
            onClick={() => void m.refetchAll()}
          >
            {m.isRefreshing ? 'Actualizando...' : 'Actualizar'}
          </Button>
        }
        tabs={
          <TabBar
            tabs={adminTabs}
            activeId={m.activeTab}
            onSelect={(id) => m.setActiveTab(id)}
            idPrefix="admin-tab-"
            panelId={`admin-panel-${m.activeTab}`}
            ariaLabel="Secciones de administración de plataforma"
          />
        }
      />

      {m.hasError && !tabShowsOwnError && (
        <AlertBanner
          tone="danger"
          action={
            <Button variant="danger" size="sm" onClick={() => void m.refetchAll()}>
              Reintentar
            </Button>
          }
        >
          Ocurrió un error al consultar algunos datos administrativos. Verifica la conexión e intenta de nuevo.
        </AlertBanner>
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
