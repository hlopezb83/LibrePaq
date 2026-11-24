import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
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

const signedYtd = (acc: AccountWithBalance, expected: 'ACREEDORA' | 'DEUDORA') =>
  acc.nature === expected ? acc.finalBalance : -acc.finalBalance;

const signedMes = (acc: AccountWithBalance, expected: 'ACREEDORA' | 'DEUDORA') =>
  expected === 'ACREEDORA'
    ? acc.periodCredits - acc.periodCharges
    : acc.periodCharges - acc.periodCredits;

export function EstadoResultadosTab({
  company,
  ejercicio,
  periodo,
  mesNombre,
  incomeStatement,
  onSelectAccount
}: EstadoResultadosTabProps) {
  const effectivePeriod = periodo ?? company.currentPeriod ?? 10;
  const periodLabel = formatIncomePeriodLabel(ejercicio, effectivePeriod, mesNombre);
  const p = incomeStatement.periodTotals;
  const utilidadOperativa =
    incomeStatement.utilidadOperativa ??
    incomeStatement.utilidadBruta - incomeStatement.totalGastos;
  const pUtilidadOperativa =
    p?.utilidadOperativa ?? (p ? p.utilidadBruta - p.totalGastos : 0);
  const rifProductos = incomeStatement.rifProductos ?? [];
  const rifGastos = incomeStatement.rifGastos ?? [];
  const rifNeto = incomeStatement.rifNeto ?? 0;
  const pRifNeto = p?.rifNeto ?? 0;
  const uai = incomeStatement.utilidadAntesImpuestos ?? utilidadOperativa + rifNeto;
  const pUai = p?.utilidadAntesImpuestos ?? pUtilidadOperativa + pRifNeto;
  const totalIsr = incomeStatement.totalIsr ?? 0;
  const pIsr = p?.totalIsr ?? 0;
  const isLoss = incomeStatement.utilidadNeta < 0;

  const renderRows = (items: AccountWithBalance[], expected: 'ACREEDORA' | 'DEUDORA') =>
    items.length === 0 ? (
      <p className="text-xs text-slate-600 italic px-3 py-1.5">
        Sin movimientos acumulados en este rubro.
      </p>
    ) : (
      items.map((acc) => {
        const ytdVal = signedYtd(acc, expected);
        const mesVal = signedMes(acc, expected);
        return (
          <button
            key={acc.id}
            type="button"
            onClick={() => onSelectAccount(acc.id)}
            title={`Ver auxiliar de ${acc.code} — ${acc.name}`}
            className={`w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left text-xs py-1.5 px-3 hover:bg-blue-50/40 rounded-lg transition cursor-pointer ${
              acc.level === 2 ? 'font-bold text-slate-900' : 'pl-7 text-slate-700'
            }`}
          >
            <span className="min-w-0 truncate">
              <span className="font-mono mr-2 text-blue-800 underline decoration-dotted whitespace-nowrap">
                {acc.code}
              </span>
              {acc.name}
            </span>
            <span className="flex items-center gap-3 font-mono tabular-nums whitespace-nowrap shrink-0">
              <span className={`w-24 text-right ${mesVal < 0 ? 'text-red-700' : 'text-slate-600'}`}>
                {formatCurrency(mesVal)}
              </span>
              <span className={`w-28 text-right ${ytdVal < 0 ? 'text-red-700' : ''}`}>
                {formatCurrency(ytdVal)}
              </span>
              <span className="w-14 text-right text-[11px] text-slate-600">
                {fmtPct(ytdVal, incomeStatement.totalIngresos)}
              </span>
            </span>
          </button>
        );
      })
    );

  const renderSubtotal = (
    label: string,
    mesVal: number,
    ytdVal: number,
    highlight = false
  ) => (
    <div
      className={`flex items-center justify-between gap-3 text-xs sm:text-sm font-bold border-t border-slate-300 pt-2 px-3 ${
        highlight ? 'bg-slate-50 rounded-lg py-2 text-slate-900' : 'text-slate-800'
      }`}
    >
      <span>{label}</span>
      <span className="flex items-center gap-3 font-mono tabular-nums whitespace-nowrap shrink-0">
        <span className={`w-24 text-right text-xs ${mesVal < 0 ? 'text-red-700' : 'text-slate-700'}`}>
          {formatCurrency(mesVal)}
        </span>
        <span className={`w-28 text-right ${ytdVal < 0 ? 'text-red-700' : 'text-slate-900'}`}>
          {formatCurrency(ytdVal)}
        </span>
        <span className={`w-14 text-right text-xs ${ytdVal < 0 ? 'text-red-700' : 'text-emerald-800'}`}>
          {fmtPct(ytdVal, incomeStatement.totalIngresos)}
        </span>
      </span>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-3.5 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight break-words">
            {company.name}
          </h2>
          <div className="text-xs font-mono text-slate-600 mt-0.5 break-words">
            RFC: <span className="font-semibold">{company.rfc}</span> • Régimen Fiscal:{' '}
            {company.regimenFiscal || '601 - General de Ley Personas Morales'}
          </div>
          <div className="text-sm font-bold text-blue-900 mt-1 uppercase tracking-wide flex flex-wrap items-center gap-2">
            <span>Estado de Resultados Integral (NIF B-3)</span>
            {incomeStatement.isPreCloseP13 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                Vista Pre-Cierre Anual
              </span>
            )}
          </div>
          <div className="text-xs text-slate-600">
            {periodLabel} • Cifras expresadas en Pesos Mexicanos (MXN)
          </div>
        </div>
        <div className="text-right hidden sm:block shrink-0">
          <TrendingUp className="w-8 h-8 text-blue-700 ml-auto" aria-hidden="true" />
          <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
            NIF B-3 Mes + Acum. Ejercicio
          </span>
        </div>
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label="Detalle del Estado de Resultados Integral NIF B-3"
        className="overflow-x-auto max-w-full"
      >
        <div className="min-w-[540px] space-y-5">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg">
        <span>Rubro Contable / Concepto</span>
        <span className="flex items-center gap-3 font-mono whitespace-nowrap shrink-0">
          <span className="w-24 text-right">Del Mes</span>
          <span className="w-28 text-right">Acum. Ejercicio</span>
          <span className="w-14 text-right">% Vert.</span>
        </span>
      </div>

      <section className="space-y-1.5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
          (+) Ingresos Operativos (Ventas Netas)
        </div>
        {renderRows(incomeStatement.ingresos, 'ACREEDORA')}
        {renderSubtotal('Total de Ingresos Netos', p?.totalIngresos ?? 0, incomeStatement.totalIngresos)}
      </section>

      <section className="space-y-1.5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
          (-) Costo de Ventas y Servicios
        </div>
        {renderRows(incomeStatement.costos, 'DEUDORA')}
        {renderSubtotal(
          incomeStatement.utilidadBruta < 0 ? '(=) Pérdida Bruta' : '(=) Utilidad Bruta',
          p?.utilidadBruta ?? 0,
          incomeStatement.utilidadBruta,
          true
        )}
      </section>

      <section className="space-y-1.5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
          (-) Gastos Generales de Operación y Administración
        </div>
        {renderRows(incomeStatement.gastos, 'DEUDORA')}
        {renderSubtotal('Total de Gastos de Operación', p?.totalGastos ?? 0, incomeStatement.totalGastos)}
        {renderSubtotal(
          utilidadOperativa < 0 ? '(=) Pérdida de Operación' : '(=) Utilidad de Operación',
          pUtilidadOperativa,
          utilidadOperativa,
          true
        )}
      </section>

      {(rifProductos.length > 0 || rifGastos.length > 0 || Math.abs(rifNeto) >= 0.01 || Math.abs(pRifNeto) >= 0.01) && (
        <section className="space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            (+/-) Resultado Integral de Financiamiento (RIF: 702 − 701)
          </div>
          {rifProductos.length > 0 && renderRows(rifProductos, 'ACREEDORA')}
          {rifGastos.length > 0 && renderRows(rifGastos, 'DEUDORA')}
          {renderSubtotal('(=) Resultado Integral de Financiamiento (RIF Neto)', pRifNeto, rifNeto)}
        </section>
      )}

      {renderSubtotal(
        uai < 0 ? '(=) Pérdida antes de Impuestos (UAI)' : '(=) Utilidad antes de Impuestos (UAI)',
        pUai,
        uai,
        true
      )}

      {((incomeStatement.isrEjercicio && incomeStatement.isrEjercicio.length > 0) || Math.abs(totalIsr) >= 0.01) && (
        <section className="space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            (-) Provisión de Impuesto a la Utilidad (ISR Ejercicio - NIF D-4)
          </div>
          {renderRows(incomeStatement.isrEjercicio ?? [], 'DEUDORA')}
          {renderSubtotal('Total ISR del Ejercicio', pIsr, totalIsr)}
        </section>
      )}

      <div className="p-4 rounded-xl bg-[#0A1120] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold">
            {isLoss ? '(=) Pérdida Neta del Ejercicio' : '(=) Utilidad Neta del Ejercicio'}
          </div>
          <div className="text-xs text-slate-300">
            Del Mes:{' '}
            <strong className="font-mono tabular-nums text-cyan-300">
              {formatCurrency(p?.utilidadNeta ?? 0)}
            </strong>{' '}
            • Margen Neto Acum. Ejercicio:{' '}
            <strong className={`${isLoss ? 'text-red-300' : 'text-emerald-300'} font-mono tabular-nums`}>
              {fmtPct(incomeStatement.utilidadNeta, incomeStatement.totalIngresos)}
            </strong>
          </div>
        </div>
        <div className={`text-xl font-bold font-mono tabular-nums whitespace-nowrap ${isLoss ? 'text-red-400' : 'text-emerald-400'}`}>
          {formatCurrency(incomeStatement.utilidadNeta)}
        </div>
      </div>
        </div>
      </div>

      <div className="pt-10 mt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center text-xs text-slate-600 print-signatures">
        <div className="pt-8 border-t border-slate-400 max-w-xs mx-auto w-full">
          <div className="font-bold text-slate-900">Auxiliar Contable</div>
          <div className="text-[11px] text-slate-600 mt-0.5">Elaboró</div>
        </div>
        <div className="pt-8 border-t border-slate-400 max-w-xs mx-auto w-full">
          <div className="font-bold text-slate-900">C.P. Auditor / Contador General</div>
          <div className="text-[11px] text-slate-600 mt-0.5">Revisó (Cédula Prof. Titulado)</div>
        </div>
        <div className="pt-8 border-t border-slate-400 max-w-xs mx-auto w-full">
          <div className="font-bold text-slate-900">{company.name}</div>
          <div className="text-[11px] text-slate-600 mt-0.5">Autorizó (Representante Legal)</div>
        </div>
      </div>
    </div>
  );
}
