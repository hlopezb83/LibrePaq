import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import { Select, StatusBadge } from '../../components/ui';
import { apiClient } from '../../lib/api-client';
import { formatCurrency } from '../../lib/formatters';
import { ronda11Client } from '../../lib/supabase/supabase-ronda11';
import { formatIncomePeriodLabel } from '../../shared/date-utils';
import type { AccountWithBalance, Company, FinancialStatementsResponse } from '../../shared/types';

interface EstadoResultadosTabProps {
  company: Company;
  ejercicio: number;
  periodo?: number;
  mesNombre: string;
  incomeStatement: FinancialStatementsResponse['incomeStatement'];
  onSelectAccount: (accountId: string) => void;
}

const fmtPct = (amount: number, base: number) =>
  !base || Math.abs(base) < 0.01 ? '0.0%' : `${((amount / base) * 100).toFixed(1)}%`;

const fmtMomPct = (cur: number, prev: number) =>
  Math.abs(prev) < 0.01 ? 'N/A' : `${cur >= prev ? '+' : ''}${(((cur - prev) / Math.abs(prev)) * 100).toFixed(1)}%`;

const signedYtd = (acc: AccountWithBalance, expected: 'ACREEDORA' | 'DEUDORA') =>
  acc.nature === expected ? acc.finalBalance : -acc.finalBalance;

const signedMes = (acc: AccountWithBalance, expected: 'ACREEDORA' | 'DEUDORA') =>
  expected === 'ACREEDORA' ? acc.periodCredits - acc.periodCharges : acc.periodCharges - acc.periodCredits;

