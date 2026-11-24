import { useEffect, useRef, useState } from 'react';
import { HelpCircle, Lock, X } from 'lucide-react';
import { StatusBadge } from '../../components/ui';
import type { Company, PolizaType } from '../../shared/types';

export function PolizaEditorTitle({
  editingPolizaId,
  isPeriodLocked,
  predictedNextFolio,
  tipo
}: {
  editingPolizaId: string | null;
  isPeriodLocked: boolean;
  predictedNextFolio: number;
  tipo: PolizaType;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
      <span className="truncate">
        {editingPolizaId ? 'Editar Póliza Contable' : 'Capturar Nueva Póliza Contable'}
      </span>
      <StatusBadge tone="blue" shape="tag" className="px-2 py-0.5 text-[11px]">
        {editingPolizaId ? 'Modo Edición' : `Folio: ${tipo} #${predictedNextFolio}`}
      </StatusBadge>
      {isPeriodLocked && (
        <StatusBadge
          tone="amber"
          shape="tag"
          icon={<Lock className="w-3 h-3" aria-hidden="true" />}
        >
          Periodo Bloqueado
        </StatusBadge>
      )}
    </span>
  );
}

export function PolizaEditorSubtitle({
  activeCompany,
  currentYear,
  currentPeriod
}: {
  activeCompany?: Company | null;
  currentYear?: number;
  currentPeriod?: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap text-[11px] text-slate-600 min-w-0">
      <span className="font-bold text-slate-800 truncate max-w-[160px] sm:max-w-xs">
        {activeCompany?.name}
      </span>
      {activeCompany?.rfc && (
        <StatusBadge tone="slate" shape="tag">
          {activeCompany.rfc}
        </StatusBadge>
      )}
      <span className="text-slate-400" aria-hidden="true">•</span>
      <span className="font-mono tabular-nums text-[11px] text-blue-700 font-semibold">
        P{String(currentPeriod ?? 1).padStart(2, '0')}/{currentYear ?? 2026}
      </span>
    </span>
  );
}

export function PolizaShortcutsPopover({ editingPolizaId }: { editingPolizaId: string | null }) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const shortcutsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showShortcuts) return;
    const onOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowShortcuts(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowShortcuts(false);
        requestAnimationFrame(() => shortcutsButtonRef.current?.focus());
      }
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [showShortcuts]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        ref={shortcutsButtonRef}
        type="button"
        aria-expanded={showShortcuts}
        aria-haspopup="dialog"
        aria-label="Ver atajos rápidos de teclado CONTPAQi"
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
              onClick={() => {
                setShowShortcuts(false);
                requestAnimationFrame(() => shortcutsButtonRef.current?.focus());
              }}
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
  );
}
