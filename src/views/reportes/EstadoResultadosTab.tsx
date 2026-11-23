import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { AccountWithBalance, Company } from '../../shared/types';

interface EstadoResultadosTabProps {
  company: Company;
  ejercicio: number;
  periodo?: number;
  mesNombre: string;
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
  onSelectAccount: (accountId: string) => void;
}

export function EstadoResultadosTab({
  company,
  ejercicio,
  periodo,
  mesNombre,
  incomeStatement,
  onSelectAccount
}: EstadoResultadosTabProps) {
  const lastDay = new Date(ejercicio, Math.min(12, Math.max(1, periodo ?? company.currentPeriod ?? 10)), 0).getDate();
  const isLoss = incomeStatement.utilidadNeta < 0;
  const formatVerticalPct = (amount: number, base: number) => {
    if (!base || Math.abs(base) < 0.01) return '0.0%';
    return `${((amount / base) * 100).toFixed(1)}%`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-3.5 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Membrete Ejecutivo Formal para Presentación y Auditoría */}
      <div className="border-b-2 border-slate-900 pb-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight truncate">
              {company.name}
            </h2>
            <div className="text-xs font-mono text-slate-600 mt-0.5 truncate">
              RFC: <span className="font-semibold">{company.rfc}</span> • Régimen Fiscal:{' '}
              {company.regimenFiscal || '601 - General de Ley Personas Morales'}
            </div>
            <div className="text-sm font-bold text-blue-900 mt-1 uppercase tracking-wide">
              Estado de Resultados Integral Acumulado (NIF B-3)
            </div>
            <div className="text-xs text-slate-500">
              Del 01 de Enero al {String(lastDay).padStart(2, '0')} de {mesNombre} de {ejercicio} • Cifras expresadas en Pesos Mexicanos (MXN)
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <TrendingUp className="w-8 h-8 text-blue-700 ml-auto" aria-hidden="true" />
            <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              NIF B-3 Auditado
            </span>
          </div>
        </div>
      </div>

      {/* Ingresos */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
          <span>(+) Ingresos Operativos</span>
          <span className="font-mono text-[11px] text-slate-600">Importe | % Vertical</span>
        </div>
        {incomeStatement.ingresos.length === 0 ? (
          <p className="text-xs text-slate-500 italic px-3 py-1.5">
            Sin movimientos acumulados en este rubro.
          </p>
        ) : (
          incomeStatement.ingresos.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => onSelectAccount(acc.id)}
              title={`Ver auxiliar de ${acc.code} — ${acc.name}`}
              className={`w-full flex items-center justify-between gap-2 text-left text-xs py-1.5 px-3 hover:bg-blue-50/40 rounded-lg transition cursor-pointer ${
                acc.level === 2 ? 'font-bold text-slate-900' : 'pl-7 text-slate-700'
              }`}
            >
              <span className="min-w-0">
                <span className="font-mono mr-2 text-blue-800 underline decoration-dotted">
                  {acc.code}
                </span>
                {acc.name}
              </span>
              <span className="flex items-center gap-4 font-mono shrink-0">
                <span>{formatCurrency(acc.finalBalance)}</span>
                <span className="w-14 text-right text-[11px] text-slate-500">
                  {formatVerticalPct(acc.finalBalance, incomeStatement.totalIngresos)}
                </span>
              </span>
            </button>
          ))
        )}
        <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-300 pt-2 px-3">
          <span>Total de Ingresos Netos</span>
          <span className="flex items-center gap-4 font-mono">
            <span>{formatCurrency(incomeStatement.totalIngresos)}</span>
            <span className="w-14 text-right text-xs text-blue-800">100.0%</span>
          </span>
        </div>
      </div>

      {/* Costos */}
      <div className="space-y-1.5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
          (-) Costo de Ventas y Servicios
        </div>
        {incomeStatement.costos.length === 0 ? (
          <p className="text-xs text-slate-500 italic px-3 py-1.5">
            Sin movimientos acumulados en este rubro.
          </p>
        ) : (
          incomeStatement.costos.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => onSelectAccount(acc.id)}
              title={`Ver auxiliar de ${acc.code} — ${acc.name}`}
              className={`w-full flex items-center justify-between gap-2 text-left text-xs py-1.5 px-3 hover:bg-blue-50/40 rounded-lg transition cursor-pointer ${
                acc.level === 2 ? 'font-bold text-slate-900' : 'pl-7 text-slate-700'
              }`}
            >
              <span className="min-w-0">
                <span className="font-mono mr-2 text-blue-800 underline decoration-dotted">
                  {acc.code}
                </span>
                {acc.name}
              </span>
              <span className="flex items-center gap-4 font-mono shrink-0">
                <span>{formatCurrency(acc.finalBalance)}</span>
                <span className="w-14 text-right text-[11px] text-slate-500">
                  {formatVerticalPct(acc.finalBalance, incomeStatement.totalIngresos)}
                </span>
              </span>
            </button>
          ))
        )}
        <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-300 pt-2 px-3 bg-slate-50 rounded-lg py-2">
          <span>(=) Utilidad Bruta</span>
          <span className="flex items-center gap-4 font-mono">
            <span>{formatCurrency(incomeStatement.utilidadBruta)}</span>
            <span className="w-14 text-right text-xs text-emerald-800">
              {formatVerticalPct(
                incomeStatement.utilidadBruta,
                incomeStatement.totalIngresos
              )}
            </span>
          </span>
        </div>
      </div>

      {/* Gastos de Operación */}
      <div className="space-y-1.5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
          (-) Gastos Generales de Operación y Administración
        </div>
        {incomeStatement.gastos.length === 0 ? (
          <p className="text-xs text-slate-500 italic px-3 py-1.5">
            Sin movimientos acumulados en este rubro.
          </p>
        ) : (
          incomeStatement.gastos.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => onSelectAccount(acc.id)}
              title={`Ver auxiliar de ${acc.code} — ${acc.name}`}
              className={`w-full flex items-center justify-between gap-2 text-left text-xs py-1.5 px-3 hover:bg-blue-50/40 rounded-lg transition cursor-pointer ${
                acc.level === 2 ? 'font-bold text-slate-900' : 'pl-7 text-slate-700'
              }`}
            >
              <span className="min-w-0">
                <span className="font-mono mr-2 text-blue-800 underline decoration-dotted">
                  {acc.code}
                </span>
                {acc.name}
              </span>
              <span className="flex items-center gap-4 font-mono shrink-0">
                <span>{formatCurrency(acc.finalBalance)}</span>
                <span className="w-14 text-right text-[11px] text-slate-500">
                  {formatVerticalPct(acc.finalBalance, incomeStatement.totalIngresos)}
                </span>
              </span>
            </button>
          ))
        )}
        <div className="flex justify-between text-xs font-bold text-slate-800 border-t border-slate-300 pt-2 px-3">
          <span>Total de Gastos de Operación</span>
          <span className="flex items-center gap-4 font-mono">
            <span>{formatCurrency(incomeStatement.totalGastos)}</span>
            <span className="w-14 text-right text-slate-600">
              {formatVerticalPct(
                incomeStatement.totalGastos,
                incomeStatement.totalIngresos
              )}
            </span>
          </span>
        </div>
      </div>

      {/* Impuesto a la Utilidad (ISR del Ejercicio) NIF B-3 */}
      {incomeStatement.isrEjercicio && incomeStatement.isrEjercicio.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
            (-) Provisión de Impuesto a la Utilidad (ISR Ejercicio - NIF B-3)
          </div>
          {incomeStatement.isrEjercicio.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => onSelectAccount(acc.id)}
              title={`Ver auxiliar de ${acc.code} — ${acc.name}`}
              className={`w-full flex items-center justify-between gap-2 text-left text-xs py-1.5 px-3 hover:bg-blue-50/40 rounded-lg transition cursor-pointer ${
                acc.level === 2 ? 'font-bold text-slate-900' : 'pl-7 text-slate-700'
              }`}
            >
              <span className="min-w-0">
                <span className="font-mono mr-2 text-blue-800 underline decoration-dotted">
                  {acc.code}
                </span>
                {acc.name}
              </span>
              <span className="flex items-center gap-4 font-mono shrink-0">
                <span>{formatCurrency(acc.finalBalance)}</span>
                <span className="w-14 text-right text-[11px] text-slate-500">
                  {formatVerticalPct(acc.finalBalance, incomeStatement.totalIngresos)}
                </span>
              </span>
            </button>
          ))}
          <div className="flex justify-between text-xs font-bold text-slate-800 border-t border-slate-300 pt-2 px-3">
            <span>Total ISR del Ejercicio</span>
            <span className="flex items-center gap-4 font-mono">
              <span>{formatCurrency(incomeStatement.totalIsr ?? 0)}</span>
              <span className="w-14 text-right text-slate-600">
                {formatVerticalPct(
                  incomeStatement.totalIsr ?? 0,
                  incomeStatement.totalIngresos
                )}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Resultado Neto */}
      <div className="p-4 rounded-xl bg-[#0A1120] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold">
            {isLoss
              ? '(=) Pérdida Neta Acumulada del Ejercicio'
              : '(=) Utilidad Neta Acumulada del Ejercicio'}
          </div>
          <div className="text-xs text-slate-400">
            Margen Neto sobre Ventas:{' '}
            <strong className={`${isLoss ? 'text-red-300' : 'text-emerald-300'} font-mono`}>
              {formatVerticalPct(
                incomeStatement.utilidadNeta,
                incomeStatement.totalIngresos
              )}
            </strong>
          </div>
        </div>
        <div className={`text-xl font-bold font-mono ${isLoss ? 'text-red-400' : 'text-emerald-400'}`}>
          {formatCurrency(incomeStatement.utilidadNeta)}
        </div>
      </div>

      {/* Pie de Firmas para Dictamen / Impresión Ejecutiva */}
      <div className="pt-10 mt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center text-xs text-slate-600">
        <div className="pt-8 border-t border-slate-400 max-w-xs mx-auto w-full">
          <div className="font-bold text-slate-900">Auxiliar Contable</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Elaboró</div>
        </div>
        <div className="pt-8 border-t border-slate-400 max-w-xs mx-auto w-full">
          <div className="font-bold text-slate-900">C.P. Auditor / Contador General</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Revisó (Cédula Prof. Titulado)</div>
        </div>
        <div className="pt-8 border-t border-slate-400 max-w-xs mx-auto w-full">
          <div className="font-bold text-slate-900">{company.name}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Autorizó (Representante Legal)</div>
        </div>
      </div>
    </div>
  );
}
