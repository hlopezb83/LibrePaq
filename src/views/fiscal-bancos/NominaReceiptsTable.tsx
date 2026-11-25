import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { PayrollExtendedAmarre } from '../../shared/engine/payroll-summary.engine';
import { formatCurrency } from '../../lib/formatters';

export function NominaReceiptsTable({ extended }: { extended: PayrollExtendedAmarre }) {
  const [expanded, setExpanded] = useState(false);
  const { exentosStats, receipts } = extended;

  return (
    <div className="space-y-3 pt-2 border-t border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
          <span className="text-[11px] font-semibold text-slate-600 block">Gravado vs. Exento (CFDI N)</span>
          <span className="font-mono tabular-nums font-bold text-slate-900">
            {formatCurrency(exentosStats.totalGravado)} / {formatCurrency(exentosStats.totalExento)}
          </span>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
          <span className="text-[11px] font-semibold text-emerald-800 block">Exentos Deducibles 53% (No disminuyó)</span>
          <span className="font-mono tabular-nums font-bold text-emerald-900">
            Ded. {formatCurrency(exentosStats.deducible53Pct)} · No Ded. {formatCurrency(exentosStats.noDeducible47Pct)}
          </span>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
          <span className="text-[11px] font-semibold text-amber-800 block">Exentos Deducibles 47% (Si disminuyó)</span>
          <span className="font-mono tabular-nums font-bold text-amber-900">
            Ded. {formatCurrency(exentosStats.deducible47Pct)} · No Ded. {formatCurrency(exentosStats.noDeducible53Pct)}
          </span>
        </div>
      </div>

      {receipts.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:underline cursor-pointer"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
            {expanded ? 'Ocultar' : 'Ver'} detalle por recibo ({receipts.length} CFDI{receipts.length === 1 ? '' : 's'})
          </button>

          {expanded && (
            <div className="mt-2 overflow-x-auto border border-slate-200 rounded-xl max-h-72">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0">
                  <tr>
                    <th className="px-2.5 py-2">Recibo / Fecha</th>
                    <th className="px-2.5 py-2">Empleado</th>
                    <th className="px-2.5 py-2 text-right">Días / SBC</th>
                    <th className="px-2.5 py-2 text-right">Percep.</th>
                    <th className="px-2.5 py-2 text-right">Gravado</th>
                    <th className="px-2.5 py-2 text-right">Exento</th>
                    <th className="px-2.5 py-2 text-right">ISR Ret.</th>
                    <th className="px-2.5 py-2 text-right">IMSS Obr.</th>
                    <th className="px-2.5 py-2 text-right">Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {receipts.map((r) => (
                    <tr key={r.cfdiId} className="hover:bg-slate-50">
                      <td className="px-2.5 py-1.5 font-mono">
                        <div className="font-semibold text-slate-900">{r.serieFolio}</div>
                        <div className="text-[10px] text-slate-500">{r.fecha}</div>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <div className="font-medium text-slate-900 truncate max-w-[180px]" title={r.nombre}>{r.nombre}</div>
                        <div className="text-[10px] font-mono text-slate-500">{r.rfc}</div>
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-slate-700">
                        {r.numDiasPagados > 0 ? `${r.numDiasPagados}d · ${formatCurrency(r.sbc)}` : '—'}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">{formatCurrency(r.percepciones)}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">{formatCurrency(r.gravado)}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-slate-600">{formatCurrency(r.exento)}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-blue-700">{formatCurrency(r.isrRetenido)}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">{formatCurrency(r.imssObrero)}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums font-bold text-slate-900">{formatCurrency(r.netoPagado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
