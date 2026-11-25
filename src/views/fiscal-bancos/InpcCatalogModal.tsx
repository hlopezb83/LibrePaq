import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Calendar, DollarSign, Plus, Trash2 } from 'lucide-react';
import { Button, Input, ModalShell, Select, StatusBadge, TabBar, type TabBarItem } from '../../components/ui';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import {
  deleteCustomInpcEntry,
  listCustomInpcEntries,
  upsertCustomInpcEntry
} from '../../lib/supabase/supabase-custom-inpc';
import {
  OFFICIAL_DOF_EXCHANGE_RATES,
  OFFICIAL_INPC_TABLE
} from '../../shared/sat-inpc-catalog';

const INPC_TABS: ReadonlyArray<TabBarItem<'INPC' | 'DOF'>> = [
  { id: 'INPC', label: 'INPC Oficial INEGI (2015 - 2026+)', icon: <Calendar className="w-3.5 h-3.5" aria-hidden="true" /> },
  { id: 'DOF', label: 'Tipo de Cambio USD Cierre DOF Banxico', icon: <DollarSign className="w-3.5 h-3.5" aria-hidden="true" /> }
];

export interface InpcCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeYear?: number;
  companyId?: string;
  isReadOnly?: boolean;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function InpcCatalogModal({
  isOpen,
  onClose,
  activeYear = 2026,
  companyId: companyIdProp,
  isReadOnly = false
}: InpcCatalogModalProps) {
  const { activeCompanyId } = useCompany();
  const companyId = companyIdProp || activeCompanyId;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'INPC' | 'DOF'>('INPC');
  const [editYear, setEditYear] = useState(activeYear);
  const [editMonth, setEditMonth] = useState(11);
  const [editValue, setEditValue] = useState('');
  const { copiedKey: copiedCell, copy: copyValue } = useCopyToClipboard<string>(1500);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { data: customEntries = [] } = useQuery({
    queryKey: ['custom-inpc', companyId],
    queryFn: () => listCustomInpcEntries(companyId),
    enabled: Boolean(isOpen && companyId)
  });

  const customMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of customEntries) m.set(`${e.year}-${e.month}`, e.inpcValue);
    return m;
  }, [customEntries]);

  const saveInpcMut = useMutation({
    mutationFn: () => upsertCustomInpcEntry({
      companyId,
      year: editYear,
      month: editMonth,
      inpcValue: Number.parseFloat(editValue)
    }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['custom-inpc', companyId] });
      setEditValue('');
      toast.success(`INPC ${MONTHS[saved.month - 1]} ${saved.year} guardado (${saved.inpcValue.toFixed(3)}).`);
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const deleteInpcMut = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) => deleteCustomInpcEntry(companyId, year, month),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['custom-inpc', companyId] });
      toast.info('INPC manual eliminado; se restaura valor oficial.');
    },
    onError: (err: Error) => toast.error(err.message)
  });

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

  const inpcYears = Array.from(new Set([...Object.keys(OFFICIAL_INPC_TABLE).map(Number), ...customEntries.map((c) => c.year)])).sort((a, b) => b - a);
  const dofYears = Object.keys(OFFICIAL_DOF_EXCHANGE_RATES).map(Number).sort((a, b) => b - a);

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
              ? 'Base: 2a quincena jul 2018 = 100. Haz clic para copiar o captura manualmente meses recientes/futuros abajo.'
              : 'Solo cifras publicadas Banxico DOF (2023–Ene 2025, sin tasas sintéticas). Haz clic para copiar.'}
          </p>
          {copiedCell && (
            <span role="status">
              <StatusBadge tone="emerald" className="font-mono">
                Copiado: {copiedCell}
              </StatusBadge>
            </span>
          )}
        </div>

        {tab === 'INPC' && !isReadOnly && companyId && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (Number.parseFloat(editValue) > 0) saveInpcMut.mutate();
            }}
            className="flex flex-wrap items-end gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200"
          >
            <label className="space-y-1">
              <span className="block text-[10px] font-bold text-slate-600 uppercase">Año</span>
              <Input size="sm" type="number" min={2015} max={2035} value={editYear} onChange={(e) => setEditYear(Number(e.target.value) || activeYear)} className="w-20 font-mono" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-bold text-slate-600 uppercase">Mes</span>
              <Select size="sm" value={editMonth} onChange={(e) => setEditMonth(Number(e.target.value))}>
                {MONTHS.map((m, idx) => <option key={m} value={idx + 1}>{m}</option>)}
              </Select>
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-bold text-slate-600 uppercase">INPC Manual</span>
              <Input size="sm" type="number" step="0.001" min="0.001" required placeholder="147.850" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-28 font-mono" />
            </label>
            <Button type="submit" size="sm" variant="primary" loading={saveInpcMut.isPending} leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}>
              Guardar INPC
            </Button>
            {customEntries.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 ml-auto">
                {customEntries.slice(0, 4).map((ce) => (
                  <span key={`${ce.year}-${ce.month}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-mono text-[10px]">
                    {MONTHS[ce.month - 1]} {ce.year}: {ce.inpcValue.toFixed(3)}
                    <button type="button" onClick={() => deleteInpcMut.mutate({ year: ce.year, month: ce.month })} aria-label={`Eliminar INPC manual ${MONTHS[ce.month - 1]} ${ce.year}`} className="text-red-700 hover:text-red-900 cursor-pointer">
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </form>
        )}

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
                    const customVal = tab === 'INPC' ? customMap.get(`${yr}-${m}`) : undefined;
                    const val = tab === 'INPC'
                      ? (customVal ?? OFFICIAL_INPC_TABLE[yr]?.[m])
                      : OFFICIAL_DOF_EXCHANGE_RATES[yr]?.[m];
                    const formatted = val
                      ? (tab === 'INPC' ? val.toFixed(3) : val.toFixed(4))
                      : null;
                    return (
                      <td key={m} className="py-1.5 px-1 text-slate-700">
                        {formatted ? (
                          <button
                            type="button"
                            onClick={() => {
                              handleCopyValue(formatted);
                              if (tab === 'INPC' && !isReadOnly) {
                                setEditYear(yr);
                                setEditMonth(m);
                                setEditValue(formatted);
                              }
                            }}
                            title={
                              tab === 'INPC'
                                ? `Copiar/editar INPC ${MONTHS[m - 1]} ${yr}: ${formatted}`
                                : `Copiar TC DOF ${MONTHS[m - 1]} ${yr}: ${formatted}`
                            }
                            aria-label={
                              tab === 'INPC'
                                ? `Copiar INPC ${MONTHS[m - 1]} ${yr}: ${formatted}`
                                : `Copiar Tipo de Cambio ${MONTHS[m - 1]} ${yr}: ${formatted}`
                            }
                            className={`px-1 py-0.5 rounded hover:bg-blue-100 hover:text-blue-900 cursor-pointer transition ${customVal !== undefined ? 'bg-amber-100 text-amber-950 font-bold' : ''}`}
                          >
                            {tab === 'DOF' ? `$${formatted}` : formatted}
                          </button>
                        ) : (
                          tab === 'INPC' && !isReadOnly ? (
                            <button
                              type="button"
                              onClick={() => { setEditYear(yr); setEditMonth(m); setEditValue(''); }}
                              title={`Capturar INPC ${MONTHS[m - 1]} ${yr}`}
                              className="px-1.5 py-0.5 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                            >
                              +
                            </button>
                          ) : '-'
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
