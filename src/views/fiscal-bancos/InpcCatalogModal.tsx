import { useEffect, useRef, useState } from 'react';
import { BookOpen, Calendar, DollarSign, X } from 'lucide-react';
import {
  OFFICIAL_DOF_EXCHANGE_RATES,
  OFFICIAL_INPC_TABLE
} from '../../shared/sat-inpc-catalog';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { handleTablistKeyDown } from '../../hooks/useTablistKeyboard';

const INPC_TABS: ReadonlyArray<{ id: 'INPC' | 'DOF'; label: string }> = [
  { id: 'INPC', label: 'INPC Oficial INEGI (2020 - 2026)' },
  { id: 'DOF', label: 'Tipo de Cambio USD Cierre DOF Banxico' }
];

export interface InpcCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeYear?: number;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function InpcCatalogModal({
  isOpen,
  onClose,
  activeYear = 2026
}: InpcCatalogModalProps) {
  const [tab, setTab] = useState<'INPC' | 'DOF'>('INPC');
  const { copiedKey: copiedCell, copy: copyValue } = useCopyToClipboard<string>(1500);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogLightDismiss(dialogRef, onClose, { isOpen });

  const handleCopyValue = (raw: string) => {
    void copyValue(raw, raw);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const inpcYears = Object.keys(OFFICIAL_INPC_TABLE)
    .map(Number)
    .sort((a, b) => b - a);

  const dofYears = Object.keys(OFFICIAL_DOF_EXCHANGE_RATES)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="modal-inpc-title"
      className="bg-white rounded-2xl shadow-xl border border-slate-300 w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden backdrop:bg-slate-900/60 p-0 m-auto"
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <BookOpen className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 id="modal-inpc-title" className="text-sm font-bold text-slate-900">
              Catálogo Oficial INEGI / DOF (Art. 20 y 31 LISR)
            </h3>
              <p className="text-xs text-slate-500">
                Índice Nacional de Precios al Consumidor y Tipos de Cambio DOF Banxico
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar catálogo INPC y DOF"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Selector de catálogo fiscal"
          className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-xs font-semibold shrink-0 erp-tab-scroller"
        >
          <button
            id="inpc-tab-INPC"
            type="button"
            role="tab"
            aria-selected={tab === 'INPC'}
            aria-controls="inpc-panel-INPC"
            tabIndex={tab === 'INPC' ? 0 : -1}
            onClick={() => setTab('INPC')}
            onKeyDown={(e) => handleTablistKeyDown(e, INPC_TABS, tab, setTab, 'inpc-tab-')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              tab === 'INPC'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-700 hover:text-slate-950'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
            INPC Oficial INEGI (2020 - 2026)
          </button>
          <button
            id="inpc-tab-DOF"
            type="button"
            role="tab"
            aria-selected={tab === 'DOF'}
            aria-controls="inpc-panel-DOF"
            tabIndex={tab === 'DOF' ? 0 : -1}
            onClick={() => setTab('DOF')}
            onKeyDown={(e) => handleTablistKeyDown(e, INPC_TABS, tab, setTab, 'inpc-tab-')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              tab === 'DOF'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-700 hover:text-slate-950'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" aria-hidden="true" />
            Tipo de Cambio USD Cierre DOF Banxico
          </button>
        </div>

        <div
          role="tabpanel"
          id={`inpc-panel-${tab}`}
          aria-labelledby={`inpc-tab-${tab}`}
          className="p-4 overflow-y-auto overscroll-contain flex-1 min-h-0 text-xs"
        >
          {tab === 'INPC' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-slate-600 text-[11px]">
                  Base: Segunda quincena de julio de 2018 = 100 puntos. Haz clic en un índice para copiarlo al portapapeles.
                </p>
                {copiedCell && (
                  <span role="status" className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Copiado: {copiedCell}
                  </span>
                )}
              </div>
              <div tabIndex={0} role="region" aria-label="Tabla histórica de INPC INEGI" className="overflow-x-auto border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600">
                <table className="w-full text-center border-collapse">
                  <caption className="visually-hidden">Tabla histórica mensual de INPC INEGI</caption>
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-bold text-slate-700 border-b border-slate-200">
                      <th scope="col" className="sticky left-0 z-10 bg-slate-50 py-2 px-2.5 text-left">Año</th>
                      {MONTHS.map((m) => (
                        <th scope="col" key={m} className="py-2 px-1 font-semibold">{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {inpcYears.map((yr) => (
                      <tr
                        key={yr}
                        className={yr === activeYear ? 'bg-blue-50/70 font-bold' : 'hover:bg-slate-50'}
                      >
                        <th
                          scope="row"
                          className={`sticky left-0 z-10 py-2 px-2.5 text-left font-bold text-slate-900 border-r border-slate-200 ${
                            yr === activeYear ? 'bg-blue-50' : 'bg-white'
                          }`}
                        >
                          {yr}
                        </th>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                          const val = OFFICIAL_INPC_TABLE[yr]?.[m];
                          const formatted = val ? val.toFixed(3) : null;
                          return (
                            <td key={m} className="py-1.5 px-1 text-slate-700">
                              {formatted ? (
                                <button
                                  type="button"
                                  onClick={() => handleCopyValue(formatted)}
                                  title={`Copiar INPC ${MONTHS[m - 1]} ${yr}: ${formatted}`}
                                  aria-label={`Copiar INPC ${MONTHS[m - 1]} ${yr}: ${formatted}`}
                                  className="px-1 py-0.5 rounded hover:bg-blue-100 hover:text-blue-900 cursor-pointer transition"
                                >
                                  {formatted}
                                </button>
                              ) : (
                                '-'
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-slate-600 text-[11px]">
                  Tipo de cambio de cierre DOF Banxico (Art. 8 CFF). Haz clic en una cifra para copiarla.
                </p>
                {copiedCell && (
                  <span role="status" className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Copiado: {copiedCell}
                  </span>
                )}
              </div>
              <div tabIndex={0} role="region" aria-label="Tabla histórica de Tipo de Cambio DOF" className="overflow-x-auto border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600">
                <table className="w-full text-center border-collapse">
                  <caption className="visually-hidden">Tabla histórica de Tipo de Cambio DOF Banxico</caption>
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-bold text-slate-700 border-b border-slate-200">
                      <th scope="col" className="sticky left-0 z-10 bg-slate-50 py-2 px-2.5 text-left">Año</th>
                      {MONTHS.map((m) => (
                        <th scope="col" key={m} className="py-2 px-1 font-semibold">{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {dofYears.map((yr) => (
                      <tr
                        key={yr}
                        className={yr === activeYear ? 'bg-blue-50/70 font-bold' : 'hover:bg-slate-50'}
                      >
                        <th
                          scope="row"
                          className={`sticky left-0 z-10 py-2 px-2.5 text-left font-bold text-slate-900 border-r border-slate-200 ${
                            yr === activeYear ? 'bg-blue-50' : 'bg-white'
                          }`}
                        >
                          {yr}
                        </th>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                          const val = OFFICIAL_DOF_EXCHANGE_RATES[yr]?.[m];
                          const formatted = val ? val.toFixed(4) : null;
                          return (
                            <td key={m} className="py-1.5 px-1 text-slate-700">
                              {formatted ? (
                                <button
                                  type="button"
                                  onClick={() => handleCopyValue(formatted)}
                                  title={`Copiar TC DOF ${MONTHS[m - 1]} ${yr}: ${formatted}`}
                                  aria-label={`Copiar Tipo de Cambio ${MONTHS[m - 1]} ${yr}: ${formatted}`}
                                  className="px-1 py-0.5 rounded hover:bg-blue-100 hover:text-blue-900 cursor-pointer transition"
                                >
                                  ${formatted}
                                </button>
                              ) : (
                                '-'
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
    </dialog>
  );
}
