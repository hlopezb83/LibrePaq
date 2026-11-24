import React from 'react';
import { CheckCircle2, Loader2, Lock, Sparkles } from 'lucide-react';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import type { AccountType, AccountWithBalance, Company } from '../../shared/types';
import { AccountEditorHeader } from './AccountEditorHeader';
import { isValidAccountMask } from './catalogoCsvIo';
import { SatGroupCodePicker } from './SatGroupCodePicker';

export interface AccountEditorModalProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  editingAccountId: string | null;
  editingIsAffectable?: boolean;
  isJanLocked?: boolean;
  activeCompany?: Company | null;
  currentYear?: number;
  formError: string | null;
  parentCode: string;
  setParentCode: (code: string) => void;
  parentAccounts: AccountWithBalance[];
  accounts: AccountWithBalance[];
  code: string;
  setCode: (code: string) => void;
  name: string;
  setName: (name: string) => void;
  satGroupCode: string;
  setSatGroupCode: (val: string) => void;
  type: AccountType;
  setType: (t: AccountType) => void;
  nature: 'DEUDORA' | 'ACREEDORA';
  setNature: (n: 'DEUDORA' | 'ACREEDORA') => void;
  setLevel: (l: number) => void;
  initialBalanceRaw: string;
  setInitialBalanceRaw: (val: string) => void;
  suggestNextCodeForParent: (pCode: string) => string;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  isWriteBlocked?: boolean;
}

