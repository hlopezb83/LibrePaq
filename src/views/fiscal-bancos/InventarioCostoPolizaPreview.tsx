import { AlertTriangle, Calculator } from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { CostOfSalesComputation, CostOfSalesPolizaPlan } from '../../shared/types/cost-of-sales.types';

interface InventarioCostoPolizaPreviewProps {
  liveCost: CostOfSalesComputation;
  exceedsAvailable: boolean;
  polizaPlan: CostOfSalesPolizaPlan | null;
  confirmPoliza: boolean;
  isLocked: boolean;
  lockReason: string | null;
  isSubmitting: boolean;
  onCancelConfirm: () => void;
  onConfirmPoliza: () => void;
}

export function InventarioCostoPolizaPreview({
  liveCost,
  exceedsAvailable,
  polizaPlan,
  confirmPoliza,
  isLocked,
  lockReason,
  isSubmitting,
  onCancelConfirm,
  onConfirmPoliza
}: InventarioCostoPolizaPreviewProps) {
  const movementSummary = polizaPlan
    ? polizaPlan.movements
        .map((m) => `${m.cargo > 0 ? 'Cargo' : 'Abono'} ${m.accountCode} (${formatCurrency(m.cargo > 0 ? m.cargo : m.abono)})`)
        .join(' · ')
    : '';

  return (
    <>
      <div aria-live="polite" className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-700 font-mono tabular-nums">
          <Calculator className="w-4 h-4 text-slate-600 shrink-0" aria-hidden="true" />
          <span>
            {formatCurrency(liveCost.initialInventory)} + {formatCurrency(liveCost.purchasesPeriod)} − {formatCurrency(liveCost.finalInventory)} ={' '}
            <strong className="text-emerald-800">{formatCurrency(liveCost.costOfSales)}</strong>
          </span>
        </div>
        {polizaPlan && (
          <div className="text-[11px] text-slate-600 font-mono">
            Diario ({formatShortDate(polizaPlan.fecha)}): {movementSummary}
          </div>
        )}
      </div>

      {exceedsAvailable && (
        <div role="status" aria-live="polite" className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 font-medium">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            El Inventario Final capturado supera la mercancía disponible ({formatCurrency(liveCost.availableMerchandise)}), por lo que el Costo de Ventas se ajustó a <strong className="font-mono">$0.00</strong>.
          </span>
        </div>
      )}

      {confirmPoliza && polizaPlan && (
        <div role="region" aria-label="Confirmación de póliza de costo de ventas" className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5 text-amber-950">
            <p className="font-semibold">
              Ya existe una póliza vinculada para este periodo. ¿Generar una nueva póliza de Costo de Ventas y actualizar el vínculo?
            </p>
            <p className="text-[11px] font-mono text-amber-900">
              Diario ({formatShortDate(polizaPlan.fecha)}): {movementSummary}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" autoFocus onClick={onCancelConfirm} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold cursor-pointer">
              Cancelar
            </button>
            <button type="button" disabled={isLocked || isSubmitting} title={lockReason ?? 'Confirmar y registrar nueva póliza de costo de ventas'} onClick={onConfirmPoliza} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? 'Registrando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
