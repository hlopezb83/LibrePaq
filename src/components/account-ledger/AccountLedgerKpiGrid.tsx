import { formatCurrency } from '../../lib/formatters';
import type { AccountLedgerResponse, AccountNature } from '../../shared/types';

export function getLedgerNatureLabels(nature: AccountNature): {
  chargesLabel: string;
  creditsLabel: string;
} {
  if (nature === 'ACREEDORA') {
    return {
      chargesLabel: '(-) Cargos del Periodo',
      creditsLabel: '(+) Abonos del Periodo'
    };
  }
  return {
    chargesLabel: '(+) Cargos del Periodo',
    creditsLabel: '(-) Abonos del Periodo'
  };
}

interface AccountLedgerKpiGridProps {
  data: AccountLedgerResponse;
  mesNombre: string;
}

export function AccountLedgerKpiGrid({ data, mesNombre }: AccountLedgerKpiGridProps) {
  const { chargesLabel, creditsLabel } = getLedgerNatureLabels(data.account.nature);
  const isNegativeFinal = data.finalBalance < 0;
  const isNegativeInitial = data.initialBalance < 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
        <div className="text-[11px] font-bold text-slate-600 uppercase truncate">
          Saldo Inicial ({mesNombre})
        </div>
        <div
          className={`mt-1 text-sm sm:text-base font-bold font-mono tabular-nums truncate ${
            isNegativeInitial ? 'text-red-700' : 'text-slate-900'
          }`}
          title={formatCurrency(data.initialBalance)}
        >
          {formatCurrency(data.initialBalance)}
        </div>
        <div className="text-[10px] text-slate-600">
          Incluye arrastre de meses previos
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
        <div className="text-[11px] font-bold text-slate-600 uppercase truncate">
          {chargesLabel}
        </div>
        <div
          className="mt-1 text-sm sm:text-base font-bold font-mono tabular-nums text-slate-900 truncate"
          title={formatCurrency(data.totalCharges)}
        >
          {formatCurrency(data.totalCharges)}
        </div>
        <div className="text-[10px] text-slate-600">Movimientos en el Debe</div>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
        <div className="text-[11px] font-bold text-slate-600 uppercase truncate">
          {creditsLabel}
        </div>
        <div
          className="mt-1 text-sm sm:text-base font-bold font-mono tabular-nums text-slate-900 truncate"
          title={formatCurrency(data.totalCredits)}
        >
          {formatCurrency(data.totalCredits)}
        </div>
        <div className="text-[10px] text-slate-600">Movimientos en el Haber</div>
      </div>

      <div
        className={`p-3.5 rounded-xl border min-w-0 ${
          isNegativeFinal ? 'bg-red-50/80 border-red-200' : 'bg-blue-50/80 border-blue-200'
        }`}
      >
        <div
          className={`text-[11px] font-bold uppercase truncate ${
            isNegativeFinal ? 'text-red-900' : 'text-blue-900'
          }`}
        >
          (=) Saldo Final Acumulado
        </div>
        <div
          className={`mt-1 text-sm sm:text-base font-bold font-mono tabular-nums truncate ${
            isNegativeFinal ? 'text-red-700' : 'text-blue-950'
          }`}
          title={formatCurrency(data.finalBalance)}
        >
          {formatCurrency(data.finalBalance)}
        </div>
        <div className={`text-[10px] ${isNegativeFinal ? 'text-red-800' : 'text-blue-800'}`}>
          Naturaleza {data.account.nature}
        </div>
      </div>
    </div>
  );
}
