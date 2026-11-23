import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';

export type SuperAdminTab = 'metrics' | 'users' | 'companies' | 'ads' | 'sat' | 'broadcast' | 'audit';

export function useSuperAdminManager() {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const routerState = useRouterState();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(
    (routerState?.location?.search || {}) as Record<string, string>
  );
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

  const setActiveTab = (tab: SuperAdminTab, q?: string) => {
    const nextSearch: Record<string, string> = {};
    if (tab !== 'metrics') nextSearch.tab = tab;
    if (q) nextSearch.q = q;
    void navigate({
      to: '/admin',
      search: Object.keys(nextSearch).length > 0 ? nextSearch : undefined
    });
  };

  const metricsQuery = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => apiClient.getAdminMetrics(),
    enabled: Boolean(isSuperAdmin)
  });

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiClient.getAdminUsers(),
    enabled: Boolean(isSuperAdmin)
  });

  const companiesQuery = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => apiClient.getAdminCompanies(),
    enabled: Boolean(isSuperAdmin)
  });

  const satHealthQuery = useQuery({
    queryKey: ['admin-sat-health'],
    queryFn: () => apiClient.getAdminSatHealth(),
    enabled: Boolean(isSuperAdmin && (activeTab === 'sat' || activeTab === 'metrics'))
  });

  const auditLogsQuery = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => apiClient.getAdminAuditLogs(100),
    enabled: Boolean(isSuperAdmin && activeTab === 'audit')
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: ({
      userId,
      status,
      reason
    }: {
      userId: string;
      status: 'ACTIVO' | 'SUSPENDIDO';
      reason?: string;
    }) => apiClient.setAdminUserStatus(userId, { status, reason }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast.success(
        res.status === 'SUSPENDIDO' ? 'Usuario suspendido' : 'Usuario reactivado',
        res.status === 'SUSPENDIDO'
          ? 'El acceso a la plataforma ha sido bloqueado para esta cuenta.'
          : 'La cuenta puede iniciar sesión nuevamente.'
      );
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error al actualizar el estado del usuario.';
      toast.error('No se pudo actualizar el usuario', msg);
    }
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: (companyId: string) => apiClient.deleteAdminCompany(companyId),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      void queryClient.removeQueries({ queryKey: ['admin-company-detail', res.companyId] });
      toast.success('Empresa eliminada', 'La empresa fiscal y sus registros han sido depurados.');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error al depurar la empresa.';
      toast.error('No se pudo eliminar la empresa', msg);
    }
  });

  const hasError =
    metricsQuery.isError ||
    usersQuery.isError ||
    companiesQuery.isError ||
    ((activeTab === 'sat' || activeTab === 'metrics') && satHealthQuery.isError) ||
    (activeTab === 'audit' && auditLogsQuery.isError);

  const isRefreshing =
    metricsQuery.isFetching ||
    usersQuery.isFetching ||
    companiesQuery.isFetching ||
    satHealthQuery.isFetching ||
    auditLogsQuery.isFetching;

  const refetchAll = async () => {
    const tasks: Array<Promise<unknown>> = [
      metricsQuery.refetch(),
      usersQuery.refetch(),
      companiesQuery.refetch()
    ];
    if (activeTab === 'sat' || activeTab === 'metrics') tasks.push(satHealthQuery.refetch());
    if (activeTab === 'audit') tasks.push(auditLogsQuery.refetch());
    await Promise.all(tasks);
  };

  return {
    user,
    isSuperAdmin,
    authLoading,
    searchQuery,
    activeTab,
    setActiveTab,
    metrics: metricsQuery.data,
    loadingMetrics: metricsQuery.isLoading,
    metricsError: metricsQuery.isError,
    users: usersQuery.data ?? [],
    loadingUsers: usersQuery.isLoading,
    companies: companiesQuery.data ?? [],
    loadingCompanies: companiesQuery.isLoading,
    satHealth: satHealthQuery.data,
    loadingSatHealth: satHealthQuery.isLoading,
    satHealthError: satHealthQuery.isError,
    refetchSatHealth: satHealthQuery.refetch,
    auditLogs: auditLogsQuery.data ?? [],
    loadingAuditLogs: auditLogsQuery.isLoading,
    auditLogsError: auditLogsQuery.isError,
    refetchAuditLogs: auditLogsQuery.refetch,
    hasError,
    isRefreshing,
    refetchAll,
    updateUserStatusMutation,
    deleteCompanyMutation
  };
}
