import React from 'react';
import { AccountPickerCombobox } from '../../components/account-picker/AccountPickerCombobox';
import { formatCurrency } from '../../lib/formatters';
import type { Account } from '../../shared/types';
import type { DraftMovement } from './poliza-editor.types';
import { PolizaMovementAmountCells } from './PolizaMovementAmountCells';

export interface PolizaMovementRowProps {
  idx: number;
  mov: DraftMovement;
  movementsCount: number;
  accounts?: Account[];
  accountsById?: Map<string, Account>;
  affectableAccounts: Account[];
  cfdiUuids?: string[];
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
  cfdiUuids = [],
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
  const currentAcc = accountsById
    ? accountsById.get(mov.accountId)
    : accounts?.find((a) => a.id === mov.accountId);

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
              prev.map((item, i) => (i === idx ? { ...item, accountId: val } : item))
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
              prev.map((item, i) => (i === idx ? { ...item, referencia: val } : item))
            );
          }}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono focus:ring-1 focus:ring-blue-600 focus:outline-none"
        />
      </td>

      <td className="p-2 min-w-[220px] space-y-1">
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
              prev.map((item, i) => (i === idx ? { ...item, concepto: val } : item))
            );
          }}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
        />
        {cfdiUuids.length > 0 && (
          <select
            aria-label={`UUID CFDI partida ${idx + 1}`}
            value={mov.cfdiUuid ?? ''}
            onChange={(e) => {
              const val = e.target.value || null;
              setMovements((prev) =>
                prev.map((item, i) => (i === idx ? { ...item, cfdiUuid: val } : item))
              );
            }}
            className="w-full px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-[10px] font-mono text-slate-600"
          >
            <option value="">UUID: Predeterminado cabecera</option>
            {cfdiUuids.map((u) => (
              <option key={u} value={u}>
                CFDI: {u.slice(0, 14)}...
              </option>
            ))}
          </select>
        )}
      </td>

      <PolizaMovementAmountCells
        idx={idx}
        mov={mov}
        movementsCount={movementsCount}
        isLastRow={isLastRow}
        difference={difference}
        accountRefs={accountRefs}
        cargoRefs={cargoRefs}
        abonoRefs={abonoRefs}
        setMovements={setMovements}
        applyBalanceToRow={applyBalanceToRow}
        addIva16Line={addIva16Line}
        onRowFocus={onRowFocus}
        onDeleteRow={onDeleteRow}
        autoBalanceDifference={autoBalanceDifference}
        onLastRowSubmitFocus={onLastRowSubmitFocus}
      />
    </tr>
  );
});
