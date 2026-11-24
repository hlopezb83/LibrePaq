import { Check, ChevronDown, ChevronUp, ClipboardList, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { buildSatDypCasillas } from '../../shared/engine/sat-dyp-formatter';
import type { FiscalWorkpaperResponse } from '../../shared/types';

export interface PapelDia17DypDrawerProps {
  workpaper: FiscalWorkpaperResponse;
  year: number;
  period: number;
  hasUnsavedParams: boolean;
  onCopyFullGuide: () => void;
  copiedFullGuide: boolean;
}

const SECTION_BADGES: Record<'ISR' | 'IVA' | 'RETENCIONES' | 'TOTAL', string> = {
  ISR: 'bg-blue-50 text-blue-800 border-blue-200',
  IVA: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  RETENCIONES: 'bg-amber-50 text-amber-900 border-amber-200',
  TOTAL: 'bg-slate-900 text-white border-slate-900'
};

const SECTION_TITLES: Record<'ISR' | 'IVA' | 'RETENCIONES' | 'TOTAL', string> = {
  ISR: 'ISR Provisional',
  IVA: 'IVA Definitivo',
  RETENCIONES: 'Retenciones Enterables',
  TOTAL: 'Total a Pagar SAT'
};

const SECTION_ORDER: ReadonlyArray<'ISR' | 'IVA' | 'RETENCIONES' | 'TOTAL'> = [
  'ISR',
  'IVA',
  'RETENCIONES',
  'TOTAL'
];

export function PapelDia17DypDrawer({
  workpaper,
  year,
  period,
  hasUnsavedParams,
  onCopyFullGuide,
  copiedFullGuide
}: PapelDia17DypDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);
  const { copiedKey, copy: copyCasilla } = useCopyToClipboard<string>(1500);
  const casillas = buildSatDypCasillas(workpaper, year, period);
  const unsavedTitle = 'Aplica los cambios con Recalcular antes de copiar';

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        toggleBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-slate-50 border-b border-slate-200">
        <button
          ref={toggleBtnRef}
          type="button"
          aria-expanded={isOpen}
          aria-controls="dyp-casillas-panel"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-900 hover:text-blue-800 cursor-pointer"
        >
          <ClipboardList className="w-4 h-4 text-blue-700" aria-hidden="true" />
          <span>Guía DyP Casilla por Casilla (Art. 20 CFF · Pesos Enteros)</span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-500" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          disabled={hasUnsavedParams}
          title={hasUnsavedParams ? unsavedTitle : 'Copiar todas las casillas de la guía DyP'}
          onClick={onCopyFullGuide}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {copiedFullGuide ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span className="text-emerald-700">Guía Copiada</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
              <span>Copiar Guía Completa</span>
            </>
          )}
        </button>
      </div>

      {isOpen && (
        <div id="dyp-casillas-panel" className="p-4 space-y-3">
          <span className="visually-hidden" role="status" aria-live="polite">
            {copiedKey ? 'Valor de casilla DyP copiado al portapapeles' : copiedFullGuide ? 'Guía DyP completa copiada al portapapeles' : ''}
          </span>
          <p className="text-[11px] text-slate-600">
            Importes redondeados conforme al Art. 20 CFF (≤ $0.50 baja al entero anterior; &gt; $0.50 sube al siguiente). Haz clic en Copiar en cada casilla para capturar en el portal SAT DyP.
          </p>
          <div className="space-y-3">
            {SECTION_ORDER.map((section) => {
              const items = casillas.filter((c) => c.section === section);
              if (items.length === 0) return null;
              return (
                <div key={section} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-3 py-1.5 bg-slate-100/80 border-b border-slate-200 flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${SECTION_BADGES[section]}`}>
                      {section}
                    </span>
                    <span className="text-[11px] font-bold text-slate-800">{SECTION_TITLES[section]}</span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {items.map((c) => {
                      const isCopied = copiedKey === c.id;
                      return (
                        <div
                          key={c.id}
                          className={`px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-xs ${
                            c.section === 'TOTAL' ? 'bg-slate-50 font-bold' : 'bg-white hover:bg-slate-50/70'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-slate-900 font-medium break-words">{c.label}</div>
                            <div className="text-[11px] text-slate-500">{c.satFieldHint}</div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                            <span className="font-mono tabular-nums font-bold text-slate-900">{c.formatted}</span>
                            <button
                              type="button"
                              disabled={hasUnsavedParams}
                              title={hasUnsavedParams ? unsavedTitle : `Copiar ${c.label}`}
                              aria-label={`Copiar ${c.label}: ${c.valuePesos}`}
                              onClick={() => void copyCasilla(String(c.valuePesos), c.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 min-h-[28px] rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {isCopied ? (
                                <Check className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                              ) : (
                                <Copy className="w-3 h-3" aria-hidden="true" />
                              )}
                              <span>{isCopied ? 'Copiado' : 'Copiar'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
