import { CheckCircle2, ReceiptText } from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { BankReconciliationResponse } from '../../shared/types';

interface BankBookMovementsTableProps {
  reconData: BankReconciliationResponse;
  showOnlyPending?: boolean;
  highlightAmount?: number | null;
  selectedBookMovementId?: string | null;
  onSelectBookMovement?: (movementId: string) => void;
}

export function BankBookMovementsTable({
  reconData,
  showOnlyPending = false,
  highlightAmount = null,
  selectedBookMovementId = null,
  onSelectBookMovement
}: BankBookMovementsTableProps) {
  const visibleMovements = showOnlyPending
    ? reconData.bookMovements.filter((bm) => !bm.isMatched)
    : reconData.bookMovements;
  const totalCargos = visibleMovements.reduce((acc, bm) => acc + bm.cargoContable, 0);
  const totalAbonos = visibleMovements.reduce((acc, bm) => acc + bm.abonoContable, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            2. Movimientos Contables Registrados en Libros ({reconData.account.code})
          </h2>
          <p className="text-xs text-slate-600">
            Partidas contables en pólizas del periodo y su estatus de correspondencia con el banco
          </p>
        </div>
        <span className="text-[11px] font-mono text-slate-600">
          {visibleMovements.length} de {reconData.bookMovements.length} partidas
        </span>
      </div>

      <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
        <table className="w-full text-left border-collapse erp-sticky-table">
          <caption className="visually-hidden">
            Movimientos contables en libros de la cuenta bancaria
          </caption>
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <th scope="col" className="py-2.5 px-4 w-[110px]">Fecha</th>
              <th scope="col" className="py-2.5 px-4 w-[130px]">Póliza Contable</th>
              <th scope="col" className="py-2.5 px-4 w-[130px]">Referencia</th>
              <th scope="col" className="py-2.5 px-4 min-w-[200px]">Concepto en Libros</th>
              <th scope="col" className="py-2.5 px-4 w-[130px] text-right">Cargo (Entrada)</th>
              <th scope="col" className="py-2.5 px-4 w-[130px] text-right">Abono (Salida)</th>
              <th scope="col" className="py-2.5 px-4 w-[170px] text-center">Estatus en Banco</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {visibleMovements.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-600">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-2xs mb-2">
                    <ReceiptText className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <p className="font-bold text-slate-800 text-sm">
                    {showOnlyPending && reconData.bookMovements.length > 0
                      ? 'Sin partidas contables pendientes en libros'
                      : 'No se encontraron pólizas en esta cuenta bancaria'}
                  </p>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto mt-1">
                    {showOnlyPending && reconData.bookMovements.length > 0
                      ? 'Todas las partidas contables coinciden con movimientos bancarios.'
                      : 'Las pólizas registradas con afectación a esta cuenta contable aparecerán aquí automáticamente.'}
                  </p>
                </td>
              </tr>
            ) : (
              visibleMovements.map((bm) => {
                const amount = bm.cargoContable > 0 ? bm.cargoContable : bm.abonoContable;
                const isSelected = selectedBookMovementId === bm.movementId;
                const isCandidateMatch =
                  highlightAmount != null && !bm.isMatched && Math.abs(amount - highlightAmount) < 0.01;
                return (
                  <tr
                    key={bm.movementId}
                    tabIndex={!bm.isMatched && onSelectBookMovement ? 0 : undefined}
                    aria-selected={!bm.isMatched ? isSelected : undefined}
                    onClick={() => {
                      if (!bm.isMatched && onSelectBookMovement) onSelectBookMovement(bm.movementId);
                    }}
                    onKeyDown={(e) => {
                      if (!bm.isMatched && onSelectBookMovement && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onSelectBookMovement(bm.movementId);
                      }
                    }}
                    className={
                      isSelected
                        ? 'bg-emerald-100/80 ring-1 ring-inset ring-emerald-500 cursor-pointer'
                        : isCandidateMatch
                          ? 'bg-blue-50 ring-1 ring-inset ring-blue-300 cursor-pointer'
                          : !bm.isMatched && onSelectBookMovement
                            ? 'hover:bg-blue-50/40 cursor-pointer'
                            : 'hover:bg-blue-50/30'
                    }
                  >
                <td className="py-2.5 px-4 font-mono text-slate-600 w-[110px] whitespace-nowrap">
                  {formatShortDate(bm.fecha)}
                </td>
                <td className="py-2.5 px-4 font-mono font-bold text-blue-800 w-[130px] whitespace-nowrap">
                  {bm.polizaFolio}
                </td>
                <td className="py-2.5 px-4 font-mono text-slate-600 w-[130px] whitespace-nowrap">
                  {bm.referencia}
                </td>
                <td className="py-2.5 px-4 text-slate-800">{bm.concepto}</td>
                <td className="py-2.5 px-4 text-right font-mono text-slate-900 font-semibold w-[130px] whitespace-nowrap tabular-nums">
                  {bm.cargoContable > 0 ? formatCurrency(bm.cargoContable) : '—'}
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-slate-900 font-semibold w-[130px] whitespace-nowrap tabular-nums">
                  {bm.abonoContable > 0 ? formatCurrency(bm.abonoContable) : '—'}
                </td>
                <td className="py-2.5 px-4 text-center w-[170px] whitespace-nowrap">
                  {bm.isMatched ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      Cruzado con Banco
                    </span>
                  ) : isCandidateMatch ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                      Posible cruce
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200/80 text-slate-800 border border-slate-300">
                      En Tránsito
                    </span>
                  )}
                </td>
              </tr>
                );
              })
            )}
          </tbody>
          {visibleMovements.length > 0 && (
            <tfoot className="sticky bottom-0 z-10 bg-slate-100 [&_td]:bg-slate-100">
              <tr className="border-t-2 border-slate-300 font-mono text-xs font-bold text-slate-900">
                <td colSpan={4} className="py-2.5 px-4 font-sans text-right uppercase tracking-wider text-slate-700">
                  Totales Libros ({visibleMovements.length}):
                </td>
                <td className="py-2.5 px-4 text-right whitespace-nowrap tabular-nums">
                  {formatCurrency(totalCargos)}
                </td>
                <td className="py-2.5 px-4 text-right whitespace-nowrap tabular-nums">
                  {formatCurrency(totalAbonos)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
