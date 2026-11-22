import { formatCurrency } from '../../lib/formatters';
import type { Company, AccountWithBalance } from '../../shared/types';
import { DeliverableSignaturesBlock } from './DeliverableSignaturesBlock';

interface DeliverableResultadosDocProps {
  company: Company;
  year: number;
  period: number;
  mesNombre: string;
  firmName: string;
  issuanceDate: string;
  incomeStatement: {
    ingresos: AccountWithBalance[];
    costos: AccountWithBalance[];
    gastos: AccountWithBalance[];
    totalIngresos: number;
    totalCostos: number;
    utilidadBruta: number;
    totalGastos: number;
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
  issuanceDate,
  incomeStatement,
  auditorName,
  auditorCedula,
  legalRepName,
  legalRepTitle
}: DeliverableResultadosDocProps) {
  const formatVerticalPct = (amount: number, base: number) => {
    if (!base || Math.abs(base) < 0.01) return '0.0%';
    return `${((amount / base) * 100).toFixed(1)}%`;
  };

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
            Del 01 al 31 de {mesNombre} de {year} • Cifras en Pesos Mexicanos (MXN)
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-500 font-mono shrink-0">
          <div>Folio: DOC-RES-{year}-{String(period).padStart(2, '0')}</div>
          <div>Emisión: {issuanceDate}</div>
        </div>
      </div>

      <div className="space-y-4 text-xs">
        {/* Ingresos */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-800 flex justify-between">
            <span>(+) Ingresos Operativos</span>
            <span>Importe | % Vertical</span>
          </div>
          <div className="p-2 space-y-1">
            {incomeStatement.ingresos.map((a) => (
              <div
                key={a.id}
                className={`flex justify-between py-0.5 ${
                  a.level === 2
                    ? 'font-bold text-slate-900 bg-slate-50/70 rounded px-2 mt-0.5'
                    : 'pl-6 pr-2 text-slate-700'
                }`}
              >
                <span className={a.level === 2 ? 'font-semibold' : 'text-slate-600'}>
                  {a.code} — {a.name}
                </span>
                <span className={`font-mono ${a.level === 2 ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                  {formatCurrency(a.finalBalance)} ({formatVerticalPct(a.finalBalance, incomeStatement.totalIngresos)})
                </span>
              </div>
            ))}
            <div className="flex justify-between px-2 pt-1 border-t border-slate-300 font-bold text-slate-900">
              <span>Total de Ingresos Netos</span>
              <span className="font-mono">{formatCurrency(incomeStatement.totalIngresos)} (100.0%)</span>
            </div>
          </div>
        </div>

        {/* Costos y Utilidad Bruta */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-800">
            (-) Costo de Ventas y Servicios
          </div>
          <div className="p-2 space-y-1">
            {incomeStatement.costos.map((a) => (
              <div
                key={a.id}
                className={`flex justify-between py-0.5 ${
                  a.level === 2
                    ? 'font-bold text-slate-900 bg-slate-50/70 rounded px-2 mt-0.5'
                    : 'pl-6 pr-2 text-slate-700'
                }`}
              >
                <span className={a.level === 2 ? 'font-semibold' : 'text-slate-600'}>
                  {a.code} — {a.name}
                </span>
                <span className={`font-mono ${a.level === 2 ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                  {formatCurrency(a.finalBalance)}
                </span>
              </div>
            ))}
            <div className="flex justify-between px-2 pt-1 border-t border-slate-300 font-bold text-slate-900 bg-slate-50 py-1 rounded">
              <span>(=) Utilidad Bruta Operativa</span>
              <span className="font-mono text-emerald-900 font-extrabold">
                {formatCurrency(incomeStatement.utilidadBruta)} (
                {formatVerticalPct(incomeStatement.utilidadBruta, incomeStatement.totalIngresos)})
              </span>
            </div>
          </div>
        </div>

        {/* Gastos de Operación y Utilidad Neta */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-800">
            (-) Gastos Generales de Operación y Administración
          </div>
          <div className="p-2 space-y-1">
            {incomeStatement.gastos.map((a) => (
              <div
                key={a.id}
                className={`flex justify-between py-0.5 ${
                  a.level === 2
                    ? 'font-bold text-slate-900 bg-slate-50/70 rounded px-2 mt-0.5'
                    : 'pl-6 pr-2 text-slate-700'
                }`}
              >
                <span className={a.level === 2 ? 'font-semibold' : 'text-slate-600'}>
                  {a.code} — {a.name}
                </span>
                <span className={`font-mono ${a.level === 2 ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                  {formatCurrency(a.finalBalance)}
                </span>
              </div>
            ))}
            <div className="flex justify-between px-2 pt-1 border-t border-slate-300 font-bold text-slate-900">
              <span>Total de Gastos de Operación</span>
              <span className="font-mono">{formatCurrency(incomeStatement.totalGastos)}</span>
            </div>
          </div>
        </div>

        {/* Cierre: Utilidad Neta del Periodo */}
        <div className="p-4 rounded-xl bg-slate-900 text-white flex justify-between items-center text-sm font-bold font-mono">
          <span className="uppercase tracking-wide">(=) UTILIDAD NETA DEL PERIODO:</span>
          <span className="text-emerald-300 text-base">
            {formatCurrency(incomeStatement.utilidadNeta)} (
            {formatVerticalPct(incomeStatement.utilidadNeta, incomeStatement.totalIngresos)})
          </span>
        </div>
      </div>

      {/* Bloque de Firmas */}
      <DeliverableSignaturesBlock
        auditorName={auditorName}
        auditorCedula={auditorCedula}
        legalRepName={legalRepName}
        legalRepTitle={legalRepTitle}
      />
    </article>
  );
}
