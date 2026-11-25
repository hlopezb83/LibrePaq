import { Check, Copy, FileSpreadsheet, SlidersHorizontal } from 'lucide-react';
import { EmptyState, StatusBadge } from '../../components/ui';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { formatCurrency } from '../../lib/formatters';
import { fromCents, toCents } from '../../shared/engine/invariants-and-math';
import type { Efos69BStatus } from '../../shared/types';

export interface DiotSupplierRowWithEfos {
  rfc: string;
  nombre: string;
  tipoTercero: string;
  tipoOperacion: string;
  cfdiCount: number;
  actosPagados16: number;
  actosPagados8?: number;
  ivaAcreditable16: number;
  ivaRetenido: number;
  isrRetenido: number;
  batchLine: string;
  isEfos: boolean;
  efosStatus: Efos69BStatus;
}

export interface DiotSuppliersTableProps {
  rows: DiotSupplierRowWithEfos[];
  mesName: string;
  ejercicio: number;
  totals: {
    actosPagados16: number;
    actosPagados8?: number;
    ivaAcreditable16: number;
    ivaRetenido: number;
    isrRetenido: number;
  };
  onClassifySupplier?: (row: DiotSupplierRowWithEfos) => void;
}

const OP_LABELS: Record<string, string> = {
  '02': '02 Enajenación',
  '03': '03 Serv. Prof.',
  '06': '06 Arrend.',
  '07': '07 Imp. Bienes',
  '08': '08 Imp. Serv.',
  '85': '85 Otros',
  '87': '87 Global'
};

const TERCERO_LABELS: Record<string, string> = {
  '04': 'Nacional',
  '05': 'Extranjero',
  '15': 'Global'
};

const EFOS_BADGE_LABELS: Record<Efos69BStatus, string> = {
  LIMPIO: 'Limpio',
  PRESUNTO_EFOS: 'Presunto EFOS',
  DEFINITIVO_EFOS: 'Definitivo EFOS',
  DESVIRTUADO: 'Desvirtuado'
};

