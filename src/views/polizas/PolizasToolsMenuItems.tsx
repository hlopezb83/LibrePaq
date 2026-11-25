import { Anchor, ArrowRightLeft, BookmarkCheck, Download, FileSpreadsheet, Loader2, Lock, Printer } from 'lucide-react';
import { InlineConfirm } from '../../components/ui';

export interface PolizasToolsMenuItemsProps {
  currentYear: number;
  currentPeriod?: number;
  isPeriodLocked: boolean;
  isPeriod13Locked: boolean;
  isReadOnlyClient: boolean;
  isWriteBlocked: boolean;
  isCloseYearBlocked: boolean;
  isCloseYearPending: boolean;
  hasPolizasToExport: boolean;
  confirmCloseYear: boolean;
  setConfirmCloseYear: (v: boolean) => void;
  closeMenu: () => void;
  onExportCsv: () => void;
  onPrintPdf?: () => void;
  onOpenTemplatesModal?: () => void;
  onOpenImportModal?: () => void;
  onOpenAsambleaModal?: () => void;
  onOpenPedimentoModal?: () => void;
  onCloseYear: () => void;
}

export function PolizasToolsMenuItems({
  currentYear,
  currentPeriod,
  isPeriodLocked,
  isPeriod13Locked,
  isReadOnlyClient,
  isWriteBlocked,
  isCloseYearBlocked,
  isCloseYearPending,
  hasPolizasToExport,
  confirmCloseYear,
  setConfirmCloseYear,
  closeMenu,
  onExportCsv,
  onPrintPdf,
  onOpenTemplatesModal,
  onOpenImportModal,
  onOpenAsambleaModal,
  onOpenPedimentoModal,
  onCloseYear
}: PolizasToolsMenuItemsProps) {
  const printTooltip = hasPolizasToExport
    ? 'Genera una versión formal optimizada para impresión y Guardar como PDF'
    : 'No hay pólizas visibles para imprimir';

  return (
    <>
      <div className="sm:hidden py-1">
        <button
          type="button"
          role="menuitem"
          disabled={!hasPolizasToExport}
          onClick={() => { closeMenu(); onExportCsv(); }}
          title={hasPolizasToExport ? 'Exportar pólizas visibles a CSV' : 'No hay pólizas visibles para exportar'}
          className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4 text-emerald-700" aria-hidden="true" />
          <span className="font-medium">Exportar Excel (.CSV)</span>
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={!hasPolizasToExport}
          title={printTooltip}
          onClick={() => { closeMenu(); if (onPrintPdf) onPrintPdf(); else window.print(); }}
          className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Printer className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <span className="font-medium">Imprimir / PDF Formal</span>
        </button>
      </div>

      <div className="py-1">
        {onOpenTemplatesModal && (
          <button
            type="button"
            role="menuitem"
            onClick={() => { closeMenu(); onOpenTemplatesModal(); }}
            className="w-full text-left px-3.5 py-2 flex items-start gap-2.5 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <BookmarkCheck className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-medium block text-slate-800">Pre-pólizas / Plantillas</span>
              <span className="text-[10px] text-slate-500 leading-tight block">
                Asientos recurrentes en 1 clic
              </span>
            </div>
          </button>
        )}

        {onOpenImportModal && (
          <button
            type="button"
            role="menuitem"
            disabled={isReadOnlyClient}
            onClick={() => { if (!isReadOnlyClient) { closeMenu(); onOpenImportModal(); } }}
            title={isReadOnlyClient ? 'Modo solo lectura' : 'Importar pólizas desde CSV, Excel o CONTPAQi TXT'}
            className="w-full text-left px-3.5 py-2 flex items-start gap-2.5 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-medium block text-slate-800">Importar Pólizas (CSV/XLSX/TXT)</span>
              <span className="text-[10px] text-slate-500 leading-tight block">
                Carga masiva con validación de partida doble
              </span>
            </div>
          </button>
        )}

        {onOpenAsambleaModal && (
          <button
            type="button"
            role="menuitem"
            disabled={isWriteBlocked}
            onClick={() => { if (!isWriteBlocked) { closeMenu(); onOpenAsambleaModal(); } }}
            title={
              isReadOnlyClient
                ? 'Modo solo lectura'
                : isPeriodLocked
                ? 'Periodo bloqueado ante el SAT'
                : currentPeriod === 1
                ? 'Traspaso de Resultado del Ejercicio (305 -> 301-02)'
                : 'Recomendado ejecutarse en Enero (Periodo 01)'
            }
            className="w-full text-left px-3.5 py-2 flex items-start gap-2.5 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRightLeft className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-medium block text-slate-800">
                Traspaso Asamblea {currentPeriod === 1 ? '(Enero)' : '(P01)'}
              </span>
              <span className="text-[10px] text-slate-500 leading-tight block">
                305-01-001 a Resultados Anteriores (sin doble conteo)
              </span>
            </div>
          </button>
        )}

        {onOpenPedimentoModal && (
          <button
            type="button"
            role="menuitem"
            disabled={isWriteBlocked}
            onClick={() => {
              if (isWriteBlocked) return;
              closeMenu();
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
          <div className="px-3 py-2.5 bg-amber-50 space-y-2">
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-bold text-amber-950 block">Cierre Anual {currentYear} (Mes 13)</span>
                <span className="text-[10px] text-amber-900 leading-tight block">
                  Cancela cuentas de resultados y traslada utilidad o pérdida al ejercicio {currentYear}.
                </span>
              </div>
            </div>
            <InlineConfirm
              tone="warning"
              confirmLabel={isCloseYearPending ? 'Generando...' : 'Confirmar cierre'}
              cancelLabel="Cancelar"
              busy={isCloseYearPending || isCloseYearBlocked}
              ariaLabel={`Confirmar cierre anual ${currentYear}`}
              className="w-full justify-end bg-transparent border-0 p-0"
              onCancel={() => setConfirmCloseYear(false)}
              onConfirm={() => {
                closeMenu();
                setConfirmCloseYear(false);
                onCloseYear();
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            role="menuitem"
            disabled={isCloseYearPending || isCloseYearBlocked}
            aria-busy={isCloseYearPending}
            onClick={() => { if (!isCloseYearBlocked) setConfirmCloseYear(true); }}
            title={
              isReadOnlyClient
                ? 'Modo solo lectura'
                : isPeriod13Locked
                ? 'Periodo 13 bloqueado ante el SAT'
                : `Generar póliza de cierre anual ${currentYear} (Mes 13)`
            }
            className="w-full text-left px-3.5 py-2 flex items-start gap-2.5 text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCloseYearPending ? (
              <Loader2 className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 animate-spin" aria-hidden="true" />
            ) : (
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
            )}
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
    </>
  );
}
