import { useEffect, useRef, type RefObject } from 'react';

interface UsePolizasKeyboardShortcutsParams {
  dialogRef: RefObject<HTMLDialogElement | null>;
  isNewRequested: boolean;
  isLoadingAccounts: boolean;
  isLoadingPeriodLock: boolean;
  isWriteBlocked: boolean;
  accountsCount: number;
  openNewPolizaModal: () => void;
}

export function isEditableElementActive(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement ||
    Boolean((active as HTMLElement).isContentEditable)
  );
}

export function usePolizasKeyboardShortcuts({
  dialogRef,
  isNewRequested,
  isLoadingAccounts,
  isLoadingPeriodLock,
  isWriteBlocked,
  accountsCount,
  openNewPolizaModal
}: UsePolizasKeyboardShortcutsParams) {
  const hasAutoOpenedNewRef = useRef(false);

  useEffect(() => {
    if (!isNewRequested) {
      hasAutoOpenedNewRef.current = false;
      return;
    }
    if (isLoadingAccounts || isLoadingPeriodLock) return;
    if (hasAutoOpenedNewRef.current) return;
    hasAutoOpenedNewRef.current = true;
    if (!isWriteBlocked && accountsCount > 0) {
      openNewPolizaModal();
    }
  }, [
    isNewRequested,
    isLoadingAccounts,
    isLoadingPeriodLock,
    isWriteBlocked,
    accountsCount,
    openNewPolizaModal
  ]);

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.altKey && (e.key === 'n' || e.key === 'N')) || e.key === 'Insert') {
        if (isWriteBlocked) return;
        if (dialogRef.current?.open || document.querySelector('dialog[open]')) return;
        if (isEditableElementActive()) return;
        e.preventDefault();
        openNewPolizaModal();
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [dialogRef, isWriteBlocked, openNewPolizaModal]);
}
