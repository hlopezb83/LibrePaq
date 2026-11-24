import { useEffect, useRef, useState } from 'react';
import {
  Anchor,
  ChevronDown,
  Download,
  Lock,
  Plus,
  Printer,
  SlidersHorizontal
} from 'lucide-react';

export interface PolizasHeaderActionsProps {
  currentYear?: number;
  isPeriodLocked: boolean;
  isPeriod13Locked?: boolean;
  isReadOnlyClient?: boolean;
  isCloseYearPending: boolean;
  hasPolizasToExport?: boolean;
  onNewPoliza: () => void;
  onOpenPedimentoModal?: () => void;
  onExportCsv: () => void;
  onPrintPdf?: () => void;
  onCloseYear: () => void;
}

export function PolizasHeaderActions({
  currentYear = 2026,
  isPeriodLocked,
  isPeriod13Locked = false,
  isReadOnlyClient = false,
  isCloseYearPending,
  hasPolizasToExport = true,
  onNewPoliza,
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
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
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
      className="flex flex-col 2xl:flex-row flex-wrap items-stretch sm:items-start 2xl:items-center gap-2 shrink-0 no-print w-full 2xl:w-auto"
      ref={menuRef}
    >
      <div className="hidden sm:flex items-center gap-2">
        <button
          type="button"
          disabled={!hasPolizasToExport}
          onClick={onExportCsv}
          title={hasPolizasToExport ? 'Exportar pólizas visibles a CSV' : 'No hay pólizas visibles para exportar'}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <span>Exportar Excel (.CSV)</span>
        </button>

        <button
          type="button"
          disabled={!hasPolizasToExport}
          title={printTooltip}
          onClick={() => (onPrintPdf ? onPrintPdf() : window.print())}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Printer className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <span>Imprimir / PDF</span>
        </button>
      </div>

      <div className="flex flex-nowrap sm:flex-wrap items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
        <button
          type="button"
          disabled={isWriteBlocked}
          onClick={onNewPoliza}
          title={
            isReadOnlyClient
              ? 'Modo solo lectura'
              : isPeriodLocked
              ? 'Periodo fiscal bloqueado ante el SAT'
              : 'Capturar nueva póliza contable (Atajo: Alt+N o Insert)'
          }
          className={`flex-1 sm:flex-initial min-w-0 inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition order-1 sm:order-3 whitespace-nowrap ${
            isWriteBlocked
              ? 'bg-slate-400 cursor-not-allowed opacity-60'
              : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
          }`}
        >
          {isWriteBlocked ? (
            <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Plus className="w-3.5 h-3.5 text-blue-100 shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">Capturar Nueva Póliza</span>
          {!isWriteBlocked && (
            <kbd className="hidden sm:inline font-mono text-[9px] bg-blue-800 text-blue-100 px-1 py-0.5 rounded border border-blue-400/50">
              Alt+N
            </kbd>
          )}
        </button>

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
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              isMenuOpen
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
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
              className={`absolute ${alignRight ? 'right-0 left-auto' : 'left-0 right-auto'} top-full mt-1.5 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 divide-y divide-slate-100 text-xs animate-in fade-in slide-in-from-top-1 duration-150`}
            >
              <div className="sm:hidden py-1">
                <button
                  type="button"
                  role="menuitem"
                  disabled={!hasPolizasToExport}
                  onClick={() => {
                    setIsMenuOpen(false);
                    onExportCsv();
                  }}
                  title={
                    hasPolizasToExport
                      ? 'Exportar pólizas visibles a CSV'
                      : 'No hay pólizas visibles para exportar'
                  }
                  className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span className="font-medium">Exportar Excel (.CSV)</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!hasPolizasToExport}
                  title={printTooltip}
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (onPrintPdf) onPrintPdf();
                    else window.print();
                  }}
                  className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  <span className="font-medium">Imprimir / PDF Formal</span>
                </button>
              </div>

              <div className="py-1">
                {onOpenPedimentoModal && (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={isWriteBlocked}
                    onClick={() => {
                      if (isWriteBlocked) return;
                      setIsMenuOpen(false);
                      onOpenPedimentoModal();
                    }}
                    title={
                      isReadOnlyClient
                        ? 'Modo solo lectura'
                        : isPeriodLocked
                        ? 'Periodo bloqueado ante el SAT'
                        : 'Registrar Pedimento Aduanal'
                    }
                    className="w-full text-left px-3.5 py-2 flex items-start gap-2.5 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Anchor className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <span className="font-medium block text-slate-800">Pedimento Aduanal</span>
                      <span className="text-[10px] text-slate-500 leading-tight block">
                        Importación con IVA y DTA (A1 / IN)
                      </span>
                    </div>
                  </button>
                )}

                {confirmCloseYear ? (
                  <div className="px-3.5 py-2.5 bg-amber-50 space-y-2">
                    <div className="flex items-start gap-2">
                      <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <span className="font-bold text-amber-950 block">
                          Cierre Anual {currentYear} (Mes 13)
                        </span>
                        <span className="text-[10px] text-amber-900 leading-tight block">
                          Cancela cuentas de resultados y traslada utilidad o pérdida al ejercicio {currentYear}.
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfirmCloseYear(false)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={isCloseYearPending || isCloseYearBlocked}
                        onClick={() => {
                          setIsMenuOpen(false);
                          setConfirmCloseYear(false);
                          onCloseYear();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isCloseYearPending ? 'Generando...' : 'Confirmar cierre'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={isCloseYearPending || isCloseYearBlocked}
                    onClick={() => {
                      if (isCloseYearBlocked) return;
                      setConfirmCloseYear(true);
                    }}
                    title={
                      isReadOnlyClient
                        ? 'Modo solo lectura'
                        : isPeriod13Locked
                        ? 'Periodo 13 bloqueado ante el SAT'
                        : `Generar póliza de cierre anual ${currentYear} (Mes 13)`
                    }
                    className="w-full text-left px-3.5 py-2 flex items-start gap-2.5 text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
                    <div>
                      <span className="font-medium block text-slate-800">
                        {isCloseYearPending ? 'Generando Cierre...' : `Cierre Anual ${currentYear} (Mes 13)`}
                      </span>
                      <span className="text-[10px] text-slate-500 leading-tight block">
                        Pérdidas y ganancias del ejercicio {currentYear}
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
