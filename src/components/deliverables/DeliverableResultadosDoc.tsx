import { formatCurrency } from '../../lib/formatters';
import type { Company, AccountWithBalance } from '../../shared/types';
import { DeliverableSignaturesBlock } from './DeliverableSignaturesBlock';

interface DeliverableResultadosDocProps {
  company: Company;
  year: number;
  period: number;
  mesNombre: string;
  firmName: string;
  issuanceCity?: string;
  issuanceDate: string;
  hideZeroAccounts?: boolean;
  incomeStatement: {
    ingresos: AccountWithBalance[];
    costos: AccountWithBalance[];
    gastos: AccountWithBalance[];
    isrEjercicio?: AccountWithBalance[];
    totalIngresos: number;
    totalCostos: number;
    utilidadBruta: number;
    totalGastos: number;
    totalIsr?: number;
    utilidadNeta: number;
  };
  auditorName: string;
  auditorCedula: string;
  legalRepName: string;
  legalRepTitle: string;
}

export function DeliverableResultadosDoc({
  company,
  year,
  period,
  mesNombre,
  firmName,
  issuanceCity,
  issuanceDate,
  hideZeroAccounts = false,
  incomeStatement,
  auditorName,
  auditorCedula,
  legalRepName,
  legalRepTitle
}: DeliverableResultadosDocProps) {
  const lastDay = new Date(year, Math.min(12, Math.max(1, period)), 0).getDate();
  const isLoss = incomeStatement.utilidadNeta < 0;
  const isGrossLoss = incomeStatement.utilidadBruta < 0;
  const signedResultBal = (acc: AccountWithBalance, expectedNature: 'ACREEDORA' | 'DEUDORA') =>
    acc.nature === expectedNature ? acc.finalBalance : -acc.finalBalance;
  const formatVerticalPct = (amount: number, base: number) => {
    if (!base || Math.abs(base) < 0.01) return '0.0%';
    return `${((amount / base) * 100).toFixed(1)}%`;
  };

  const renderRows = (items: AccountWithBalance[], expected: 'ACREEDORA' | 'DEUDORA') =>
    items
      .filter((a) => !hideZeroAccounts || Math.abs(a.finalBalance) >= 0.01)
      .map((a) => {
        const signedAmt = signedResultBal(a, expected);
        return (
          <div
            key={a.id}
            className={`flex items-center justify-between gap-3 py-0.5 ${
              a.level === 2
                ? 'font-bold text-slate-900 bg-slate-50/70 rounded px-2 mt-0.5'
                : 'pl-6 pr-2 text-slate-700'
            }`}
          >
            <span className={`min-w-0 ${a.level === 2 ? 'font-semibold' : 'text-slate-600'}`}>
              <span className="font-mono whitespace-nowrap mr-1.5">{a.code}</span>
              <span>— {a.name}</span>
            </span>
            <div className="flex items-center gap-3 font-mono tabular-nums whitespace-nowrap shrink-0">
              <span className={`w-28 text-right ${signedAmt < 0 ? 'text-red-700 font-semibold' : a.level === 2 ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                {formatCurrency(signedAmt)}
              </span>
              <span className="w-14 text-right text-[11px] text-slate-600">
                {formatVerticalPct(signedAmt, incomeStatement.totalIngresos)}
              </span>
            </div>
          </div>
        );
      });

  return (
    <article className="max-w-5xl mx-auto bg-white rounded-xl shadow-xs border border-slate-300 p-6 sm:p-8 space-y-5 print-page-break mb-8">
      <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            {firmName}
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight mt-0.5">
            {company.name}
          </h2>
          <div className="text-xs font-mono text-slate-600">
            RFC: <span className="font-bold text-slate-900">{company.rfc}</span> • {company.regimenFiscal}
          </div>
          <div className="text-xs font-bold text-blue-900 mt-1 uppercase">
            Estado de Resultados Integral (NIF B-3) con Análisis Vertical (%)
          </div>
          <div className="text-[11px] text-slate-500">
            Del 01 de Enero al {String(lastDay).padStart(2, '0')} de {mesNombre} de {year} • Cifras en Pesos Mexicanos (MXN)
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-600 font-mono shrink-0">
          <div>Folio: DOC-RES-{year}-{String(period).padStart(2, '0')}</div>
          <div>{issuanceCity ? `${issuanceCity}, ` : ''}{issuanceDate}</div>
        </div>
      </div>

      <div className="space-y-4 text-xs">
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-800 flex items-center justify-between gap-3">
            <span>(+) Ingresos Operativos</span>
            <div className="flex items-center gap-3 shrink-0">
              <span className="w-28 text-right">Importe</span>
              <span className="w-14 text-right">% Vert.</span>
            </div>
          </div>
          <div className="p-2 space-y-1">
            {renderRows(incomeStatement.ingresos, 'ACREEDORA')}
            <div className="flex items-center justify-between gap-3 px-2 pt-1 border-t border-slate-300 font-bold text-slate-900">
              <span>Total de Ingresos Netos</span>
              <div className="flex items-center gap-3 font-mono tabular-nums whitespace-nowrap shrink-0">
                <span className={`w-28 text-right ${incomeStatement.totalIngresos < 0 ? 'text-red-700' : ''}`}>
                  {formatCurrency(incomeStatement.totalIngresos)}
                </span>
                <span className="w-14 text-right text-[11px] text-slate-600">
                  {formatVerticalPct(incomeStatement.totalIngresos, incomeStatement.totalIngresos)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-800">
            (-) Costo de Ventas y Servicios
          </div>
          <div className="p-2 space-y-1">
            {renderRows(incomeStatement.costos, 'DEUDORA')}
            <div className="flex items-center justify-between gap-3 px-2 pt-1 border-t border-slate-300 font-bold text-slate-900 bg-slate-50 py-1 rounded">
              <span>{isGrossLoss ? '(=) Pérdida Bruta Operativa' : '(=) Utilidad Bruta Operativa'}</span>
              <div className="flex items-center gap-3 font-mono tabular-nums whitespace-nowrap shrink-0">
                <span className={`w-28 text-right font-extrabold ${isGrossLoss ? 'text-red-700' : 'text-emerald-900'}`}>
                  {formatCurrency(incomeStatement.utilidadBruta)}
                </span>
                <span className="w-14 text-right text-[11px] text-slate-600">
                  {formatVerticalPct(incomeStatement.utilidadBruta, incomeStatement.totalIngresos)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-800">
            (-) Gastos Generales de Operación y Administración
          </div>
          <div className="p-2 space-y-1">
            {renderRows(incomeStatement.gastos, 'DEUDORA')}
            <div className="flex items-center justify-between gap-3 px-2 pt-1 border-t border-slate-300 font-bold text-slate-900">
              <span>Total de Gastos de Operación</span>
              <div className="flex items-center gap-3 font-mono tabular-nums whitespace-nowrap shrink-0">
                <span className={`w-28 text-right ${incomeStatement.totalGastos < 0 ? 'text-red-700' : ''}`}>
                  {formatCurrency(incomeStatement.totalGastos)}
                </span>
                <span className="w-14 text-right text-[11px] text-slate-600">
                  {formatVerticalPct(incomeStatement.totalGastos, incomeStatement.totalIngresos)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {incomeStatement.isrEjercicio && incomeStatement.isrEjercicio.length > 0 && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-800">
              (-) Provisión de Impuesto a la Utilidad (ISR Ejercicio - NIF B-3)
            </div>
            <div className="p-2 space-y-1">
              {renderRows(incomeStatement.isrEjercicio, 'DEUDORA')}
              <div className="flex items-center justify-between gap-3 px-2 pt-1 border-t border-slate-300 font-bold text-slate-900">
                <span>Total ISR del Ejercicio</span>
                <div className="flex items-center gap-3 font-mono tabular-nums whitespace-nowrap shrink-0">
                  <span className={`w-28 text-right ${(incomeStatement.totalIsr ?? 0) < 0 ? 'text-red-700' : ''}`}>
                    {formatCurrency(incomeStatement.totalIsr ?? 0)}
                  </span>
                  <span className="w-14 text-right text-[11px] text-slate-600">
                    {formatVerticalPct(incomeStatement.totalIsr ?? 0, incomeStatement.totalIngresos)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-slate-900 text-white flex justify-between items-center text-sm font-bold font-mono">
          <span className="uppercase tracking-wide">
            {isLoss ? '(=) PÉRDIDA NETA DEL PERIODO:' : '(=) UTILIDAD NETA DEL PERIODO:'}
          </span>
          <div className={`flex items-center gap-3 tabular-nums whitespace-nowrap ${isLoss ? 'text-red-400' : 'text-emerald-300'}`}>
            <span className="text-base">{formatCurrency(incomeStatement.utilidadNeta)}</span>
            <span className="text-xs">({formatVerticalPct(incomeStatement.utilidadNeta, incomeStatement.totalIngresos)})</span>
          </div>
        </div>
      </div>

      <DeliverableSignaturesBlock
        auditorName={auditorName}
        auditorCedula={auditorCedula}
        legalRepName={legalRepName}
        legalRepTitle={legalRepTitle}
      />
    </article>
  );
}