export function DiotSuppliersTable({
  rows,
  mesName,
  ejercicio,
  totals,
  onClassifySupplier
}: DiotSuppliersTableProps) {
  const { copiedKey, copy: copyBatchLine } = useCopyToClipboard<string>(1800);
  const totalActosPagadosCents =
    rows.length > 0
      ? rows.reduce((acc, r) => acc + toCents(r.actosPagados16) + toCents(r.actosPagados8 ?? 0), 0)
      : toCents(totals.actosPagados16);

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Tabla de operaciones con terceros DIOT"
      className="overflow-x-auto max-h-[440px] overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-600"
    >
      <span className="visually-hidden" role="status" aria-live="polite">
        {copiedKey ? 'Línea batch DIOT copiada al portapapeles' : ''}
      </span>
      <table className="w-full text-left border-collapse erp-sticky-table">
        <caption className="visually-hidden">
          Padrón de terceros para la declaración DIOT del SAT
        </caption>
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <th scope="col" className="py-2.5 px-2.5 whitespace-nowrap">Tercero / Operación</th>
            <th scope="col" className="py-2.5 px-2.5 whitespace-nowrap">RFC Proveedor</th>
            <th scope="col" className="py-2.5 px-2.5">Nombre / Razón Social</th>
            <th scope="col" className="py-2.5 px-2.5 text-right whitespace-nowrap">Actos Pagados</th>
            <th scope="col" className="py-2.5 px-2.5 text-right whitespace-nowrap">IVA Acred.</th>
            <th scope="col" className="py-2.5 px-2.5 text-right whitespace-nowrap">IVA Ret.</th>
            <th scope="col" className="py-2.5 px-2.5 text-right whitespace-nowrap">ISR Ret.</th>
            <th scope="col" className="py-2.5 px-2.5">Línea Batch SAT (.txt)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <EmptyState
                  icon={<FileSpreadsheet className="w-6 h-6" aria-hidden="true" />}
                  tone="blue"
                  title={`Sin operaciones DIOT en ${mesName} ${ejercicio}`}
                  description="No se registraron operaciones pagadas y contabilizadas con proveedores en este periodo."
                />
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const rowKey = `${r.rfc}::${r.nombre}::${r.tipoOperacion}`;
              const isLineCopied = copiedKey === rowKey;
              return (
                <tr
                  key={rowKey}
                  className={
                    r.isEfos ? 'bg-red-50/70 hover:bg-red-50 transition' : 'hover:bg-blue-50/30 transition'
                  }
                >
                  <td className="py-2.5 px-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge tone="slate">
                        {TERCERO_LABELS[r.tipoTercero] ?? r.tipoTercero} · {OP_LABELS[r.tipoOperacion] ?? r.tipoOperacion}
                      </StatusBadge>
                      {onClassifySupplier && (
                        <button
                          type="button"
                          onClick={() => onClassifySupplier(r)}
                          title={`Clasificar operación DIOT de ${r.rfc} en el Padrón Fiscal`}
                          className="inline-flex items-center gap-1 px-2 min-h-[28px] py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-semibold cursor-pointer"
                        >
                          <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
                          <span>Clasificar</span>
                        </button>
                      )}
                    </div>
                  </td>
                  <th scope="row" className="py-2.5 px-2.5 font-mono font-bold text-blue-800 whitespace-nowrap text-left">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{r.rfc}</span>
                      {r.isEfos && (
                        <span title={`Proveedor publicado en lista negra del SAT Art. 69-B (${EFOS_BADGE_LABELS[r.efosStatus] ?? r.efosStatus})`}>
                          <StatusBadge tone="red" shape="tag">
                            {EFOS_BADGE_LABELS[r.efosStatus] ?? r.efosStatus}
                          </StatusBadge>
                        </span>
                      )}
                      {!r.isEfos && r.efosStatus === 'DESVIRTUADO' && (
                        <span title="Contribuyente que desvirtuó los hechos imputados ante el SAT (Art. 69-B)">
                          <StatusBadge tone="blue" shape="tag">Desvirtuado</StatusBadge>
                        </span>
                      )}
                    </div>
                  </th>
                  <td className="py-2.5 px-2.5 font-medium text-slate-900">
                    {r.nombre}{' '}
                    <span className="text-[11px] text-slate-600 font-normal">
                      ({r.cfdiCount} CFDI)
                    </span>
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                    {formatCurrency(fromCents(toCents(r.actosPagados16) + toCents(r.actosPagados8 ?? 0)))}
                  </td>
                  <td className={`py-2.5 px-2.5 text-right font-mono whitespace-nowrap tabular-nums ${r.ivaAcreditable16 > 0 ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                    {formatCurrency(r.ivaAcreditable16)}
                  </td>
                  <td className={`py-2.5 px-2.5 text-right font-mono whitespace-nowrap tabular-nums ${r.ivaRetenido > 0 ? 'text-red-700 font-semibold' : 'text-slate-500'}`}>
                    {formatCurrency(r.ivaRetenido)}
                  </td>
                  <td className={`py-2.5 px-2.5 text-right font-mono whitespace-nowrap tabular-nums ${r.isrRetenido > 0 ? 'text-red-700 font-semibold' : 'text-slate-500'}`}>
                    {formatCurrency(r.isrRetenido)}
                  </td>
                  <td className="py-2.5 px-2.5 font-mono text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <code title={r.batchLine} className="max-w-[140px] truncate block">
                        {r.batchLine}
                      </code>
                      <button
                        type="button"
                        onClick={() => void copyBatchLine(r.batchLine, rowKey)}
                        aria-label={`Copiar línea batch DIOT de ${r.rfc}`}
                        title="Copiar línea batch SAT"
                        className="min-h-[28px] min-w-[28px] inline-flex items-center justify-center p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer shrink-0"
                      >
                        {isLineCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="sticky bottom-0 z-10 bg-slate-100 [&_td]:bg-slate-100">
            <tr className="border-t-2 border-slate-300 font-mono text-xs font-bold text-slate-900">
              <td colSpan={3} className="py-2.5 px-2.5 font-sans text-right uppercase tracking-wider text-slate-700">
                Totales DIOT ({rows.length} proveedores):
              </td>
              <td className="py-2.5 px-2.5 text-right whitespace-nowrap tabular-nums">
                {formatCurrency(fromCents(totalActosPagadosCents))}
              </td>
              <td className="py-2.5 px-2.5 text-right text-emerald-800 whitespace-nowrap tabular-nums">
                {formatCurrency(totals.ivaAcreditable16)}
              </td>
              <td className={`py-2.5 px-2.5 text-right whitespace-nowrap tabular-nums ${totals.ivaRetenido > 0 ? 'text-red-700' : 'text-slate-500'}`}>
                {formatCurrency(totals.ivaRetenido)}
              </td>
              <td className={`py-2.5 px-2.5 text-right whitespace-nowrap tabular-nums ${totals.isrRetenido > 0 ? 'text-red-700' : 'text-slate-500'}`}>
                {formatCurrency(totals.isrRetenido)}
              </td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
