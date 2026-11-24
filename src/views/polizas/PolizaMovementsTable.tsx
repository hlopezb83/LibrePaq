import React from 'react';
import { Calculator, Plus, Scale, Zap } from 'lucide-react';
import { Button } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';
import type { Account, CfdiDocument } from '../../shared/types';
import type { DraftMovement } from './poliza-editor.types';
import { PolizaMovementRow } from './PolizaMovementRow';

interface PolizaMovementsTableProps {
  movements: DraftMovement[];
  setMovements: React.Dispatch<React.SetStateAction<DraftMovement[]>>;
  accounts: Account[];
  affectableAccounts: Account[];
  cfdiUuids?: string[];
  allCfdis?: CfdiDocument[];
  concepto: string;
  difference: number;
  totalCargos: number;
  totalAbonos: number;
  accountRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  referenciaRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  conceptoRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  cargoRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  abonoRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  addIva16Line: (idx: number) => void;
  autoBalanceDifference: () => void;
  applyBalanceToRow: (idx: number, type: 'cargo' | 'abono') => void;
  onLastRowSubmitFocus: () => void;
}

export function PolizaMovementsTable({
  movements,
  setMovements,
  accounts,
  affectableAccounts,
  cfdiUuids = [],
  allCfdis = [],
  concepto,
  difference,
  totalCargos,
  totalAbonos,
  accountRefs,
  referenciaRefs,
  conceptoRefs,
  cargoRefs,
  abonoRefs,
  addIva16Line,
  autoBalanceDifference,
  applyBalanceToRow,
  onLastRowSubmitFocus
}: PolizaMovementsTableProps) {
  const [activeRowIdx, setActiveRowIdx] = React.useState(0);
  const prevLengthRef = React.useRef(movements.length);

  React.useEffect(() => {
    if (movements.length > prevLengthRef.current) {
      const targetIdx = movements.length - 1;
      requestAnimationFrame(() => {
        accountRefs.current[targetIdx]?.focus();
        accountRefs.current[targetIdx]?.select();
      });
    }
    prevLengthRef.current = movements.length;
  }, [movements.length, accountRefs]);

  const handleDeleteRow = React.useCallback(
    (idx: number) => {
      setMovements((prev) => prev.filter((_, i) => i !== idx));
      const fallbackIdx = Math.max(0, idx - 1);
      requestAnimationFrame(() => {
        accountRefs.current[fallbackIdx]?.focus();
      });
    },
    [setMovements, accountRefs]
  );

  const accountsById = React.useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const cfdisByUuid = React.useMemo(
    () => new Map(allCfdis.map((c) => [c.uuid.toUpperCase(), c])),
    [allCfdis]
  );

  return (
    <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs w-full min-w-0 max-w-full">
      <div className="bg-slate-50 px-3 sm:px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800">
            Movimientos Contables (<span className="font-mono tabular-nums">{movements.length}</span> partidas)
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            • Pulsa <kbd className="bg-white px-1 py-0.5 rounded border border-slate-200 font-bold">=</kbd> para cuadrar
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="export-outline"
            size="sm"
            onClick={() => addIva16Line(Math.min(activeRowIdx, movements.length - 1))}
            title="Calcula el 16% de IVA sobre la partida activa (atajo F4) y genera el asiento automáticamente"
            leftIcon={<Calculator className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            Desglosar IVA 16% (F4)
          </Button>

          {Math.abs(difference) >= 0.01 && (
            <button
              type="button"
              onClick={autoBalanceDifference}
              title="Genera o completa la partida de contrapartida para igualar Cargos y Abonos"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 cursor-pointer transition font-mono tabular-nums"
            >
              <Scale className="w-3.5 h-3.5" aria-hidden="true" />
              <Zap className="w-3 h-3" aria-hidden="true" />
              <span>Cuadrar Asiento ({formatCurrency(Math.abs(difference))})</span>
            </button>
          )}

          <Button
            variant="secondary"
            size="sm"
            className="bg-blue-50! text-blue-800! border-blue-200! hover:bg-blue-100!"
            leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
            onClick={() =>
              setMovements((prev) => [
                ...prev,
                {
                  _rowId: crypto.randomUUID(),
                  accountId: affectableAccounts[0]?.id || '',
                  referencia: prev[prev.length - 1]?.referencia || 'REF',
                  concepto: prev[prev.length - 1]?.concepto || concepto,
                  cargo: 0,
                  abono: 0
                }
              ])
            }
          >
            Agregar Partida
          </Button>
        </div>
      </div>

      <div className="w-full min-w-0 max-w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="visually-hidden">Partidas del asiento contable en captura</caption>
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-slate-50/90">
              <th scope="col" className="py-2.5 px-3 min-w-[280px]">
                Cuenta Contable Afectable (Buscar Código o Nombre)
              </th>
              <th scope="col" className="py-2.5 px-3 w-28">Referencia</th>
              <th scope="col" className="py-2.5 px-3 min-w-[220px]">Concepto del Movimiento</th>
              <th scope="col" className="py-2.5 px-3 w-36 text-right">Cargo (Debe)</th>
              <th scope="col" className="py-2.5 px-3 w-36 text-right">Abono (Haber)</th>
              <th scope="col" className="py-2.5 px-2 w-10 text-center">
                <span className="visually-hidden">Quitar</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {movements.map((mov, idx) => (
              <PolizaMovementRow
                key={mov._rowId || `mov-${idx}`}
                idx={idx}
                mov={mov}
                movementsCount={movements.length}
                accounts={accounts}
                accountsById={accountsById}
                affectableAccounts={affectableAccounts}
                cfdiUuids={cfdiUuids}
                cfdisByUuid={cfdisByUuid}
                concepto={concepto}
                difference={difference}
                referenciaRefs={referenciaRefs}
                accountRefs={accountRefs}
                conceptoRefs={conceptoRefs}
                cargoRefs={cargoRefs}
                abonoRefs={abonoRefs}
                setMovements={setMovements}
                applyBalanceToRow={applyBalanceToRow}
                addIva16Line={addIva16Line}
                onRowFocus={setActiveRowIdx}
                onDeleteRow={handleDeleteRow}
                autoBalanceDifference={autoBalanceDifference}
                onLastRowSubmitFocus={onLastRowSubmitFocus}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200 font-mono tabular-nums text-xs font-bold">
              <td colSpan={3} className="py-2.5 px-4 text-right text-slate-700">
                Sumas Iguales (Partida Doble):
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-slate-900">{formatCurrency(totalCargos)}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-slate-900">{formatCurrency(totalAbonos)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
