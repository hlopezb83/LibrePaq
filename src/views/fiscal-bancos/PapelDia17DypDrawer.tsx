import { Check, ChevronDown, ChevronUp, ClipboardList, Copy } from 'lucide-react';
import { useState } from 'react';
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

export function PapelDia17DypDrawer({
  workpaper,
  year,
  period,
  hasUnsavedParams,
  onCopyFullGuide,
  copiedFullGuide
}: PapelDia17DypDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { copiedKey, copy: copyCasilla } = useCopyToClipboard<string>(1500);
  const casillas = buildSatDypCasillas(workpaper, year, period);

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-slate-50 border-b border-slate-200">
        <button
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
        <div id="dyp-casillas-panel" className="p-4 space-y-2">
          <p className="text-[11px] text-slate-600">
            Importes redondeados conforme al Art. 20 CFF (≤ $0.50 baja al entero anterior; &gt; $0.50 sube al siguiente). Haz clic en Copiar en cada casilla para capturar en el portal SAT DyP.
          </p>
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
            {casillas.map((c) => {
              const isCopied = copiedKey === c.id;
              return (
                <div
                  key={c.id}
                  className={`px-3 py-2 flex items-center justify-between gap-3 text-xs ${
                    c.section === 'TOTAL' ? 'bg-slate-50 font-bold' : 'bg-white hover:bg-slate-50/70'
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold shrink-0 ${SECTION_BADGES[c.section]}`}>
                      {c.section}
                    </span>
                    <div className="min-w-0">
                      <div className="text-slate-900 font-medium truncate">{c.label}</div>
                      <div className="text-[11px] text-slate-500">{c.satFieldHint}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums font-bold text-slate-900">{c.formatted}</span>
                    <button
                      type="button"
                      disabled={hasUnsavedParams}
                      aria-label={`Copiar ${c.label}: ${c.valuePesos}`}
                      onClick={() => void copyCasilla(String(c.valuePesos), c.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 text-[11px] font-semibold disabled:opacity-50 cursor-pointer"
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
      )}
    </div>
  );
}
