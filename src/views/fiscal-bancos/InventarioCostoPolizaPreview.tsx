import { AlertTriangle, Calculator, Loader2 } from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { CostOfSalesComputation, CostOfSalesPolizaPlan } from '../../shared/types/cost-of-sales.types';

interface InventarioCostoPolizaPreviewProps {
  liveCost: CostOfSalesComputation;
  exceedsAvailable: boolean;
  polizaPlan: CostOfSalesPolizaPlan | null;
  hasExistingPoliza: boolean;
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
  hasExistingPoliza,
  confirmPoliza,
  isLocked,
  lockReason,
  isSubmitting,
  onCancelConfirm,
  onConfirmPoliza
}: InventarioCostoPolizaPreviewProps) {
  return (
    <>
      <div aria-live="polite" className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-slate-700 font-mono tabular-nums">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-slate-600 shrink-0" aria-hidden="true" />
            <span>
              {formatCurrency(liveCost.initialInventory)} + {formatCurrency(liveCost.purchasesPeriod)} − {formatCurrency(liveCost.finalInventory)} ={' '}
              <strong className="text-emerald-800">{formatCurrency(liveCost.costOfSales)}</strong>
            </span>
          </div>
          {polizaPlan && (
            <span className="text-[11px] text-slate-600">
              Diario ({formatShortDate(polizaPlan.fecha)})
            </span>
          )}
        </div>

        {polizaPlan && polizaPlan.movements.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left border-collapse text-[11px]">
              <caption className="visually-hidden">Partidas preliminares de la póliza de costo de ventas</caption>
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase">
                  <th scope="col" className="py-1.5 px-3">Cuenta</th>
                  <th scope="col" className="py-1.5 px-3">Concepto</th>
                  <th scope="col" className="py-1.5 px-3 text-right">Debe</th>
                  <th scope="col" className="py-1.5 px-3 text-right">Haber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                {polizaPlan.movements.map((m, i) => (
                  <tr key={`${m.accountId}-${i}`}>
                    <td className="py-1.5 px-3 font-semibold text-slate-800 whitespace-nowrap">{m.accountCode}</td>
                    <td className="py-1.5 px-3 font-sans text-slate-700">{m.concepto}</td>
                    <td className="py-1.5 px-3 text-right text-slate-900 whitespace-nowrap">
                      {m.cargo > 0 ? formatCurrency(m.cargo) : '—'}
                    </td>
                    <td className="py-1.5 px-3 text-right text-slate-900 whitespace-nowrap">
                      {m.abono > 0 ? formatCurrency(m.abono) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        <div
          role="alertdialog"
          aria-label="Confirmación de póliza de costo de ventas"
          onKeyDown={(e) => { if (e.key === 'Escape') onCancelConfirm(); }}
          className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div className="space-y-0.5 text-amber-950">
            <p className="font-semibold">
              {hasExistingPoliza
                ? 'Ya existe una póliza vinculada en este periodo. Se eliminará la póliza anterior y se generará una nueva póliza de Costo de Ventas.'
                : `¿Confirmas registrar la póliza de Diario (${formatShortDate(polizaPlan.fecha)}) por Costo de Ventas?`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" autoFocus onClick={onCancelConfirm} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold cursor-pointer">
              Cancelar
            </button>
            <button
              type="button"
              disabled={isLocked || isSubmitting}
              title={lockReason ?? 'Confirmar y registrar póliza de costo de ventas'}
              onClick={onConfirmPoliza}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              {isSubmitting ? 'Registrando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
