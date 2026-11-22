import { useMemo } from 'react';
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures
} from '@tanstack/react-table';
import { BookOpen } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { AccountWithBalance } from '../../shared/types';

export const balanzaTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel()
});
const columnHelper = createColumnHelper<typeof balanzaTableFeatures, AccountWithBalance>();

export function useBalanzaColumns(onSelectAccount: (accountId: string) => void) {
  return useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('code', {
        header: 'Cuenta',
        cell: (info) => {
          const row = info.row.original;
          const pad = row.level === 1 ? 'font-bold' : row.level === 2 ? 'pl-3 font-semibold' : 'pl-6';
          return (
            <button
              type="button"
              onClick={() => onSelectAccount(row.id)}
              title="Ver Tarjeta Auxiliar / Libro Mayor"
              className={`font-mono text-xs text-blue-800 hover:text-blue-950 underline decoration-dotted underline-offset-2 cursor-pointer ${pad}`}
            >
              {info.getValue()}
            </button>
          );
        }
      }),
      columnHelper.accessor('name', {
        header: 'Nombre de la Cuenta',
        cell: (info) => {
          const row = info.row.original;
          return (
            <button
              type="button"
              onClick={() => onSelectAccount(row.id)}
              className={`text-left hover:text-blue-800 cursor-pointer ${
                row.level === 1
                  ? 'font-bold text-slate-900 uppercase'
                  : row.level === 2
                  ? 'font-semibold text-slate-800'
                  : 'text-slate-700'
              }`}
            >
              {info.getValue()}
            </button>
          );
        }
      }),
      columnHelper.accessor('satGroupCode', {
        header: 'SAT',
        cell: (info) => (
          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
            {info.getValue()}
          </span>
        )
      }),
      columnHelper.accessor('nature', {
        header: 'Nat.',
        cell: (info) => (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              info.getValue() === 'DEUDORA'
                ? 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-slate-100 text-slate-800 border-slate-300'
            }`}
          >
            {info.getValue() === 'DEUDORA' ? 'D' : 'A'}
          </span>
        )
      }),
      columnHelper.accessor('initialBalanceComputed', {
        header: () => <div className="text-right">Saldo Inicial</div>,
        cell: (info) => (
          <div className="text-right font-mono text-slate-700">
            {formatCurrency(info.getValue())}
          </div>
        )
      }),
      columnHelper.accessor('periodCharges', {
        header: () => <div className="text-right">Cargos (Debe)</div>,
        cell: (info) => (
          <div className="text-right font-mono text-slate-900">
            {info.getValue() > 0 ? formatCurrency(info.getValue()) : '$0.00'}
          </div>
        )
      }),
      columnHelper.accessor('periodCredits', {
        header: () => <div className="text-right">Abonos (Haber)</div>,
        cell: (info) => (
          <div className="text-right font-mono text-slate-900">
            {info.getValue() > 0 ? formatCurrency(info.getValue()) : '$0.00'}
          </div>
        )
      }),
      columnHelper.accessor('finalBalance', {
        header: () => <div className="text-right">Saldo Final</div>,
        cell: (info) => {
          const row = info.row.original;
          return (
            <div
              className={`text-right font-mono ${
                row.level < 3 ? 'font-bold text-slate-900' : 'font-semibold text-blue-900'
              }`}
            >
              {formatCurrency(info.getValue())}
            </div>
          );
        }
      }),
      columnHelper.display({
        id: 'drilldown',
        header: () => <div className="text-right no-print">Auxiliar</div>,
        cell: (info) => (
          <div className="text-right no-print">
            <button
              type="button"
              onClick={() => onSelectAccount(info.row.original.id)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 cursor-pointer"
            >
              <BookOpen className="w-3 h-3" aria-hidden="true" />
              Mayor
            </button>
          </div>
        )
      })
    ]),
    [onSelectAccount]
  );
}
