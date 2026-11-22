import { Calculator, CheckCircle2, Clock } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { BankReconciliationResponse, ReconciliationFormulaData } from '../../shared/types';

interface ConciliacionArithmeticCardProps {
  reconData: BankReconciliationResponse;
  reconFormula: ReconciliationFormulaData | null;
}

export function ConciliacionArithmeticCard({
  reconData,
  reconFormula
}: ConciliacionArithmeticCardProps) {
  const pendingTotal =
    reconData.summary.movimientosPendientesBanco +
    reconData.summary.movimientosPendientesLibros;
  const isFullyReconciled = pendingTotal === 0 && reconData.statementLines.length > 0;

  return (
    <div className="bg-[#0A1120] text-white rounded-2xl border border-[#1E293B] p-4 sm:p-5 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-300 uppercase tracking-wider">
          <Calculator className="w-4 h-4" aria-hidden="true" />
          Cédula Aritmética de Conciliación Bancaria ({reconData.account.code})
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isFullyReconciled ? (
            <span
              title="Todas las partidas del estado de cuenta y libros contables están debidamente emparejadas"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-2xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>Conciliación Cuadrada (0 pendientes)</span>
            </span>
          ) : (
            <span
              title="Existen movimientos bancarios o partidas en tránsito pendientes de conciliar"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-2xs"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>
                {reconData.summary.movimientosPendientesBanco} banco / {reconData.summary.movimientosPendientesLibros} libros pendientes
              </span>
            </span>
          )}

          <span className="text-[11px] font-mono text-slate-400">
            {reconData.summary.movimientosConciliados} de {reconData.statementLines.length} conciliadas
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3 rounded-xl bg-[#111C35] border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold">
            1. Saldo Final en Libros
          </div>
          <div className="mt-1 text-base font-bold text-white">
            {formatCurrency(reconData.summary.saldoFinalLibros)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#111C35] border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold">
            2. (+) Depósitos Banco No Reg.
          </div>
          <div className="mt-1 text-base font-bold text-emerald-300">
            +{formatCurrency(reconFormula?.depositosBancoNoRegistrados ?? 0)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#111C35] border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold">
            3. (-) Cargos Banco No Reg.
          </div>
          <div className="mt-1 text-base font-bold text-red-300">
            -{formatCurrency(reconFormula?.cargosBancoNoRegistrados ?? 0)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-blue-950/70 border border-blue-700/60">
          <div className="text-[10px] text-blue-200 uppercase font-sans font-bold">
            4. (=) Saldo tras Partidas Banco
          </div>
          <div className="mt-1 text-base font-bold text-blue-200">
            {formatCurrency(reconFormula?.saldoConciliadoEstimado ?? 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
