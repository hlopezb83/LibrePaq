import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, invalidateAccountingQueries } from '../lib/api-client';
import { getStoredAdAttribution, trackWorkspaceSignupConversion } from '../lib/analytics';
import { useAuth, checkIsSuperAdmin } from './AuthContext';
import { setClientReadOnlyMode, useSupportSession } from '../lib/support-impersonation';
import { workspaceRbacClient } from '../lib/workspace-rbac-client';
import { getCurrentFiscalPeriod } from '../shared/date-utils';
import { loadStoredViewedPeriods, saveStoredViewedPeriods, type ViewedPeriodsMap } from './companyPeriodStorage';
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

  const [activeCompanyId, setActiveCompanyIdState] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      const urlComp =
        new URLSearchParams(window.location.search).get('companyId') ||
        new URLSearchParams(window.location.search).get('company');
      if (urlComp) return urlComp;
    }
    return localStorage.getItem(storageKey) || '';
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      const urlComp =
        new URLSearchParams(window.location.search).get('companyId') ||
        new URLSearchParams(window.location.search).get('company');
      if (urlComp) {
        setActiveCompanyIdState(urlComp);
        localStorage.setItem(storageKey, urlComp);
        return;
      }
    }
    const saved = localStorage.getItem(storageKey) || '';
    setActiveCompanyIdState(saved);
    setWorkspaceNameOverride(localStorage.getItem(wsStorageKey));
    setViewedPeriods(loadStoredViewedPeriods(userScope));
  }, [storageKey, wsStorageKey, userScope]);

  const defaultWorkspaceName = user
    ? `Despacho Contable — ${user.user_metadata?.full_name || user.email?.split('@')[0] || 'Mi Cartera'}`
    : 'Mi Despacho Contable';

  const rawWsName = workspaceNameOverride || user?.user_metadata?.workspace_name;
  const resolvedWsName = rawWsName
    ? String(rawWsName).replace(/^Workspace(\s*[-—]\s*|\s+)/i, 'Despacho Contable — ')
    : defaultWorkspaceName;

  const workspace: UserWorkspace | null = useMemo(() => {
    if (!user || isOwner) return null;
    return {
      id: String(user.user_metadata?.workspace_id || `ws_${user.id.slice(0, 8)}`),
      name: resolvedWsName,
      ownerEmail: user.email || ''
    };
  }, [user, isOwner, resolvedWsName]);

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

  const supportCompany: Company | null = useMemo(() => {
    if (!isSupportImpersonation || !supportSession) return null;
    const d = supportDetail?.company;
    return {
      id: supportSession.companyId,
      name: d?.name || supportSession.companyName,
      rfc: d?.rfc || supportSession.companyRfc,
      regimenFiscal: d?.regimenFiscal || '601 - General de Ley Personas Morales',
      codigoPostal: d?.codigoPostal || '64000',
      maskFormat: 'XXX-XX-XXX',
      currentYear: d?.currentYear ?? getCurrentFiscalPeriod().year,
      currentPeriod: d?.currentPeriod ?? 1,
      createdAt: d?.createdAt || supportSession.startedAt,
      userId: d?.userId ?? null
    };
  }, [isSupportImpersonation, supportSession, supportDetail]);

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

  const { data: effectiveRoleInfo, isLoading: effectiveRoleLoading } = useQuery({
    queryKey: ['effective-company-role', resolvedActiveCompanyId, user?.id],
    queryFn: () => workspaceRbacClient.getEffectiveCompanyRole(resolvedActiveCompanyId),
    enabled: shouldCheckCompanyRole,
    staleTime: 60_000,
    retry: false
  });

  const isRoleUnresolved = shouldCheckCompanyRole && (effectiveRoleLoading || !effectiveRoleInfo);
  const isFailClosedNullRole = shouldCheckCompanyRole && effectiveRoleInfo?.role === null;
  const isReadOnlyClient = Boolean(
    isRoleUnresolved || isFailClosedNullRole ||
      effectiveRoleInfo?.isReadOnlyClient || effectiveRoleInfo?.role === 'CLIENTE_LECTURA'
  );
  const effectiveCompanyRole: DespachoRole | 'OWNER' | null = isSupportImpersonation
    ? 'CLIENTE_LECTURA'
    : shouldCheckCompanyRole
      ? isRoleUnresolved || !effectiveRoleInfo?.role ? null : effectiveRoleInfo.role
      : baseActiveCompany ? 'OWNER' : null;
  const isReadOnlySupportMode = isSupportImpersonation || isReadOnlyClient;

  useEffect(() => {
    setClientReadOnlyMode(isReadOnlyClient);
    return () => setClientReadOnlyMode(false);
  }, [isReadOnlyClient]);

  const periodMutation = useMutation({
    mutationFn: ({ year, period }: { year: number; period: number }) =>
      apiClient.updateCompanyPeriod(resolvedActiveCompanyId, year, period),
    onSuccess: (updatedCompany) => {
      if (updatedCompany) {
        queryClient.setQueryData<Company[]>(['companies', userScope], (prev = []) =>
          prev.map((c) => (c.id === updatedCompany.id ? updatedCompany : c))
        );
      }
      if (resolvedActiveCompanyId) {
        invalidateAccountingQueries(queryClient, resolvedActiveCompanyId);
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
        mutatePeriod({ year, period });
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
