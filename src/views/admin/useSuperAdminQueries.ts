import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import type {
  AdminAuditLogsPageQuery,
  AdminCompaniesPageQuery,
  AdminUsersPageQuery,
  PlatformAlertStatus
} from '../../shared/admin-types';

export type SuperAdminTab = 'metrics' | 'users' | 'companies' | 'ads' | 'sat' | 'broadcast' | 'audit';

export interface UseSuperAdminQueriesParams {
  hasAdminAccess: boolean;
  activeTab: SuperAdminTab;
  companiesQuery: AdminCompaniesPageQuery;
  usersQuery: AdminUsersPageQuery;
  auditQuery: AdminAuditLogsPageQuery;
  alertsStatusFilter: 'ALL' | PlatformAlertStatus;
}

export function useSuperAdminQueries({
  hasAdminAccess,
  activeTab,
  companiesQuery,
  usersQuery,
  auditQuery,
  alertsStatusFilter
}: UseSuperAdminQueriesParams) {
  const metricsQuery = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => apiClient.getAdminMetrics(),
    enabled: Boolean(hasAdminAccess)
  });

  const usersQueryAll = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiClient.getAdminUsers(),
    enabled: Boolean(hasAdminAccess && (activeTab === 'ads' || activeTab === 'companies'))
  });

  const companiesQueryAll = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => apiClient.getAdminCompanies(),
    enabled: Boolean(hasAdminAccess && activeTab === 'ads')
  });

  const companiesPageQuery = useQuery({
    queryKey: ['admin-companies-paginated', companiesQuery],
    queryFn: () => apiClient.getAdminCompaniesPaginated(companiesQuery),
    enabled: Boolean(hasAdminAccess && activeTab === 'companies'),
    placeholderData: keepPreviousData
  });

  const usersPageQuery = useQuery({
    queryKey: ['admin-users-paginated', usersQuery],
    queryFn: () => apiClient.getAdminUsersPaginated(usersQuery),
    enabled: Boolean(hasAdminAccess && activeTab === 'users'),
    placeholderData: keepPreviousData
  });

  const auditPageQuery = useQuery({
    queryKey: ['admin-audit-logs-paginated', auditQuery],
    queryFn: () => apiClient.getAdminAuditLogsPaginated(auditQuery),
    enabled: Boolean(hasAdminAccess && activeTab === 'audit'),
    placeholderData: keepPreviousData
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

  const hasError =
    metricsQuery.isError ||
    (activeTab === 'users' && usersPageQuery.isError) ||
    (activeTab === 'companies' && companiesPageQuery.isError) ||
    (activeTab === 'ads' && (usersQueryAll.isError || companiesQueryAll.isError)) ||
    ((activeTab === 'sat' || activeTab === 'metrics') && (satHealthQuery.isError || alertsQuery.isError)) ||
    (activeTab === 'audit' && auditPageQuery.isError);

  const isRefreshing =
    metricsQuery.isFetching ||
    usersPageQuery.isFetching ||
    companiesPageQuery.isFetching ||
    (activeTab === 'ads' && (usersQueryAll.isFetching || companiesQueryAll.isFetching)) ||
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
    if (activeTab === 'companies') tasks.push(companiesPageQuery.refetch(), usersQueryAll.refetch());
    if (activeTab === 'ads') {
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
    metrics: metricsQuery.data,
    loadingMetrics: metricsQuery.isLoading,
    metricsError: metricsQuery.isError,
    users: usersQueryAll.data ?? [],
    companies: companiesQueryAll.data ?? [],
    loadingAdsData: usersQueryAll.isLoading || companiesQueryAll.isLoading,
    adsDataError: usersQueryAll.isError || companiesQueryAll.isError,
    companiesPage: companiesPageQuery.data,
    loadingCompaniesPage: companiesPageQuery.isLoading,
    fetchingCompaniesPage: companiesPageQuery.isFetching,
    usersPage: usersPageQuery.data,
    loadingUsersPage: usersPageQuery.isLoading,
    fetchingUsersPage: usersPageQuery.isFetching,
    auditPage: auditPageQuery.data,
    loadingAuditPage: auditPageQuery.isLoading,
    fetchingAuditPage: auditPageQuery.isFetching,
    auditLogsError: auditPageQuery.isError,
    refetchAuditLogs: auditPageQuery.refetch,
    satHealth: satHealthQuery.data,
    loadingSatHealth: satHealthQuery.isLoading,
    satHealthError: satHealthQuery.isError,
    refetchSatHealth: satHealthQuery.refetch,
    alerts: alertsQuery.data ?? [],
    openAlertsCount,
    loadingAlerts: alertsQuery.isLoading,
    hasError,
    isRefreshing,
    refetchAll
  };
}
