import { useQuery } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/api-client';

export type SuperAdminTab = 'metrics' | 'users' | 'companies' | 'ads' | 'broadcast';

export function useSuperAdminManager() {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
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
    searchTab === 'broadcast'
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

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => apiClient.getAdminMetrics(),
    enabled: Boolean(isSuperAdmin)
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiClient.getAdminUsers(),
    enabled: Boolean(isSuperAdmin)
  });

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => apiClient.getAdminCompanies(),
    enabled: Boolean(isSuperAdmin)
  });

  return {
    user,
    isSuperAdmin,
    authLoading,
    searchQuery,
    activeTab,
    setActiveTab,
    metrics,
    loadingMetrics,
    users,
    loadingUsers,
    companies,
    loadingCompanies
  };
}
