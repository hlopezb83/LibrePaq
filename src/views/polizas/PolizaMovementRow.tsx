import React from 'react';
import { Trash2, Zap } from 'lucide-react';
import { AccountPickerCombobox } from '../../components/account-picker/AccountPickerCombobox';
import { formatCurrency } from '../../lib/formatters';
import type { Account } from '../../shared/types';
import type { DraftMovement } from './poliza-editor.types';

export interface PolizaMovementRowProps {
  idx: number;
  mov: DraftMovement;
  movementsCount: number;
  accounts?: Account[];
  accountsById?: Map<string, Account>;
  affectableAccounts: Account[];
  concepto: string;
  difference: number;
  accountRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  referenciaRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  conceptoRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  cargoRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  abonoRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  setMovements: React.Dispatch<React.SetStateAction<DraftMovement[]>>;
  applyBalanceToRow: (idx: number, type: 'cargo' | 'abono') => void;
  addIva16Line: (idx: number) => void;
  onRowFocus: (idx: number) => void;
  onDeleteRow: (idx: number) => void;
  autoBalanceDifference: () => void;
  onLastRowSubmitFocus: () => void;
}

export const PolizaMovementRow = React.memo(function PolizaMovementRow({
  idx,
  mov,
  movementsCount,
  accounts,
  accountsById,
  affectableAccounts,
  concepto,
  difference,
  accountRefs,
  referenciaRefs,
  conceptoRefs,
  cargoRefs,
  abonoRefs,
  setMovements,
  applyBalanceToRow,
  addIva16Line,
  onRowFocus,
  onDeleteRow,
  autoBalanceDifference,
  onLastRowSubmitFocus
}: PolizaMovementRowProps) {
  const isLastRow = idx === movementsCount - 1;
  const currentAcc = accountsById ? accountsById.get(mov.accountId) : accounts?.find((a) => a.id === mov.accountId);

  return (
    <tr className="hover:bg-slate-50/70 transition">
      <td className="p-2 min-w-[280px]">
        <AccountPickerCombobox
          accounts={affectableAccounts}
          value={mov.accountId}
          onInputRef={(el) => {
            accountRefs.current[idx] = el;
          }}
          onChange={(val) => {
            setMovements((prev) =>
              prev.map((item, i) =>
                i === idx ? { ...item, accountId: val } : item
              )
            );
          }}
          onAdvance={() => {
            referenciaRefs.current[idx]?.focus();
            referenciaRefs.current[idx]?.select();
          }}
          ariaLabel={`Cuenta contable partida ${idx + 1}`}
        />
        {currentAcc && (
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
            <span>
              Saldo:{' '}
              <strong className="text-slate-800">
                {formatCurrency(
                  'finalBalance' in currentAcc && typeof currentAcc.finalBalance === 'number'
                    ? currentAcc.finalBalance
                    : currentAcc.initialBalance
                )}
              </strong>
            </span>
            <span>•</span>
            <span
              className={`font-semibold ${
                currentAcc.nature === 'DEUDORA' ? 'text-emerald-700' : 'text-blue-700'
              }`}
            >
              Naturaleza {currentAcc.nature}
            </span>
            {currentAcc.satGroupCode && (
              <>
                <span>•</span>
                <span className="text-slate-500">SAT {currentAcc.satGroupCode}</span>
              </>
            )}
          </div>
        )}
      </td>

      <td className="p-2 w-28">
        <input
          ref={(el) => {
            referenciaRefs.current[idx] = el;
          }}
          type="text"
          aria-label={`Referencia partida ${idx + 1}`}
          value={mov.referencia}
          placeholder="REF"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              conceptoRefs.current[idx]?.focus();
              conceptoRefs.current[idx]?.select();
            } else if (e.key === '"' || e.key === 'F3') {
              e.preventDefault();
              setMovements((prev) =>
                prev.map((item, i) =>
                  i === idx
                    ? { ...item, referencia: idx > 0 ? prev[idx - 1]?.referencia || 'REF-01' : 'REF-01' }
                    : item
                )
              );
            }
          }}
          onChange={(e) => {
            const val = e.target.value;
            setMovements((prev) =>
              prev.map((item, i) =>
                i === idx ? { ...item, referencia: val } : item
              )
            );
          }}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-blue-600 focus:outline-none"
        />
      </td>

      <td className="p-2 min-w-[220px]">
        <input
          ref={(el) => {
            conceptoRefs.current[idx] = el;
          }}
          type="text"
          aria-label={`Concepto partida ${idx + 1}`}
          value={mov.concepto}
          placeholder={concepto || 'Concepto...'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (currentAcc?.nature === 'ACREEDORA') {
                abonoRefs.current[idx]?.focus();
                abonoRefs.current[idx]?.select();
              } else {
                cargoRefs.current[idx]?.focus();
                cargoRefs.current[idx]?.select();
              }
            } else if (e.key === '"' || e.key === 'F3') {
              e.preventDefault();
              setMovements((prev) =>
                prev.map((item, i) =>
                  i === idx
                    ? { ...item, concepto: idx > 0 ? prev[idx - 1]?.concepto || concepto : concepto }
                    : item
                )
              );
            }
          }}
          onChange={(e) => {
            const val = e.target.value;
            setMovements((prev) =>
              prev.map((item, i) =>
                i === idx ? { ...item, concepto: val } : item
              )
            );
          }}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
        />
      </td>

      <td className="p-2 w-36 text-right">
        <input
          ref={(el) => {
            cargoRefs.current[idx] = el;
          }}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          aria-label={`Cargo partida ${idx + 1}`}
          value={mov.cargo || ''}
          placeholder="0.00"
          onFocus={() => onRowFocus(idx)}
          onKeyDown={(e) => {
            if (e.key === 'F4') {
              e.preventDefault();
              addIva16Line(idx);
              return;
            }
            if (['e', 'E', '+', '-'].includes(e.key)) {
              e.preventDefault();
              return;
            }
            if (e.key === '=' || e.key === ' ') {
              if (difference < 0 && (!mov.cargo || mov.cargo === 0)) {
                e.preventDefault();
                applyBalanceToRow(idx, 'cargo');
                return;
              }
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              if (mov.cargo > 0) {
                if (isLastRow) {
                  if (Math.abs(difference) >= 0.01) autoBalanceDifference();
                  else onLastRowSubmitFocus();
                } else {
                  accountRefs.current[idx + 1]?.focus();
                  accountRefs.current[idx + 1]?.select();
                }
              } else {
                abonoRefs.current[idx]?.focus();
                abonoRefs.current[idx]?.select();
              }
            }
          }}
          onChange={(e) => {
            const val = Number(e.target.value || 0);
            setMovements((prev) =>
              prev.map((item, i) =>
                i === idx
                  ? { ...item, cargo: val, abono: val > 0 ? 0 : item.abono }
                  : item
              )
            );
          }}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono text-right focus:ring-1 focus:ring-blue-600 focus:outline-none"
        />
        {difference < 0 && !mov.cargo && !mov.abono && (
          <button
            type="button"
            onClick={() => applyBalanceToRow(idx, 'cargo')}
            title="Pulsa = o clic para cuadrar este cargo"
            className="mt-1 w-full text-[10px] font-mono font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-1 py-0.5 rounded cursor-pointer flex items-center justify-center gap-1 transition shadow-2xs"
          >
            <Zap className="w-3 h-3" aria-hidden="true" />
            <span>Cuadrar</span>
            <span>{formatCurrency(Math.abs(difference))}</span>
          </button>
        )}
      </td>

      <td className="p-2 w-36 text-right">
        <input
          ref={(el) => {
            abonoRefs.current[idx] = el;
          }}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          aria-label={`Abono partida ${idx + 1}`}
          value={mov.abono || ''}
          placeholder="0.00"
          onFocus={() => onRowFocus(idx)}
          onKeyDown={(e) => {
            if (e.key === 'F4') {
              e.preventDefault();
              addIva16Line(idx);
              return;
            }
            if (['e', 'E', '+', '-'].includes(e.key)) {
              e.preventDefault();
              return;
            }
            if (e.key === '=' || e.key === ' ') {
              if (difference > 0 && (!mov.abono || mov.abono === 0)) {
                e.preventDefault();
                applyBalanceToRow(idx, 'abono');
                return;
              }
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              if (isLastRow) {
                if (Math.abs(difference) >= 0.01) {
                  autoBalanceDifference();
                } else {
                  onLastRowSubmitFocus();
                }
              } else {
                accountRefs.current[idx + 1]?.focus();
                accountRefs.current[idx + 1]?.select();
              }
            }
          }}
          onChange={(e) => {
            const val = Number(e.target.value || 0);
            setMovements((prev) =>
              prev.map((item, i) =>
                i === idx
                  ? { ...item, abono: val, cargo: val > 0 ? 0 : item.cargo }
                  : item
              )
            );
          }}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono text-right focus:ring-1 focus:ring-blue-600 focus:outline-none"
        />
        {difference > 0 && !mov.cargo && !mov.abono && (
          <button
            type="button"
            onClick={() => applyBalanceToRow(idx, 'abono')}
            title="Pulsa = o clic para cuadrar este abono"
            className="mt-1 w-full text-[10px] font-mono font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-1 py-0.5 rounded cursor-pointer flex items-center justify-center gap-1 transition shadow-2xs"
          >
            <Zap className="w-3 h-3" aria-hidden="true" />
            <span>Cuadrar</span>
            <span>{formatCurrency(difference)}</span>
          </button>
        )}
      </td>

      <td className="p-2 text-center w-10">
        {movementsCount > 2 && (
          <button
            type="button"
            aria-label={`Eliminar partida ${idx + 1}`}
            onClick={() => onDeleteRow(idx)}
            className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1 text-slate-600 hover:text-red-700 cursor-pointer rounded hover:bg-red-50 transition"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </td>
    </tr>
  );
});
