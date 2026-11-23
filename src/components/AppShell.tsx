import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../context/CompanyContext';
import { MESES_SAT } from '../shared/sat-constants';
import { useToast } from '../context/ToastContext';
import type { Company } from '../shared/types';
import { getCompanyTheme } from './company-switcher/companyThemes';
import { useAuth, checkIsSuperAdmin } from '../context/AuthContext';
import { useUIModal } from '../context/UIModalContext';
import { useSupportSession } from '../lib/support-impersonation';
import { AppShellSidebar } from './shell/AppShellSidebar';
import { AppShellTopHeader } from './shell/AppShellTopHeader';
import { AppShellFooter } from './shell/AppShellFooter';
import { AppShellCompanyAlert } from './shell/AppShellCompanyAlert';
import { APP_SHELL_NAV_ITEMS, SUPERADMIN_NAV_ITEMS } from './shell/appShellNavItems';
import { useAppShellKeyboard } from './shell/useAppShellKeyboard';
import { AppShellModals } from './shell/AppShellModals';
import { parseNavTarget } from './shell/parseNavTarget';
import { useSupportModeExit } from './shell/useSupportModeExit';
import { useAppShellDocumentTitle } from './shell/useAppShellDocumentTitle';
import { useAppShellData } from './shell/useAppShellData';
import { WhatsAppSupportButton } from './WhatsAppSupportButton';
import { BroadcastBanner } from './shell/BroadcastBanner';
import { SupportModeBanner } from './shell/SupportModeBanner';
import { ExecutiveTopHeader } from './shell/ExecutiveTopHeader';
import { WorkspaceEmptyView } from './workspace/WorkspaceEmptyView';
import { SandboxDemoBanner } from './workspace/SandboxDemoBanner';
import { isSandboxDemoCompany } from '../lib/sandbox-demo-constants';
import { GuestDemoBanner } from './shell/GuestDemoBanner';
import { AppErrorBoundary } from './AppErrorBoundary';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { workspace, renameWorkspace, companies, activeCompany, activeCompanyId, setActiveCompanyId, updatePeriod, isLoading: companiesLoading, isReadOnlySupportMode } = useCompany();
  const activeYear = activeCompany?.currentYear;
  const activePeriod = activeCompany?.currentPeriod;
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const wizardDialogRef = useRef<HTMLDialogElement>(null), switcherDialogRef = useRef<HTMLDialogElement>(null);
  const cmdDialogRef = useRef<HTMLDialogElement>(null), cmdInputRef = useRef<HTMLInputElement>(null);
  const shortcutsDialogRef = useRef<HTMLDialogElement>(null), authDialogRef = useRef<HTMLDialogElement>(null);

  const { user, loading: authLoading, hasAdminAccess, signOut } = useAuth();
  const supportSession = useSupportSession();
  const toast = useToast();

  const [hasOpenedCmd, setHasOpenedCmd] = useState(false);
  const [hasOpenedWizard, setHasOpenedWizard] = useState(false);
  const [hasOpenedSwitcher, setHasOpenedSwitcher] = useState(false);
  const [hasOpenedShortcuts, setHasOpenedShortcuts] = useState(false);
  const [hasOpenedAuth, setHasOpenedAuth] = useState(false);

  const [lastSwitchedCompany, setLastSwitchedCompany] = useState<Company | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return (
        (localStorage.getItem('librepaq_sidebar_collapsed') ??
          localStorage.getItem('libre_contpaq_sidebar_collapsed')) === 'true'
      );
    } catch {
      return false;
    }
  });
  const [cmdQuery, setCmdQuery] = useState('');
  const { globalLedgerAccountId, openLedger, closeLedger } = useUIModal();

  const currentTheme = useMemo(
    () => (activeCompany ? getCompanyTheme(activeCompany.rfc) : getCompanyTheme('')),
    [activeCompany]
  );

  const openModalWithRef = useCallback((
    ref: React.RefObject<HTMLDialogElement | null>,
    hasOpened: boolean,
    setHasOpened: (v: boolean) => void,
    onOpened?: () => void
  ) => {
    const showSafe = (attempt = 0) => {
      const el = ref.current;
      if (el) {
        if (!el.open) el.showModal();
        onOpened?.();
      } else if (attempt < 15) {
        requestAnimationFrame(() => showSafe(attempt + 1));
      }
    };
    if (!hasOpened) setHasOpened(true);
    requestAnimationFrame(() => showSafe(0));
  }, []);

  const openCompanySwitcherModal = useCallback(() => openModalWithRef(switcherDialogRef, hasOpenedSwitcher, setHasOpenedSwitcher, () => switcherDialogRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()), [openModalWithRef, hasOpenedSwitcher]);
  const openShortcutsModal = useCallback(() => openModalWithRef(shortcutsDialogRef, hasOpenedShortcuts, setHasOpenedShortcuts, () => shortcutsDialogRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()), [openModalWithRef, hasOpenedShortcuts]);
  const openNewCompanyModal = useCallback(() => openModalWithRef(wizardDialogRef, hasOpenedWizard, setHasOpenedWizard, () => wizardDialogRef.current?.querySelector<HTMLInputElement>('#wizard-comp-name')?.focus()), [openModalWithRef, hasOpenedWizard]);
  const openAuthModal = useCallback(() => openModalWithRef(authDialogRef, hasOpenedAuth, setHasOpenedAuth, () => authDialogRef.current?.querySelector<HTMLInputElement>('#auth-fullname, #auth-email')?.focus()), [openModalWithRef, hasOpenedAuth]);
  const openCommandPaletteModal = useCallback(() => {
    setCmdQuery('');
    openModalWithRef(cmdDialogRef, hasOpenedCmd, setHasOpenedCmd, () => cmdInputRef.current?.focus());
  }, [openModalWithRef, hasOpenedCmd]);

  const { isModalOpen, closeModal } = useUIModal();
  useEffect(() => { if (isModalOpen('COMPANY_WIZARD')) openNewCompanyModal(); }, [isModalOpen, openNewCompanyModal]);
  useEffect(() => {
    const wizardEl = wizardDialogRef.current;
    if (!wizardEl) return;
    const onClose = () => closeModal('COMPANY_WIZARD');
    wizardEl.addEventListener('close', onClose);
    return () => wizardEl.removeEventListener('close', onClose);
  }, [hasOpenedWizard, closeModal]);
  useEffect(() => { try { localStorage.setItem('librepaq_sidebar_collapsed', String(sidebarCollapsed)); } catch {} }, [sidebarCollapsed]);

  const isPublicPage = ['/landing', '/privacy', '/terms', '/reset-password'].includes(currentPath) || (!user && currentPath === '/');
  const { accounts, polizas, periodLock, togglePeriodLockMutation } = useAppShellData({
    activeCompanyId, activeYear, activePeriod, isPublicPage, hasOpenedCmd, toast
  });


  const hasPlatformRole = hasAdminAccess || checkIsSuperAdmin(user);
  const isOwner = hasPlatformRole && !isReadOnlySupportMode;
  const navItems = isOwner ? SUPERADMIN_NAV_ITEMS : APP_SHELL_NAV_ITEMS;
  const isWorkspaceEmpty = Boolean(user && !hasPlatformRole && !companiesLoading && companies.length === 0);

  const navigateToCompanies = useCallback(
    () => void navigate({ to: '/admin', search: { tab: 'companies' } }),
    [navigate]
  );

  const { isExitingSupport, handleExitSupportMode } = useSupportModeExit({
    supportSession,
    isReadOnlySupportMode,
    currentPath,
    authLoading,
    queryClient,
    navigateToCompanies
  });

  const navigateTarget = useCallback(
    (opts: { to: string; search?: Record<string, string> }) => {
      const parsed = parseNavTarget(opts.to);
      return navigate({ to: parsed.to, search: opts.search ?? parsed.search });
    },
    [navigate]
  );

  useEffect(() => {
    if (!authLoading && user && isOwner && currentPath === '/') {
      void navigate({ to: '/admin' });
    }
  }, [authLoading, user, isOwner, currentPath, navigate]);

  useAppShellDocumentTitle({
    currentPath,
    activeCompany,
    navItems,
    isOwner,
    user,
    isWorkspaceEmpty,
    onPathChange: useCallback(() => setMobileMenuOpen(false), [])
  });

  const stepPeriod = (delta: number) => {
    if (!activeCompany) return;
    const nextPeriod = Math.max(1, Math.min(13, activeCompany.currentPeriod + delta));
    if (nextPeriod !== activeCompany.currentPeriod) {
      updatePeriod(activeCompany.currentYear, nextPeriod);
      const nextMes = MESES_SAT.find((m) => m.periodo === nextPeriod)?.nombre || `P${nextPeriod}`;
      toast.info(`Periodo contable: ${nextMes} ${activeCompany.currentYear}`);
    }
  };

  useAppShellKeyboard({
    shortcutsDialogRef,
    cmdDialogRef,
    switcherDialogRef,
    openShortcutsModal,
    openCommandPaletteModal,
    openCompanySwitcherModal,
    setSidebarCollapsed,
    navItems,
    navigate: navigateTarget,
    stepPeriod,
    activeCompany,
    isOwner
  });

  useEffect(() => {
    if (!authLoading && !user && !isPublicPage) {
      void navigate({ to: '/' });
    }
  }, [authLoading, user, isPublicPage, navigate]);

  if (isPublicPage) {
    return (
      <main id="main-content" className="min-h-screen bg-white focus:outline-none relative" tabIndex={-1}>
        {children}
        <WhatsAppSupportButton />
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F3F5F8] text-slate-900">
      <a
        href="#main-content"
        className="visually-hidden focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-blue-700 focus:text-white focus:text-xs focus:font-bold focus:shadow-lg"
      >
        Saltar al contenido contable principal
      </a>

      <AppShellSidebar
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        currentPath={currentPath}
        navItems={navItems}
        onOpenCommandPalette={openCommandPaletteModal}
        isWorkspaceEmpty={isWorkspaceEmpty}
        onEmptyModuleClick={(label) =>
          toast.info(`Crea tu primera empresa o abre la Empresa Ejemplo para usar "${label}".`)
        }
        user={user}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <GuestDemoBanner
          isGuest={Boolean(user?.user_metadata?.is_guest)}
          onOpenAuth={openAuthModal}
          onSignOut={signOut}
        />
        <div className="sticky top-0 z-30 no-print">
          {isReadOnlySupportMode && supportSession && (
            <SupportModeBanner session={supportSession} onExit={() => void handleExitSupportMode()} isExiting={isExitingSupport} />
          )}
          {isOwner ? (
            <ExecutiveTopHeader user={user} onSignOut={signOut} />
          ) : (
            <AppShellTopHeader
              workspaceName={workspace?.name}
              activeCompany={activeCompany}
              currentTheme={currentTheme}
              onOpenCompanySwitcher={openCompanySwitcherModal}
              onOpenNewCompany={openNewCompanyModal}
              onOpenAuth={openAuthModal}
              stepPeriod={stepPeriod}
              updatePeriod={updatePeriod}
              isPeriodLocked={Boolean(periodLock?.isLocked)}
              isTogglingLock={togglePeriodLockMutation.isPending}
              onTogglePeriodLock={(next) => togglePeriodLockMutation.mutate(next)}
              user={user}
              onSignOut={signOut}
            />
          )}
        </div>
        <BroadcastBanner />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-3 sm:p-4 lg:p-5 max-w-[1800px] w-full mx-auto focus:outline-none"
        >
          {activeCompany && !isOwner && isSandboxDemoCompany(activeCompany) && (
            <SandboxDemoBanner
              company={activeCompany}
              onOpenNewCompanyWizard={openNewCompanyModal}
              onDemoDeleted={() => setLastSwitchedCompany(null)}
            />
          )}

          {lastSwitchedCompany && !isOwner && (
            <AppShellCompanyAlert
              company={lastSwitchedCompany}
              currentTheme={currentTheme}
              onDismiss={() => setLastSwitchedCompany(null)}
            />
          )}

          {isWorkspaceEmpty ? (
            <WorkspaceEmptyView
              workspace={workspace}
              onRenameWorkspace={renameWorkspace}
              onOpenNewCompanyWizard={openNewCompanyModal}
              onCompanyRestored={(id, comp) => setActiveCompanyId(id, comp)}
            />
          ) : (
            <AppErrorBoundary>
              {children}
            </AppErrorBoundary>
          )}
        </main>

        {activeCompany && !isOwner && (
          <AppShellFooter
            activeCompany={activeCompany}
            currentTheme={currentTheme}
            onOpenShortcuts={openShortcutsModal}
            accounts={accounts}
          />
        )}
      </div>

      <AppErrorBoundary>
        <AppShellModals
          activeCompanyId={activeCompanyId}
          globalLedgerAccountId={globalLedgerAccountId}
          setGlobalLedgerAccountId={(id) => (id ? openLedger(id) : closeLedger())}
          cmdDialogRef={cmdDialogRef}
          cmdInputRef={cmdInputRef}
          cmdQuery={cmdQuery}
          setCmdQuery={setCmdQuery}
          navItems={navItems}
          accounts={accounts}
          companies={companies}
          activeCompany={activeCompany}
          polizas={polizas}
          navigate={navigateTarget}
          setActiveCompanyId={setActiveCompanyId}
          updatePeriod={updatePeriod}
          openCompanySwitcherModal={openCompanySwitcherModal}
          openNewCompanyModal={openNewCompanyModal}
          wizardDialogRef={wizardDialogRef}
          switcherDialogRef={switcherDialogRef}
          shortcutsDialogRef={shortcutsDialogRef}
          authDialogRef={authDialogRef}
          setLastSwitchedCompany={setLastSwitchedCompany}
          toast={toast}
          hasOpenedCmd={hasOpenedCmd}
          hasOpenedWizard={hasOpenedWizard}
          hasOpenedSwitcher={hasOpenedSwitcher}
          hasOpenedShortcuts={hasOpenedShortcuts}
          hasOpenedAuth={hasOpenedAuth}
        />
      </AppErrorBoundary>

      {!isOwner && <WhatsAppSupportButton />}
    </div>
  );
}
