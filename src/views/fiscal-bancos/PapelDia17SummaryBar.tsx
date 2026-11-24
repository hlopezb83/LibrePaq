import { formatCurrency } from '../../lib/formatters';
import type { FiscalWorkpaperResponse, RetencionDesgloseItem } from '../../shared/types';

export interface PapelDia17SummaryBarProps {
  cap: FiscalWorkpaperResponse['resumenLineaCapturaSat'];
  retencionesDesglose?: RetencionDesgloseItem[];
}

export function PapelDia17SummaryBar({ cap, retencionesDesglose }: PapelDia17SummaryBarProps) {
  return (
    <div className="bg-[#0A1120] text-white rounded-2xl border border-[#1E293B] p-4 space-y-3 text-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
          <div>
            <span className="text-[11px] font-sans uppercase text-slate-300 block">ISR Provisional</span>
            <strong className="text-sm">{formatCurrency(cap.isrProvisionalAPagar)}</strong>
          </div>
          <div>
            <span className="text-[11px] font-sans uppercase text-slate-300 block">IVA Definitivo</span>
            <strong className="text-sm">{formatCurrency(cap.ivaDefinitivoAPagar)}</strong>
          </div>
          <div>
            <span className="text-[11px] font-sans uppercase text-slate-300 block">Ret. ISR + IVA</span>
            <strong className="text-sm">
              {formatCurrency(cap.retencionesIsrPorEnterar + cap.retencionesIvaPorEnterar)}
            </strong>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 bg-[#111C35] px-4 py-2 rounded-xl border border-blue-700/50">
          <span className="font-sans font-bold text-blue-200 uppercase text-[11px]">
            Total Estimado Línea de Captura Día 17:
          </span>
          <span className="font-mono tabular-nums text-base font-extrabold text-emerald-300">
            {formatCurrency(cap.totalEstimadoDia17)}
          </span>
        </div>
      </div>

      {retencionesDesglose && retencionesDesglose.length > 0 && (
        <div className="pt-2.5 border-t border-slate-800 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-300 font-semibold uppercase tracking-wide mr-1">
            Desglose Retenciones DyP (216-*):
          </span>
          {retencionesDesglose.map((r) => (
            <span
              key={`${r.code}-${r.satGroupCode}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#111C35] border border-slate-700 font-mono tabular-nums"
            >
              <span className="text-blue-300 font-bold">{r.satGroupCode}</span>
              <span className="font-sans text-slate-200">{r.name}:</span>
              <strong className="text-white">{formatCurrency(r.amount)}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
