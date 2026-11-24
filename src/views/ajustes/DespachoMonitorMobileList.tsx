import { ArrowRight, CheckCircle2, FileCode2, KeyRound, Landmark, Lock, LockOpen } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { DespachoClientHealthRow, FielTrafficLightStatus } from '../../lib/supabase/supabase-despacho-monitor';

export interface DespachoMonitorMobileListProps {
  rows: DespachoClientHealthRow[];
  activeCompanyId: string;
  onSelectCompany: (companyId: string, companyName: string, rfc: string) => void;
  onDrillDown: (row: DespachoClientHealthRow, target: 'ADD' | 'DIA17' | 'EFIRMA') => void;
  renderOverallPill: (status: DespachoClientHealthRow['overallTrafficLight']) => React.ReactNode;
  renderFielBadge: (status: FielTrafficLightStatus, daysRemaining: number | null) => React.ReactNode;
}

export function DespachoMonitorMobileList({
  rows,
  activeCompanyId,
  onSelectCompany,
  onDrillDown,
  renderOverallPill,
  renderFielBadge
}: DespachoMonitorMobileListProps) {
  return (
    <div className="md:hidden divide-y divide-slate-200">
      {rows.map((row) => {
        const isActive = row.companyId === activeCompanyId;
        return (
          <div
            key={row.companyId}
            className={`p-4 space-y-3 text-xs ${isActive ? 'bg-blue-50/60' : 'bg-white'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                  <span className="break-words">{row.companyName}</span>
                  {isActive && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                      Activa
                    </span>
                  )}
                </div>
                <div className="font-mono text-[11px] text-slate-600">{row.rfc}</div>
              </div>
              {renderOverallPill(row.overallTrafficLight)}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 font-mono tabular-nums text-[11px]">
              <span className="font-bold text-slate-800">
                P{String(row.periodo).padStart(2, '0')}/{row.ejercicio}
              </span>
              {row.periodLockStatus === 'BLOQUEADO_SAT' ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                  <Lock className="w-3 h-3" aria-hidden="true" />
                  Bloqueado SAT
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-semibold">
                  <LockOpen className="w-3 h-3" aria-hidden="true" />
                  Abierto
                </span>
              )}
              {renderFielBadge(row.fielStatus, row.fielDaysRemaining)}
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px] bg-slate-50 border border-slate-200 rounded-xl p-2.5">
              <div>
                <span className="text-slate-600 block">CFDIs Pend.</span>
                <strong className="font-mono tabular-nums text-slate-900">{row.pendingCfdisCount}</strong>
              </div>
              <div>
                <span className="text-slate-600 block">Bancos Pend.</span>
                <strong className="font-mono tabular-nums text-slate-900">{row.pendingBankLinesCount}</strong>
              </div>
              <div>
                <span className="text-slate-600 block">Día 17</span>
                {row.dia17Ready ? (
                  <strong className="font-mono tabular-nums text-emerald-800 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    {formatCurrency(row.ivaNetoAPagar)}
                  </strong>
                ) : (
                  <span className="text-amber-800 font-semibold">Pendiente</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onDrillDown(row, 'ADD')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
              >
                <FileCode2 className="w-3 h-3 text-blue-700" aria-hidden="true" />
                <span>CFDIs</span>
              </button>
              <button
                type="button"
                onClick={() => onDrillDown(row, 'DIA17')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
              >
                <Landmark className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                <span>Bancos / Día 17</span>
              </button>
              <button
                type="button"
                onClick={() => onDrillDown(row, 'EFIRMA')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
              >
                <KeyRound className="w-3 h-3 text-amber-700" aria-hidden="true" />
                <span>e.firma</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectCompany(row.companyId, row.companyName, row.rfc)}
                className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 cursor-pointer"
              >
                <span>{isActive ? 'En uso' : 'Abrir'}</span>
                <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