export function EstadoResultadosTab({
  company,
  ejercicio,
  periodo,
  mesNombre,
  incomeStatement,
  onSelectAccount
}: EstadoResultadosTabProps) {
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const effectivePeriod = periodo ?? company.currentPeriod ?? 10;
  const periodLabel = formatIncomePeriodLabel(ejercicio, effectivePeriod, mesNombre);
  const prevTarget = effectivePeriod === 1
    ? { year: ejercicio - 1, period: 12 }
    : { year: ejercicio, period: Math.min(effectivePeriod - 1, 12) };

  const { data: segments = [] } = useQuery({
    queryKey: ['business-segments', company.id],
    queryFn: () => ronda11Client.listBusinessSegments(company.id),
    enabled: Boolean(company.id)
  });

  const { data: segmentReports } = useQuery({
    queryKey: ['reports-by-segment', company.id, ejercicio, effectivePeriod, selectedSegmentId],
    queryFn: () => ronda11Client.getSegmentFinancialStatements(company.id, ejercicio, effectivePeriod, selectedSegmentId),
    enabled: Boolean(company.id && selectedSegmentId)
  });

  const { data: prevMonthReports } = useQuery({
    queryKey: ['reports', company.id, prevTarget.year, prevTarget.period, selectedSegmentId],
    queryFn: () =>
      selectedSegmentId
        ? ronda11Client.getSegmentFinancialStatements(company.id, prevTarget.year, prevTarget.period, selectedSegmentId)
        : apiClient.getReports(company.id, prevTarget.year, prevTarget.period),
    enabled: Boolean(company.id && prevTarget.year > 2000)
  });

  const er = segmentReports?.incomeStatement ?? incomeStatement;
  const prevEr = prevMonthReports?.incomeStatement ?? null;
  const p = er.periodTotals;
  const pm = prevEr?.periodTotals;
  const mesSales = p?.totalIngresos ?? 0;

  const utilidadOperativa = er.utilidadOperativa ?? er.utilidadBruta - er.totalGastos;
  const pUtilidadOperativa = p?.utilidadOperativa ?? (p ? p.utilidadBruta - p.totalGastos : 0);
  const pmUtilOp = pm?.utilidadOperativa ?? (pm ? pm.utilidadBruta - pm.totalGastos : 0);
  const rifProductos = er.rifProductos ?? [];
  const rifGastos = er.rifGastos ?? [];
  const rifNeto = er.rifNeto ?? 0;
  const pRifNeto = p?.rifNeto ?? 0;
  const pmRifNeto = pm?.rifNeto ?? 0;
  const uai = er.utilidadAntesImpuestos ?? utilidadOperativa + rifNeto;
  const pUai = p?.utilidadAntesImpuestos ?? pUtilidadOperativa + pRifNeto;
  const pmUai = pm?.utilidadAntesImpuestos ?? pmUtilOp + pmRifNeto;
  const totalIsr = er.totalIsr ?? 0;
  const pIsr = p?.totalIsr ?? 0;
  const pmIsr = pm?.totalIsr ?? 0;
  const isLoss = er.utilidadNeta < 0;

  const prevAccMap = new Map<string, AccountWithBalance>();
  if (prevEr) {
    for (const grp of [prevEr.ingresos, prevEr.costos, prevEr.gastos, prevEr.rifProductos ?? [], prevEr.rifGastos ?? [], prevEr.isrEjercicio ?? []]) {
      for (const a of grp) prevAccMap.set(a.code, a);
    }
  }

  const renderRows = (items: AccountWithBalance[], expected: 'ACREEDORA' | 'DEUDORA') =>
    items.length === 0 ? (
      <p className="text-xs text-slate-600 italic px-3 py-1.5">Sin movimientos acumulados en este rubro.</p>
    ) : (
      items.map((acc) => {
        const ytdVal = signedYtd(acc, expected);
        const mesVal = signedMes(acc, expected);
        const prevAcc = prevAccMap.get(acc.code);
        const prevMesVal = prevAcc ? signedMes(prevAcc, expected) : 0;
        return (
          <button
            key={acc.id}
            type="button"
            onClick={() => onSelectAccount(acc.id)}
            title={`Ver auxiliar de ${acc.code} — ${acc.name}`}
            className={`w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-left text-xs py-1.5 px-3 hover:bg-blue-50/40 rounded-lg transition cursor-pointer ${
              acc.level === 2 ? 'font-bold text-slate-900' : 'pl-7 text-slate-700'
            }`}
          >
            <span className="min-w-0 truncate">
              <span className="font-mono mr-2 text-blue-800 underline decoration-dotted whitespace-nowrap">{acc.code}</span>
              {acc.name}
            </span>
            <span className="flex items-center gap-2 font-mono tabular-nums whitespace-nowrap shrink-0 text-[11px]">
              <span className={`w-22 text-right ${mesVal < 0 ? 'text-red-700' : 'text-slate-600'}`}>{formatCurrency(mesVal)}</span>
              <span className="w-12 text-right text-slate-500">{fmtPct(mesVal, mesSales)}</span>
              <span className="w-22 text-right text-slate-500">{formatCurrency(prevMesVal)}</span>
              <span className={`w-13 text-right ${mesVal - prevMesVal < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{fmtMomPct(mesVal, prevMesVal)}</span>
              <span className={`w-24 text-right ${ytdVal < 0 ? 'text-red-700' : ''}`}>{formatCurrency(ytdVal)}</span>
              <span className="w-12 text-right text-slate-600">{fmtPct(ytdVal, er.totalIngresos)}</span>
            </span>
          </button>
        );
      })
    );

  const renderSubtotal = (label: string, mesVal: number, prevMesVal: number, ytdVal: number, highlight = false) => (
    <div
      className={`flex items-center justify-between gap-2 text-xs font-bold border-t border-slate-300 pt-2 px-3 ${
        highlight ? 'bg-slate-50 rounded-lg py-2 text-slate-900' : 'text-slate-800'
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="flex items-center gap-2 font-mono tabular-nums whitespace-nowrap shrink-0 text-[11px]">
        <span className={`w-22 text-right ${mesVal < 0 ? 'text-red-700' : 'text-slate-700'}`}>{formatCurrency(mesVal)}</span>
        <span className="w-12 text-right text-slate-500">{fmtPct(mesVal, mesSales)}</span>
        <span className="w-22 text-right text-slate-500">{formatCurrency(prevMesVal)}</span>
        <span className={`w-13 text-right ${mesVal - prevMesVal < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{fmtMomPct(mesVal, prevMesVal)}</span>
        <span className={`w-24 text-right ${ytdVal < 0 ? 'text-red-700' : 'text-slate-900'}`}>{formatCurrency(ytdVal)}</span>
        <span className={`w-12 text-right ${ytdVal < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{fmtPct(ytdVal, er.totalIngresos)}</span>
      </span>
    </div>
  );

  const activeSeg = segments.find((s) => s.id === selectedSegmentId);

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-3.5 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight break-words">{company.name}</h2>
          <div className="text-xs font-mono text-slate-600 mt-0.5 break-words">
            RFC: <span className="font-semibold">{company.rfc}</span> • Régimen Fiscal: {company.regimenFiscal || '601 - General de Ley Personas Morales'}
          </div>
          <div className="text-sm font-bold text-blue-900 mt-1 uppercase tracking-wide flex flex-wrap items-center gap-2">
            <span>Estado de Resultados Integral (NIF B-3)</span>
            {er.isPreCloseP13 && <StatusBadge tone="amber">Vista Pre-Cierre Anual</StatusBadge>}
            {activeSeg && <StatusBadge tone="blue">Segmento: {activeSeg.code} — {activeSeg.name}</StatusBadge>}
          </div>
          <div className="text-xs text-slate-600">{periodLabel} • Cifras expresadas en Pesos Mexicanos (MXN)</div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0 no-print">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-700 hidden sm:block" aria-hidden="true" />
            <StatusBadge tone="emerald" shape="tag">NIF B-3 Mes, MoM + Acum.</StatusBadge>
          </div>
          {segments.length > 0 && (
            <div className="w-60">
              <Select
                size="sm"
                aria-label="Filtrar por segmento de negocio"
                value={selectedSegmentId}
                onChange={(e) => setSelectedSegmentId(e.target.value)}
              >
                <option value="">Todos los segmentos (Consolidado)</option>
                {segments.map((seg) => (
                  <option key={seg.id} value={seg.id}>
                    {seg.code} — {seg.name}{!seg.isActive ? ' (Inactivo)' : ''}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </div>

      <div tabIndex={0} role="region" aria-label="Detalle del Estado de Resultados Integral NIF B-3" className="overflow-x-auto max-w-full">
        <div className="min-w-[720px] space-y-5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg">
            <span>Rubro Contable / Concepto</span>
            <span className="flex items-center gap-2 font-mono whitespace-nowrap shrink-0">
              <span className="w-22 text-right">Del Mes</span>
              <span className="w-12 text-right">% Mes</span>
              <span className="w-22 text-right">Mes Ant.</span>
              <span className="w-13 text-right">MoM %</span>
              <span className="w-24 text-right">Acum. Ejerc.</span>
              <span className="w-12 text-right">% Acum.</span>
            </span>
          </div>

          <section className="space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">(+) Ingresos Operativos (Ventas Netas)</div>
            {renderRows(er.ingresos, 'ACREEDORA')}
            {renderSubtotal('Total de Ingresos Netos', p?.totalIngresos ?? 0, pm?.totalIngresos ?? 0, er.totalIngresos)}
          </section>

          <section className="space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">(-) Costo de Ventas y Servicios</div>
            {renderRows(er.costos, 'DEUDORA')}
            {renderSubtotal(er.utilidadBruta < 0 ? '(=) Pérdida Bruta' : '(=) Utilidad Bruta', p?.utilidadBruta ?? 0, pm?.utilidadBruta ?? 0, er.utilidadBruta, true)}
          </section>

          <section className="space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">(-) Gastos Generales de Operación y Administración</div>
            {renderRows(er.gastos, 'DEUDORA')}
            {renderSubtotal('Total de Gastos de Operación', p?.totalGastos ?? 0, pm?.totalGastos ?? 0, er.totalGastos)}
            {renderSubtotal(utilidadOperativa < 0 ? '(=) Pérdida de Operación' : '(=) Utilidad de Operación', pUtilidadOperativa, pmUtilOp, utilidadOperativa, true)}
          </section>

          {(rifProductos.length > 0 || rifGastos.length > 0 || Math.abs(rifNeto) >= 0.01 || Math.abs(pRifNeto) >= 0.01) && (
            <section className="space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">(+/-) Resultado Integral de Financiamiento (RIF: 702 − 701)</div>
              {rifProductos.length > 0 && renderRows(rifProductos, 'ACREEDORA')}
              {rifGastos.length > 0 && renderRows(rifGastos, 'DEUDORA')}
              {renderSubtotal('(=) Resultado Integral de Financiamiento (RIF Neto)', pRifNeto, pmRifNeto, rifNeto)}
            </section>
          )}

          {renderSubtotal(uai < 0 ? '(=) Pérdida antes de Impuestos (UAI)' : '(=) Utilidad antes de Impuestos (UAI)', pUai, pmUai, uai, true)}

          {((er.isrEjercicio && er.isrEjercicio.length > 0) || Math.abs(totalIsr) >= 0.01) && (
            <section className="space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">(-) Provisión de Impuesto a la Utilidad (ISR Ejercicio - NIF D-4)</div>
              {renderRows(er.isrEjercicio ?? [], 'DEUDORA')}
              {renderSubtotal('Total ISR del Ejercicio', pIsr, pmIsr, totalIsr)}
            </section>
          )}

          <div className="p-4 rounded-xl bg-[#0A1120] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold">{isLoss ? '(=) Pérdida Neta del Ejercicio' : '(=) Utilidad Neta del Ejercicio'}</div>
              <div className="text-xs text-slate-300">
                Del Mes: <strong className="font-mono tabular-nums text-cyan-300">{formatCurrency(p?.utilidadNeta ?? 0)}</strong> ({fmtPct(p?.utilidadNeta ?? 0, mesSales)}) • Mes Ant.: <strong className="font-mono tabular-nums text-slate-200">{formatCurrency(pm?.utilidadNeta ?? 0)}</strong> ({fmtMomPct(p?.utilidadNeta ?? 0, pm?.utilidadNeta ?? 0)}) • Margen Acum.: <strong className={`${isLoss ? 'text-red-300' : 'text-emerald-300'} font-mono tabular-nums`}>{fmtPct(er.utilidadNeta, er.totalIngresos)}</strong>
              </div>
            </div>
            <div className={`text-xl font-bold font-mono tabular-nums whitespace-nowrap ${isLoss ? 'text-red-400' : 'text-emerald-400'}`}>
              {formatCurrency(er.utilidadNeta)}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-10 mt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center text-xs text-slate-600 print-signatures">
        <div className="pt-8 border-t border-slate-400 max-w-xs mx-auto w-full"><div className="font-bold text-slate-900">Auxiliar Contable</div><div className="text-[11px] text-slate-600 mt-0.5">Elaboró</div></div>
        <div className="pt-8 border-t border-slate-400 max-w-xs mx-auto w-full"><div className="font-bold text-slate-900">C.P. Auditor / Contador General</div><div className="text-[11px] text-slate-600 mt-0.5">Revisó (Cédula Prof. Titulado)</div></div>
        <div className="pt-8 border-t border-slate-400 max-w-xs mx-auto w-full"><div className="font-bold text-slate-900">{company.name}</div><div className="text-[11px] text-slate-600 mt-0.5">Autorizó (Representante Legal)</div></div>
      </div>
    </div>
  );
}
