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
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  navItems: CommandPaletteNavItem[];
  navigate: (opts: { to: string; search?: Record<string, string> }) => void;
  stepPeriod: (delta: number) => void;
  activeCompany: Company | null;
  isOwner?: boolean;
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
  activeCompany,
  isOwner = false
}: UseAppShellKeyboardProps) {
  useEffect(() => {
    const isEditableTarget = () => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return false;
      const tag = active.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || active.isContentEditable;
    };

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
        if (!isEditableTarget()) {
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
        if (!isEditableTarget()) {
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
        if (!isEditableTarget()) {
          e.preventDefault();
          setSidebarCollapsed((prev) => !prev);
          return;
        }
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (typeof document !== 'undefined' && document.querySelector('dialog[open]')) {
          return;
        }

        if (!isEditableTarget()) {
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
            const parsed = parseNavTarget(targetItem.to);
            if (!activeCompany && !isOwner && idx > 0 && !parsed.to.startsWith('/admin')) {
              navigate({ to: '/' });
              return;
            }
            navigate(parsed);
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navItems, navigate, activeCompany, isOwner, shortcutsDialogRef, cmdDialogRef, switcherDialogRef, openShortcutsModal, openCommandPaletteModal, openCompanySwitcherModal, setSidebarCollapsed, stepPeriod]);
}
