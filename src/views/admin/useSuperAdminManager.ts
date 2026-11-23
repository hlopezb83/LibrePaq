import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import type {
  AdminAuditLogsPageQuery,
  AdminCompaniesPageQuery,
  AdminUsersPageQuery,
  PlatformAlertStatus,
  PlatformRole
} from '../../shared/admin-types';

export type SuperAdminTab = 'metrics' | 'users' | 'companies' | 'ads' | 'sat' | 'broadcast' | 'audit';

export function useSuperAdminManager() {
  const { user, isSuperAdmin, platformRole, hasAdminAccess, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const routerState = useRouterState();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams((routerState?.location?.search || {}) as Record<string, string>);
  const searchTab = searchParams.get('tab');
  const searchQuery = searchParams.get('q') || '';

  const activeTab: SuperAdminTab =
    searchTab === 'users' ||
    searchTab === 'companies' ||
    searchTab === 'ads' ||
    searchTab === 'sat' ||
    searchTab === 'broadcast' ||
    searchTab === 'audit'
      ? searchTab
      : 'metrics';

  const [companiesQuery, setCompaniesQuery] = useState<AdminCompaniesPageQuery>(() => ({
    page: 1,
    pageSize: 20,
    search: searchQuery,
    ownerType: searchQuery ? 'ALL' : 'user',
    fielFilter: 'ALL',
    sortBy: 'createdAt',
    sortDir: 'desc'
  }));
  const [usersQuery, setUsersQuery] = useState<AdminUsersPageQuery>({
    page: 1,
    pageSize: 20,
    search: '',
    status: 'ALL',
    role: 'ALL'
  });
  const [auditQuery, setAuditQuery] = useState<AdminAuditLogsPageQuery>({
    page: 1,
    pageSize: 25,
    search: '',
    action: '',
    targetType: ''
  });
  const [alertsStatusFilter, setAlertsStatusFilter] = useState<'ALL' | PlatformAlertStatus>('open');

  useEffect(() => {
    setCompaniesQuery((prev) => {
      if (searchQuery) {
        if (prev.search === searchQuery && prev.ownerType === 'ALL' && prev.fielFilter === 'ALL') {
          return prev;
        }
        return { ...prev, page: 1, search: searchQuery, ownerType: 'ALL', fielFilter: 'ALL' };
      }
      if (!prev.search) return prev;
      return { ...prev, page: 1, search: '' };
    });
  }, [searchQuery]);

  const setActiveTab = (tab: SuperAdminTab, q?: string) => {
    const nextSearch: Record<string, string> = {};
    if (tab !== 'metrics') nextSearch.tab = tab;
    if (q) {
      nextSearch.q = q;
      if (tab === 'companies') {
        setCompaniesQuery((prev) => ({
          ...prev,
          page: 1,
          search: q,
          ownerType: 'ALL',
          fielFilter: 'ALL'
        }));
      }
    }
    void navigate({
      to: '/admin',
      search: Object.keys(nextSearch).length > 0 ? nextSearch : undefined
    });
  };

  const metricsQuery = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => apiClient.getAdminMetrics(),
    enabled: Boolean(hasAdminAccess)
  });

  const usersQueryAll = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiClient.getAdminUsers(),
    enabled: Boolean(hasAdminAccess && (activeTab === 'metrics' || activeTab === 'ads' || activeTab === 'users'))
  });

  const companiesQueryAll = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => apiClient.getAdminCompanies(),
    enabled: Boolean(hasAdminAccess && (activeTab === 'metrics' || activeTab === 'ads' || activeTab === 'companies'))
  });

  const companiesPageQuery = useQuery({
    queryKey: ['admin-companies-paginated', companiesQuery],
    queryFn: () => apiClient.getAdminCompaniesPaginated(companiesQuery),
    enabled: Boolean(hasAdminAccess && activeTab === 'companies')
  });

  const usersPageQuery = useQuery({
    queryKey: ['admin-users-paginated', usersQuery],
    queryFn: () => apiClient.getAdminUsersPaginated(usersQuery),
    enabled: Boolean(hasAdminAccess && activeTab === 'users')
  });

  const auditPageQuery = useQuery({
    queryKey: ['admin-audit-logs-paginated', auditQuery],
    queryFn: () => apiClient.getAdminAuditLogsPaginated(auditQuery),
    enabled: Boolean(hasAdminAccess && activeTab === 'audit')
  });

  const satHealthQuery = useQuery({
    queryKey: ['admin-sat-health'],
    queryFn: () => apiClient.getAdminSatHealth(),
    enabled: Boolean(hasAdminAccess && (activeTab === 'sat' || activeTab === 'metrics'))
  });

  const alertsQuery = useQuery({
    queryKey: ['admin-alerts', alertsStatusFilter],
    queryFn: () => apiClient.getAdminPlatformAlerts(alertsStatusFilter),
    enabled: Boolean(hasAdminAccess && (activeTab === 'sat' || activeTab === 'metrics'))
  });

  const openAlertsCountQuery = useQuery({
    queryKey: ['admin-alerts', 'open'],
    queryFn: () => apiClient.getAdminPlatformAlerts('open'),
    enabled: Boolean(hasAdminAccess)
  });

  const invalidateAuditAndUsers = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-users-paginated'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs-paginated'] });
  };

  const updateUserStatusMutation = useMutation({
    mutationFn: (v: { userId: string; status: 'ACTIVO' | 'SUSPENDIDO'; reason?: string }) =>
      apiClient.setAdminUserStatus(v.userId, { status: v.status, reason: v.reason }),
    onSuccess: (res) => {
      invalidateAuditAndUsers();
      toast.success(
        res.status === 'SUSPENDIDO' ? 'Usuario suspendido' : 'Usuario reactivado',
        res.status === 'SUSPENDIDO' ? 'Acceso bloqueado para esta cuenta.' : 'La cuenta puede iniciar sesión nuevamente.'
      );
    },
    onError: (err: unknown) => toast.error('No se pudo actualizar el usuario', err instanceof Error ? err.message : 'Error inesperado.')
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: (v: { userId: string; platformRole: PlatformRole }) => apiClient.setAdminUserRole(v.userId, v.platformRole),
    onSuccess: (res) => {
      invalidateAuditAndUsers();
      toast.success('Rol de plataforma actualizado', `Nuevo rol asignado: ${res.platformRole}`);
    },
    onError: (err: unknown) => toast.error('No se pudo actualizar el rol', err instanceof Error ? err.message : 'Error inesperado.')
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: (companyId: string) => apiClient.deleteAdminCompany(companyId),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-companies-paginated'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
      invalidateAuditAndUsers();
      void queryClient.removeQueries({ queryKey: ['admin-company-detail', res.companyId] });
      toast.success('Empresa eliminada', 'La empresa fiscal y sus registros han sido depurados.');
    },
    onError: (err: unknown) => toast.error('No se pudo eliminar la empresa', err instanceof Error ? err.message : 'Error inesperado.')
  });

  const scanAlertsMutation = useMutation({
    mutationFn: () => apiClient.runAdminHealthScan(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-sat-health'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs-paginated'] });
      toast.success('Escaneo de salud completado', `${res.alertsCreated} alertas nuevas · ${res.openAlertsCount} abiertas.`);
    },
    onError: (err: unknown) => toast.error('Error al ejecutar escaneo', err instanceof Error ? err.message : 'Error inesperado.')
  });

  const updateAlertStatusMutation = useMutation({
    mutationFn: (v: { alertId: string; status: PlatformAlertStatus }) => apiClient.updateAdminPlatformAlertStatus(v.alertId, v.status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs-paginated'] });
    },
    onError: (err: unknown) => toast.error('Error al actualizar alerta', err instanceof Error ? err.message : 'Error inesperado.')
  });

  const hasError =
    metricsQuery.isError ||
    (activeTab === 'users' && usersPageQuery.isError) ||
    (activeTab === 'companies' && companiesPageQuery.isError) ||
    ((activeTab === 'sat' || activeTab === 'metrics') && (satHealthQuery.isError || alertsQuery.isError)) ||
    (activeTab === 'audit' && auditPageQuery.isError);

  const isRefreshing =
    metricsQuery.isFetching ||
    usersPageQuery.isFetching ||
    companiesPageQuery.isFetching ||
    satHealthQuery.isFetching ||
    alertsQuery.isFetching ||
    openAlertsCountQuery.isFetching ||
    auditPageQuery.isFetching;

  const openAlertsCount =
    openAlertsCountQuery.data?.length ??
    (alertsQuery.data ? alertsQuery.data.filter((a) => a.status === 'open').length : 0);

  const refetchAll = async () => {
    const tasks: Array<Promise<unknown>> = [metricsQuery.refetch(), openAlertsCountQuery.refetch()];
    if (activeTab === 'users') tasks.push(usersPageQuery.refetch());
    if (activeTab === 'companies') tasks.push(companiesPageQuery.refetch());
    if (activeTab === 'ads' || activeTab === 'metrics') {
      tasks.push(usersQueryAll.refetch(), companiesQueryAll.refetch());
    }
    if (activeTab === 'sat' || activeTab === 'metrics') {
      tasks.push(satHealthQuery.refetch());
      if (alertsStatusFilter !== 'open') tasks.push(alertsQuery.refetch());
    }
    if (activeTab === 'audit') tasks.push(auditPageQuery.refetch());
    await Promise.all(tasks);
  };

  return {
    user, isSuperAdmin, platformRole, hasAdminAccess, authLoading, searchQuery, activeTab, setActiveTab,
    metrics: metricsQuery.data, loadingMetrics: metricsQuery.isLoading, metricsError: metricsQuery.isError,
    users: usersQueryAll.data ?? [], companies: companiesQueryAll.data ?? [],
    companiesQuery, setCompaniesQuery, companiesPage: companiesPageQuery.data, loadingCompaniesPage: companiesPageQuery.isLoading, fetchingCompaniesPage: companiesPageQuery.isFetching,
    usersQuery, setUsersQuery, usersPage: usersPageQuery.data, loadingUsersPage: usersPageQuery.isLoading, fetchingUsersPage: usersPageQuery.isFetching,
    auditQuery, setAuditQuery, auditPage: auditPageQuery.data, loadingAuditPage: auditPageQuery.isLoading, fetchingAuditPage: auditPageQuery.isFetching, auditLogsError: auditPageQuery.isError, refetchAuditLogs: auditPageQuery.refetch,
    satHealth: satHealthQuery.data, loadingSatHealth: satHealthQuery.isLoading, satHealthError: satHealthQuery.isError, refetchSatHealth: satHealthQuery.refetch,
    alerts: alertsQuery.data ?? [], openAlertsCount, loadingAlerts: alertsQuery.isLoading, alertsStatusFilter, setAlertsStatusFilter,
    scanAlertsMutation, updateAlertStatusMutation,
    hasError, isRefreshing, refetchAll, updateUserStatusMutation, updateUserRoleMutation, deleteCompanyMutation
  };
}
