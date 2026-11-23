import { Scale } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { AccountWithBalance, Company } from '../../shared/types';

interface BalanceGeneralTabProps {
  company: Company;
  ejercicio: number;
  periodo?: number;
  mesNombre: string;
  balanceSheet: {
    activos: AccountWithBalance[];
    pasivos: AccountWithBalance[];
    capital: AccountWithBalance[];
    totalActivo: number;
    totalPasivo: number;
    totalCapitalBase?: number;
    totalCapital?: number;
    utilidadEjercicio: number;
    totalPasivoMasCapital: number;
    isBalanced?: boolean;
  };
  onSelectAccount: (accountId: string) => void;
  onViewIncomeStatement?: () => void;
}

export function BalanceGeneralTab({
  company,
  ejercicio,
  periodo,
  mesNombre,
  balanceSheet,
  onSelectAccount,
  onViewIncomeStatement
}: BalanceGeneralTabProps) {
  const lastDay = new Date(
    ejercicio,
    Math.min(12, Math.max(1, periodo ?? company.currentPeriod ?? 10)),
    0
  ).getDate();
  const isLoss = balanceSheet.utilidadEjercicio < 0;
  const isBalanced =
    balanceSheet.isBalanced ??
    Math.abs(balanceSheet.totalActivo - balanceSheet.totalPasivoMasCapital) < 0.05;

  const formatVerticalPct = (amount: number, base: number) => {
    if (!base || Math.abs(base) < 0.01) return '0.0%';
    return `${((amount / base) * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Membrete Ejecutivo Formal para Presentación y Auditoría */}
      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-3.5 sm:p-6 border-b-2 border-slate-900">
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
              Balance General o Estado de Situación Financiera (NIF B-6)
            </div>
            <div className="text-xs text-slate-500">
              Al {String(lastDay).padStart(2, '0')} de {mesNombre} de {ejercicio} • Cifras expresadas en Pesos Mexicanos (MXN)
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <Scale className="w-8 h-8 text-blue-700 ml-auto" aria-hidden="true" />
            <span
              className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                isBalanced
                  ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                  : 'text-amber-800 bg-amber-50 border-amber-300'
              }`}
            >
              {isBalanced
                ? 'Ecuación Cuadrada (A = P + C)'
                : `Descuadre: ${formatCurrency(Math.abs(balanceSheet.totalActivo - balanceSheet.totalPasivoMasCapital))}`}
            </span>
          </div>
        </div>
      </div>

      <div
        className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
          isBalanced
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
            : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}
      >
        <div className="flex items-start sm:items-center gap-2.5 text-xs font-semibold">
          <Scale
            className={`w-5 h-5 shrink-0 mt-0.5 sm:mt-0 ${
              isBalanced ? 'text-emerald-700' : 'text-amber-700'
            }`}
            aria-hidden="true"
          />
          <span className="leading-relaxed">
            {isBalanced ? 'Ecuación Contable Cuadrada' : 'Ecuación Contable con Diferencia'}: Total Activo (
            <strong className="font-mono">
              {formatCurrency(balanceSheet.totalActivo)}
            </strong>
            ) {isBalanced ? '=' : '≠'} Pasivo + Capital Contable (
            <strong className="font-mono">
              {formatCurrency(balanceSheet.totalPasivoMasCapital)}
            </strong>
            )
          </span>
        </div>
        <span
          className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
            isBalanced
              ? 'bg-emerald-700 text-white'
              : 'bg-amber-700 text-white'
          }`}
        >
          {isBalanced ? 'NIF B-6 Verificado ✔' : 'Diferencia en Ecuación ⚠'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Columna Izquierda: ACTIVO */}
        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-900 bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl">
              <span>100 — Activo (Recursos y Derechos)</span>
              <span className="font-mono text-[10px] text-slate-600">Saldo | % Activo</span>
            </div>
            <div className="divide-y divide-slate-100">
              {balanceSheet.activos.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-3 px-2">
                  Sin cuentas de activo registradas en el periodo.
                </p>
              ) : (
                balanceSheet.activos.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => onSelectAccount(acc.id)}
                    title={`Ver auxiliar de ${acc.code} — ${acc.name}`}
                    className={`w-full py-2 flex justify-between gap-2 text-left text-xs hover:bg-blue-50/40 transition cursor-pointer ${
                      acc.level === 2
                        ? 'font-bold text-slate-900 bg-slate-50/80 px-2 rounded'
                        : 'pl-5 pr-2 text-slate-700'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="font-mono mr-2 text-blue-800 underline decoration-dotted">
                        {acc.code}
                      </span>
                      {acc.name}
                    </span>
                    <span className="flex items-center gap-3 font-mono shrink-0">
                      <span>{formatCurrency(acc.finalBalance)}</span>
                      <span className="w-12 text-right text-[11px] text-slate-500">
                        {formatVerticalPct(acc.finalBalance, balanceSheet.totalActivo)}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-3 border-t-2 border-slate-900 flex justify-between items-center text-sm font-bold text-slate-900">
            <span>TOTAL ACTIVO</span>
            <span className="flex items-center gap-3 font-mono text-base text-blue-800 shrink-0">
              <span>{formatCurrency(balanceSheet.totalActivo)}</span>
              <span className="text-xs text-slate-600">100.0%</span>
            </span>
          </div>
        </div>

        {/* Columna Derecha: PASIVO + CAPITAL */}
        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5 flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            {/* Pasivo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-900 bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl">
                <span>200 — Pasivo (Obligaciones)</span>
                <span className="font-mono text-[10px] text-slate-600">Saldo | % Activo</span>
              </div>
              <div className="divide-y divide-slate-100">
                {balanceSheet.pasivos.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-3 px-2">
                    Sin cuentas de pasivo registradas en el periodo.
                  </p>
                ) : (
                  balanceSheet.pasivos.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => onSelectAccount(acc.id)}
                      title={`Ver auxiliar de ${acc.code} — ${acc.name}`}
                      className={`w-full py-2 flex justify-between gap-2 text-left text-xs hover:bg-blue-50/40 transition cursor-pointer ${
                        acc.level === 2
                          ? 'font-bold text-slate-900 bg-slate-50/80 px-2 rounded'
                          : 'pl-5 pr-2 text-slate-700'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="font-mono mr-2 text-blue-800 underline decoration-dotted">
                          {acc.code}
                        </span>
                        {acc.name}
                      </span>
                      <span className="flex items-center gap-3 font-mono shrink-0">
                        <span>{formatCurrency(acc.finalBalance)}</span>
                        <span className="w-12 text-right text-[11px] text-slate-500">
                          {formatVerticalPct(acc.finalBalance, balanceSheet.totalActivo)}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-bold text-slate-900 px-2">
                <span>Total Pasivo</span>
                <span className="flex items-center gap-3 font-mono shrink-0">
                  <span>{formatCurrency(balanceSheet.totalPasivo)}</span>
                  <span className="w-12 text-right text-[11px] text-slate-500">
                    {formatVerticalPct(
                      balanceSheet.totalPasivo,
                      balanceSheet.totalActivo
                    )}
                  </span>
                </span>
              </div>
            </div>

            {/* Capital Contable */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-900 bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl">
                <span>300 — Capital Contable (Patrimonio)</span>
                <span className="font-mono text-[10px] text-slate-600">Saldo | % Activo</span>
              </div>
              <div className="divide-y divide-slate-100">
                {balanceSheet.capital.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => onSelectAccount(acc.id)}
                    title={`Ver auxiliar de ${acc.code} — ${acc.name}`}
                    className={`w-full py-2 flex justify-between gap-2 text-left text-xs hover:bg-blue-50/40 transition cursor-pointer ${
                      acc.level === 2
                        ? 'font-bold text-slate-900 bg-slate-50/80 px-2 rounded'
                        : 'pl-5 pr-2 text-slate-700'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="font-mono mr-2 text-blue-800 underline decoration-dotted">
                        {acc.code}
                      </span>
                      {acc.name}
                    </span>
                    <span className="flex items-center gap-3 font-mono shrink-0">
                      <span>{formatCurrency(acc.finalBalance)}</span>
                      <span className="w-12 text-right text-[11px] text-slate-500">
                        {formatVerticalPct(acc.finalBalance, balanceSheet.totalActivo)}
                      </span>
                    </span>
                  </button>
                ))}
                {onViewIncomeStatement ? (
                  <button
                    type="button"
                    onClick={onViewIncomeStatement}
                    title="Abrir Estado de Resultados (NIF B-3) para auditar el origen del resultado"
                    className={`w-full py-2 pl-5 pr-2 flex justify-between gap-2 text-left text-xs font-bold rounded transition cursor-pointer hover:ring-1 hover:ring-blue-400 ${
                      isLoss ? 'text-red-800 bg-red-50/70' : 'text-emerald-800 bg-emerald-50/60'
                    }`}
                  >
                    <span className="underline decoration-dotted underline-offset-2">
                      305-01-001 Resultado ({isLoss ? 'Pérdida' : 'Utilidad'}) del Ejercicio Actual
                    </span>
                    <span className="flex items-center gap-3 font-mono shrink-0">
                      <span>{formatCurrency(balanceSheet.utilidadEjercicio)}</span>
                      <span className={`w-12 text-right text-[11px] ${isLoss ? 'text-red-700' : 'text-emerald-700'}`}>
                        {formatVerticalPct(
                          balanceSheet.utilidadEjercicio,
                          balanceSheet.totalActivo
                        )}
                      </span>
                    </span>
                  </button>
                ) : (
                  <div
                    className={`py-2 pl-5 pr-2 flex justify-between gap-2 text-xs font-bold rounded ${
                      isLoss ? 'text-red-800 bg-red-50/70' : 'text-emerald-800 bg-emerald-50/60'
                    }`}
                  >
                    <span>
                      305-01-001 Resultado ({isLoss ? 'Pérdida' : 'Utilidad'}) del Ejercicio Actual
                    </span>
                    <span className="flex items-center gap-3 font-mono shrink-0">
                      <span>{formatCurrency(balanceSheet.utilidadEjercicio)}</span>
                      <span className={`w-12 text-right text-[11px] ${isLoss ? 'text-red-700' : 'text-emerald-700'}`}>
                        {formatVerticalPct(
                          balanceSheet.utilidadEjercicio,
                          balanceSheet.totalActivo
                        )}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t-2 border-slate-900 flex justify-between items-center text-sm font-bold text-slate-900">
            <span>TOTAL PASIVO + CAPITAL</span>
            <span className="flex items-center gap-3 font-mono text-base text-blue-800 shrink-0">
              <span>{formatCurrency(balanceSheet.totalPasivoMasCapital)}</span>
              <span className="text-xs text-slate-600">100.0%</span>
            </span>
          </div>
        </div>
      </div>

      {/* Pie de Firmas para Dictamen / Impresión Ejecutiva */}
      <div className="bg-white rounded-2xl border border-slate-300/90 p-6 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center text-xs text-slate-600">
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
