import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Lock, Plus, Printer, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../components/ui';
import { PolizasToolsMenuItems } from './PolizasToolsMenuItems';

export interface PolizasHeaderActionsProps {
  currentYear?: number;
  currentPeriod?: number;
  isPeriodLocked: boolean;
  isPeriod13Locked?: boolean;
  isReadOnlyClient?: boolean;
  isCloseYearPending: boolean;
  hasPolizasToExport?: boolean;
  onNewPoliza: () => void;
  onOpenTemplatesModal?: () => void;
  onOpenImportModal?: () => void;
  onOpenAsambleaModal?: () => void;
  onOpenPedimentoModal?: () => void;
  onExportCsv: () => void;
  onPrintPdf?: () => void;
  onCloseYear: () => void;
}

export function PolizasHeaderActions({
  currentYear = 2026,
  currentPeriod,
  isPeriodLocked,
  isPeriod13Locked = false,
  isReadOnlyClient = false,
  isCloseYearPending,
  hasPolizasToExport = true,
  onNewPoliza,
  onOpenTemplatesModal,
  onOpenImportModal,
  onOpenAsambleaModal,
  onOpenPedimentoModal,
  onExportCsv,
  onPrintPdf,
  onCloseYear
}: PolizasHeaderActionsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [confirmCloseYear, setConfirmCloseYear] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const popoverMenuRef = useRef<HTMLDivElement>(null);
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;
  const isCloseYearBlocked = isPeriod13Locked || isReadOnlyClient;

  const updateMenuAlignment = () => {
    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 256;
    const overflowsRight = rect.left + menuWidth > window.innerWidth - 12;
    const fitsRightAligned = rect.right - menuWidth >= 12;
    setAlignRight(overflowsRight && fitsRightAligned);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setConfirmCloseYear(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (!isMenuOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsMenuOpen(false);
        setConfirmCloseYear(false);
        requestAnimationFrame(() => menuButtonRef.current?.focus());
        return;
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        const items = Array.from(
          popoverMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []
        );
        if (items.length === 0) return;
        event.preventDefault();
        const currentIdx = items.indexOf(document.activeElement as HTMLButtonElement);
        let nextIdx = 0;
        if (event.key === 'ArrowDown') {
          nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % items.length;
        } else if (event.key === 'ArrowUp') {
          nextIdx = currentIdx <= 0 ? items.length - 1 : currentIdx - 1;
        } else if (event.key === 'End') {
          nextIdx = items.length - 1;
        }
        items[nextIdx]?.focus();
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const printTooltip = hasPolizasToExport
    ? 'Imprimir o exportar pólizas visibles a PDF formal'
    : 'No hay pólizas visibles para imprimir';

  return (
    <div
      className="flex flex-wrap items-center gap-2 shrink-0 no-print w-full lg:w-auto"
      ref={menuRef}
    >
      <div className="hidden sm:flex items-center gap-2">
        <Button
          variant="export"
          size="md"
          disabled={!hasPolizasToExport}
          onClick={onExportCsv}
          title={hasPolizasToExport ? 'Exportar pólizas visibles a CSV' : 'No hay pólizas visibles para exportar'}
          leftIcon={<Download className="w-3.5 h-3.5" aria-hidden="true" />}
        >
          Exportar Excel (.CSV)
        </Button>

        <Button
          variant="secondary"
          size="md"
          disabled={!hasPolizasToExport}
          title={printTooltip}
          onClick={() => (onPrintPdf ? onPrintPdf() : window.print())}
          leftIcon={<Printer className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />}
        >
          Imprimir / PDF
        </Button>
      </div>

      <div className="flex flex-nowrap sm:flex-wrap items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
        <Button
          variant="primary"
          size="md"
          disabled={isWriteBlocked}
          onClick={onNewPoliza}
          title={
            isReadOnlyClient
              ? 'Modo solo lectura'
              : isPeriodLocked
              ? 'Periodo fiscal bloqueado ante el SAT'
              : 'Capturar nueva póliza contable (Atajo: Alt+N o Insert)'
          }
          className="flex-1 sm:flex-initial min-w-0 order-1 sm:order-3"
          leftIcon={
            isWriteBlocked ? (
              <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Plus className="w-3.5 h-3.5 text-blue-100 shrink-0" aria-hidden="true" />
            )
          }
        >
          <span className="truncate">Capturar Nueva Póliza</span>
          {!isWriteBlocked && (
            <kbd className="hidden sm:inline font-mono text-[9px] bg-blue-800 text-blue-100 px-1 py-0.5 rounded border border-blue-400/50">
              Alt+N
            </kbd>
          )}
        </Button>

        <div className="relative order-2 sm:order-2 shrink-0">
          <button
            ref={menuButtonRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-label="Más acciones y herramientas fiscales de pólizas"
            onClick={() => {
              if (!isMenuOpen) updateMenuAlignment();
              setIsMenuOpen((prev) => !prev);
              setConfirmCloseYear(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && !isMenuOpen) {
                e.preventDefault();
                updateMenuAlignment();
                setIsMenuOpen(true);
                requestAnimationFrame(() => {
                  const first = popoverMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
                  first?.focus();
                });
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              isMenuOpen
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-2xs'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 sm:hidden" aria-hidden="true" />
            <span className="sm:hidden">Acciones</span>
            <span className="hidden sm:inline">Herramientas</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {isMenuOpen && (
            <div
              ref={popoverMenuRef}
              role="menu"
              aria-orientation="vertical"
              className={`absolute ${alignRight ? 'right-0 left-auto' : 'left-0 right-auto'} top-full mt-1.5 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 divide-y divide-slate-100 text-xs`}
            >
              <PolizasToolsMenuItems
                currentYear={currentYear}
                currentPeriod={currentPeriod}
                isPeriodLocked={isPeriodLocked}
                isPeriod13Locked={isPeriod13Locked}
                isReadOnlyClient={isReadOnlyClient}
                isWriteBlocked={isWriteBlocked}
                isCloseYearBlocked={isCloseYearBlocked}
                isCloseYearPending={isCloseYearPending}
                hasPolizasToExport={hasPolizasToExport}
                confirmCloseYear={confirmCloseYear}
                setConfirmCloseYear={setConfirmCloseYear}
                closeMenu={() => setIsMenuOpen(false)}
                onExportCsv={onExportCsv}
                onPrintPdf={onPrintPdf}
                onOpenTemplatesModal={onOpenTemplatesModal}
                onOpenImportModal={onOpenImportModal}
                onOpenAsambleaModal={onOpenAsambleaModal}
                onOpenPedimentoModal={onOpenPedimentoModal}
                onCloseYear={onCloseYear}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
