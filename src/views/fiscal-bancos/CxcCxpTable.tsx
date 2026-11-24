import { Fragment } from 'react';
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import { fromCents, sumCents } from '../../shared/engine/invariants-and-math';
import type { CxcCxpAgingBucket, CxcCxpDocumentRow } from '../../shared/types';

export interface BucketMeta {
  key: CxcCxpAgingBucket;
  label: string;
  badgeClass: string;
}

export interface CxcCxpTableProps {
  mode: 'CXC' | 'CXP';
  items: readonly CxcCxpDocumentRow[];
  bucketMeta: readonly BucketMeta[];
  expandedIds: ReadonlySet<string>;
  onToggleExpanded: (cfdiId: string) => void;
}

export function CxcCxpTable({
  mode,
  items,
  bucketMeta,
  expandedIds,
  onToggleExpanded
}: CxcCxpTableProps) {
  const { copiedKey, copy } = useCopyToClipboard<string>(2000);
  const totalOriginal = fromCents(sumCents(items.map((r) => r.totalOriginalMxn)));
  const totalPagado = fromCents(sumCents(items.map((r) => r.totalPagadoMxn)));
  const totalInsoluto = fromCents(sumCents(items.map((r) => r.saldoInsolutoMxn)));

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={mode === 'CXC' ? 'Documentos PPD por cobrar' : 'Documentos PPD por pagar'}
      className="overflow-x-auto max-w-full"
    >
      <table className="w-full text-left border-collapse">
        <caption className="visually-hidden">
          {mode === 'CXC' ? 'Documentos PPD por cobrar' : 'Documentos PPD por pagar'}
        </caption>
        <thead>
          <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <th scope="col" className="py-2.5 px-3 w-11"><span className="visually-hidden">Parcialidades</span></th>
            <th scope="col" className="py-2.5 px-3">{mode === 'CXC' ? 'Cliente (Receptor)' : 'Proveedor (Emisor)'}</th>
            <th scope="col" className="py-2.5 px-3">Serie-Folio / UUID</th>
            <th scope="col" className="py-2.5 px-3">Fecha y Antigüedad</th>
            <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Total MXN</th>
            <th scope="col" className="py-2.5 px-3 min-w-[220px]">Pagado vs. Saldo Insoluto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs">
          {items.map((row) => {
            const isExpanded = expandedIds.has(row.cfdiId);
            const bucketInfo = bucketMeta.find((b) => b.key === row.bucket) ?? bucketMeta[0]!;
            const paidPct = row.totalOriginalMxn > 0
              ? Math.min(100, Math.max(0, Math.round((row.totalPagadoMxn / row.totalOriginalMxn) * 100)))
              : 0;
            const detailRowId = `parcialidades-${row.cfdiId}`;
            const isUuidCopied = copiedKey === row.cfdiId;

            return (
              <Fragment key={row.cfdiId}>
                <tr className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-3 align-top">
                    <button
                      type="button"
                      onClick={() => onToggleExpanded(row.cfdiId)}
                      aria-expanded={isExpanded}
                      aria-controls={detailRowId}
                      aria-label={`${isExpanded ? 'Ocultar' : 'Ver'} parcialidades de ${row.serieFolio || row.uuid.slice(0, 8)}`}
                      className="p-2 rounded-lg hover:bg-slate-200 text-slate-700 cursor-pointer transition"
                    >
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4" aria-hidden="true" />
                        : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
                    </button>
                  </td>
                  <th scope="row" className="py-2.5 px-3 align-top text-left font-normal min-w-0">
                    <div className="font-semibold text-slate-900">{row.nombre}</div>
                    <div className="font-mono text-[11px] text-slate-600">{row.rfc}</div>
                  </th>
                  <td className="py-2.5 px-3 align-top whitespace-nowrap">
                    <div className="font-semibold text-slate-900">{row.serieFolio || 'S/N'}</div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600" title={row.uuid}>
                      <span>{row.uuid.slice(0, 8)}…{row.uuid.slice(-4)} ({row.moneda})</span>
                      <button
                        type="button"
                        onClick={() => void copy(row.uuid, row.cfdiId)}
                        aria-label={isUuidCopied ? `UUID ${row.uuid} copiado` : `Copiar UUID completo de ${row.serieFolio || row.uuid.slice(0, 8)}`}
                        title={isUuidCopied ? 'UUID copiado' : 'Copiar UUID completo'}
                        className="min-h-[28px] min-w-[28px] inline-flex items-center justify-center p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer transition"
                      >
                        {isUuidCopied
                          ? <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                          : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                      </button>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 align-top whitespace-nowrap">
                    <div className="text-slate-800">{formatShortDate(row.fecha)}</div>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded border text-[11px] font-bold ${bucketInfo.badgeClass}`}>
                      {row.daysPast} días ({bucketInfo.label})
                    </span>
                  </td>
                  <td className="py-2.5 px-3 align-top text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {formatCurrency(row.totalOriginalMxn)}
                  </td>
                  <td className="py-2.5 px-3 align-top">
                    <div className="flex justify-between gap-3 text-[11px] font-mono tabular-nums mb-1 whitespace-nowrap">
                      <span className="text-emerald-800">Pagado: {formatCurrency(row.totalPagadoMxn)}</span>
                      <span className="font-bold text-slate-900">Insoluto: {formatCurrency(row.saldoInsolutoMxn)}</span>
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
                    <div className="text-[11px] text-slate-600 mt-0.5">
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
                              <div key={`${p.paymentUuid}-${p.numParcialidad}`} className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs min-w-0">
                                <div className="min-w-0">
                                  <span className="font-bold text-slate-900 block">Pago 2.0 · Parcialidad #{p.numParcialidad}</span>
                                  <span className="text-[11px] text-slate-600 block">Fecha pago: {formatShortDate(p.fechaPago)}</span>
                                  <span className="font-mono text-[11px] text-slate-600 block truncate" title={p.paymentUuid}>UUID: {p.paymentUuid.slice(0, 8)}…</span>
                                </div>
                                <strong className="font-mono text-emerald-800 tabular-nums whitespace-nowrap shrink-0">
                                  {formatCurrency(p.impPagadoMxn)}
                                </strong>
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
        {items.length > 0 && (
          <tfoot className="bg-slate-100 border-t-2 border-slate-300 text-xs font-bold text-slate-900">
            <tr>
              <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider text-slate-700">
                Subtotales filtrados ({items.length} {items.length === 1 ? 'documento' : 'documentos'}):
              </td>
              <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                {formatCurrency(totalOriginal)}
              </td>
              <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                <div className="flex justify-between gap-3 text-[11px]">
                  <span className="text-emerald-800">Pagado: {formatCurrency(totalPagado)}</span>
                  <span className="text-slate-900">Insoluto: {formatCurrency(totalInsoluto)}</span>
                </div>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
