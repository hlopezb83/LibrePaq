import { AlertTriangle, Calculator, CheckCircle2, Clock, Info } from 'lucide-react';
import { Input, KpiCard, StatusBadge } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';
import type { BankReconciliationResponse, ReconciliationFormulaData } from '../../shared/types';
import { computeBankReconciliationProof } from './BankReconciliationExport';

interface ConciliacionArithmeticCardProps {
  reconData: BankReconciliationResponse;
  reconFormula: ReconciliationFormulaData | null;
  bankStatementFinalBalance: number;
  bankBalanceDraft: string;
  hasCapturedBankBalance: boolean;
  closureSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onBankBalanceDraftChange?: (value: string) => void;
  isLocked?: boolean;
}

export function ConciliacionArithmeticCard({
  reconData,
  reconFormula,
  bankStatementFinalBalance,
  bankBalanceDraft,
  hasCapturedBankBalance,
  closureSaveStatus = 'idle',
  onBankBalanceDraftChange,
  isLocked = false
}: ConciliacionArithmeticCardProps) {
  const pendingTotal =
    reconData.summary.movimientosPendientesBanco +
    reconData.summary.movimientosPendientesLibros;
  const isFullyReconciled = pendingTotal === 0 && reconData.statementLines.length > 0;
  const proof = reconFormula
    ? computeBankReconciliationProof(reconData, reconFormula, bankStatementFinalBalance)
    : null;

  return (
    <div className="bg-white text-slate-900 rounded-2xl border border-slate-300/90 p-4 sm:p-5 shadow-2xs space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-800 uppercase tracking-wider">
          <Calculator className="w-4 h-4 text-blue-700" aria-hidden="true" />
          <span>Cédula Aritmética de Conciliación Bancaria ({reconData.account.code})</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isFullyReconciled ? (
            <span title="Todas las partidas del estado de cuenta y libros contables están debidamente emparejadas">
              <StatusBadge tone="emerald" icon={<CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}>
                Conciliación Cuadrada (0 pendientes)
              </StatusBadge>
            </span>
          ) : (
            <span title="Existen movimientos bancarios o partidas en tránsito pendientes de conciliar">
              <StatusBadge tone="amber" icon={<Clock className="w-3.5 h-3.5" aria-hidden="true" />}>
                {reconData.summary.movimientosPendientesBanco} banco / {reconData.summary.movimientosPendientesLibros} libros pendientes
              </StatusBadge>
            </span>
          )}

          <span className="text-[11px] font-mono text-slate-600 tabular-nums">
            {reconData.summary.movimientosConciliados} de {reconData.statementLines.length} conciliadas
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="1. Saldo Final en Libros"
          value={formatCurrency(reconData.summary.saldoFinalLibros)}
          className="p-3.5 sm:p-4"
        />
        <KpiCard
          label="2. (+) Depósitos Banco No Reg."
          value={`+${formatCurrency(reconFormula?.depositosBancoNoRegistrados ?? 0)}`}
          valueClassName="text-emerald-800"
          className="p-3.5 sm:p-4"
        />
        <KpiCard
          label="3. (-) Cargos Banco No Reg."
          value={`-${formatCurrency(reconFormula?.cargosBancoNoRegistrados ?? 0)}`}
          valueClassName="text-red-700"
          className="p-3.5 sm:p-4"
        />
        <KpiCard
          tone="blue"
          label="4. (=) Saldo Conciliado Libros"
          value={formatCurrency(reconFormula?.saldoConciliadoEstimado ?? 0)}
          valueClassName="text-blue-900"
          className="p-3.5 sm:p-4"
        />
      </div>

      {proof && (
        <div className="pt-3 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="bank-statement-final-balance"
              className="font-sans text-xs font-semibold text-slate-700 whitespace-nowrap"
            >
              Saldo Final Edo. Cuenta ($):
            </label>
            <Input
              id="bank-statement-final-balance"
              size="sm"
              type="text"
              inputMode="decimal"
              placeholder="Captura saldo banco"
              disabled={isLocked || !onBankBalanceDraftChange}
              value={bankBalanceDraft}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^0-9.-]/g, '');
                onBankBalanceDraftChange?.(cleaned);
              }}
              className="max-w-[180px] font-mono tabular-nums"
            />
            <span
              aria-live="polite"
              className={`text-[11px] font-sans ${
                closureSaveStatus === 'error'
                  ? 'text-red-700 font-semibold'
                  : closureSaveStatus === 'saved'
                    ? 'text-emerald-800 font-semibold'
                    : 'text-slate-600'
              }`}
            >
              {closureSaveStatus === 'saving'
                ? 'Guardando...'
                : closureSaveStatus === 'saved'
                  ? 'Guardado'
                  : closureSaveStatus === 'error'
                    ? 'Error al guardar'
                    : !hasCapturedBankBalance
                      ? 'Captura el saldo real de tu estado de cuenta bancario'
                      : ''}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-700">
            <span>
              (+) Dep. Tránsito: <strong className="text-emerald-800">+{formatCurrency(proof.cargosContablesEnTransito)}</strong>
            </span>
            <span>
              (-) Pagos Tránsito: <strong className="text-amber-800">-{formatCurrency(proof.abonosContablesEnTransito)}</strong>
            </span>
            <span>
              (=) Conciliado Banco:{' '}
              <strong className="text-blue-800">
                {hasCapturedBankBalance ? formatCurrency(proof.saldoConciliadoBanco) : 'Pendiente'}
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap lg:justify-end">
            <span
              role="status"
              aria-live="polite"
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono text-xs font-bold border ${
                !hasCapturedBankBalance
                  ? 'bg-slate-100 text-slate-800 border-slate-300'
                  : proof.isCuadrada
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-amber-50 text-amber-950 border-amber-300'
              }`}
            >
              {!hasCapturedBankBalance ? (
                <>
                  <Info className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />
                  <span>Diferencia: Por capturar</span>
                </>
              ) : proof.isCuadrada ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                  <span>Diferencia: {formatCurrency(proof.diferenciaCuadre)}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                  <span>Diferencia: {formatCurrency(proof.diferenciaCuadre)}</span>
                </>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
