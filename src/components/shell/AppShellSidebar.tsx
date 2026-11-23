import { Link } from '@tanstack/react-router';
import {
  ChevronRight,
  Lock,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X
} from 'lucide-react';
import { LibrePaqLogo, LibrePaqIcon } from '../LibrePaqLogo';
import type { CommandPaletteNavItem } from '../command-palette/CommandPaletteModal';
import type { User } from '@supabase/supabase-js';
import { checkIsSuperAdmin } from '../../context/AuthContext';

interface AppShellSidebarProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  currentPath: string;
  navItems: CommandPaletteNavItem[];
  onOpenCommandPalette: () => void;
  isWorkspaceEmpty?: boolean;
  onEmptyModuleClick?: (label: string) => void;
  user?: User | null;
}

export function AppShellSidebar({
  sidebarCollapsed,
  setSidebarCollapsed,
  mobileMenuOpen,
  setMobileMenuOpen,
  currentPath,
  navItems,
  onOpenCommandPalette,
  isWorkspaceEmpty = false,
  onEmptyModuleClick,
  user
}: AppShellSidebarProps) {
  const isOwner = checkIsSuperAdmin(user ?? null);

  return (
    <aside
      className={`w-full ${
        sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'
      } bg-[#0A1120] text-slate-100 flex flex-col border-b lg:border-b-0 lg:border-r border-[#1E293B] shrink-0 no-print transition-all duration-300 ease-in-out`}
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
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#111C35] transition cursor-pointer"
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
                <span className="text-slate-400 group-hover:text-white text-[10px] font-mono flex items-center gap-0.5">
                  <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  <span>EXP</span>
                </span>
              </button>
            </div>
          </>
        )}

        <div className="flex items-center gap-1.5 lg:hidden ml-auto shrink-0">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Buscar cuenta o módulo (Ctrl+K)"
            title="Buscar cuenta o módulo (Ctrl+K)"
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-2 rounded-xl bg-[#111C35] border border-[#1E293B] text-blue-400 hover:text-white cursor-pointer"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="primary-sidebar-nav"
            aria-label="Mostrar u ocultar menú de módulos"
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-2 rounded-xl bg-[#111C35] border border-[#1E293B] text-slate-300 hover:text-white cursor-pointer"
          >
            {mobileMenuOpen ? (
              <X className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Menu className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div
        className={`flex-1 flex flex-col min-h-0 max-h-[calc(100dvh-3.25rem)] lg:max-h-none overflow-y-auto overscroll-contain ${
          mobileMenuOpen ? 'block' : 'hidden lg:flex'
        }`}
      >
        <div className="hidden lg:block px-2.5 pt-2.5">
          {!sidebarCollapsed ? (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#111C35] hover:bg-slate-800/90 border border-[#1E293B] text-xs text-slate-300 transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                <span>Buscar cuenta o módulo...</span>
              </span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[#0A1120] text-slate-400 rounded border border-slate-700">
                Ctrl K
              </kbd>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              title="Buscar cuenta o módulo (Ctrl+K)"
              aria-label="Buscar cuenta o módulo (Ctrl+K)"
              className="w-full flex items-center justify-center p-2 rounded-xl bg-[#111C35] hover:bg-slate-800 border border-[#1E293B] text-blue-400 hover:text-white transition cursor-pointer"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <nav id="primary-sidebar-nav" aria-label="Menú principal" className="p-2 flex-1 space-y-1">
          {!sidebarCollapsed && (
            <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span>{isOwner ? 'Consola de Propietario' : 'Módulos Contables'}</span>
              <span className="font-mono text-[9px] text-slate-400">
                {isOwner ? 'Alt+1..5' : 'Alt+1..7'}
              </span>
            </div>
          )}
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1" role="list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isLockedModule = !isOwner && isWorkspaceEmpty && item.to !== '/';
            const displayLabel =
              !isOwner && isWorkspaceEmpty && item.to === '/' ? 'Mi Despacho' : item.label;
            const displaySublabel =
              !isOwner && isWorkspaceEmpty && item.to === '/'
                ? 'Configura tu primera empresa'
                : isLockedModule
                ? 'Requiere empresa activa'
                : item.sublabel;

            const isActive = isLockedModule
              ? false
              : !isOwner && isWorkspaceEmpty && item.to === '/'
              ? true
              : isOwner
              ? currentPath === '/admin' &&
                (item.to.includes('?tab=')
                  ? window.location.search.includes(item.to.slice(item.to.indexOf('?tab=')))
                  : !window.location.search.includes('?tab='))
              : item.to === '/'
              ? currentPath === '/'
              : currentPath.startsWith(item.to);

            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={isActive ? 'page' : undefined}
                  aria-disabled={isLockedModule || undefined}
                  onClick={
                    isLockedModule
                      ? (e) => {
                          e.preventDefault();
                          onEmptyModuleClick?.(item.label);
                        }
                      : undefined
                  }
                  title={
                    isLockedModule
                      ? `Primero da de alta una empresa en tu Despacho Contable para usar ${item.label}`
                      : `${displayLabel} (${item.shortcut}) • ${displaySublabel}`
                  }
                  className={`group flex items-center ${
                    sidebarCollapsed
                      ? 'lg:flex-col lg:justify-center px-2 py-2 text-center'
                      : 'gap-3 px-3 py-2'
                  } rounded-xl text-xs sm:text-sm transition-all ${
                    isActive
                      ? isOwner
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm border border-amber-400'
                        : 'bg-blue-700 text-white shadow-sm font-medium border border-blue-500/30'
                      : isLockedModule
                      ? 'text-slate-400 hover:bg-[#111C35]/70 hover:text-slate-300 border border-transparent'
                      : 'text-slate-300 hover:bg-[#111C35] hover:text-white border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive
                        ? isOwner
                          ? 'text-slate-950'
                          : 'text-white'
                        : isLockedModule
                        ? 'text-slate-500'
                        : isOwner
                        ? 'text-amber-400 group-hover:text-amber-300'
                        : 'text-slate-400 group-hover:text-blue-400'
                    }`}
                    aria-hidden="true"
                  />
                  {!sidebarCollapsed ? (
                    <div className="leading-tight min-w-0 flex-1">
                      <div className="truncate flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold truncate">{displayLabel}</span>
                        {isLockedModule ? (
                          <Lock className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                        ) : (
                          <span
                            className={`text-[9px] font-mono ${
                              isActive
                                ? isOwner
                                  ? 'text-slate-900 font-bold'
                                  : 'text-blue-200'
                                : 'text-slate-400 group-hover:text-slate-300'
                            }`}
                          >
                            {item.shortcut}
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-[10px] truncate ${
                          isActive
                            ? isOwner
                              ? 'text-slate-800'
                              : 'text-blue-100'
                            : isLockedModule
                            ? 'text-slate-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {displaySublabel}
                      </div>
                    </div>
                  ) : (
                    <span className="hidden lg:block text-[9px] font-mono font-semibold text-slate-400 group-hover:text-slate-200 mt-0.5">
                      {isLockedModule ? '🔒' : item.shortcut}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      </div>
    </aside>
  );
}
