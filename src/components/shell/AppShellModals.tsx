import React, { Suspense, lazy } from 'react';
import type { Company, AccountWithBalance, Poliza } from '../../shared/types';
import type { CommandPaletteNavItem } from '../command-palette/CommandPaletteModal';
import type { ToastContextType } from '../../context/ToastContext';
import { useUIModal } from '../../context/UIModalContext';
import { MESES_SAT } from '../../shared/sat-constants';
import { parseNavTarget } from './parseNavTarget';

const CommandPaletteModal = lazy(() =>
  import('../command-palette/CommandPaletteModal').then((m) => ({ default: m.CommandPaletteModal }))
);
const CompanySwitcherModal = lazy(() =>
  import('../company-switcher/CompanySwitcherModal').then((m) => ({ default: m.CompanySwitcherModal }))
);
const AuthModal = lazy(() =>
  import('../auth/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const AccountLedgerModal = lazy(() =>
  import('../account-ledger/AccountLedgerModal').then((m) => ({ default: m.AccountLedgerModal }))
);
const CompanyOnboardingWizardModal = lazy(() =>
  import('../onboarding/CompanyOnboardingWizardModal').then((m) => ({
    default: m.CompanyOnboardingWizardModal
  }))
);
const KeyboardShortcutsModal = lazy(() =>
  import('../keyboard-shortcuts/KeyboardShortcutsModal').then((m) => ({
    default: m.KeyboardShortcutsModal
  }))
);
const ExecutiveDeliverablePackageModal = lazy(() =>
  import('../deliverables/ExecutiveDeliverablePackageModal').then((m) => ({
    default: m.ExecutiveDeliverablePackageModal
  }))
);

interface AppShellModalsProps {
  activeCompanyId: string;
  globalLedgerAccountId: string | null;
  setGlobalLedgerAccountId: (id: string | null) => void;
  cmdDialogRef: React.RefObject<HTMLDialogElement | null>;
  cmdInputRef: React.RefObject<HTMLInputElement | null>;
  cmdQuery: string;
  setCmdQuery: (q: string) => void;
  navItems: CommandPaletteNavItem[];
  accounts: AccountWithBalance[];
  companies: Company[];
  activeCompany: Company | null;
  polizas: Poliza[];
  navigate: (opts: { to: string; search?: Record<string, string> }) => void;
  setActiveCompanyId: (id: string, comp?: Company) => void;
  updatePeriod: (year: number, period: number) => void;
  openCompanySwitcherModal: () => void;
  openNewCompanyModal: () => void;
  wizardDialogRef: React.RefObject<HTMLDialogElement | null>;
  switcherDialogRef: React.RefObject<HTMLDialogElement | null>;
  shortcutsDialogRef: React.RefObject<HTMLDialogElement | null>;
  authDialogRef: React.RefObject<HTMLDialogElement | null>;
  setLastSwitchedCompany: (comp: Company | null) => void;
  toast: ToastContextType;
  hasOpenedCmd?: boolean;
  hasOpenedWizard?: boolean;
  hasOpenedSwitcher?: boolean;
  hasOpenedShortcuts?: boolean;
  hasOpenedAuth?: boolean;
  isReadOnlyClient?: boolean;
  isOwner?: boolean;
  isWorkspaceEmpty?: boolean;
}

export function AppShellModals({
  activeCompanyId,
  globalLedgerAccountId,
  setGlobalLedgerAccountId,
  cmdDialogRef,
  cmdInputRef,
  cmdQuery,
  setCmdQuery,
  navItems,
  accounts,
  companies,
  activeCompany,
  polizas,
  navigate,
  setActiveCompanyId,
  updatePeriod,
  openCompanySwitcherModal,
  openNewCompanyModal,
  wizardDialogRef,
  switcherDialogRef,
  shortcutsDialogRef,
  authDialogRef,
  setLastSwitchedCompany,
  toast,
  hasOpenedCmd = false,
  hasOpenedWizard = false,
  hasOpenedSwitcher = false,
  hasOpenedShortcuts = false,
  hasOpenedAuth = false,
  isReadOnlyClient = false,
  isOwner = false,
  isWorkspaceEmpty = false
}: AppShellModalsProps) {
  const { isModalOpen, closeModal, deliverablesTab, openDeliverables } = useUIModal();

  return (
    <Suspense fallback={null}>
      {/* Modal Global de Libro Mayor / Tarjeta Auxiliar */}
      {globalLedgerAccountId && (
        <AccountLedgerModal
          companyId={activeCompanyId}
          accountId={globalLedgerAccountId}
          onClose={() => setGlobalLedgerAccountId(null)}
        />
      )}

      {/* Modal Nativo <dialog> Paleta de Comandos Rápidos (Ctrl+K) */}
      {hasOpenedCmd && (
        <CommandPaletteModal
          dialogRef={cmdDialogRef}
          inputRef={cmdInputRef}
          query={cmdQuery}
          onQueryChange={setCmdQuery}
          navItems={navItems}
          accounts={accounts}
          companies={companies}
          activeCompany={activeCompany}
          polizas={polizas}
          onSelectRoute={(to) => navigate(parseNavTarget(to))}
          onSelectAccount={(id) => setGlobalLedgerAccountId(id)}
          onSelectCompany={(id) => {
            const comp = companies.find((c) => c.id === id);
            if (comp && comp.id !== activeCompanyId) {
              setLastSwitchedCompany(comp);
            }
            setActiveCompanyId(id);
            if (comp) {
              toast.success(`Empresa activa: ${comp.name} (${comp.rfc})`);
            }
          }}
          onSelectPeriod={(year, period) => {
            updatePeriod(year, period);
            const mesNombre = MESES_SAT.find((m) => m.periodo === period)?.nombre || `P${period}`;
            toast.info(`Periodo contable cambiado a: ${mesNombre} ${year}`);
          }}
          onOpenCompanySwitcher={openCompanySwitcherModal}
          onOpenNewCompanyWizard={openNewCompanyModal}
          onOpenDeliverables={() => openDeliverables('DOSSIER')}
          isReadOnlyClient={isReadOnlyClient}
          isOwner={isOwner}
          isWorkspaceEmpty={isWorkspaceEmpty}
        />
      )}

      {/* Asistente Guiado de Onboarding para Nueva Empresa (Multi-paso) */}
      {hasOpenedWizard && (
        <CompanyOnboardingWizardModal
          dialogRef={wizardDialogRef}
          onClose={() => closeModal('COMPANY_WIZARD')}
          onCompanyCreated={(newId, createdComp) => {
            setLastSwitchedCompany(createdComp || null);
            setActiveCompanyId(newId, createdComp);
            if (createdComp) {
              toast.info(`Bienvenido a ${createdComp.name} (${createdComp.rfc})`);
            }
            navigate({ to: '/' });
          }}
        />
      )}

      {/* Modal Conmutador de Empresa Activa */}
      {hasOpenedSwitcher && (
        <CompanySwitcherModal
          dialogRef={switcherDialogRef}
          companies={companies}
          activeCompanyId={activeCompanyId}
          onSelectCompany={(comp) => {
            setLastSwitchedCompany(comp);
            setActiveCompanyId(comp.id);
            toast.info(`Espacio contable abierto: ${comp.name} (${comp.rfc})`);
          }}
          onOpenNewCompanyWizard={openNewCompanyModal}
        />
      )}

      {/* Centro Unificado de Atajos de Teclado (F1 / ?) */}
      {hasOpenedShortcuts && (
        <KeyboardShortcutsModal
          dialogRef={shortcutsDialogRef}
          onNavigate={(to) => navigate(parseNavTarget(to))}
        />
      )}

      {/* Modal de Autenticación y Acceso a la Nube */}
      {hasOpenedAuth && (
        <AuthModal dialogRef={authDialogRef} />
      )}

      {/* Modal Centralizado de Entregables Contables y Fiscales */}
      {activeCompany && isModalOpen('DELIVERABLES') && (
        <ExecutiveDeliverablePackageModal
          key={activeCompany.id}
          isOpen={true}
          onClose={() => closeModal('DELIVERABLES')}
          company={activeCompany}
          year={activeCompany.currentYear}
          period={activeCompany.currentPeriod}
          initialTab={deliverablesTab}
        />
      )}
    </Suspense>
  );
}
