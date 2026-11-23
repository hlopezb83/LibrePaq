import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import type { AccountWithBalance, Company, Poliza } from '../../shared/types';
import {
  useCommandPaletteItems
} from './useCommandPaletteItems';
import type { CommandPaletteNavItem } from './commandPaletteTypes';

export type { CommandPaletteNavItem };

export interface CommandPaletteModalProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (val: string) => void;
  navItems: CommandPaletteNavItem[];
  accounts: AccountWithBalance[];
  companies?: Company[];
  activeCompany?: Company | null;
  polizas?: Poliza[];
  onSelectRoute: (to: string) => void;
  onSelectAccount: (accountId: string) => void;
  onSelectCompany?: (companyId: string) => void;
  onSelectPeriod?: (year: number, period: number) => void;
  onOpenCompanySwitcher?: () => void;
  onOpenNewCompanyWizard?: () => void;
}

export function CommandPaletteModal({
  dialogRef,
  inputRef,
  query,
  onQueryChange,
  navItems,
  accounts,
  companies = [],
  activeCompany = null,
  polizas = [],
  onSelectRoute,
  onSelectAccount,
  onSelectCompany,
  onSelectPeriod,
  onOpenCompanySwitcher,
  onOpenNewCompanyWizard
}: CommandPaletteModalProps) {
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useDialogLightDismiss(dialogRef, () => dialogRef.current?.close());

  const flattenedItems = useCommandPaletteItems({
    query,
    navItems,
    accounts,
    companies,
    activeCompany,
    polizas,
    onSelectRoute,
    onSelectAccount,
    onSelectCompany,
    onSelectPeriod,
    onOpenCompanySwitcher,
    onOpenNewCompanyWizard
  });

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  useEffect(() => {
    const el = itemRefs.current[highlightedIndex];
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [highlightedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flattenedItems.length === 0) return;
      setHighlightedIndex((prev) => (prev + 1) % flattenedItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flattenedItems.length === 0) return;
      setHighlightedIndex((prev) => (prev - 1 + flattenedItems.length) % flattenedItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const currentItem = flattenedItems[highlightedIndex];
      if (currentItem) {
        dialogRef.current?.close();
        currentItem.action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      dialogRef.current?.close();
    }
  };

  let currentCategory = '';
  let itemIndexTracker = 0;

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="cmd-palette-title"
      onKeyDown={handleKeyDown}
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-2xl max-h-[90dvh] overflow-hidden backdrop:bg-slate-950/40 backdrop:backdrop-blur-xs p-0 m-auto"
    >
      <div className="flex flex-col max-h-[90dvh] bg-white divide-y divide-slate-100">
        {/* Cabecera / Input de búsqueda Spotlight */}
        <div className="p-2.5 sm:p-3.5 flex items-center gap-2.5 bg-slate-50/70 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0 shadow-xs">
            <Search className="w-4 h-4" aria-hidden="true" />
          </div>

          <div className="flex-1 min-w-0">
            <label htmlFor="cmd-palette-input" id="cmd-palette-title" className="visually-hidden">
              Buscador universal de módulos, acciones, cuentas contables y pólizas
            </label>
            <input
              ref={inputRef}
              id="cmd-palette-input"
              type="text"
              role="combobox"
              aria-expanded={true}
              aria-controls="cmd-palette-listbox"
              aria-autocomplete="list"
              aria-activedescendant={flattenedItems[highlightedIndex]?.id}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Escribe un comando, cuenta (102-01), póliza o módulo..."
              className="w-full text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent border-none focus:outline-none"
            />
          </div>

          {query.trim().length > 0 && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              title="Borrar búsqueda"
              aria-label="Borrar búsqueda"
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}

          <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-slate-200">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Cerrar paleta de comandos"
              className="px-2 py-1 rounded-md text-[10px] font-mono font-bold bg-white text-slate-500 border border-slate-200 hover:bg-slate-100 shadow-2xs cursor-pointer"
            >
              ESC
            </button>
          </div>
        </div>

        {/* Panel de resultados navegable por teclado */}
        <div
          id="cmd-palette-listbox"
          role="listbox"
          aria-label="Resultados de comandos contables"
          className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3 scrollable-panel"
        >
          {flattenedItems.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <Search className="w-6 h-6" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Sin coincidencias para &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Prueba buscando por código de cuenta (ej. <code>102</code>), nombre (<code>BBVA</code>),
                tipo de póliza (<code>Diario</code>) o módulo (<code>Balanza</code>).
              </p>
            </div>
          ) : (
            flattenedItems.map((item) => {
              const globalIndex = itemIndexTracker++;
              const isSelected = globalIndex === highlightedIndex;
              const isNewCategory = item.categoryTitle !== currentCategory;
              if (isNewCategory) {
                currentCategory = item.categoryTitle;
              }

              const Icon = item.icon;

              return (
                <React.Fragment key={item.id}>
                  {isNewCategory && (
                    <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>{item.categoryTitle}</span>
                    </div>
                  )}

                  <button
                    id={item.id}
                    ref={(el) => {
                      itemRefs.current[globalIndex] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={-1}
                    onClick={() => {
                      dialogRef.current?.close();
                      item.action();
                    }}
                    onMouseEnter={() => setHighlightedIndex(globalIndex)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs font-medium'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs truncate ${
                              isSelected ? 'font-bold text-white' : 'font-semibold text-slate-900'
                            }`}
                          >
                            {item.title}
                          </span>
                          {item.badge && (
                            <span
                              className={`text-[9px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${
                                isSelected
                                  ? 'bg-white/20 text-white border-white/30'
                                  : item.badgeClass || 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.subtitle && (
                          <div
                            className={`text-[11px] truncate mt-0.5 ${
                              isSelected ? 'text-blue-100' : 'text-slate-500'
                            }`}
                          >
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.meta && (
                        <span
                          className={`text-xs font-mono font-bold ${
                            isSelected ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {item.meta}
                        </span>
                      )}
                      {item.shortcut && (
                        <kbd
                          className={`px-1.5 py-0.5 font-mono text-[10px] rounded border ${
                            isSelected
                              ? 'bg-white/20 text-white border-white/40 font-bold'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {item.shortcut}
                        </kbd>
                      )}
                    </div>
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Barra inferior con atajos de ayuda */}
        <div className="px-3 sm:px-4 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 font-mono text-[9px] bg-white border border-slate-200 rounded text-slate-600 shadow-2xs">
                ↑↓
              </kbd>
              <span className="text-slate-400">Navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 font-mono text-[9px] bg-white border border-slate-200 rounded text-slate-600 shadow-2xs">
                ↵
              </kbd>
              <span className="text-slate-400">Abrir</span>
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <kbd className="px-1 py-0.5 font-mono text-[9px] bg-white border border-slate-200 rounded text-slate-600 shadow-2xs">
                ESC
              </kbd>
              <span className="text-slate-400">Cerrar</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono" aria-live="polite">
            <span className="hidden sm:inline font-semibold text-slate-500">LibrePaq Pro •</span>
            <span>{flattenedItems.length} comandos</span>
          </div>
        </div>
      </div>
    </dialog>
  );
}
