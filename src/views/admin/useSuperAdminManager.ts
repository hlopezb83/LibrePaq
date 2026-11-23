import { useEffect, useState } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useAuth } from '../../context/AuthContext';
import type {
  AdminAuditLogsPageQuery,
  AdminCompaniesPageQuery,
  AdminUsersPageQuery,
  PlatformAlertStatus
} from '../../shared/admin-types';
import { useSuperAdminMutations } from './useSuperAdminMutations';
import { type SuperAdminTab, useSuperAdminQueries } from './useSuperAdminQueries';

export type { SuperAdminTab };

export function useSuperAdminManager() {
  const { user, isSuperAdmin, platformRole, hasAdminAccess, loading: authLoading } = useAuth();
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

  const queries = useSuperAdminQueries({
    hasAdminAccess: Boolean(hasAdminAccess),
    activeTab,
    companiesQuery,
    usersQuery,
    auditQuery,
    alertsStatusFilter
  });

  const mutations = useSuperAdminMutations();

  return {
    user,
    isSuperAdmin,
    platformRole,
    hasAdminAccess,
    authLoading,
    searchQuery,
    activeTab,
    setActiveTab,
    ...queries,
    companiesQuery,
    setCompaniesQuery,
    usersQuery,
    setUsersQuery,
    auditQuery,
    setAuditQuery,
    alertsStatusFilter,
    setAlertsStatusFilter,
    ...mutations
  };
}
