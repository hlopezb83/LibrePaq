import { CheckCircle2, ReceiptText } from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { BankReconciliationResponse } from '../../shared/types';

interface BankBookMovementsTableProps {
  reconData: BankReconciliationResponse;
}

export function BankBookMovementsTable({ reconData }: BankBookMovementsTableProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            2. Movimientos Contables Registrados en Libros ({reconData.account.code})
          </h2>
          <p className="text-xs text-slate-500">
            Partidas contables en pólizas del periodo y su estatus de correspondencia con el banco
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse erp-sticky-table">
          <caption className="visually-hidden">
            Movimientos contables en libros de la cuenta bancaria
          </caption>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <th scope="col" className="py-2.5 px-4 w-[110px]">Fecha</th>
              <th scope="col" className="py-2.5 px-4 w-[130px]">Póliza Contable</th>
              <th scope="col" className="py-2.5 px-4 w-[130px]">Referencia</th>
              <th scope="col" className="py-2.5 px-4 min-w-[200px]">Concepto en Libros</th>
              <th scope="col" className="py-2.5 px-4 w-[130px] text-right">Cargo (Entrada)</th>
              <th scope="col" className="py-2.5 px-4 w-[130px] text-right">Abono (Salida)</th>
              <th scope="col" className="py-2.5 px-4 w-[150px] text-center">Estatus en Banco</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {reconData.bookMovements.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-2xs mb-2">
                    <ReceiptText className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <p className="font-bold text-slate-800 text-sm">No se encontraron pólizas en esta cuenta bancaria</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Las pólizas registradas con afectación a esta cuenta contable aparecerán aquí automáticamente.
                  </p>
                </td>
              </tr>
            ) : (
              reconData.bookMovements.map((bm) => (
                <tr key={bm.movementId} className="hover:bg-blue-50/30">
                <td className="py-2.5 px-4 font-mono text-slate-600 w-[110px]">
                  {formatShortDate(bm.fecha)}
                </td>
                <td className="py-2.5 px-4 font-mono font-bold text-blue-800 w-[130px]">
                  {bm.polizaFolio}
                </td>
                <td className="py-2.5 px-4 font-mono text-slate-600 w-[130px]">
                  {bm.referencia}
                </td>
                <td className="py-2.5 px-4 text-slate-800">{bm.concepto}</td>
                <td className="py-2.5 px-4 text-right font-mono text-slate-900 font-semibold w-[130px]">
                  {bm.cargoContable > 0 ? formatCurrency(bm.cargoContable) : '—'}
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-slate-900 font-semibold w-[130px]">
                  {bm.abonoContable > 0 ? formatCurrency(bm.abonoContable) : '—'}
                </td>
                <td className="py-2.5 px-4 text-center w-[150px]">
                  {bm.isMatched ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      Cruzado con Banco
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      En Tránsito
                    </span>
                  )}
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
