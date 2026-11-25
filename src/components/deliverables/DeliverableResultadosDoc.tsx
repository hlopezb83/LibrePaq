import { formatCurrency } from '../../lib/formatters';
import { formatIncomePeriodLabel } from '../../shared/date-utils';
import type { Company, AccountWithBalance, FinancialStatementsResponse } from '../../shared/types';
import { DeliverableSignaturesBlock } from './DeliverableSignaturesBlock';

interface DeliverableResultadosDocProps {
  company: Company;
  year: number;
  period: number;
  mesNombre: string;
  firmName: string;
  preparerName?: string;
  logoDataUrl?: string;
  issuanceCity?: string;
  issuanceDate: string;
  hideZeroAccounts?: boolean;
  incomeStatement: FinancialStatementsResponse['incomeStatement'];
  prevMonthIncomeStatement?: FinancialStatementsResponse['incomeStatement'] | null;
  auditorName: string;
  auditorCedula: string;
  legalRepName: string;
  legalRepTitle: string;
}

const fmtPct = (amount: number, base: number) =>
  !base || Math.abs(base) < 0.01 ? '0.0%' : `${((amount / base) * 100).toFixed(1)}%`;

const fmtMomPct = (cur: number, prev: number) =>
  Math.abs(prev) < 0.01 ? 'N/A' : `${cur >= prev ? '+' : ''}${(((cur - prev) / Math.abs(prev)) * 100).toFixed(1)}%`;

const signedYtd = (acc: AccountWithBalance, expected: 'ACREEDORA' | 'DEUDORA') =>
  acc.nature === expected ? acc.finalBalance : -acc.finalBalance;

const signedMes = (acc: AccountWithBalance, expected: 'ACREEDORA' | 'DEUDORA') =>
  expected === 'ACREEDORA' ? acc.periodCredits - acc.periodCharges : acc.periodCharges - acc.periodCredits;

