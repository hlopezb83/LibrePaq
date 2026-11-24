import type React from 'react';
import { handleTablistKeyDown } from '../../hooks/useTablistKeyboard';

export interface TabBarItem<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  count?: number | string;
  disabled?: boolean;
  title?: string;
}

export interface TabBarProps<T extends string> {
  tabs: ReadonlyArray<TabBarItem<T>>;
  activeId: T;
  onSelect: (id: T) => void;
  idPrefix: string;
  ariaLabel: string;
  panelId?: string;
  mode?: 'tablist' | 'group';
  className?: string;
}

/**
 * Barra de pestañas/filtros WAI-ARIA canónica del ERP.
 * Se renderiza al pie de `<PageHeader>` con wrap fluido en escritorio y desplazamiento suave en móvil.
 */
export function TabBar<T extends string>({
  tabs,
  activeId,
  onSelect,
  idPrefix,
  ariaLabel,
  panelId,
  mode = 'tablist',
  className = ''
}: TabBarProps<T>) {
  const isTablist = mode === 'tablist';

  return (
    <div className={`erp-tabbar-wrap min-w-0 ${className}`.trim()}>
      <div
        role={mode}
        aria-label={ariaLabel}
        onKeyDown={(e) => {
          if (isTablist) handleTablistKeyDown(e, tabs, activeId, onSelect, idPrefix);
        }}
        className="erp-tab-scroller flex items-center gap-1.5 md:flex-wrap pb-0.5"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              id={`${idPrefix}${tab.id}`}
              type="button"
              role={isTablist ? 'tab' : undefined}
              aria-selected={isTablist ? isActive : undefined}
              aria-pressed={!isTablist ? isActive : undefined}
              aria-controls={isTablist && panelId && isActive ? panelId : undefined}
              tabIndex={isTablist ? (isActive ? 0 : -1) : 0}
              disabled={tab.disabled}
              title={tab.title}
              onClick={() => onSelect(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-blue-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono tabular-nums leading-none ${
                    isActive
                      ? 'bg-blue-800/80 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
