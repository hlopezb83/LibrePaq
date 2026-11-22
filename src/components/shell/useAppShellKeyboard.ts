import { useEffect } from 'react';
import type { Company } from '../../shared/types';
import type { CommandPaletteNavItem } from '../CommandPaletteModal';

interface UseAppShellKeyboardProps {
  shortcutsDialogRef: React.RefObject<HTMLDialogElement | null>;
  cmdDialogRef: React.RefObject<HTMLDialogElement | null>;
  cmdInputRef: React.RefObject<HTMLInputElement | null>;
  switcherDialogRef: React.RefObject<HTMLDialogElement | null>;
  setCmdQuery: (q: string) => void;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  navItems: CommandPaletteNavItem[];
  navigate: (opts: { to: string }) => void;
  stepPeriod: (delta: number) => void;
  activeCompany: Company | null;
}

export function useAppShellKeyboard({
  shortcutsDialogRef,
  cmdDialogRef,
  cmdInputRef,
  switcherDialogRef,
  setCmdQuery,
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
          shortcutsDialogRef.current?.showModal();
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
            shortcutsDialogRef.current?.showModal();
          } else {
            shortcutsDialogRef.current?.close();
          }
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdQuery('');
        if (!cmdDialogRef.current?.open) {
          cmdDialogRef.current?.showModal();
          setTimeout(() => cmdInputRef.current?.focus(), 20);
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
            switcherDialogRef.current?.showModal();
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
  }, [navItems, navigate, activeCompany, shortcutsDialogRef, cmdDialogRef, cmdInputRef, switcherDialogRef, setCmdQuery, setSidebarCollapsed, stepPeriod]);
}
