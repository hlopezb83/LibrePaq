import { CheckCircle2, ReceiptText } from 'lucide-react';
import { EmptyState, StatusBadge } from '../../components/ui';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { BankReconciliationResponse } from '../../shared/types';

interface BankBookMovementsTableProps {
  reconData: BankReconciliationResponse;
  showOnlyPending?: boolean;
  highlightAmount?: number | null;
  selectedBookMovementIds?: ReadonlySet<string>;
  onToggleBookMovement?: (movementId: string) => void;
  selectedBookMovementId?: string | null;
  onSelectBookMovement?: (movementId: string) => void;
}

export function BankBookMovementsTable({
  reconData,
  showOnlyPending = false,
  highlightAmount = null,
  selectedBookMovementIds,
  onToggleBookMovement,
  selectedBookMovementId = null,
  onSelectBookMovement
}: BankBookMovementsTableProps) {
  const toggleMov = onToggleBookMovement ?? onSelectBookMovement;
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
            Marca una partida para cruce 1:1 o varias partidas con casilla para cruce manual N:1 sin tope
          </p>
        </div>
        <span className="text-[11px] font-mono text-slate-600">
          {visibleMovements.length} de {reconData.bookMovements.length} partidas
        </span>
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label="Tabla de movimientos contables en libros"
        className="overflow-x-auto max-h-[380px] overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-600"
      >
        <table className="w-full text-left border-collapse erp-sticky-table">
          <caption className="visually-hidden">
            Movimientos contables en libros de la cuenta bancaria
          </caption>
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              {toggleMov && (
                <th scope="col" className="py-2.5 px-2.5 w-10 text-center">
                  <span className="visually-hidden">Selección múltiple</span>
                </th>
              )}
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
                <td colSpan={toggleMov ? 8 : 7}>
                  <EmptyState
                    icon={<ReceiptText className="w-6 h-6" aria-hidden="true" />}
                    tone="blue"
                    title={
                      showOnlyPending && reconData.bookMovements.length > 0
                        ? 'Sin partidas contables pendientes en libros'
                        : 'No se encontraron pólizas en esta cuenta bancaria'
                    }
                    description={
                      showOnlyPending && reconData.bookMovements.length > 0
                        ? 'Todas las partidas contables coinciden con movimientos bancarios.'
                        : 'Las pólizas registradas con afectación a esta cuenta contable aparecerán aquí automáticamente.'
                    }
                  />
                </td>
              </tr>
            ) : (
              visibleMovements.map((bm) => {
                const amount = bm.cargoContable > 0 ? bm.cargoContable : bm.abonoContable;
                const isSelected = selectedBookMovementIds
                  ? selectedBookMovementIds.has(bm.movementId)
                  : selectedBookMovementId === bm.movementId;
                const isCandidateMatch =
                  highlightAmount != null && !bm.isMatched && Math.abs(amount - highlightAmount) < 0.01;
                return (
                  <tr
                    key={bm.movementId}
                    tabIndex={!bm.isMatched && toggleMov ? 0 : undefined}
                    aria-selected={!bm.isMatched && toggleMov ? isSelected : undefined}
                    aria-label={
                      !bm.isMatched && toggleMov
                        ? `${isSelected ? 'Deseleccionar' : 'Seleccionar'} partida contable ${bm.polizaFolio} por ${formatCurrency(amount)} para cruce manual`
                        : undefined
                    }
                    onClick={() => {
                      if (!bm.isMatched && toggleMov) toggleMov(bm.movementId);
                    }}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (!bm.isMatched && toggleMov && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        toggleMov(bm.movementId);
                      }
                    }}
                    className={
                      isSelected
                        ? 'bg-emerald-100/80 ring-1 ring-inset ring-emerald-500 cursor-pointer'
                        : isCandidateMatch
                          ? 'bg-blue-50 ring-1 ring-inset ring-blue-300 cursor-pointer'
                          : !bm.isMatched && toggleMov
                            ? 'hover:bg-blue-50/40 cursor-pointer'
                            : 'hover:bg-blue-50/30'
                    }
                  >
                    {toggleMov && (
                      <td className="py-2.5 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        {!bm.isMatched && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleMov(bm.movementId)}
                            aria-label={`Marcar ${bm.polizaFolio} (${formatCurrency(amount)}) para cruce`}
                            className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                          />
                        )}
                      </td>
                    )}
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
                        <StatusBadge tone="emerald" icon={<CheckCircle2 className="w-3 h-3" aria-hidden="true" />}>
                          Cruzado con Banco
                        </StatusBadge>
                      ) : isCandidateMatch ? (
                        <StatusBadge tone="blue">Posible cruce</StatusBadge>
                      ) : (
                        <StatusBadge tone="slate">En Tránsito</StatusBadge>
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
                <td colSpan={toggleMov ? 5 : 4} className="py-2.5 px-4 font-sans text-right uppercase tracking-wider text-slate-700">
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
