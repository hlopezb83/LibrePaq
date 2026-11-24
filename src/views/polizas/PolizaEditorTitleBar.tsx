import { useEffect, useRef, useState } from 'react';
import { HelpCircle, Lock, ReceiptText, X } from 'lucide-react';
import type { Company, PolizaType } from '../../shared/types';

interface PolizaEditorTitleBarProps {
  editingPolizaId: string | null;
  activeCompany?: Company | null;
  currentYear?: number;
  currentPeriod?: number;
  isPeriodLocked: boolean;
  predictedNextFolio: number;
  tipo: PolizaType;
  onClose: () => void;
}

export function PolizaEditorTitleBar({
  editingPolizaId,
  activeCompany,
  currentYear,
  currentPeriod,
  isPeriodLocked,
  predictedNextFolio,
  tipo,
  onClose
}: PolizaEditorTitleBarProps) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showShortcuts) return;
    const onOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowShortcuts(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setShowShortcuts(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [showShortcuts]);

  return (
    <header className="shrink-0 px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
          <ReceiptText className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 id="modal-poliza-title" className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {editingPolizaId ? 'Editar Póliza Contable' : 'Capturar Nueva Póliza Contable'}
            </h2>
            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200 whitespace-nowrap">
              {editingPolizaId ? 'Modo Edición' : `Folio: ${tipo} #${predictedNextFolio}`}
            </span>
            {isPeriodLocked && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300 whitespace-nowrap">
                <Lock className="w-3 h-3 text-amber-700" aria-hidden="true" /> Periodo Bloqueado
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-[11px] text-slate-600">
            <span className="font-bold text-slate-800 truncate max-w-[180px] sm:max-w-xs">
              {activeCompany?.name}
            </span>
            {activeCompany?.rfc && (
              <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 text-[10px] font-bold">
                {activeCompany.rfc}
              </span>
            )}
            <span className="text-slate-400" aria-hidden="true">•</span>
            <span className="font-mono text-[11px] text-blue-700 font-semibold">
              P{String(currentPeriod ?? 1).padStart(2, '0')}/{currentYear ?? 2026}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            aria-expanded={showShortcuts}
            aria-haspopup="dialog"
            onClick={() => setShowShortcuts((prev) => !prev)}
            title="Ver atajos rápidos de teclado CONTPAQi"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition ${
              showShortcuts
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            <span className="hidden sm:inline">Atajos</span>
          </button>

          {showShortcuts && (
            <div
              role="dialog"
              aria-label="Atajos de teclado para captura de póliza"
              className="absolute right-0 top-full mt-1.5 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-slate-300 p-3 z-40 text-[11px] text-slate-700 space-y-1.5"
            >
              <div className="font-bold text-slate-900 pb-1 border-b border-slate-200 flex items-center justify-between">
                <span>Atajos Rápidos CONTPAQi</span>
                <button
                  type="button"
                  onClick={() => setShowShortcuts(false)}
                  aria-label="Cerrar lista de atajos"
                  className="text-slate-500 hover:text-slate-800 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
              <ul className="space-y-1 font-mono text-[10.5px]">
                <li><kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 font-bold">Tab / Enter</kbd> Avanzar celda</li>
                <li><kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 font-bold">&quot; / F3</kbd> Copiar renglón superior</li>
                <li><kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 font-bold">= / Espacio</kbd> Auto-cuadrar diferencia</li>
                {!editingPolizaId && (
                  <li><kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 font-bold">Alt+1..3</kbd> Plantillas rápidas</li>
                )}
                <li><kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 font-bold">F4</kbd> Desglosar IVA 16%</li>
                <li><kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 font-bold">F2</kbd> Abrir catálogo de cuentas</li>
                <li><kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 font-bold">Ctrl+Enter</kbd> Guardar y aplicar</li>
              </ul>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar captura de póliza"
          className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer shrink-0"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
