import { ArrowDownLeft, ArrowUpRight, Scale, Wallet } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { AccountLedgerResponse, AccountNature } from '../../shared/types';
import { KpiCard } from '../ui';

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
      <KpiCard
        label={`Saldo Inicial (${mesNombre})`}
        value={formatCurrency(data.initialBalance)}
        valueClassName={isNegativeInitial ? 'text-red-700' : 'text-slate-900'}
        icon={<Wallet className="w-4 h-4" aria-hidden="true" />}
        iconTone="default"
        hint="Incluye arrastre de meses previos"
      />

      <KpiCard
        label={chargesLabel}
        value={formatCurrency(data.totalCharges)}
        icon={<ArrowUpRight className="w-4 h-4" aria-hidden="true" />}
        iconTone="emerald"
        hint="Movimientos en el Debe"
      />

      <KpiCard
        label={creditsLabel}
        value={formatCurrency(data.totalCredits)}
        icon={<ArrowDownLeft className="w-4 h-4" aria-hidden="true" />}
        iconTone="amber"
        hint="Movimientos en el Haber"
      />

      <KpiCard
        label="(=) Saldo Final Acumulado"
        value={formatCurrency(data.finalBalance)}
        tone={isNegativeFinal ? 'red' : 'blue'}
        iconTone={isNegativeFinal ? 'red' : 'blue'}
        valueClassName={isNegativeFinal ? 'text-red-700' : 'text-blue-950'}
        icon={<Scale className="w-4 h-4" aria-hidden="true" />}
        hint={`Naturaleza ${data.account.nature}`}
      />
    </div>
  );
}
