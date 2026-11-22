import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export type DeliverableTabId = 'DOSSIER' | 'BALANZA' | 'RESULTADOS' | 'BALANCE' | 'DIA17' | 'CONFIG';

export type UIModalId =
  | 'COMPANY_WIZARD'
  | 'COMPANY_SWITCHER'
  | 'SHORTCUTS'
  | 'AUTH'
  | 'DELIVERABLES'
  | 'COMMAND_PALETTE';

interface UIModalContextValue {
  openModal: (id: UIModalId) => void;
  closeModal: (id: UIModalId) => void;
  closeAllModals: () => void;
  isModalOpen: (id: UIModalId) => boolean;
  openCompanyWizard: () => void;
  openCompanySwitcher: () => void;
  openShortcuts: () => void;
  openAuth: () => void;
  deliverablesTab: DeliverableTabId;
  openDeliverables: (tab?: DeliverableTabId) => void;
  globalLedgerAccountId: string | null;
  openLedger: (accountId: string) => void;
  closeLedger: () => void;
}

const UIModalContext = createContext<UIModalContextValue | null>(null);

export function UIModalProvider({ children }: { children: React.ReactNode }) {
  const [openModals, setOpenModals] = useState<Record<UIModalId, boolean>>({
    COMPANY_WIZARD: false,
    COMPANY_SWITCHER: false,
    SHORTCUTS: false,
    AUTH: false,
    DELIVERABLES: false,
    COMMAND_PALETTE: false
  });

  const [globalLedgerAccountId, setGlobalLedgerAccountId] = useState<string | null>(null);
  const [deliverablesTab, setDeliverablesTab] = useState<DeliverableTabId>('DOSSIER');

  const openModal = useCallback((id: UIModalId) => {
    setOpenModals((prev) => ({ ...prev, [id]: true }));
  }, []);

  const closeModal = useCallback((id: UIModalId) => {
    setOpenModals((prev) => ({ ...prev, [id]: false }));
  }, []);

  const closeAllModals = useCallback(() => {
    setOpenModals({
      COMPANY_WIZARD: false,
      COMPANY_SWITCHER: false,
      SHORTCUTS: false,
      AUTH: false,
      DELIVERABLES: false,
      COMMAND_PALETTE: false
    });
    setGlobalLedgerAccountId(null);
    setDeliverablesTab('DOSSIER');
  }, []);

  const isModalOpen = useCallback(
    (id: UIModalId) => Boolean(openModals[id]),
    [openModals]
  );

  const openCompanyWizard = useCallback(() => openModal('COMPANY_WIZARD'), [openModal]);
  const openCompanySwitcher = useCallback(() => openModal('COMPANY_SWITCHER'), [openModal]);
  const openShortcuts = useCallback(() => openModal('SHORTCUTS'), [openModal]);
  const openAuth = useCallback(() => openModal('AUTH'), [openModal]);
  const openDeliverables = useCallback((tab: DeliverableTabId = 'DOSSIER') => {
    setDeliverablesTab(tab);
    openModal('DELIVERABLES');
  }, [openModal]);
  const openLedger = useCallback((accId: string) => setGlobalLedgerAccountId(accId), []);
  const closeLedger = useCallback(() => setGlobalLedgerAccountId(null), []);

  const value = useMemo<UIModalContextValue>(() => ({
    openModal,
    closeModal,
    closeAllModals,
    isModalOpen,
    openCompanyWizard,
    openCompanySwitcher,
    openShortcuts,
    openAuth,
    deliverablesTab,
    openDeliverables,
    globalLedgerAccountId,
    openLedger,
    closeLedger
  }), [
    openModal,
    closeModal,
    closeAllModals,
    isModalOpen,
    openCompanyWizard,
    openCompanySwitcher,
    openShortcuts,
    openAuth,
    deliverablesTab,
    openDeliverables,
    globalLedgerAccountId,
    openLedger,
    closeLedger
  ]);

  return <UIModalContext.Provider value={value}>{children}</UIModalContext.Provider>;
}

export function useUIModal(): UIModalContextValue {
  const ctx = useContext(UIModalContext);
  if (!ctx) {
    throw new Error('useUIModal must be used within a UIModalProvider');
  }
  return ctx;
}
