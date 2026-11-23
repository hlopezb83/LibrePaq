import { useEffect, useRef, useState } from 'react';
import { BookOpen, Calendar, DollarSign, X } from 'lucide-react';
import {
  OFFICIAL_DOF_EXCHANGE_RATES,
  OFFICIAL_INPC_TABLE
} from '../../shared/sat-inpc-catalog';
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogLightDismiss(dialogRef, onClose, { isOpen });

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
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
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
                : 'border-transparent text-slate-500 hover:text-slate-800'
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
                : 'border-transparent text-slate-500 hover:text-slate-800'
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
              <p className="text-slate-600 text-[11px]">
                Base: Segunda quincena de julio de 2018 = 100 puntos. Los valores son utilizados para el cálculo de la deducción de inversiones y actualización de pérdidas fiscales.
              </p>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
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
                        className={yr === activeYear ? 'bg-blue-50/50 font-bold' : 'hover:bg-slate-50'}
                      >
                        <td className="sticky left-0 bg-white py-2 px-2.5 text-left font-bold text-slate-900 border-r border-slate-100">{yr}</td>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                          const val = OFFICIAL_INPC_TABLE[yr]?.[m];
                          return (
                            <td key={m} className="py-2 px-1 text-slate-700">
                              {val ? val.toFixed(3) : '-'}
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
              <p className="text-slate-600 text-[11px]">
                Tipo de cambio para solventar obligaciones denominadas en moneda extranjera, publicado por el Banco de México en el DOF al cierre de cada mes (Art. 8 CFF).
              </p>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
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
                        className={yr === activeYear ? 'bg-blue-50/50 font-bold' : 'hover:bg-slate-50'}
                      >
                        <td className="sticky left-0 bg-white py-2 px-2.5 text-left font-bold text-slate-900 border-r border-slate-100">{yr}</td>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                          const val = OFFICIAL_DOF_EXCHANGE_RATES[yr]?.[m];
                          return (
                            <td key={m} className="py-2 px-1 text-slate-700">
                              {val ? `$${val.toFixed(4)}` : '-'}
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
