import { useEffect, useRef, useState } from 'react';
import { BookOpen, Calendar, DollarSign } from 'lucide-react';
import { Button, ModalShell, StatusBadge, TabBar, type TabBarItem } from '../../components/ui';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import {
  OFFICIAL_DOF_EXCHANGE_RATES,
  OFFICIAL_INPC_TABLE
} from '../../shared/sat-inpc-catalog';

const INPC_TABS: ReadonlyArray<TabBarItem<'INPC' | 'DOF'>> = [
  { id: 'INPC', label: 'INPC Oficial INEGI (2020 - 2026)', icon: <Calendar className="w-3.5 h-3.5" aria-hidden="true" /> },
  { id: 'DOF', label: 'Tipo de Cambio USD Cierre DOF Banxico', icon: <DollarSign className="w-3.5 h-3.5" aria-hidden="true" /> }
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
    <ModalShell
      dialogRef={dialogRef}
      isOpen={isOpen}
      onClose={onClose}
      title="Catálogo Oficial INEGI / DOF (Art. 20 y 31 LISR)"
      subtitle="Índice Nacional de Precios al Consumidor y Tipos de Cambio DOF Banxico"
      icon={<BookOpen className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      titleId="modal-inpc-title"
      maxWidth="4xl"
      closeLabel="Cerrar catálogo INPC y DOF"
      bodyClassName="text-xs"
      headerTabs={
        <TabBar
          tabs={INPC_TABS}
          activeId={tab}
          onSelect={setTab}
          idPrefix="inpc-tab-"
          ariaLabel="Selector de catálogo fiscal"
          panelId={`inpc-panel-${tab}`}
        />
      }
      footer={
        <Button variant="primary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div
        role="tabpanel"
        id={`inpc-panel-${tab}`}
        aria-labelledby={`inpc-tab-${tab}`}
        className="space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-slate-600 text-[11px]">
            {tab === 'INPC'
              ? 'Base: Segunda quincena de julio de 2018 = 100 puntos. Haz clic en un índice para copiarlo al portapapeles.'
              : 'Tipo de cambio de cierre DOF Banxico (Art. 8 CFF). Haz clic en una cifra para copiarla.'}
          </p>
          {copiedCell && (
            <span role="status">
              <StatusBadge tone="emerald" className="font-mono">
                Copiado: {copiedCell}
              </StatusBadge>
            </span>
          )}
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-label={tab === 'INPC' ? 'Tabla histórica de INPC INEGI' : 'Tabla histórica de Tipo de Cambio DOF'}
          className="overflow-x-auto border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <table className="w-full text-center border-collapse">
            <caption className="visually-hidden">
              {tab === 'INPC' ? 'Tabla histórica mensual de INPC INEGI' : 'Tabla histórica de Tipo de Cambio DOF Banxico'}
            </caption>
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-700 border-b border-slate-200">
                <th scope="col" className="sticky left-0 z-10 bg-slate-50 py-2 px-2.5 text-left">Año</th>
                {MONTHS.map((m) => (
                  <th scope="col" key={m} className="py-2 px-1 font-semibold">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {(tab === 'INPC' ? inpcYears : dofYears).map((yr) => (
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
                    const val = tab === 'INPC'
                      ? OFFICIAL_INPC_TABLE[yr]?.[m]
                      : OFFICIAL_DOF_EXCHANGE_RATES[yr]?.[m];
                    const formatted = val
                      ? (tab === 'INPC' ? val.toFixed(3) : val.toFixed(4))
                      : null;
                    return (
                      <td key={m} className="py-1.5 px-1 text-slate-700">
                        {formatted ? (
                          <button
                            type="button"
                            onClick={() => handleCopyValue(formatted)}
                            title={
                              tab === 'INPC'
                                ? `Copiar INPC ${MONTHS[m - 1]} ${yr}: ${formatted}`
                                : `Copiar TC DOF ${MONTHS[m - 1]} ${yr}: ${formatted}`
                            }
                            aria-label={
                              tab === 'INPC'
                                ? `Copiar INPC ${MONTHS[m - 1]} ${yr}: ${formatted}`
                                : `Copiar Tipo de Cambio ${MONTHS[m - 1]} ${yr}: ${formatted}`
                            }
                            className="px-1 py-0.5 rounded hover:bg-blue-100 hover:text-blue-900 cursor-pointer transition"
                          >
                            {tab === 'DOF' ? `$${formatted}` : formatted}
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
    </ModalShell>
  );
}
