import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, invalidateAccountingQueries } from '../lib/api-client';
import { getStoredAdAttribution, trackWorkspaceSignupConversion } from '../lib/analytics';
import { useAuth, checkIsSuperAdmin } from './AuthContext';
import { setClientReadOnlyMode, useSupportSession } from '../lib/support-impersonation';
import { workspaceRbacClient } from '../lib/workspace-rbac-client';
import { loadStoredViewedPeriods, saveStoredViewedPeriods, type ViewedPeriodsMap } from './companyPeriodStorage';
import { buildSupportCompany, readUrlCompanyParam, resolveWorkspaceName } from './companyContextHelpers';
import { resolveClientDespachoName } from '../lib/supabase/supabase-ronda11';
import type { Company } from '../shared/types';
import type { DespachoRole } from '../shared/types/despacho-rbac.types';

export interface UserWorkspace {
  id: string;
  name: string;
  ownerEmail: string;
}

interface CompanyContextValue {
  workspace: UserWorkspace | null;
  renameWorkspace: (nextName: string) => Promise<void>;
  companies: Company[];
  activeCompany: Company | null;
  activeCompanyId: string;
  setActiveCompanyId: (id: string, newCompany?: Company) => void;
  updatePeriod: (year: number, period: number) => void;
  isUpdatingPeriod: boolean;
  isLoading: boolean;
  isReadOnlySupportMode: boolean;
  isReadOnlyClient: boolean;
  effectiveCompanyRole: DespachoRole | 'OWNER' | null;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user, loading: authLoading, hasAdminAccess } = useAuth();
  const supportSession = useSupportSession();
  const isSupportImpersonation = Boolean(supportSession && (hasAdminAccess || checkIsSuperAdmin(user)));
  const isOwner = (hasAdminAccess || checkIsSuperAdmin(user)) && !isSupportImpersonation;
  const userScope = user?.id || 'demo';
  const storageKey = `librepaq_company_id_${userScope}`;
  const wsStorageKey = `librepaq_workspace_name_${userScope}`;
  const provisionedUserRef = useRef<string | null>(null);
  const acceptedInvitesUserRef = useRef<string | null>(null);
  const inFlightInvitesUserRef = useRef<string | null>(null);

  const [workspaceNameOverride, setWorkspaceNameOverride] = useState<string | null>(null);
  const [viewedPeriods, setViewedPeriods] = useState<ViewedPeriodsMap>(() => loadStoredViewedPeriods(userScope));

  const [activeCompanyId, setActiveCompanyIdState] = useState<string>(
    () => readUrlCompanyParam() || localStorage.getItem(storageKey) || ''
  );

  useEffect(() => {
    const urlComp = readUrlCompanyParam();
    if (urlComp) {
      setActiveCompanyIdState(urlComp);
      localStorage.setItem(storageKey, urlComp);
      return;
    }
    setActiveCompanyIdState(localStorage.getItem(storageKey) || '');
    setWorkspaceNameOverride(localStorage.getItem(wsStorageKey));
    setViewedPeriods(loadStoredViewedPeriods(userScope));
  }, [storageKey, wsStorageKey, userScope]);

  const defaultWorkspaceName = user
    ? `Despacho Contable — ${user.user_metadata?.full_name || user.email?.split('@')[0] || 'Mi Cartera'}`
    : 'Mi Despacho Contable';
  const resolvedWsName = resolveWorkspaceName(workspaceNameOverride, user?.user_metadata?.workspace_name, defaultWorkspaceName);

  // Aprovisionar automáticamente el Workspace + atribución de Google Ads al primer ingreso real
  useEffect(() => {
    if (!user || isOwner || isSupportImpersonation || hasAdminAccess || checkIsSuperAdmin(user)) return;
    if (user.user_metadata?.workspace_id) return;
    if (provisionedUserRef.current === user.id) return;

    provisionedUserRef.current = user.id;
    const wsId = `ws_${user.id.slice(0, 8)}`;
    const wsName = defaultWorkspaceName;
    const attribution = getStoredAdAttribution();
    const provider = String(user.app_metadata?.provider || 'email');

    void apiClient.updateUserProfileWorkspace({
      userId: user.id,
      workspaceId: wsId,
      workspaceName: wsName,
      acquisitionSource: attribution?.source || 'organic_or_direct',
      gclid: attribution?.gclid || null,
      utmCampaign: attribution?.utmCampaign || null,
      utmTerm: attribution?.utmTerm || null
    });

    trackWorkspaceSignupConversion(provider, attribution);
  }, [user, isOwner, isSupportImpersonation, hasAdminAccess, defaultWorkspaceName]);

  useEffect(() => {
    if (!user) {
      acceptedInvitesUserRef.current = null;
      inFlightInvitesUserRef.current = null;
      return;
    }
    if (isOwner || isSupportImpersonation || hasAdminAccess || checkIsSuperAdmin(user)) return;
    if (
      user.user_metadata?.is_guest ||
      acceptedInvitesUserRef.current === user.id ||
      inFlightInvitesUserRef.current === user.id
    ) {
      return;
    }
    const targetUserId = user.id;
    inFlightInvitesUserRef.current = targetUserId;
    void workspaceRbacClient
      .acceptPendingInvites()
      .then((res) => {
        if (inFlightInvitesUserRef.current === targetUserId) inFlightInvitesUserRef.current = null;
        acceptedInvitesUserRef.current = targetUserId;
        if (res.acceptedCount > 0) {
          void queryClient.invalidateQueries({ queryKey: ['companies', userScope] });
          void queryClient.invalidateQueries({ queryKey: ['effective-company-role'] });
        }
      })
      .catch(() => {
        if (inFlightInvitesUserRef.current === targetUserId) inFlightInvitesUserRef.current = null;
        acceptedInvitesUserRef.current = null;
      });
  }, [user, isOwner, isSupportImpersonation, hasAdminAccess, queryClient, userScope]);

  const renameWorkspace = useCallback(
    async (nextName: string) => {
      if (isSupportImpersonation) return;
      const clean = nextName.trim();
      if (!clean || !user) return;
      setWorkspaceNameOverride(clean);
      try { localStorage.setItem(wsStorageKey, clean); } catch { /* ignore */ }
      const wsId = String(user.user_metadata?.workspace_id || `ws_${user.id.slice(0, 8)}`);
      await apiClient.updateUserProfileWorkspace({ userId: user.id, workspaceId: wsId, workspaceName: clean });
    },
    [isSupportImpersonation, user, wsStorageKey]
  );

  const { data: supportDetail, isLoading: supportLoading } = useQuery({
    queryKey: ['support-company-detail', supportSession?.companyId],
    queryFn: () => apiClient.getAdminCompanyDetail(supportSession!.companyId),
    enabled: Boolean(isSupportImpersonation && supportSession?.companyId)
  });

  const { data: companies = [], isLoading, isError } = useQuery({
    queryKey: ['companies', userScope],
    queryFn: apiClient.getCompanies,
    enabled: Boolean(user) && !authLoading && !hasAdminAccess && !checkIsSuperAdmin(user)
  });

  const supportCompany: Company | null = useMemo(
    () => buildSupportCompany(isSupportImpersonation, supportSession, supportDetail?.company),
    [isSupportImpersonation, supportSession, supportDetail]
  );

  const effectiveCompanies = useMemo(
    () => (supportCompany ? [supportCompany] : companies),
    [supportCompany, companies]
  );

  useEffect(() => {
    if (isLoading || isError) return;
    if (companies.length === 0) {
      if (activeCompanyId !== '') {
        setActiveCompanyIdState('');
        localStorage.removeItem(storageKey);
      }
      return;
    }
    if (!companies.some((c) => c.id === activeCompanyId)) {
      const firstCompany = companies[0];
      if (firstCompany) {
        setActiveCompanyIdState(firstCompany.id);
        localStorage.setItem(storageKey, firstCompany.id);
      }
    }
  }, [companies, activeCompanyId, isLoading, isError, storageKey]);

  const setActiveCompanyId = useCallback(
    (id: string, newCompany?: Company) => {
      if (newCompany) {
        queryClient.setQueryData<Company[]>(['companies', userScope], (prev = []) => [
          ...prev.filter((c) => c.id !== newCompany.id),
          newCompany
        ]);
      }
      setActiveCompanyIdState(id);
      localStorage.setItem(storageKey, id);
      if (typeof window !== 'undefined' && window.location.search) {
        const url = new URL(window.location.href);
        if (url.searchParams.has('companyId') || url.searchParams.has('company')) {
          url.searchParams.set('companyId', id);
          url.searchParams.delete('company');
          window.history.replaceState({}, '', url.toString());
        }
      }
    },
    [queryClient, userScope, storageKey]
  );

  const baseActiveCompany = supportCompany ?? companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? null;
  const resolvedActiveCompanyId = baseActiveCompany?.id ?? '';
  const viewedOverride = resolvedActiveCompanyId ? viewedPeriods[resolvedActiveCompanyId] : undefined;
  const activeCompany = useMemo(
    () =>
      baseActiveCompany && viewedOverride
        ? { ...baseActiveCompany, currentYear: viewedOverride.year, currentPeriod: viewedOverride.period }
        : baseActiveCompany,
    [baseActiveCompany, viewedOverride]
  );

  const shouldCheckCompanyRole = Boolean(
    user && resolvedActiveCompanyId && !isSupportImpersonation &&
      !hasAdminAccess && !checkIsSuperAdmin(user) && !user.user_metadata?.is_guest
  );
  const isDirectCompanyOwner = Boolean(
    user && baseActiveCompany?.userId && baseActiveCompany.userId === user.id
  );

  const {
    data: effectiveRoleInfo,
    isLoading: effectiveRoleLoading,
    isError: effectiveRoleError
  } = useQuery({
    queryKey: ['effective-company-role', resolvedActiveCompanyId, user?.id],
    queryFn: () => workspaceRbacClient.getEffectiveCompanyRole(resolvedActiveCompanyId),
    enabled: shouldCheckCompanyRole,
    staleTime: 60_000,
    retry: 2
  });

  const isTransientRoleFallbackOwner = Boolean(effectiveRoleError && isDirectCompanyOwner);
  const isRoleUnresolved = shouldCheckCompanyRole && !effectiveRoleError && (effectiveRoleLoading || !effectiveRoleInfo);
  const isFailClosedNullRole = shouldCheckCompanyRole && !effectiveRoleError && effectiveRoleInfo?.role === null;
  const isReadOnlyClient = isTransientRoleFallbackOwner
    ? false
    : Boolean(
        isRoleUnresolved ||
          (shouldCheckCompanyRole && effectiveRoleError) ||
          isFailClosedNullRole ||
          effectiveRoleInfo?.isReadOnlyClient ||
          effectiveRoleInfo?.role === 'CLIENTE_LECTURA'
      );
  const effectiveCompanyRole: DespachoRole | 'OWNER' | null = isSupportImpersonation
    ? 'CLIENTE_LECTURA'
    : isTransientRoleFallbackOwner
      ? 'OWNER'
      : shouldCheckCompanyRole
        ? isRoleUnresolved || !effectiveRoleInfo?.role ? null : effectiveRoleInfo.role
        : baseActiveCompany ? 'OWNER' : null;
  const isReadOnlySupportMode = isSupportImpersonation || isReadOnlyClient;
  const isExternalCompanyMember = Boolean(
    isReadOnlyClient ||
      (user && baseActiveCompany?.userId && baseActiveCompany.userId !== 'demo' && baseActiveCompany.userId !== user.id)
  );
  const { data: clientDespachoName } = useQuery({
    queryKey: ['client-despacho-name', resolvedActiveCompanyId, baseActiveCompany?.organizationId],
    queryFn: () => resolveClientDespachoName({ id: resolvedActiveCompanyId, organizationId: baseActiveCompany?.organizationId }),
    enabled: Boolean(resolvedActiveCompanyId && isExternalCompanyMember),
    staleTime: 300_000
  });
  const workspace: UserWorkspace | null = useMemo(() => {
    if (!user || isOwner) return null;
    const displayWsName = isExternalCompanyMember ? (clientDespachoName || 'Despacho Contable') : resolvedWsName;
    return {
      id: String(baseActiveCompany?.organizationId || user.user_metadata?.workspace_id || `ws_${user.id.slice(0, 8)}`),
      name: displayWsName,
      ownerEmail: user.email || ''
    };
  }, [user, isOwner, isExternalCompanyMember, clientDespachoName, resolvedWsName, baseActiveCompany?.organizationId]);

  useEffect(() => {
    setClientReadOnlyMode(isReadOnlyClient);
    return () => setClientReadOnlyMode(false);
  }, [isReadOnlyClient]);

  const periodMutation = useMutation({
    mutationFn: ({ companyId, year, period }: { companyId: string; year: number; period: number }) =>
      apiClient.updateCompanyPeriod(companyId, year, period),
    onSuccess: (updatedCompany, vars) => {
      if (updatedCompany) {
        queryClient.setQueryData<Company[]>(['companies', userScope], (prev = []) =>
          prev.map((c) => (c.id === updatedCompany.id ? updatedCompany : c))
        );
      }
      if (vars.companyId) {
        invalidateAccountingQueries(queryClient, vars.companyId);
      }
    }
  });

  const { mutate: mutatePeriod, isPending: isUpdatingPeriod } = periodMutation;

  const updatePeriod = useCallback(
    (year: number, period: number) => {
      if (!resolvedActiveCompanyId) return;
      setViewedPeriods((prev) => {
        const next = { ...prev, [resolvedActiveCompanyId]: { year, period } };
        saveStoredViewedPeriods(userScope, next);
        return next;
      });
      invalidateAccountingQueries(queryClient, resolvedActiveCompanyId);
      // Solo persistimos periodo compartido en BD si tiene permiso de escritura en ficha (y sin bloquear si falla)
      if (!isReadOnlySupportMode && !isReadOnlyClient && effectiveCompanyRole !== 'AUXILIAR') {
        mutatePeriod({ companyId: resolvedActiveCompanyId, year, period });
      }
    },
    [isReadOnlySupportMode, isReadOnlyClient, effectiveCompanyRole, resolvedActiveCompanyId, userScope, queryClient, mutatePeriod]
  );

  const contextValue = useMemo<CompanyContextValue>(
    () => ({
      workspace,
      renameWorkspace,
      companies: effectiveCompanies,
      activeCompany,
      activeCompanyId: resolvedActiveCompanyId,
      setActiveCompanyId,
      updatePeriod,
      isUpdatingPeriod,
      isLoading: isSupportImpersonation ? supportLoading : isLoading,
      isReadOnlySupportMode,
      isReadOnlyClient,
      effectiveCompanyRole
    }),
    [
      workspace, renameWorkspace, effectiveCompanies, activeCompany, resolvedActiveCompanyId,
      setActiveCompanyId, updatePeriod, isUpdatingPeriod, isSupportImpersonation,
      isReadOnlySupportMode, isReadOnlyClient, effectiveCompanyRole, supportLoading, isLoading
    ]
  );

  return <CompanyContext.Provider value={contextValue}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany debe usarse dentro de CompanyProvider');
  return ctx;
}
