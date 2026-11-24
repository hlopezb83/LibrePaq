import { formatCurrency } from '../../lib/formatters';
import { calculateDia17Deadline } from '../../shared/date-utils';
import type { FiscalWorkpaperResponse, RetencionDesgloseItem } from '../../shared/types';

export interface PapelDia17SummaryBarProps {
  cap: FiscalWorkpaperResponse['resumenLineaCapturaSat'];
  saldoFavorIvaRemanente?: number;
  year?: number;
  period?: number;
  retencionesDesglose?: RetencionDesgloseItem[];
}

export function PapelDia17SummaryBar({
  cap,
  saldoFavorIvaRemanente = 0,
  year,
  period,
  retencionesDesglose
}: PapelDia17SummaryBarProps) {
  const deadline = year && period ? calculateDia17Deadline(year, period) : null;
  return (
    <div className="bg-white text-slate-900 rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5 space-y-3 text-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
          <div>
            <span className="text-[11px] font-sans font-bold uppercase text-slate-600 block">
              ISR Provisional
            </span>
            <strong className="text-sm text-slate-900">{formatCurrency(cap.isrProvisionalAPagar)}</strong>
          </div>
          <span className="text-slate-400 font-bold text-sm" aria-hidden="true">+</span>
          <div>
            <span className="text-[11px] font-sans font-bold uppercase text-slate-600 block">
              IVA Definitivo
            </span>
            <strong className="text-sm text-slate-900">{formatCurrency(cap.ivaDefinitivoAPagar)}</strong>
            {saldoFavorIvaRemanente > 0 && cap.ivaDefinitivoAPagar === 0 && (
              <span className="block font-sans text-[11px] font-medium text-emerald-800">
                Saldo a favor remanente: {formatCurrency(saldoFavorIvaRemanente)}
              </span>
            )}
          </div>
          <span className="text-slate-400 font-bold text-sm" aria-hidden="true">+</span>
          <div>
            <span className="text-[11px] font-sans font-bold uppercase text-slate-600 block">
              Ret. ISR + IVA
            </span>
            <strong className="text-sm text-slate-900">
              {formatCurrency(cap.retencionesIsrPorEnterar + cap.retencionesIvaPorEnterar)}
            </strong>
          </div>
          <span className="text-blue-700 font-bold text-sm hidden lg:inline" aria-hidden="true">=</span>
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 bg-blue-50/70 px-4 py-2.5 rounded-xl border border-blue-200">
          <div>
            <span className="font-sans font-bold text-blue-900 uppercase text-[11px] block">
              Total Estimado Línea de Captura Día 17:
            </span>
            {deadline && period && year && (
              <span className="font-mono text-[11px] text-slate-700">
                P{String(period).padStart(2, '0')}/{year} · Límite SAT: {deadline.formattedSpanish}
              </span>
            )}
          </div>
          <span className="font-mono tabular-nums text-base font-extrabold text-blue-900">
            {formatCurrency(cap.totalEstimadoDia17)}
          </span>
        </div>
      </div>

      {retencionesDesglose && retencionesDesglose.length > 0 && (
        <div className="pt-2.5 border-t border-slate-200 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-700 font-semibold uppercase tracking-wide mr-1">
            Desglose Retenciones DyP (216-*):
          </span>
          {retencionesDesglose.map((r) => (
            <span
              key={`${r.code}-${r.satGroupCode}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 font-mono tabular-nums"
            >
              <span className="text-blue-700 font-bold">{r.satGroupCode}</span>
              <span className="font-sans text-slate-700">{r.name}:</span>
              <strong className="text-slate-900">{formatCurrency(r.amount)}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
