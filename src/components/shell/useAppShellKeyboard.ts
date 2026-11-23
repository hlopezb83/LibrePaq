import { useEffect } from 'react';
import type { Company } from '../../shared/types';
import type { CommandPaletteNavItem } from '../command-palette/CommandPaletteModal';

interface UseAppShellKeyboardProps {
  shortcutsDialogRef: React.RefObject<HTMLDialogElement | null>;
  cmdDialogRef: React.RefObject<HTMLDialogElement | null>;
  switcherDialogRef: React.RefObject<HTMLDialogElement | null>;
  openShortcutsModal: () => void;
  openCommandPaletteModal: () => void;
  openCompanySwitcherModal: () => void;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  navItems: CommandPaletteNavItem[];
  navigate: (opts: { to: string }) => void;
  stepPeriod: (delta: number) => void;
  activeCompany: Company | null;
}

export function useAppShellKeyboard({
  shortcutsDialogRef,
  cmdDialogRef,
  switcherDialogRef,
  openShortcutsModal,
  openCommandPaletteModal,
  openCompanySwitcherModal,
  setSidebarCollapsed,
  navItems,
  navigate,
  stepPeriod,
  activeCompany
}: UseAppShellKeyboardProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        if (!shortcutsDialogRef.current?.open) {
          openShortcutsModal();
        } else {
          shortcutsDialogRef.current?.close();
        }
        return;
      }

      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          if (!shortcutsDialogRef.current?.open) {
            openShortcutsModal();
          } else {
            shortcutsDialogRef.current?.close();
          }
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!cmdDialogRef.current?.open) {
          openCommandPaletteModal();
        } else {
          cmdDialogRef.current?.close();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          if (!switcherDialogRef.current?.open) {
            openCompanySwitcherModal();
          } else {
            switcherDialogRef.current?.close();
          }
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          setSidebarCollapsed((prev) => !prev);
          return;
        }
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (typeof document !== 'undefined' && document.querySelector('dialog[open]')) {
          return;
        }

        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          if (e.key === '[' || e.key === 'PageUp') {
            e.preventDefault();
            stepPeriod(-1);
            return;
          }
          if (e.key === ']' || e.key === 'PageDown') {
            e.preventDefault();
            stepPeriod(1);
            return;
          }

          const idx = Number(e.key) - 1;
          const targetItem = navItems[idx];
          if (targetItem) {
            e.preventDefault();
            navigate({ to: targetItem.to });
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navItems, navigate, activeCompany, shortcutsDialogRef, cmdDialogRef, switcherDialogRef, openShortcutsModal, openCommandPaletteModal, openCompanySwitcherModal, setSidebarCollapsed, stepPeriod]);
}
