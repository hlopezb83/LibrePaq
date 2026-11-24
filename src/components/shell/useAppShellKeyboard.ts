import { useEffect } from 'react';
import type { Company } from '../../shared/types';
import type { CommandPaletteNavItem } from '../command-palette/CommandPaletteModal';
import { parseNavTarget } from './parseNavTarget';

interface UseAppShellKeyboardProps {
  shortcutsDialogRef: React.RefObject<HTMLDialogElement | null>;
  cmdDialogRef: React.RefObject<HTMLDialogElement | null>;
  switcherDialogRef: React.RefObject<HTMLDialogElement | null>;
  openShortcutsModal: () => void;
  openCommandPaletteModal: () => void;
  openCompanySwitcherModal: () => void;
  closeAllModals?: () => void;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  navItems: CommandPaletteNavItem[];
  navigate: (opts: { to: string; search?: Record<string, string> }) => void;
  stepPeriod: (delta: number) => void;
  activeCompany: Company | null;
  isOwner?: boolean;
  isPublicPage?: boolean;
  disableCommandPalette?: boolean;
  onEmptyModuleShortcut?: (label: string) => void;
}

export function useAppShellKeyboard({
  shortcutsDialogRef,
  cmdDialogRef,
  switcherDialogRef,
  openShortcutsModal,
  openCommandPaletteModal,
  openCompanySwitcherModal,
  closeAllModals,
  setSidebarCollapsed,
  navItems,
  navigate,
  stepPeriod,
  activeCompany,
  isOwner = false,
  isPublicPage = false,
  disableCommandPalette = false,
  onEmptyModuleShortcut
}: UseAppShellKeyboardProps) {
  useEffect(() => {
    if (isPublicPage) return;

    const isEditableTarget = () => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return false;
      const tag = active.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || active.isContentEditable;
    };

    const hasOtherOpenDialog = (selfDialog?: HTMLDialogElement | null) => {
      const openDialogs = document.querySelectorAll('dialog[open]');
      return Array.from(openDialogs).some((d) => d !== selfDialog);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        if (hasOtherOpenDialog(shortcutsDialogRef.current)) return;
        if (!shortcutsDialogRef.current?.open) {
          openShortcutsModal();
        } else {
          shortcutsDialogRef.current?.close();
        }
        return;
      }

      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!isEditableTarget()) {
          e.preventDefault();
          if (hasOtherOpenDialog(shortcutsDialogRef.current)) return;
          if (!shortcutsDialogRef.current?.open) {
            openShortcutsModal();
          } else {
            shortcutsDialogRef.current?.close();
          }
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        if (disableCommandPalette) return;
        e.preventDefault();
        if (hasOtherOpenDialog(cmdDialogRef.current)) return;
        if (!cmdDialogRef.current?.open) {
          openCommandPaletteModal();
        } else {
          cmdDialogRef.current?.close();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        if (!isEditableTarget()) {
          e.preventDefault();
          if (hasOtherOpenDialog(switcherDialogRef.current)) return;
          if (!switcherDialogRef.current?.open) {
            openCompanySwitcherModal();
          } else {
            switcherDialogRef.current?.close();
          }
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        if (!isEditableTarget()) {
          if (document.querySelector('dialog[open]')) return;
          e.preventDefault();
          setSidebarCollapsed((prev) => !prev);
          return;
        }
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && !isEditableTarget()) {
        const idx = Number(e.key) - 1;
        const targetItem = Number.isInteger(idx) && idx >= 0 ? navItems[idx] : undefined;
        if (targetItem) {
          e.preventDefault();
          document.querySelectorAll('dialog[open]').forEach((d) => {
            if (d instanceof HTMLDialogElement) d.close();
          });
          closeAllModals?.();
          const parsed = parseNavTarget(targetItem.to);
          if (!activeCompany && !isOwner && idx > 0 && !parsed.to.startsWith('/admin')) {
            onEmptyModuleShortcut?.(targetItem.label);
            navigate({ to: '/' });
            return;
          }
          navigate(parsed);
          return;
        }

        if (typeof document !== 'undefined' && document.querySelector('dialog[open]')) {
          return;
        }

        if (e.key === '[' || e.key === 'PageUp') {
          e.preventDefault();
          stepPeriod(-1);
          return;
        }
        if (e.key === ']' || e.key === 'PageDown') {
          e.preventDefault();
          stepPeriod(1);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    navItems,
    navigate,
    activeCompany,
    isOwner,
    isPublicPage,
    disableCommandPalette,
    shortcutsDialogRef,
    cmdDialogRef,
    switcherDialogRef,
    openShortcutsModal,
    openCommandPaletteModal,
    openCompanySwitcherModal,
    closeAllModals,
    setSidebarCollapsed,
    stepPeriod,
    onEmptyModuleShortcut
  ]);
}
