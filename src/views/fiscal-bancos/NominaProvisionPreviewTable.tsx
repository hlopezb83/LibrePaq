import { formatCurrency } from '../../lib/formatters';
import type { SuaAndIsnProvisionResult } from '../../shared/types/payroll-summary.types';

export interface NominaProvisionPreviewTableProps {
  provision: SuaAndIsnProvisionResult;
}

export function NominaProvisionPreviewTable({ provision }: NominaProvisionPreviewTableProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="min-w-0">
          <span className="text-[11px] font-medium text-slate-600 block">
            ISN {provision.stateName} ({provision.tasaIsnPct}%)
          </span>
          <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
            {formatCurrency(provision.isnEstatal)}
          </span>
        </div>
        <div className="min-w-0">
          <span className="text-[11px] font-medium text-slate-600 block">
            Total SUA Patronal (IMSS + RCV + INFONAVIT)
          </span>
          <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
            {formatCurrency(provision.totalSuaPatronal)}
          </span>
        </div>
        <div className="min-w-0">
          <span className="text-[11px] font-medium text-slate-600 block">
            Provisión Total (Póliza DIARIO)
          </span>
          <span className="text-sm font-bold font-mono tabular-nums text-blue-800">
            {formatCurrency(provision.totalProvision)}
          </span>
        </div>
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label="Previsualización de póliza SUA e ISN"
        className="overflow-x-auto max-w-full border border-slate-200 rounded-xl"
      >
        <table className="w-full text-xs text-left">
          <caption className="visually-hidden">
            Previsualización de póliza de diario de provisión SUA e ISN
          </caption>
          <thead className="bg-slate-100 text-slate-700 font-semibold">
            <tr>
              <th scope="col" className="px-3 py-2">Cuenta</th>
              <th scope="col" className="px-3 py-2">Concepto</th>
              <th scope="col" className="px-3 py-2 text-right">Cargo</th>
              <th scope="col" className="px-3 py-2 text-right">Abono</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {provision.polizaMovements.map((m, idx) => (
              <tr key={`${m.accountId}-${idx}`}>
                <th scope="row" className="px-3 py-2 font-mono font-normal text-slate-800 whitespace-nowrap">
                  {m.accountCode} · {m.accountName}
                </th>
                <td className="px-3 py-2 text-slate-600">{m.concepto}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                  {m.cargo > 0 ? formatCurrency(m.cargo) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                  {m.abono > 0 ? formatCurrency(m.abono) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-300">
            <tr>
              <th scope="row" colSpan={2} className="px-3 py-2 font-bold">
                Totales Póliza (Debe = Haber)
              </th>
              <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                {formatCurrency(provision.totalCargos)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                {formatCurrency(provision.totalAbonos)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
