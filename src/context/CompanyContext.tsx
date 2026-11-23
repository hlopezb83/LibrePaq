import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, invalidateAccountingQueries } from '../lib/api-client';
import {
  getStoredAdAttribution,
  trackWorkspaceSignupConversion
} from '../lib/analytics';
import { useAuth, checkIsSuperAdmin } from './AuthContext';
import { useSupportSession } from '../lib/support-impersonation';
import { getCurrentFiscalPeriod } from '../shared/date-utils';
import type { Company } from '../shared/types';

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
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user, loading: authLoading, hasAdminAccess } = useAuth();
  const supportSession = useSupportSession();
  const isReadOnlySupportMode = Boolean(supportSession && (hasAdminAccess || checkIsSuperAdmin(user)));
  const isOwner = (hasAdminAccess || checkIsSuperAdmin(user)) && !isReadOnlySupportMode;
  const userScope = user?.id || 'demo';
  const storageKey = `librepaq_company_id_${userScope}`;
  const wsStorageKey = `librepaq_workspace_name_${userScope}`;
  const provisionedUserRef = useRef<string | null>(null);

  const [workspaceNameOverride, setWorkspaceNameOverride] = useState<string | null>(null);

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
  }, [storageKey, wsStorageKey]);

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
    if (!user || isOwner || isReadOnlySupportMode || hasAdminAccess || checkIsSuperAdmin(user)) return;
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
  }, [user, isOwner, isReadOnlySupportMode, hasAdminAccess, defaultWorkspaceName]);

  const renameWorkspace = useCallback(
    async (nextName: string) => {
      if (isReadOnlySupportMode) return;
      const clean = nextName.trim();
      if (!clean || !user) return;
      setWorkspaceNameOverride(clean);
      try {
        localStorage.setItem(wsStorageKey, clean);
      } catch {
        // ignore storage errors
      }
      const wsId = String(user.user_metadata?.workspace_id || `ws_${user.id.slice(0, 8)}`);
      await apiClient.updateUserProfileWorkspace({
        userId: user.id,
        workspaceId: wsId,
        workspaceName: clean
      });
    },
    [isReadOnlySupportMode, user, wsStorageKey]
  );

  const { data: supportDetail, isLoading: supportLoading } = useQuery({
    queryKey: ['support-company-detail', supportSession?.companyId],
    queryFn: () => apiClient.getAdminCompanyDetail(supportSession!.companyId),
    enabled: Boolean(isReadOnlySupportMode && supportSession?.companyId)
  });

  const { data: companies = [], isLoading, isError } = useQuery({
    queryKey: ['companies', userScope],
    queryFn: apiClient.getCompanies,
    enabled: Boolean(user) && !authLoading && !hasAdminAccess && !checkIsSuperAdmin(user)
  });

  const supportCompany: Company | null = useMemo(() => {
    if (!isReadOnlySupportMode || !supportSession) return null;
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
  }, [isReadOnlySupportMode, supportSession, supportDetail]);

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
        queryClient.setQueryData<Company[]>(['companies', userScope], (prev = []) => {
          const filtered = prev.filter((c) => c.id !== newCompany.id);
          return [...filtered, newCompany];
        });
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

  const activeCompany = supportCompany ?? companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? null;

  const resolvedActiveCompanyId = activeCompany?.id ?? '';

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
      if (isReadOnlySupportMode || !resolvedActiveCompanyId) return;
      mutatePeriod({ year, period });
    },
    [isReadOnlySupportMode, resolvedActiveCompanyId, mutatePeriod]
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
      isLoading: isReadOnlySupportMode ? supportLoading : isLoading,
      isReadOnlySupportMode
    }),
    [
      workspace,
      renameWorkspace,
      effectiveCompanies,
      activeCompany,
      resolvedActiveCompanyId,
      setActiveCompanyId,
      updatePeriod,
      isUpdatingPeriod,
      isReadOnlySupportMode,
      supportLoading,
      isLoading
    ]
  );

  return (
    <CompanyContext.Provider value={contextValue}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error('useCompany debe usarse dentro de CompanyProvider');
  }
  return ctx;
}
