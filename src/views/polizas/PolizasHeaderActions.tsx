import { useState, useRef, useEffect } from 'react';
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
  isPeriodLocked: boolean;
  isReadOnlyClient?: boolean;
  isCloseYearPending: boolean;
  hasPolizasToExport?: boolean;
  onNewPoliza: () => void;
  onOpenPedimentoModal?: () => void;
  onExportCsv: () => void;
  onCloseYear: () => void;
}

export function PolizasHeaderActions({
  isPeriodLocked,
  isReadOnlyClient = false,
  isCloseYearPending,
  hasPolizasToExport = true,
  onNewPoliza,
  onOpenPedimentoModal,
  onExportCsv,
  onCloseYear
}: PolizasHeaderActionsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [confirmCloseYear, setConfirmCloseYear] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setConfirmCloseYear(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        setConfirmCloseYear(false);
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

  return (
    <div
      className="flex flex-wrap items-center gap-2 shrink-0 no-print w-full sm:w-auto"
      ref={menuRef}
    >
      {/* Botones directos en pantallas medianas y grandes */}
      <div className="hidden sm:flex items-center gap-2">
        <button
          type="button"
          disabled={!hasPolizasToExport}
          onClick={onExportCsv}
          title={
            hasPolizasToExport
              ? 'Exportar pólizas visibles a CSV'
              : 'No hay pólizas visibles para exportar'
          }
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <span>Exportar Excel (.CSV)</span>
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <span>Imprimir</span>
        </button>
      </div>

      {/* Botón Primario: Capturar Nueva Póliza (en móvil va primero y expandido) */}
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
        className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition order-1 sm:order-3 ${
          isWriteBlocked
            ? 'bg-slate-400 cursor-not-allowed opacity-60'
            : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
        }`}
      >
        {isWriteBlocked ? (
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <Plus className="w-3.5 h-3.5 text-blue-100" aria-hidden="true" />
        )}
        <span>Capturar Nueva Póliza</span>
        {!isWriteBlocked && (
          <kbd className="hidden sm:inline font-mono text-[9px] bg-blue-800 text-blue-100 px-1 py-0.5 rounded border border-blue-400/50">
            Alt+N
          </kbd>
        )}
      </button>

      {/* Menú de Acciones Secundarias / Especializadas */}
      <div className="relative order-2 sm:order-2">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-label="Más acciones y herramientas fiscales de pólizas"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
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
            role="menu"
            aria-orientation="vertical"
            className="absolute right-0 top-full mt-1.5 w-60 sm:w-64 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 divide-y divide-slate-100 text-xs animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {/* Solo en móviles: Exportar e Imprimir */}
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
                onClick={() => {
                  setIsMenuOpen(false);
                  window.print();
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-400" aria-hidden="true" />
                <span className="font-medium">Imprimir Reporte</span>
              </button>
            </div>

            {/* Acciones Especiales: Pedimento Aduanal y Mes 13 */}
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

              <button
                type="button"
                role="menuitem"
                disabled={isCloseYearPending || isWriteBlocked}
                onClick={() => {
                  if (isWriteBlocked) return;
                  if (!confirmCloseYear) {
                    setConfirmCloseYear(true);
                    return;
                  }
                  setIsMenuOpen(false);
                  setConfirmCloseYear(false);
                  onCloseYear();
                }}
                title={
                  isReadOnlyClient
                    ? 'Modo solo lectura'
                    : isPeriodLocked
                    ? 'Periodo bloqueado ante el SAT'
                    : 'Generar póliza de cierre mes 13'
                }
                className={`w-full text-left px-3.5 py-2 flex items-start gap-2.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  confirmCloseYear ? 'bg-amber-50 hover:bg-amber-100' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Lock className={`w-4 h-4 shrink-0 mt-0.5 ${confirmCloseYear ? 'text-amber-700' : 'text-amber-600'}`} aria-hidden="true" />
                <div>
                  <span className={`font-medium block ${confirmCloseYear ? 'text-amber-900 font-bold' : 'text-slate-800'}`}>
                    {confirmCloseYear
                      ? '¿Confirmar Cierre Anual (Mes 13)?'
                      : isCloseYearPending
                      ? 'Generando Cierre...'
                      : 'Cierre Anual (Mes 13)'}
                  </span>
                  <span className={`text-[10px] leading-tight block ${confirmCloseYear ? 'text-amber-800 font-semibold' : 'text-slate-500'}`}>
                    {confirmCloseYear
                      ? 'Clic para cancelar cuentas y trasladar a utilidades'
                      : 'Pérdidas y ganancias del ejercicio'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
