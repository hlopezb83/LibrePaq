import { Check } from 'lucide-react';
import { StatusBadge } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';
import type { CfdiPreviewMovement } from './CfdiContabilizarModal';

interface CfdiPolizaPreviewTableProps {
  effectivePreviewMovements: CfdiPreviewMovement[];
  totalCargos: number;
  totalAbonos: number;
  diffCents: number;
  isBalanced: boolean;
}

export function CfdiPolizaPreviewTable({
  effectivePreviewMovements,
  totalCargos,
  totalAbonos,
  diffCents,
  isBalanced
}: CfdiPolizaPreviewTableProps) {
  const hasMovements = effectivePreviewMovements.length > 0;

  return (
    <div className="border border-slate-300 rounded-xl overflow-hidden">
      <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-slate-800">
          Vista Previa de la Póliza que se Registrará (Partida Doble)
        </span>
        {isBalanced ? (
          <StatusBadge tone="emerald" icon={<Check className="w-3 h-3" aria-hidden="true" />}>
            Sumas Iguales Verificadas
          </StatusBadge>
        ) : hasMovements ? (
          <StatusBadge tone="amber" className="font-mono tabular-nums">
            Asiento Descuadrado ({formatCurrency(diffCents / 100)})
          </StatusBadge>
        ) : (
          <StatusBadge tone="red">Sin movimientos proyectados</StatusBadge>
        )}
      </div>

      <div className="overflow-x-auto scrollable-panel">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
              <th scope="col" className="py-2 px-3">
                Cuenta
              </th>
              <th scope="col" className="py-2 px-3">
                Nombre de Cuenta
              </th>
              <th scope="col" className="py-2 px-3">
                Concepto
              </th>
              <th scope="col" className="py-2 px-3 text-right">
                Cargo (Debe)
              </th>
              <th scope="col" className="py-2 px-3 text-right">
                Abono (Haber)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {!hasMovements ? (
              <tr>
                <td colSpan={5} className="py-4 px-3 text-center text-red-800 bg-red-50/70 font-medium">
                  No se pudieron proyectar movimientos contables para este CFDI. Verifica que existan cuentas afectables configuradas en el catálogo.
                </td>
              </tr>
            ) : (
              effectivePreviewMovements.map((line, i) => (
                <tr key={`${line.code}-${i}`} className="hover:bg-blue-50/30">
                  <td className="py-2 px-3 font-mono font-bold text-blue-800">{line.code}</td>
                  <td className="py-2 px-3 font-medium text-slate-800">{line.name}</td>
                  <td className="py-2 px-3 text-slate-600 truncate max-w-48" title={line.concepto}>
                    {line.concepto}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-900 font-semibold tabular-nums">
                    {line.cargo > 0 ? formatCurrency(line.cargo) : '—'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-900 font-semibold tabular-nums">
                    {line.abono > 0 ? formatCurrency(line.abono) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot aria-live="polite" className="bg-slate-100/90 border-t-2 border-slate-300 font-bold text-xs">
            <tr>
              <td colSpan={3} className="py-2.5 px-3 text-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span>Sumas Iguales:</span>
                  {isBalanced ? (
                    <StatusBadge
                      tone="emerald"
                      icon={<Check className="w-3 h-3" aria-hidden="true" />}
                    >
                      Póliza Cuadrada
                    </StatusBadge>
                  ) : !hasMovements ? (
                    <StatusBadge tone="red">Sin movimientos</StatusBadge>
                  ) : (
                    <StatusBadge tone="amber" className="tabular-nums">
                      Diferencia: {formatCurrency(diffCents / 100)}
                    </StatusBadge>
                  )}
                </div>
              </td>
              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                {formatCurrency(totalCargos)}
              </td>
              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                {formatCurrency(totalAbonos)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
