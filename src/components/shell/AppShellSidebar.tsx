import { useEffect, useRef } from 'react';
import { useRouterState } from '@tanstack/react-router';
import {
  ChevronRight,
  Eye,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X
} from 'lucide-react';
import { LibrePaqLogo, LibrePaqIcon } from '../LibrePaqLogo';
import type { CommandPaletteNavItem } from '../command-palette/CommandPaletteModal';
import type { User } from '@supabase/supabase-js';
import type { DespachoRole } from '../../shared/types/despacho-rbac.types';
import { useAuth, checkIsSuperAdmin } from '../../context/AuthContext';
import { useSupportSession } from '../../lib/support-impersonation';
import { AppShellSidebarNavItem } from './AppShellSidebarNavItem';

interface AppShellSidebarProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  currentPath: string;
  navItems: CommandPaletteNavItem[];
  onOpenCommandPalette: () => void;
  onBeforeNavigate?: () => void;
  isWorkspaceEmpty?: boolean;
  onEmptyModuleClick?: (label: string) => void;
  user?: User | null;
  isReadOnlyClient?: boolean;
  effectiveCompanyRole?: DespachoRole | 'OWNER' | null;
}

export function AppShellSidebar({
  sidebarCollapsed,
  setSidebarCollapsed,
  mobileMenuOpen,
  setMobileMenuOpen,
  currentPath,
  navItems,
  onOpenCommandPalette,
  onBeforeNavigate,
  isWorkspaceEmpty = false,
  onEmptyModuleClick,
  user,
  isReadOnlyClient = false,
  effectiveCompanyRole = null
}: AppShellSidebarProps) {
  const { hasAdminAccess } = useAuth();
  const supportSession = useSupportSession();
  const mobileMenuBtnRef = useRef<HTMLButtonElement>(null);
  const drawerCloseBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const routerSearch = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>) || {}
  });
  const activeAdminTab = typeof routerSearch.tab === 'string' ? routerSearch.tab : undefined;
  const isOwner = (hasAdminAccess || checkIsSuperAdmin(user ?? null)) && !supportSession;
  const cmdPalettePlaceholder = isOwner ? 'Ir a sección o comando...' : 'Buscar cuenta o módulo...';
  const cmdPaletteAriaLabel = isOwner
    ? 'Ir a sección o comando (Ctrl+K)'
    : 'Buscar cuenta o módulo (Ctrl+K)';
  const cmdPaletteTitle = isWorkspaceEmpty
    ? 'Da de alta tu primera empresa para usar el buscador universal'
    : cmdPaletteAriaLabel;

  useEffect(() => {
    if (!mobileMenuOpen) return;
    requestAnimationFrame(() => drawerCloseBtnRef.current?.focus());
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMobileMenuOpen(false);
        requestAnimationFrame(() => mobileMenuBtnRef.current?.focus());
        return;
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen, setMobileMenuOpen]);

  return (
    <aside
      aria-label="Barra lateral de módulos"
      className={`dark-surface w-full ${
        sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'
      } lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto bg-[#0A1120] text-slate-100 flex flex-col border-b lg:border-b-0 lg:border-r border-[#1E293B] shrink-0 no-print transition-all duration-300 ease-in-out`}
    >
      <div
        className={`px-3 py-2 lg:p-4 flex items-center ${
          sidebarCollapsed ? 'lg:flex-col lg:justify-center' : 'justify-between'
        } border-b border-[#1E293B] gap-2`}
      >
        {!sidebarCollapsed ? (
          <div className="flex items-center justify-between w-full min-w-0">
            <div className="lg:hidden min-w-0">
              <LibrePaqLogo variant="horizontal" size="sm" theme="dark" badge="PRO" showSubtitle={false} />
            </div>
            <div className="hidden lg:block min-w-0">
              <LibrePaqLogo variant="horizontal" size="md" theme="dark" badge="PRO" />
            </div>

            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              title="Colapsar menú lateral (Ctrl+B)"
              aria-label="Colapsar menú lateral"
              className="hidden lg:flex p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#111C35] transition cursor-pointer"
            >
              <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <div className="lg:hidden min-w-0">
              <LibrePaqLogo variant="horizontal" size="sm" theme="dark" badge="PRO" showSubtitle={false} />
            </div>
            <div className="hidden lg:flex flex-col items-center gap-1.5 w-full">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                title="Expandir menú lateral (Ctrl+B)"
                aria-label="Expandir menú lateral"
                className="flex flex-col items-center gap-1 rounded-xl p-1.5 hover:bg-[#111C35] transition cursor-pointer group"
              >
                <span className="w-9 h-9 flex items-center justify-center">
                  <LibrePaqIcon size="md" className="group-hover:hidden" />
                  <PanelLeftOpen
                    className="w-5 h-5 text-cyan-400 hidden group-hover:block"
                    aria-hidden="true"
                  />
                </span>
                <span className="text-slate-300 group-hover:text-white text-[10px] font-mono flex items-center gap-0.5">
                  <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  <span aria-hidden="true">Abrir</span>
                </span>
              </button>
            </div>
          </>
        )}

        <div className="flex items-center gap-1.5 lg:hidden ml-auto shrink-0">
          <button
            type="button"
            disabled={isWorkspaceEmpty}
            onClick={onOpenCommandPalette}
            aria-label={cmdPaletteTitle}
            title={cmdPaletteTitle}
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-2 rounded-xl bg-[#111C35] border border-[#1E293B] text-blue-300 hover:text-white disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            ref={mobileMenuBtnRef}
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="primary-sidebar-nav"
            aria-label={mobileMenuOpen ? 'Cerrar menú de módulos' : 'Abrir menú de módulos'}
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-2 rounded-xl bg-[#111C35] border border-[#1E293B] text-slate-200 hover:text-white cursor-pointer"
          >
            {mobileMenuOpen ? (
              <X className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Menu className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          aria-hidden="true"
          onClick={() => {
            setMobileMenuOpen(false);
            requestAnimationFrame(() => mobileMenuBtnRef.current?.focus());
          }}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
        />
      )}

      <div
        ref={drawerRef}
        role={mobileMenuOpen ? 'dialog' : undefined}
        aria-modal={mobileMenuOpen ? true : undefined}
        aria-label={mobileMenuOpen ? 'Menú de módulos' : undefined}
        className={`flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain ${
          mobileMenuOpen
            ? 'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] max-h-[100dvh] bg-[#0A1120] border-r border-[#1E293B] shadow-2xl lg:static lg:inset-auto lg:z-auto lg:w-auto lg:max-w-none lg:max-h-none lg:border-r-0 lg:shadow-none'
            : 'hidden lg:flex'
        }`}
      >
        {mobileMenuOpen && (
          <div className="flex lg:hidden items-center justify-between px-3 py-2.5 border-b border-[#1E293B] shrink-0">
            <LibrePaqLogo variant="horizontal" size="sm" theme="dark" badge="PRO" showSubtitle={false} />
            <button
              ref={drawerCloseBtnRef}
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                requestAnimationFrame(() => mobileMenuBtnRef.current?.focus());
              }}
              aria-label="Cerrar menú de módulos"
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-[#111C35] cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="hidden lg:block px-2.5 pt-2.5">
          {!sidebarCollapsed ? (
            <button
              type="button"
              disabled={isWorkspaceEmpty}
              onClick={onOpenCommandPalette}
              title={cmdPaletteTitle}
              aria-label={cmdPaletteTitle}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#111C35] hover:bg-slate-800/90 border border-[#1E293B] text-xs text-slate-200 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                <span>{cmdPalettePlaceholder}</span>
              </span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[#0A1120] text-slate-300 rounded border border-slate-700">
                Ctrl K
              </kbd>
            </button>
          ) : (
            <button
              type="button"
              disabled={isWorkspaceEmpty}
              onClick={onOpenCommandPalette}
              title={cmdPaletteTitle}
              aria-label={cmdPaletteTitle}
              className="w-full flex items-center justify-center p-2 rounded-xl bg-[#111C35] hover:bg-slate-800 border border-[#1E293B] text-blue-300 hover:text-white disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <nav id="primary-sidebar-nav" aria-label="Menú principal" className="px-2 pt-2 pb-6 lg:p-2 flex-1 space-y-1.5 lg:space-y-1">
          {!sidebarCollapsed && (
            <div className="px-2.5 py-1 flex items-center justify-between gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span>{isOwner ? 'Consola de Propietario' : 'Módulos Contables'}</span>
              {!isOwner && isReadOnlyClient && effectiveCompanyRole === 'CLIENTE_LECTURA' ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-900/70 text-sky-200 border border-sky-700/70 text-[9px] font-semibold normal-case tracking-normal">
                  <Eye className="w-2.5 h-2.5" aria-hidden="true" />
                  Solo lectura
                </span>
              ) : (
                <span className="font-mono text-[9px] text-slate-400">
                  Alt+1..7
                </span>
              )}
            </div>
          )}
          <ul className="grid grid-cols-1 gap-1" role="list">
            {navItems.map((item) => (
              <AppShellSidebarNavItem
                key={item.to}
                item={item}
                isOwner={isOwner}
                isWorkspaceEmpty={isWorkspaceEmpty}
                currentPath={currentPath}
                activeAdminTab={activeAdminTab}
                sidebarCollapsed={sidebarCollapsed && !mobileMenuOpen}
                onNavigateItem={() => {
                  onBeforeNavigate?.();
                  setMobileMenuOpen(false);
                }}
                onEmptyModuleClick={onEmptyModuleClick}
              />
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
