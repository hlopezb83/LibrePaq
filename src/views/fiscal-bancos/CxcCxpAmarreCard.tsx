import { CheckCircle2, Scale, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';
import { fromCents, sumCents, toCents } from '../../shared/engine/invariants-and-math';
import type { AccountWithBalance } from '../../shared/types';
import type { AgingMode } from './CxcCxpHeaderBuckets';

export interface CxcCxpAmarreCardProps {
  mode: AgingMode;
  carteraTotal: number;
  trialBalance: readonly AccountWithBalance[];
  isLoading: boolean;
}

export function computeCxcCxpAmarreSummary(
  mode: AgingMode,
  carteraTotal: number,
  trialBalance: readonly AccountWithBalance[]
) {
  const prefix = mode === 'CXC' ? '105' : '201';
  const matchingAccs = trialBalance.filter((a) => a.isAffectable && a.code.startsWith(prefix));
  const balanzaCents = sumCents(matchingAccs.map((a) => a.finalBalance));
  const carteraCents = toCents(carteraTotal);
  const diffCents = balanzaCents - carteraCents;
  return {
    prefix,
    accountCount: matchingAccs.length,
    saldoBalanza: fromCents(balanzaCents),
    saldoCarteraPpd: fromCents(carteraCents),
    diferencia: fromCents(diffCents),
    isCuadrado: Math.abs(diffCents) <= 5
  };
}

export function CxcCxpAmarreCard({ mode, carteraTotal, trialBalance, isLoading }: CxcCxpAmarreCardProps) {
  const amarre = computeCxcCxpAmarreSummary(mode, carteraTotal, trialBalance);
  const balanzaLabel = mode === 'CXC' ? 'Saldo Balanza (105 Clientes)' : 'Saldo Balanza (201 Proveedores)';

  return (
    <section
      aria-label="Amarre contable contra balanza"
      className="bg-white p-4 rounded-2xl border border-slate-300/90 shadow-2xs space-y-2.5 text-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
          <h3 className="font-bold text-slate-900">
            Amarre Contable: Cartera PPD vs. Balanza ({amarre.prefix}*)
          </h3>
        </div>
        {isLoading ? (
          <StatusBadge tone="slate">Consultando balanza...</StatusBadge>
        ) : amarre.isCuadrado ? (
          <StatusBadge tone="emerald" icon={<CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}>
            Cuadrado vs. Balanza {amarre.prefix}
          </StatusBadge>
        ) : (
          <StatusBadge tone="amber" icon={<AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />}>
            Diferencia vs. Balanza {amarre.prefix}
          </StatusBadge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <span className="text-[11px] text-slate-600 block">{balanzaLabel} ({amarre.accountCount} ctas)</span>
          <strong className="font-mono text-sm text-slate-900 tabular-nums">{formatCurrency(amarre.saldoBalanza)}</strong>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <span className="text-[11px] text-slate-600 block">Saldo Cartera PPD (CFDIs)</span>
          <strong className="font-mono text-sm text-blue-900 tabular-nums">{formatCurrency(amarre.saldoCarteraPpd)}</strong>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <span className="text-[11px] text-slate-600 block">Diferencia (Balanza − Cartera PPD)</span>
          <strong className={`font-mono text-sm tabular-nums ${amarre.isCuadrado ? 'text-emerald-700' : 'text-amber-800'}`}>
            {formatCurrency(amarre.diferencia)}
          </strong>
        </div>
      </div>

      {!isLoading && !amarre.isCuadrado && (
        <p className="text-[11px] text-slate-600">
          Nota: una diferencia puede corresponder a saldos iniciales de migración, anticipos sin CFDI PPD, facturas PUE contabilizadas a crédito o pólizas pendientes de contabilizar.
        </p>
      )}
    </section>
  );
}