export function AccountEditorModal({
  dialogRef, editingAccountId, editingIsAffectable = true, isJanLocked = false,
  activeCompany, currentYear, formError, parentCode, setParentCode,
  parentAccounts, accounts, code, setCode, name, setName,
  satGroupCode, setSatGroupCode, type, setType, nature, setNature,
  setLevel, initialBalanceRaw, setInitialBalanceRaw,
  suggestNextCodeForParent, onClose, onSave, isSaving, isWriteBlocked = false
}: AccountEditorModalProps) {
  useDialogLightDismiss(dialogRef, onClose);
  const selectedParent = parentCode ? accounts.find((a) => a.code === parentCode) : undefined;
  const computedLevel = Math.min(4, selectedParent ? selectedParent.level + 1 : 1);
  const parentHasActivity = Boolean(
    selectedParent &&
      (selectedParent.periodCharges > 0 ||
        selectedParent.periodCredits > 0 ||
        Math.abs(selectedParent.initialBalanceComputed) >= 0.01 ||
        Math.abs(selectedParent.initialBalance) >= 0.01)
  );
  const hasBlockedAffectableParent = Boolean(
    !editingAccountId && selectedParent?.isAffectable && parentHasActivity
  );
  const trimmedCode = code.trim();
  const isDuplicateCode = Boolean(!editingAccountId && trimmedCode && accounts.some((a) => a.code === trimmedCode));
  const isMaskInvalid = Boolean(!editingAccountId && trimmedCode && !isValidAccountMask(trimmedCode));

  const isAccumulative = editingAccountId ? !editingIsAffectable : computedLevel < 3;
  const isFinancialFieldsLocked = Boolean(
    (editingAccountId && isJanLocked) || isAccumulative
  );
  const financialLockBadge = editingAccountId && isJanLocked
    ? 'Enero cerrado'
    : isAccumulative
    ? 'Cuenta acumuladora'
    : null;

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="modal-account-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-xl max-h-[92dvh] open:flex open:flex-col overflow-hidden backdrop:bg-slate-900/60 p-0 m-auto"
    >
      <AccountEditorHeader
        editingAccountId={editingAccountId}
        activeCompany={activeCompany}
        currentYear={currentYear}
        onClose={onClose}
      />

      <form
        method="post"
        onSubmit={(e) => {
          e.preventDefault();
          if (isWriteBlocked || isSaving || hasBlockedAffectableParent || isDuplicateCode || isMaskInvalid) return;
          onSave();
        }}
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-3.5">
          {hasBlockedAffectableParent && selectedParent && (
            <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900">
              La cuenta padre <strong className="font-mono">{selectedParent.code}</strong> es afectable y ya tiene movimientos o saldo inicial. Elige una acumuladora.
            </div>
          )}
          {!editingAccountId && selectedParent?.isAffectable && !parentHasActivity && (
            <div role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              La cuenta padre <strong className="font-mono">{selectedParent.code}</strong> pasará a ser acumuladora al crear esta subcuenta.
            </div>
          )}
          {formError && (
            <div role="alert" aria-live="polite" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="acc-parent" className="block text-xs font-semibold text-slate-700 mb-1">
                Subcuenta de (Cuenta Padre)
              </label>
              <select
                id="acc-parent"
                disabled={Boolean(editingAccountId)}
                value={parentCode}
                onChange={(e) => {
                  const pCode = e.target.value;
                  setParentCode(pCode);
                  const parentObj = accounts.find((a) => a.code === pCode);
                  if (parentObj) {
                    setType(parentObj.type);
                    setNature(parentObj.nature);
                    setLevel(Math.min(4, parentObj.level + 1));
                    if (parentObj.satGroupCode) setSatGroupCode(parentObj.satGroupCode);
                    setCode(suggestNextCodeForParent(pCode));
                  } else {
                    setLevel(1);
                  }
                }}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white font-mono disabled:bg-slate-100"
              >
                <option value="">-- Rubro Principal (Nivel 1) --</option>
                {parentAccounts.map((pa) => (
                  <option key={pa.id} value={pa.code}>
                    [N{pa.level}] {pa.code} - {pa.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <label htmlFor="acc-code" className="block text-xs font-semibold text-slate-700">
                  Código ({activeCompany?.maskFormat || 'XXX-XX-XXX'}) *
                </label>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                  computedLevel >= 3
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  N{computedLevel} · {computedLevel >= 3 ? 'Afectable' : 'Mayor'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  id="acc-code"
                  type="text"
                  required
                  aria-invalid={isDuplicateCode || isMaskInvalid}
                  disabled={Boolean(editingAccountId)}
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-sm font-mono disabled:bg-slate-100 ${
                    isDuplicateCode || isMaskInvalid ? 'border-red-500 ring-1 ring-red-400' : 'border-slate-300'
                  }`}
                />
                {!editingAccountId && (
                  <button
                    type="button"
                    onClick={() => setCode(suggestNextCodeForParent(parentCode))}
                    title="Sugerir siguiente código disponible"
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-semibold cursor-pointer shrink-0"
                  >
                    <Sparkles className="w-3 h-3" aria-hidden="true" />
                    Sugerir
                  </button>
                )}
              </div>
              {isDuplicateCode && (
                <p role="alert" className="text-[11px] text-red-700 font-semibold mt-1">
                  El código {trimmedCode} ya existe en el catálogo.
                </p>
              )}
              {!isDuplicateCode && isMaskInvalid && (
                <p role="alert" className="text-[11px] text-red-700 font-semibold mt-1">
                  Usa segmentos alfanuméricos separados por guion (ej. 601-01-006).
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="acc-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Nombre de la Cuenta Contable *
            </label>
            <input
              id="acc-name"
              type="text"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Publicidad y Marketing Digital"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <SatGroupCodePicker
            value={satGroupCode}
            onSelect={(found, rawCode) => {
              setSatGroupCode(rawCode);
              if (found && !isFinancialFieldsLocked) {
                setType(found.type);
                setNature(found.nature);
              }
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="acc-type" className="block text-xs font-semibold text-slate-700 mb-1">
                Rubro Contable
              </label>
              <select
                id="acc-type"
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="ACTIVO">ACTIVO</option>
                <option value="PASIVO">PASIVO</option>
                <option value="CAPITAL">CAPITAL</option>
                <option value="INGRESOS">INGRESOS</option>
                <option value="COSTOS">COSTOS</option>
                <option value="GASTOS">GASTOS</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <label htmlFor="acc-nature" className="block text-xs font-semibold text-slate-700">
                  Naturaleza
                </label>
                {financialLockBadge && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                    <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                    {financialLockBadge}
                  </span>
                )}
              </div>
              <select
                id="acc-nature"
                disabled={isFinancialFieldsLocked}
                value={nature}
                onChange={(e) => setNature(e.target.value as 'DEUDORA' | 'ACREEDORA')}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="DEUDORA">DEUDORA (Cargos +)</option>
                <option value="ACREEDORA">ACREEDORA (Abonos +)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <label htmlFor="acc-init-bal" className="block text-xs font-semibold text-slate-700">
                  Saldo Apertura
                </label>
                {financialLockBadge && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                    <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                    Bloqueado
                  </span>
                )}
              </div>
              <input
                id="acc-init-bal"
                type="text"
                inputMode="decimal"
                disabled={isFinancialFieldsLocked}
                value={initialBalanceRaw}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9.-]/g, '');
                  setInitialBalanceRaw(cleaned);
                }}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-right disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving || isWriteBlocked || hasBlockedAffectableParent || isDuplicateCode || isMaskInvalid}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{isSaving ? 'Guardando...' : editingAccountId ? 'Guardar Cambios' : 'Crear Cuenta'}</span>
          </button>
        </div>
      </form>
    </dialog>
  );
}
