import { useEffect } from 'react';
import type { AccountWithBalance } from '../../shared/types';

interface UseCatalogoKeyboardNavigationProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  ledgerAccountId: string | null;
  isPeriodLocked?: boolean;
  filteredAccounts: AccountWithBalance[];
  selectedAccountId: string | null;
  selectedIndex: number;
  collapsedCodes: Record<string, boolean>;
  setSelectedAccountId: (id: string | null) => void;
  setCollapsedCodes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  openCreateModal: () => void;
  openEditModal: (acc: AccountWithBalance) => void;
  openCreateSubaccountModal: (acc: AccountWithBalance) => void;
  onOpenLedger?: (id: string) => void;
}

export function useCatalogoKeyboardNavigation({
  dialogRef,
  ledgerAccountId,
  isPeriodLocked = false,
  filteredAccounts,
  selectedAccountId,
  selectedIndex,
  collapsedCodes,
  setSelectedAccountId,
  setCollapsedCodes,
  openCreateModal,
  openEditModal,
  openCreateSubaccountModal,
  onOpenLedger
}: UseCatalogoKeyboardNavigationProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isModalOpen = Boolean(
        dialogRef.current?.open || ledgerAccountId || document.querySelector('dialog[open]')
      );
      const activeElement = document.activeElement;
      const isInputActive =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement instanceof HTMLButtonElement ||
        activeElement instanceof HTMLAnchorElement ||
        (activeElement as HTMLElement)?.isContentEditable;

      if (activeElement?.id === 'search-accounts' && !isModalOpen) {
        if (e.key === 'ArrowDown') {
          const first = filteredAccounts[0];
          if (first) {
            e.preventDefault();
            (activeElement as HTMLElement).blur();
            setSelectedAccountId(first.id);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          (activeElement as HTMLElement).blur();
          return;
        }
      }

      // Atajo F3 o / para enfocar el buscador de cuentas contables
      if ((e.key === 'F3' || (e.key === '/' && !isInputActive)) && !isModalOpen) {
        const searchInput = document.getElementById('search-accounts') as HTMLInputElement | null;
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
          return;
        }
      }

      if (isModalOpen || isInputActive) return;

      if (e.altKey && e.key.toLowerCase() === 'n') {
        if (!isPeriodLocked) {
          e.preventDefault();
          openCreateModal();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredAccounts.length === 0) return;
        if (!selectedAccountId || selectedIndex === -1) {
          const first = filteredAccounts[0];
          if (first) setSelectedAccountId(first.id);
        } else {
          const nextIndex = Math.min(filteredAccounts.length - 1, selectedIndex + 1);
          const nextItem = filteredAccounts[nextIndex];
          if (nextItem) setSelectedAccountId(nextItem.id);
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredAccounts.length === 0) return;
        if (!selectedAccountId || selectedIndex === -1) {
          const first = filteredAccounts[0];
          if (first) setSelectedAccountId(first.id);
        } else {
          const prevIndex = Math.max(0, selectedIndex - 1);
          const prevItem = filteredAccounts[prevIndex];
          if (prevItem) setSelectedAccountId(prevItem.id);
        }
        return;
      }

      if (e.key === 'Escape') {
        if (selectedAccountId) {
          e.preventDefault();
          setSelectedAccountId(null);
        }
        return;
      }

      const currentSelected =
        selectedIndex >= 0 && selectedIndex < filteredAccounts.length
          ? filteredAccounts[selectedIndex] ?? null
          : null;

      const isCtrlD = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd';
      const isInsert = e.key === 'Insert';
      if (isCtrlD || isInsert) {
        if (!isPeriodLocked) {
          e.preventDefault();
          if (currentSelected) {
            openCreateSubaccountModal(currentSelected);
          } else if (isInsert) {
            openCreateModal();
          }
        }
        return;
      }

      if (e.key === 'F2' || e.key === 'Enter') {
        if (currentSelected && !isPeriodLocked) {
          e.preventDefault();
          openEditModal(currentSelected);
        }
        return;
      }

      if (e.key === 'Home') {
        e.preventDefault();
        if (filteredAccounts[0]) setSelectedAccountId(filteredAccounts[0].id);
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        const last = filteredAccounts[filteredAccounts.length - 1];
        if (last) setSelectedAccountId(last.id);
        return;
      }

      if (e.key === ' ' && currentSelected && onOpenLedger) {
        e.preventDefault();
        onOpenLedger(currentSelected.id);
        return;
      }

      if (e.key === 'ArrowRight') {
        if (currentSelected && !currentSelected.isAffectable) {
          if (collapsedCodes[currentSelected.code]) {
            e.preventDefault();
            setCollapsedCodes((prev) => ({ ...prev, [currentSelected.code]: false }));
          } else {
            const nextAcc = filteredAccounts[selectedIndex + 1];
            if (nextAcc && nextAcc.parentCode === currentSelected.code) {
              e.preventDefault();
              setSelectedAccountId(nextAcc.id);
            }
          }
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        if (currentSelected) {
          if (!currentSelected.isAffectable && !collapsedCodes[currentSelected.code]) {
            e.preventDefault();
            setCollapsedCodes((prev) => ({ ...prev, [currentSelected.code]: true }));
          } else if (currentSelected.parentCode) {
            const parentAcc = filteredAccounts.find((a) => a.code === currentSelected.parentCode);
            if (parentAcc) {
              e.preventDefault();
              setSelectedAccountId(parentAcc.id);
            }
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    filteredAccounts,
    selectedAccountId,
    selectedIndex,
    collapsedCodes,
    ledgerAccountId,
    isPeriodLocked,
    dialogRef,
    setSelectedAccountId,
    setCollapsedCodes,
    openCreateModal,
    openEditModal,
    openCreateSubaccountModal,
    onOpenLedger
  ]);
}
