import { ArrowRight, CheckCircle2, FileCode2, KeyRound, Landmark, Lock, LockOpen } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { DespachoClientHealthRow, FielTrafficLightStatus } from '../../lib/supabase/supabase-despacho-monitor';

export interface DespachoMonitorTableProps {
  rows: DespachoClientHealthRow[];
  activeCompanyId: string;
  onSelectCompany: (companyId: string, companyName: string, rfc: string) => void;
  onDrillDown: (row: DespachoClientHealthRow, target: 'ADD' | 'DIA17' | 'EFIRMA') => void;
  renderOverallPill: (status: DespachoClientHealthRow['overallTrafficLight']) => React.ReactNode;
  renderFielBadge: (status: FielTrafficLightStatus, daysRemaining: number | null) => React.ReactNode;
}

export function DespachoMonitorTable({
  rows,
  activeCompanyId,
  onSelectCompany,
  onDrillDown,
  renderOverallPill,
  renderFielBadge
}: DespachoMonitorTableProps) {
  return (
    <div tabIndex={0} role="region" aria-label="Tabla semáforo multi-cliente" className="hidden md:block overflow-x-auto">
      <table className="w-full text-xs text-left">
        <caption className="visually-hidden">Estado fiscal y contable por RFC del despacho</caption>
        <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
          <tr>
            <th scope="col" className="py-3 px-4">Empresa / RFC</th>
            <th scope="col" className="py-3 px-3">Periodo / Candado</th>
            <th scope="col" className="py-3 px-3 text-center">CFDIs Pend.</th>
            <th scope="col" className="py-3 px-3 text-center">Bancos Pend.</th>
            <th scope="col" className="py-3 px-3">Día 17 / DIOT</th>
            <th scope="col" className="py-3 px-3">e.firma SAT</th>
            <th scope="col" className="py-3 px-3 text-center">Semáforo</th>
            <th scope="col" className="py-3 px-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => {
            const isActive = row.companyId === activeCompanyId;
            return (
              <tr
                key={row.companyId}
                onClick={() => onSelectCompany(row.companyId, row.companyName, row.rfc)}
                className={`cursor-pointer transition-colors ${isActive ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
              >
                <th scope="row" className="py-3 px-4 text-left font-normal">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{row.companyName}</span>
                    {isActive && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                        Activa
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[11px] text-slate-600">{row.rfc}</div>
                </th>
                <td className="py-3 px-3 whitespace-nowrap">
                  <div className="flex flex-wrap items-center gap-1.5 font-mono tabular-nums">
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
                  </div>
                </td>
                <td className="py-3 px-3 text-center font-mono tabular-nums">
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold ${
                      row.pendingCfdisCount === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {row.pendingCfdisCount}
                  </span>
                </td>
                <td className="py-3 px-3 text-center font-mono tabular-nums">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${
                      row.pendingBankLinesCount === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    <Landmark className="w-3 h-3" aria-hidden="true" />
                    {row.pendingBankLinesCount}
                  </span>
                </td>
                <td className="py-3 px-3 whitespace-nowrap font-mono tabular-nums">
                  {row.dia17Ready ? (
                    <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold font-sans">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                      Listo (<span className="font-mono">{formatCurrency(row.ivaNetoAPagar)}</span> IVA)
                    </span>
                  ) : (
                    <span className="text-amber-800 font-medium font-sans">
                      {row.hasSavedTaxParams ? 'Sin cálculo del periodo' : 'Faltan parámetros'}
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 whitespace-nowrap">{renderFielBadge(row.fielStatus, row.fielDaysRemaining)}</td>
                <td className="py-3 px-3 text-center whitespace-nowrap">{renderOverallPill(row.overallTrafficLight)}</td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <div className="inline-flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleDrillDownBtn(onDrillDown, row, 'ADD')}
                      title={`Ir a CFDIs ADD de ${row.companyName}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
                    >
                      <FileCode2 className="w-3 h-3 text-blue-700" aria-hidden="true" />
                      <span>CFDIs</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDrillDownBtn(onDrillDown, row, 'DIA17')}
                      title={`Ir a Bancos / Día 17 de ${row.companyName}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
                    >
                      <Landmark className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                      <span>Día 17</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDrillDownBtn(onDrillDown, row, 'EFIRMA')}
                      title={`Configurar e.firma de ${row.companyName}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
                    >
                      <KeyRound className="w-3 h-3 text-amber-700" aria-hidden="true" />
                      <span>e.firma</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectCompany(row.companyId, row.companyName, row.rfc)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 cursor-pointer"
                    >
                      <span>{isActive ? 'En uso' : 'Abrir'}</span>
                      <ArrowRight className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function handleDrillDownBtn(
  onDrillDown: DespachoMonitorTableProps['onDrillDown'],
  row: DespachoClientHealthRow,
  target: 'ADD' | 'DIA17' | 'EFIRMA'
) {
  onDrillDown(row, target);
}