export function DeliverableResultadosDoc({
  company, year, period, mesNombre, firmName, preparerName, logoDataUrl,
  issuanceCity, issuanceDate, hideZeroAccounts = false, incomeStatement,
  prevMonthIncomeStatement, auditorName, auditorCedula, legalRepName, legalRepTitle
}: DeliverableResultadosDocProps) {
  const periodLabel = formatIncomePeriodLabel(year, period, mesNombre);
  const p = incomeStatement.periodTotals;
  const pm = prevMonthIncomeStatement?.periodTotals;
  const mesSales = p?.totalIngresos ?? 0;
  const utilOp = incomeStatement.utilidadOperativa ?? incomeStatement.utilidadBruta - incomeStatement.totalGastos;
  const pUtilOp = p?.utilidadOperativa ?? (p ? p.utilidadBruta - p.totalGastos : 0);
  const pmUtilOp = pm?.utilidadOperativa ?? (pm ? pm.utilidadBruta - pm.totalGastos : 0);
  const rifProductos = incomeStatement.rifProductos ?? [];
  const rifGastos = incomeStatement.rifGastos ?? [];
  const rifNeto = incomeStatement.rifNeto ?? 0;
  const pRifNeto = p?.rifNeto ?? 0;
  const pmRifNeto = pm?.rifNeto ?? 0;
  const uai = incomeStatement.utilidadAntesImpuestos ?? utilOp + rifNeto;
  const pUai = p?.utilidadAntesImpuestos ?? pUtilOp + pRifNeto;
  const pmUai = pm?.utilidadAntesImpuestos ?? pmUtilOp + pmRifNeto;
  const totalIsr = incomeStatement.totalIsr ?? 0;
  const pIsr = p?.totalIsr ?? 0;
  const pmIsr = pm?.totalIsr ?? 0;
  const isLoss = incomeStatement.utilidadNeta < 0;

  const prevAccMap = new Map<string, AccountWithBalance>();
  if (prevMonthIncomeStatement) {
    for (const grp of [
      prevMonthIncomeStatement.ingresos, prevMonthIncomeStatement.costos,
      prevMonthIncomeStatement.gastos, prevMonthIncomeStatement.rifProductos ?? [],
      prevMonthIncomeStatement.rifGastos ?? [], prevMonthIncomeStatement.isrEjercicio ?? []
    ]) {
      for (const a of grp) prevAccMap.set(a.code, a);
    }
  }

  const renderRows = (items: AccountWithBalance[], expected: 'ACREEDORA' | 'DEUDORA') =>
    items
      .filter((a) => !hideZeroAccounts || Math.abs(a.finalBalance) >= 0.01 || Math.abs(signedMes(a, expected)) >= 0.01)
      .map((a) => {
        const ytdVal = signedYtd(a, expected);
        const mesVal = signedMes(a, expected);
        const prevAcc = prevAccMap.get(a.code);
        const prevMesVal = prevAcc ? signedMes(prevAcc, expected) : 0;
        return (
          <div
            key={a.id}
            className={`flex items-center justify-between gap-2 py-0.5 ${
              a.level === 2 ? 'font-bold text-slate-900 bg-slate-50/70 rounded px-2 mt-0.5' : 'pl-6 pr-2 text-slate-700'
            }`}
          >
            <span className={`min-w-0 truncate ${a.level === 2 ? 'font-semibold' : 'text-slate-600'}`}>
              <span className="font-mono whitespace-nowrap mr-1.5">{a.code}</span>
              <span>— {a.name}</span>
            </span>
            <div className="flex items-center gap-2 font-mono tabular-nums whitespace-nowrap shrink-0 text-[11px]">
              <span className={`w-20 text-right ${mesVal < 0 ? 'text-red-700' : 'text-slate-600'}`}>{formatCurrency(mesVal)}</span>
              <span className="w-11 text-right text-slate-500">{fmtPct(mesVal, mesSales)}</span>
              <span className="w-20 text-right text-slate-500">{formatCurrency(prevMesVal)}</span>
              <span className={`w-12 text-right ${mesVal - prevMesVal < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{fmtMomPct(mesVal, prevMesVal)}</span>
              <span className={`w-24 text-right ${ytdVal < 0 ? 'text-red-700 font-semibold' : a.level === 2 ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{formatCurrency(ytdVal)}</span>
              <span className="w-11 text-right text-slate-600">{fmtPct(ytdVal, incomeStatement.totalIngresos)}</span>
            </div>
          </div>
        );
      });

  const renderSubtotal = (label: string, mesVal: number, prevMesVal: number, ytdVal: number, emphasize = false) => (
    <div className={`flex items-center justify-between gap-2 px-2 pt-1 border-t border-slate-300 font-bold ${emphasize ? 'bg-slate-50 py-1 rounded text-slate-900' : 'text-slate-800'}`}>
      <span className="min-w-0 truncate">{label}</span>
      <div className="flex items-center gap-2 font-mono tabular-nums whitespace-nowrap shrink-0 text-[11px]">
        <span className={`w-20 text-right ${mesVal < 0 ? 'text-red-700' : 'text-slate-700'}`}>{formatCurrency(mesVal)}</span>
        <span className="w-11 text-right text-slate-500">{fmtPct(mesVal, mesSales)}</span>
        <span className="w-20 text-right text-slate-500">{formatCurrency(prevMesVal)}</span>
        <span className={`w-12 text-right ${mesVal - prevMesVal < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{fmtMomPct(mesVal, prevMesVal)}</span>
        <span className={`w-24 text-right font-extrabold ${ytdVal < 0 ? 'text-red-700' : 'text-slate-900'}`}>{formatCurrency(ytdVal)}</span>
        <span className="w-11 text-right text-slate-600">{fmtPct(ytdVal, incomeStatement.totalIngresos)}</span>
      </div>
    </div>
  );

  return (
    <article className="max-w-5xl mx-auto bg-white rounded-xl shadow-xs border border-slate-300 p-6 sm:p-8 space-y-5 print-page-break mb-8">
      <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {logoDataUrl && (
            <img src={logoDataUrl} alt={`Logo ${firmName}`} className="max-h-12 w-auto object-contain rounded shrink-0" />
          )}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{firmName}</div>
            <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight mt-0.5">{company.name}</h2>
            <div className="text-xs font-mono text-slate-600">
              RFC: <span className="font-bold text-slate-900">{company.rfc}</span> • {company.regimenFiscal}
            </div>
            <div className="text-xs font-bold text-blue-900 mt-1 uppercase">
              Estado de Resultados Integral (NIF B-3) — Del Mes, MoM y Acum. Ejercicio
            </div>
            <div className="text-[11px] text-slate-500">{periodLabel} • Cifras en Pesos Mexicanos (MXN)</div>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-600 font-mono shrink-0">
          <div>Folio: DOC-RES-{year}-{String(period).padStart(2, '0')}</div>
          <div>{issuanceCity ? `${issuanceCity}, ` : ''}{issuanceDate}</div>
        </div>
      </div>

      <div tabIndex={0} role="region" aria-label="Detalle del Estado de Resultados Integral NIF B-3" className="overflow-x-auto max-w-full">
        <div className="min-w-[680px] space-y-3.5 text-xs">
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[10px] text-slate-800 flex items-center justify-between gap-2">
              <span>(+) Ingresos Operativos (Ventas Netas)</span>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                <span className="w-20 text-right">Del Mes</span>
                <span className="w-11 text-right">% Mes</span>
                <span className="w-20 text-right">Mes Ant.</span>
                <span className="w-12 text-right">MoM %</span>
                <span className="w-24 text-right">Acum. Ejerc.</span>
                <span className="w-11 text-right">% Acum.</span>
              </div>
            </div>
            <div className="p-2 space-y-1">
              {renderRows(incomeStatement.ingresos, 'ACREEDORA')}
              {renderSubtotal('Total de Ingresos Netos', p?.totalIngresos ?? 0, pm?.totalIngresos ?? 0, incomeStatement.totalIngresos)}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-800">(-) Costo de Ventas y Servicios</div>
            <div className="p-2 space-y-1">
              {renderRows(incomeStatement.costos, 'DEUDORA')}
              {renderSubtotal(incomeStatement.utilidadBruta < 0 ? '(=) Pérdida Bruta' : '(=) Utilidad Bruta', p?.utilidadBruta ?? 0, pm?.utilidadBruta ?? 0, incomeStatement.utilidadBruta, true)}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-800">(-) Gastos Generales de Operación y Administración</div>
            <div className="p-2 space-y-1">
              {renderRows(incomeStatement.gastos, 'DEUDORA')}
              {renderSubtotal('Total de Gastos de Operación', p?.totalGastos ?? 0, pm?.totalGastos ?? 0, incomeStatement.totalGastos)}
              {renderSubtotal(utilOp < 0 ? '(=) Pérdida de Operación' : '(=) Utilidad de Operación', pUtilOp, pmUtilOp, utilOp, true)}
            </div>
          </div>

          {(rifProductos.length > 0 || rifGastos.length > 0 || Math.abs(rifNeto) >= 0.01) && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-800">(+/-) Resultado Integral de Financiamiento (RIF: 702 − 701)</div>
              <div className="p-2 space-y-1">
                {renderRows(rifProductos, 'ACREEDORA')}
                {renderRows(rifGastos, 'DEUDORA')}
                {renderSubtotal('(=) RIF Neto', pRifNeto, pmRifNeto, rifNeto)}
              </div>
            </div>
          )}

          <div className="border border-slate-200 rounded-lg p-2">
            {renderSubtotal(uai < 0 ? '(=) Pérdida antes de Impuestos (UAI)' : '(=) Utilidad antes de Impuestos (UAI)', pUai, pmUai, uai, true)}
          </div>

          {((incomeStatement.isrEjercicio && incomeStatement.isrEjercicio.length > 0) || Math.abs(totalIsr) >= 0.01) && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-800">(-) Provisión de Impuesto a la Utilidad (ISR Ejercicio - NIF D-4)</div>
              <div className="p-2 space-y-1">
                {renderRows(incomeStatement.isrEjercicio ?? [], 'DEUDORA')}
                {renderSubtotal('Total ISR del Ejercicio', pIsr, pmIsr, totalIsr)}
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-wrap justify-between items-center gap-2 text-sm font-bold font-mono">
            <div>
              <span className="uppercase tracking-wide">{isLoss ? '(=) PÉRDIDA NETA DEL EJERCICIO:' : '(=) UTILIDAD NETA DEL EJERCICIO:'}</span>
              <div className="text-[11px] font-normal text-slate-300">
                Del Mes: {formatCurrency(p?.utilidadNeta ?? 0)} ({fmtPct(p?.utilidadNeta ?? 0, mesSales)}) • Mes Ant.: {formatCurrency(pm?.utilidadNeta ?? 0)} ({fmtMomPct(p?.utilidadNeta ?? 0, pm?.utilidadNeta ?? 0)})
              </div>
            </div>
            <div className={`flex items-center gap-3 tabular-nums whitespace-nowrap ${isLoss ? 'text-red-400' : 'text-emerald-300'}`}>
              <span className="text-base">{formatCurrency(incomeStatement.utilidadNeta)}</span>
              <span className="text-xs">({fmtPct(incomeStatement.utilidadNeta, incomeStatement.totalIngresos)})</span>
            </div>
          </div>
        </div>
      </div>

      <DeliverableSignaturesBlock
        preparerName={preparerName}
        auditorName={auditorName}
        auditorCedula={auditorCedula}
        legalRepName={legalRepName}
        legalRepTitle={legalRepTitle}
      />
    </article>
  );
}
