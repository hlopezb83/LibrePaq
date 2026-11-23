import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, ChevronRight, Clock, FileCheck2, RefreshCw, Wallet } from 'lucide-react';
import { handleTablistKeyDown } from '../../hooks/useTablistKeyboard';
import { apiClient } from '../../lib/api-client';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { CxcCxpAgingBucket, CxcCxpAgingResponse, CxcCxpDocumentRow } from '../../shared/types';

export interface CxcCxpTabProps {
  activeCompanyId: string;
}

type AgingMode = 'CXC' | 'CXP';
type CxcCxpApiClient = typeof apiClient & {
  getCxcCxpAging?: (companyId: string) => Promise<CxcCxpAgingResponse>;
};

const BUCKET_META: ReadonlyArray<{ key: CxcCxpAgingBucket; label: string; badgeClass: string }> = [
  { key: '0_30', label: '0–30 días', badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
  { key: '31_60', label: '31–60 días', badgeClass: 'bg-amber-50 text-amber-900 border-amber-200' },
  { key: '61_90', label: '61–90 días', badgeClass: 'bg-orange-50 text-orange-950 border-orange-300' },
  { key: '90_PLUS', label: '+90 días', badgeClass: 'bg-red-50 text-red-900 border-red-300' }
];

const MODE_TABS: ReadonlyArray<{ id: AgingMode; label: string }> = [
  { id: 'CXC', label: 'Cuentas por Cobrar (CxC Emitidos PPD)' },
  { id: 'CXP', label: 'Cuentas por Pagar (CxP Recibidos PPD)' }
];

export function CxcCxpTab({ activeCompanyId }: CxcCxpTabProps) {
  const [mode, setMode] = useState<AgingMode>('CXC');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error, refetch } = useQuery<CxcCxpAgingResponse>({
    queryKey: ['cxc-cxp', activeCompanyId],
    queryFn: () => {
      const client = apiClient as CxcCxpApiClient;
      if (typeof client.getCxcCxpAging !== 'function') {
        throw new Error('El servicio de antigüedad CxC / CxP aún no está disponible en el cliente API.');
      }
      return client.getCxcCxpAging(activeCompanyId);
    },
    enabled: Boolean(activeCompanyId)
  });

  const toggleExpanded = (cfdiId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cfdiId)) next.delete(cfdiId);
      else next.add(cfdiId);
      return next;
    });
  };

  if (isError) {
    return (
      <div role="alert" className="p-8 text-center bg-white rounded-2xl border border-red-200 shadow-2xs space-y-4 max-w-lg mx-auto my-8">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 text-base">Error al consultar antigüedad de saldos PPD</h2>
          <p className="text-xs text-slate-600 mt-1">
            {error instanceof Error ? error.message : 'Error de conexión con el servidor contable.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reintentar consulta</span>
        </button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-600">
        Calculando antigüedad de saldos CxC / CxP y complementos Pago 2.0...
      </div>
    );
  }

  const buckets = mode === 'CXC' ? data.cxcBuckets : data.cxpBuckets;
  const totalInsoluto = mode === 'CXC' ? data.cxcTotal : data.cxpTotal;
  const items: CxcCxpDocumentRow[] = mode === 'CXC' ? data.cxcItems : data.cxpItems;

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-300/90 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Control de Cartera PPD y Complementos de Pago 2.0</h2>
            <p className="text-xs text-slate-600">Antigüedad de saldos insolutos al corte {formatShortDate(data.asOfDate)}</p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Selector de cartera Cuentas por Cobrar o Cuentas por Pagar"
          className="inline-flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200"
        >
          {MODE_TABS.map((t) => {
            const selected = mode === t.id;
            return (
              <button
                key={t.id}
                id={`cxc-cxp-mode-${t.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="cxc-cxp-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setMode(t.id)}
                onKeyDown={(e) => handleTablistKeyDown(e, MODE_TABS, mode, setMode, 'cxc-cxp-mode-')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  selected ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-white hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {BUCKET_META.map((b) => (
          <div key={b.key} className="bg-white p-4 rounded-2xl border border-slate-300/90 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase text-slate-600">{b.label}</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            </div>
            <div className="mt-1.5 text-base font-bold font-mono text-slate-900 tabular-nums">
              {formatCurrency(buckets[b.key])}
            </div>
          </div>
        ))}
        <div className="bg-[#0A1120] text-white p-4 rounded-2xl border border-[#1E293B] shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-blue-200 block">Total Insoluto MXN</span>
          <div className="mt-1.5 text-lg font-extrabold font-mono text-emerald-300 tabular-nums">
            {formatCurrency(totalInsoluto)}
          </div>
          <span className="text-[10px] text-slate-300">
            {items.length} {items.length === 1 ? 'documento PPD' : 'documentos PPD'}
          </span>
        </div>
      </div>

      <div id="cxc-cxp-panel" role="tabpanel" aria-labelledby={`cxc-cxp-mode-${mode}`} className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
        {items.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <FileCheck2 className="w-9 h-9 text-emerald-600 mx-auto" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">
              {mode === 'CXC' ? 'Sin facturas emitidas PPD con saldo pendiente' : 'Sin facturas recibidas PPD con saldo pendiente'}
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              No hay comprobantes con método de pago PPD en esta cartera o todos han sido liquidados con Complementos de Pago 2.0.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <caption className="visually-hidden">
                {mode === 'CXC' ? 'Documentos PPD por cobrar' : 'Documentos PPD por pagar'}
              </caption>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th scope="col" className="py-2.5 px-3 w-10"><span className="visually-hidden">Parcialidades</span></th>
                  <th scope="col" className="py-2.5 px-3">{mode === 'CXC' ? 'Cliente (Receptor)' : 'Proveedor (Emisor)'}</th>
                  <th scope="col" className="py-2.5 px-3">Serie-Folio / UUID</th>
                  <th scope="col" className="py-2.5 px-3">Fecha y Antigüedad</th>
                  <th scope="col" className="py-2.5 px-3 text-right">Total MXN</th>
                  <th scope="col" className="py-2.5 px-3 min-w-[200px]">Pagado vs. Saldo Insoluto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {items.map((row) => {
                  const isExpanded = expandedIds.has(row.cfdiId);
                  const bucketInfo = BUCKET_META.find((b) => b.key === row.bucket) ?? BUCKET_META[0]!;
                  const paidPct = row.totalOriginalMxn > 0 ? Math.min(100, Math.max(0, Math.round((row.totalPagadoMxn / row.totalOriginalMxn) * 100))) : 0;
                  const detailRowId = `parcialidades-${row.cfdiId}`;

                  return (
                    <Fragment key={row.cfdiId}>
                      <tr className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 align-top">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(row.cfdiId)}
                            aria-expanded={isExpanded}
                            aria-controls={detailRowId}
                            aria-label={`${isExpanded ? 'Ocultar' : 'Ver'} parcialidades de ${row.serieFolio || row.uuid.slice(0, 8)}`}
                            className="p-1 rounded-lg hover:bg-slate-200 text-slate-700 cursor-pointer transition"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" aria-hidden="true" /> : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <div className="font-semibold text-slate-900">{row.nombre}</div>
                          <div className="font-mono text-[11px] text-slate-600">{row.rfc}</div>
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <div className="font-semibold text-slate-900">{row.serieFolio || 'S/N'}</div>
                          <div className="font-mono text-[11px] text-slate-600" title={row.uuid}>
                            {row.uuid.slice(0, 8)}…{row.uuid.slice(-4)} ({row.moneda})
                          </div>
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <div className="text-slate-800">{formatShortDate(row.fecha)}</div>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded border text-[10px] font-bold ${bucketInfo.badgeClass}`}>
                            {row.daysPast} días ({bucketInfo.label})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 align-top text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatCurrency(row.totalOriginalMxn)}
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <div className="flex justify-between gap-2 text-[11px] font-mono tabular-nums mb-1">
                            <span className="text-emerald-800">Pag: {formatCurrency(row.totalPagadoMxn)}</span>
                            <span className="font-bold text-slate-900">Ins: {formatCurrency(row.saldoInsolutoMxn)}</span>
                          </div>
                          <div
                            role="progressbar"
                            aria-label={`Avance de pago para ${row.serieFolio || row.uuid.slice(0, 8)}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={paidPct}
                            aria-valuetext={`${paidPct}% pagado (${formatCurrency(row.totalPagadoMxn)} de ${formatCurrency(row.totalOriginalMxn)})`}
                            className="w-full h-2 rounded-full bg-slate-200 overflow-hidden"
                          >
                            <div className="h-full bg-emerald-600" style={{ width: `${paidPct}%` }} />
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {row.parcialidades.length} {row.parcialidades.length === 1 ? 'parcialidad' : 'parcialidades'} ({paidPct}%)
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr id={detailRowId} className="bg-slate-50/90">
                          <td colSpan={6} className="px-6 py-3 border-t border-slate-200">
                            {row.parcialidades.length === 0 ? (
                              <p className="text-xs text-slate-600 italic">
                                Sin complementos de pago Pago 2.0 asociados todavía a este comprobante PPD.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                                  Detalle de Parcialidades (Complemento Pago 2.0)
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {row.parcialidades.map((p) => (
                                    <div key={`${p.paymentUuid}-${p.numParcialidad}`} className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs">
                                      <div>
                                        <span className="font-bold text-slate-900 block">Pago 2.0 · Parcialidad #{p.numParcialidad}</span>
                                        <span className="text-[11px] text-slate-600 block">Fecha pago: {formatShortDate(p.fechaPago)}</span>
                                        <span className="font-mono text-[10px] text-slate-500" title={p.paymentUuid}>UUID: {p.paymentUuid.slice(0, 8)}…</span>
                                      </div>
                                      <strong className="font-mono text-emerald-800 tabular-nums">{formatCurrency(p.impPagadoMxn)}</strong>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
