import { formatCurrency } from '../../lib/formatters';
import type { FiscalWorkpaperResponse } from '../../shared/types';

export interface PapelDia17SummaryBarProps {
  cap: FiscalWorkpaperResponse['resumenLineaCapturaSat'];
}

export function PapelDia17SummaryBar({ cap }: PapelDia17SummaryBarProps) {
  return (
    <div className="bg-[#0A1120] text-white rounded-2xl border border-[#1E293B] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
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
  );
}
