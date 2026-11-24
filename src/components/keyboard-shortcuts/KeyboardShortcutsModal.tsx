import React, { useMemo, useState } from 'react';
import { Command, FileCode2, FolderTree, Keyboard, ReceiptText } from 'lucide-react';
import { SHORTCUT_DATABASE, type ShortcutItem } from './shortcutDatabase';
import {
  Button,
  ClearFiltersButton,
  EmptyState,
  ModalShell,
  SearchInput,
  StatusBadge,
  TabBar,
  type TabBarItem
} from '../ui';

export type { ShortcutItem };

export interface KeyboardShortcutsModalProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  onClose?: () => void;
  onNavigate?: (to: string) => void;
}

type ShortcutTabId = 'all' | 'global' | 'cuentas' | 'polizas' | 'cfdi';

export function KeyboardShortcutsModal({
  dialogRef,
  onClose,
  onNavigate
}: KeyboardShortcutsModalProps) {
  const [activeTab, setActiveTab] = useState<ShortcutTabId>('all');
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

  const categories: ReadonlyArray<TabBarItem<ShortcutTabId>> = useMemo(
    () => [
      { id: 'all', label: 'Todos', count: SHORTCUT_DATABASE.length, icon: <Keyboard className="w-3.5 h-3.5" aria-hidden="true" /> },
      { id: 'global', label: 'Globales', count: SHORTCUT_DATABASE.filter((i) => i.category === 'global').length, icon: <Command className="w-3.5 h-3.5" aria-hidden="true" /> },
      { id: 'cuentas', label: 'Catálogo de Cuentas', count: SHORTCUT_DATABASE.filter((i) => i.category === 'cuentas').length, icon: <FolderTree className="w-3.5 h-3.5" aria-hidden="true" /> },
      { id: 'polizas', label: 'Pólizas Contables', count: SHORTCUT_DATABASE.filter((i) => i.category === 'polizas').length, icon: <ReceiptText className="w-3.5 h-3.5" aria-hidden="true" /> },
      { id: 'cfdi', label: 'CFDI y Bóveda ADD', count: SHORTCUT_DATABASE.filter((i) => i.category === 'cfdi').length, icon: <FileCode2 className="w-3.5 h-3.5" aria-hidden="true" /> }
    ],
    []
  );

  const handleClose = () => {
    setSearchQuery('');
    setActiveTab('all');
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose?.();
  };

  const handleNavigateToModule = (route?: string) => {
    if (!route) return;
    handleClose();
    onNavigate?.(route);
  };

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={true}
      onClose={handleClose}
      noPrint
      maxWidth="4xl"
      titleId="shortcuts-modal-title"
      closeLabel="Cerrar ventana de atajos"
      icon={<Keyboard className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      title={
        <span className="inline-flex items-center gap-2 flex-wrap">
          <span>Centro de Atajos de Teclado</span>
          <StatusBadge tone="blue" shape="tag">
            Productividad Contable
          </StatusBadge>
        </span>
      }
      subtitle="Diseñado para contadores y captura veloz sin necesidad de usar el ratón"
      headerExtra={
        <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-[10px] font-mono font-bold bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
          ESC para cerrar
        </kbd>
      }
      headerTabs={
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <SearchInput
              id="shortcuts-filter-input"
              autoFocus
              value={searchQuery}
              onChange={setSearchQuery}
              containerClassName="flex-1"
              aria-label="Filtrar atajos de teclado por acción, tecla o módulo"
              clearLabel="Limpiar filtro de atajos"
              placeholder="Filtrar atajos (ej. 'iva', 'empresa', 'poliza', 'f4', 'cuadrar')..."
            />
            <span
              aria-live="polite"
              className="font-mono text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 shrink-0 self-end sm:self-auto"
            >
              {filteredShortcuts.length} {filteredShortcuts.length === 1 ? 'atajo' : 'atajos'}
            </span>
          </div>

          <TabBar
            tabs={categories}
            activeId={activeTab}
            onSelect={setActiveTab}
            idPrefix="shortcuts-tab-"
            ariaLabel="Filtrar atajos por categoría"
            mode="group"
          />
        </div>
      }
      footerJustify="between"
      footer={
        <>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
            <span className="text-[11px]">
              <strong>Consejo contable:</strong> Presiona{' '}
              <kbd className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300 text-slate-800">
                F1
              </kbd>{' '}
              o{' '}
              <kbd className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300 text-slate-800">
                ?
              </kbd>{' '}
              en cualquier vista para abrir esta guía.
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Entendido (ESC)
          </Button>
        </>
      }
    >
      {filteredShortcuts.length === 0 ? (
        <EmptyState
          variant="plain"
          tone="slate"
          icon={<Keyboard className="w-6 h-6" aria-hidden="true" />}
          title="No se encontraron atajos"
          description='Prueba con otro término de búsqueda como "Enter", "Ctrl", o cambia de categoría.'
          actions={
            <ClearFiltersButton
              onClick={() => {
                setSearchQuery('');
                setActiveTab('all');
              }}
              label="Restablecer filtros"
            />
          }
        />
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
                    <StatusBadge tone="slate" shape="tag">
                      {item.scope}
                    </StatusBadge>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                  {item.keys.map((key, kIdx) => (
                    <React.Fragment key={kIdx}>
                      {kIdx > 0 && (
                        <span className="text-slate-500 text-xs font-mono font-bold" aria-hidden="true">
                          +
                        </span>
                      )}
                      <kbd className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded-md font-mono text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs tracking-tight">
                        {key}
                      </kbd>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {item.targetRoute && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 font-mono text-[10px]">
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
    </ModalShell>
  );
}
