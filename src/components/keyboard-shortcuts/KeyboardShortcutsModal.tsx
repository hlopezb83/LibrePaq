import React, { useMemo, useState } from 'react';
import {
  Command,
  FileCode2,
  FolderTree,
  Keyboard,
  ReceiptText,
  Search,
  X
} from 'lucide-react';
import {
  SHORTCUT_DATABASE,
  type ShortcutItem
} from './shortcutDatabase';

export type { ShortcutItem };

export interface KeyboardShortcutsModalProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  onClose?: () => void;
  onNavigate?: (to: string) => void;
}

export function KeyboardShortcutsModal({
  dialogRef,
  onClose,
  onNavigate
}: KeyboardShortcutsModalProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'global' | 'cuentas' | 'polizas' | 'cfdi'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredShortcuts = useMemo(() => {
    let list = SHORTCUT_DATABASE;
    if (activeTab !== 'all') {
      list = list.filter((item) => item.category === activeTab);
    }
    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (item) =>
        item.action.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keys.some((k) => k.toLowerCase().includes(q)) ||
        item.scope.toLowerCase().includes(q)
    );
  }, [activeTab, searchQuery]);

  const categories = [
    { id: 'all', label: 'Todos', count: SHORTCUT_DATABASE.length, icon: Keyboard },
    {
      id: 'global',
      label: 'Globales',
      count: SHORTCUT_DATABASE.filter((i) => i.category === 'global').length,
      icon: Command
    },
    {
      id: 'cuentas',
      label: 'Catálogo de Cuentas',
      count: SHORTCUT_DATABASE.filter((i) => i.category === 'cuentas').length,
      icon: FolderTree
    },
    {
      id: 'polizas',
      label: 'Pólizas Contables',
      count: SHORTCUT_DATABASE.filter((i) => i.category === 'polizas').length,
      icon: ReceiptText
    },
    {
      id: 'cfdi',
      label: 'CFDI y Bóveda ADD',
      count: SHORTCUT_DATABASE.filter((i) => i.category === 'cfdi').length,
      icon: FileCode2
    }
  ] as const;

  const handleClose = () => {
    dialogRef.current?.close();
    onClose?.();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      handleClose();
    }
  };

  const handleNavigateToModule = (route?: string) => {
    if (!route) return;
    handleClose();
    onNavigate?.(route);
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClick={handleBackdropClick}
      aria-labelledby="shortcuts-modal-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-4xl max-h-[92dvh] overflow-hidden backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs p-0 m-auto text-slate-900"
    >
      <div className="flex flex-col max-h-[92dvh] bg-white">
        {/* Cabecera Obsidian Banking Navy (#0A1120) */}
        <div className="bg-[#0A1120] text-white p-3.5 sm:p-4 flex items-start justify-between gap-3 border-b border-[#1E293B] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center shrink-0 shadow-inner">
              <Keyboard className="w-5 h-5 text-blue-400" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="shortcuts-modal-title"
                  className="text-base sm:text-lg font-bold tracking-tight text-white"
                >
                  Centro de Atajos de Teclado
                </h2>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700/60">
                  Productividad Contable
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Diseñado para contadores y captura veloz sin necesidad de usar el ratón
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-[10px] font-mono font-bold bg-[#111C35] text-slate-400 rounded-lg border border-slate-700">
              ESC para cerrar
            </kbd>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Cerrar ventana de atajos"
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Barra de Filtro Rápido y Selector de Pestañas */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2.5 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Buscador de atajo interactivo */}
            <div className="relative flex-1">
              <label htmlFor="shortcuts-filter-input" className="visually-hidden">
                Filtrar atajos de teclado por acción, tecla o módulo
              </label>
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="shortcuts-filter-input"
                type="search"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar atajos (ej. 'iva', 'empresa', 'poliza', 'f4', 'cuadrar')..."
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white shadow-2xs font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar filtro de atajos"
                  title="Limpiar filtro"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Contador de coincidencias con anuncio para lectores de pantalla */}
            <div className="text-right shrink-0">
              <span
                aria-live="polite"
                className="font-mono text-xs font-bold text-slate-600 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs inline-block"
              >
                {filteredShortcuts.length}{' '}
                {filteredShortcuts.length === 1 ? 'atajo' : 'atajos'}
              </span>
            </div>
          </div>

          {/* Pestañas de categorías con estado presionado accesible */}
          <div
            role="group"
            aria-label="Filtrar atajos por categoría"
            className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none"
          >
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveTab(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? 'bg-blue-700 text-white shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{cat.label}</span>
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? 'bg-blue-800 text-blue-100'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista de Atajos en Formato Grid / Terminal Contable */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-4 space-y-2.5">
          {filteredShortcuts.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Keyboard className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
              <p className="text-sm font-bold text-slate-700">No se encontraron atajos</p>
              <p className="text-xs text-slate-600">
                Prueba con otro término de búsqueda como &ldquo;Enter&rdquo;, &ldquo;Ctrl&rdquo;, o cambia de categoría.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveTab('all');
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Restablecer filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filteredShortcuts.map((item) => (
                <div
                  key={item.id}
                  className="p-3 sm:p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50/20 transition-all flex flex-col justify-between gap-2 shadow-2xs group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-blue-900 transition">
                          {item.action}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {item.scope}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                        {item.description}
                      </p>
                    </div>

                    {/* Teclas <kbd> Estilizadas Tipo Terminal */}
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      {item.keys.map((key, kIdx) => (
                        <React.Fragment key={kIdx}>
                          {kIdx > 0 && (
                            <span className="text-slate-400 text-xs font-mono font-bold" aria-hidden="true">+</span>
                          )}
                          <kbd className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded-md font-mono text-[11px] font-bold bg-[#0A1120] text-white border border-slate-700 shadow-xs tracking-tight">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {item.targetRoute && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono text-[10px]">
                        Módulo: {item.categoryLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleNavigateToModule(item.targetRoute)}
                        className="text-blue-700 hover:text-blue-900 font-semibold cursor-pointer inline-flex items-center gap-1 hover:underline"
                      >
                        Ir al módulo →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pie de Información y Consejos de Ergonomía Contable */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-[11px]">
              <strong>Consejo contable:</strong> Presiona <kbd className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300 text-slate-800">F1</kbd> o <kbd className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300 text-slate-800">?</kbd> en cualquier vista para abrir esta guía.
            </span>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition cursor-pointer self-end sm:self-auto shadow-2xs"
          >
            Entendido (ESC)
          </button>
        </div>
      </div>
    </dialog>
  );
}
