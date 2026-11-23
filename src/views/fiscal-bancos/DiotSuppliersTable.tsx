import { formatCurrency } from '../../lib/formatters';
import type { Efos69BStatus } from '../../shared/types';

export interface DiotSupplierRowWithEfos {
  rfc: string;
  nombre: string;
  tipoTercero: string;
  tipoOperacion: string;
  cfdiCount: number;
  actosPagados16: number;
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
    ivaAcreditable16: number;
    ivaRetenido: number;
    isrRetenido: number;
  };
}

export function DiotSuppliersTable({
  rows,
  mesName,
  ejercicio,
  totals
}: DiotSuppliersTableProps) {
  return (
    <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
      <table className="w-full text-left border-collapse erp-sticky-table">
        <caption className="visually-hidden">
          Padrón de terceros para la declaración DIOT del SAT
        </caption>
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <th scope="col" className="py-3 px-4 whitespace-nowrap">Tercero / Operación</th>
            <th scope="col" className="py-3 px-4 whitespace-nowrap">RFC Proveedor</th>
            <th scope="col" className="py-3 px-4">Nombre / Razón Social</th>
            <th scope="col" className="py-3 px-4 text-right whitespace-nowrap">Actos Pagados 16%</th>
            <th scope="col" className="py-3 px-4 text-right whitespace-nowrap">IVA Acreditable 16%</th>
            <th scope="col" className="py-3 px-4 text-right whitespace-nowrap">IVA Retenido</th>
            <th scope="col" className="py-3 px-4 text-right whitespace-nowrap">ISR Retenido</th>
            <th scope="col" className="py-3 px-4">Línea Batch SAT (.txt)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-10 px-4 text-center text-slate-600">
                No se registraron operaciones pagadas y contabilizadas con proveedores en {mesName} {ejercicio}.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.rfc}
                className={
                  r.isEfos ? 'bg-red-50/70 hover:bg-red-50 transition' : 'hover:bg-blue-50/30 transition'
                }
              >
                <td className="py-3 px-4 font-mono whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-[11px]">
                    {r.tipoTercero} / {r.tipoOperacion}
                  </span>
                </td>
                <th scope="row" className="py-3 px-4 font-mono font-bold text-blue-800 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>{r.rfc}</span>
                    {r.isEfos && (
                      <span
                        title={`Proveedor publicado en lista negra del SAT Art. 69-B (${r.efosStatus})`}
                        className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-900 border border-red-300"
                      >
                        69-B {r.efosStatus}
                      </span>
                    )}
                  </div>
                </th>
                <td className="py-3 px-4 font-medium text-slate-900">
                  {r.nombre}{' '}
                  <span className="text-[11px] text-slate-600 font-normal">
                    ({r.cfdiCount} CFDI)
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                  {formatCurrency(r.actosPagados16)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-900 font-semibold whitespace-nowrap tabular-nums">
                  {formatCurrency(r.ivaAcreditable16)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-red-700 whitespace-nowrap tabular-nums">
                  {formatCurrency(r.ivaRetenido)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-red-700 whitespace-nowrap tabular-nums">
                  {formatCurrency(r.isrRetenido)}
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                  <code>{r.batchLine}</code>
                </td>
              </tr>
            ))
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="sticky bottom-0 z-10 bg-slate-100 [&_td]:bg-slate-100">
            <tr className="border-t-2 border-slate-300 font-mono text-xs font-bold text-slate-900">
              <td colSpan={3} className="py-2.5 px-4 font-sans text-right uppercase tracking-wider text-slate-700">
                Totales DIOT ({rows.length} proveedores):
              </td>
              <td className="py-2.5 px-4 text-right whitespace-nowrap tabular-nums">
                {formatCurrency(totals.actosPagados16)}
              </td>
              <td className="py-2.5 px-4 text-right text-emerald-800 whitespace-nowrap tabular-nums">
                {formatCurrency(totals.ivaAcreditable16)}
              </td>
              <td className="py-2.5 px-4 text-right text-red-700 whitespace-nowrap tabular-nums">
                {formatCurrency(totals.ivaRetenido)}
              </td>
              <td className="py-2.5 px-4 text-right text-red-700 whitespace-nowrap tabular-nums">
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
