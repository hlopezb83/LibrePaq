import { Link } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import type { CommandPaletteNavItem } from '../command-palette/CommandPaletteModal';
import { parseNavTarget } from './parseNavTarget';

interface AppShellSidebarNavItemProps {
  item: CommandPaletteNavItem;
  isOwner: boolean;
  isWorkspaceEmpty: boolean;
  currentPath: string;
  activeAdminTab?: string;
  sidebarCollapsed: boolean;
  onNavigateItem: () => void;
  onEmptyModuleClick?: (label: string) => void;
}

export function AppShellSidebarNavItem({
  item,
  isOwner,
  isWorkspaceEmpty,
  currentPath,
  activeAdminTab,
  sidebarCollapsed,
  onNavigateItem,
  onEmptyModuleClick
}: AppShellSidebarNavItemProps) {
  const Icon = item.icon;
  const parsedTarget = parseNavTarget(item.to);
  const itemTab = parsedTarget.search?.tab;
  const isLockedModule = !isOwner && isWorkspaceEmpty && parsedTarget.to !== '/';
  const displayLabel =
    !isOwner && isWorkspaceEmpty && parsedTarget.to === '/' ? 'Mi Despacho' : item.label;
  const displaySublabel =
    !isOwner && isWorkspaceEmpty && parsedTarget.to === '/'
      ? 'Configura tu primera empresa'
      : isLockedModule
      ? 'Requiere empresa activa'
      : item.sublabel;

  const isActive = isLockedModule
    ? false
    : !isOwner && isWorkspaceEmpty && parsedTarget.to === '/'
    ? true
    : isOwner
    ? currentPath === '/admin' &&
      (itemTab ? activeAdminTab === itemTab : !activeAdminTab || activeAdminTab === 'metrics')
    : parsedTarget.to === '/'
    ? currentPath === '/'
    : currentPath.startsWith(parsedTarget.to);

  const itemClasses = `w-full text-left group flex items-center ${
    sidebarCollapsed
      ? 'lg:flex-col lg:justify-center px-2 py-2 lg:text-center gap-3 lg:gap-0'
      : 'gap-3 px-3 py-2'
  } rounded-xl text-xs sm:text-sm transition-all cursor-pointer ${
    isActive
      ? isOwner
        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm border border-amber-400'
        : 'bg-blue-700 text-white shadow-sm font-medium border border-blue-500/30'
      : isLockedModule
      ? 'text-slate-400 hover:bg-[#111C35]/70 hover:text-slate-200 border border-transparent opacity-80'
      : 'text-slate-300 hover:bg-[#111C35] hover:text-white border border-transparent'
  }`;

  const iconClasses = `w-5 h-5 shrink-0 ${
    isActive
      ? isOwner
        ? 'text-slate-950'
        : 'text-white'
      : isLockedModule
      ? 'text-slate-400'
      : isOwner
      ? 'text-amber-400 group-hover:text-amber-300'
      : 'text-slate-400 group-hover:text-blue-400'
  }`;

  const content = (
    <>
      <Icon className={iconClasses} aria-hidden="true" />
      {sidebarCollapsed && <span className="sr-only">{displayLabel}</span>}
      <div className={`leading-tight min-w-0 flex-1 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
        <div className="truncate flex items-center justify-between gap-1">
          <span className="text-xs font-semibold truncate">{displayLabel}</span>
          {isLockedModule ? (
            <Lock className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
          ) : (
            <span
              className={`text-[9px] font-mono ${
                isActive
                  ? isOwner
                    ? 'text-slate-950 font-bold'
                    : 'text-white font-semibold'
                  : 'text-slate-400 group-hover:text-slate-200'
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
                ? 'text-slate-900'
                : 'text-blue-100'
              : 'text-slate-400'
          }`}
        >
          {displaySublabel}
        </div>
      </div>
      {sidebarCollapsed && (
        <span
          className={`hidden lg:flex items-center justify-center text-[9px] font-mono font-semibold mt-0.5 ${
            isActive
              ? isOwner
                ? 'text-slate-950 font-bold'
                : 'text-white font-bold'
              : 'text-slate-300 group-hover:text-white'
          }`}
        >
          {isLockedModule ? <Lock className="w-3 h-3" aria-hidden="true" /> : item.shortcut}
        </span>
      )}
    </>
  );

  const tooltip = isLockedModule
    ? `Primero da de alta una empresa en tu Despacho Contable para usar ${item.label}`
    : `${displayLabel} (${item.shortcut}) • ${displaySublabel}`;

  return (
    <li>
      {isLockedModule ? (
        <button
          type="button"
          aria-disabled="true"
          onClick={() => {
            onNavigateItem();
            onEmptyModuleClick?.(item.label);
          }}
          title={tooltip}
          className={itemClasses}
        >
          {content}
        </button>
      ) : (
        <Link
          to={parsedTarget.to}
          search={parsedTarget.search}
          aria-current={isActive ? 'page' : undefined}
          onClick={onNavigateItem}
          title={tooltip}
          className={itemClasses}
        >
          {content}
        </Link>
      )}
    </li>
  );
}
