import React from 'react';
import { CheckCircle2, Layers, X } from 'lucide-react';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import type { AccountType, AccountWithBalance, Company } from '../../shared/types';
import { SatGroupCodePicker } from './SatGroupCodePicker';

export interface AccountEditorModalProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  editingAccountId: string | null;
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
  initialBalance: number;
  setInitialBalance: (b: number) => void;
  suggestNextCodeForParent: (pCode: string) => string;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  isWriteBlocked?: boolean;
}

export function AccountEditorModal({
  dialogRef, editingAccountId, activeCompany, currentYear, formError,
  parentCode, setParentCode, parentAccounts, accounts, code, setCode,
  name, setName, satGroupCode, setSatGroupCode, type, setType,
  nature, setNature, setLevel, initialBalance, setInitialBalance,
  suggestNextCodeForParent, onClose, onSave, isSaving, isWriteBlocked = false
}: AccountEditorModalProps) {
  useDialogLightDismiss(dialogRef, onClose);
  const selectedParent = parentCode
    ? accounts.find((a) => a.code === parentCode)
    : undefined;
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

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="modal-account-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-xl max-h-[92dvh] flex flex-col overflow-hidden backdrop:bg-slate-900/60 p-0 m-auto"
    >
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="modal-account-title" className="text-base font-bold text-slate-900">
                {editingAccountId ? 'Editar Cuenta Contable' : 'Nueva Cuenta Contable'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-slate-600">
                <span className="font-bold text-slate-800">{activeCompany?.name}</span>
                <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 text-[11px] font-bold">
                  {activeCompany?.rfc}
                </span>
                <span className="text-slate-400">•</span>
                <span className="font-mono text-[11px] text-blue-700 font-semibold">
                  Ejercicio {currentYear}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form
          method="post"
          onSubmit={(e) => {
            e.preventDefault();
            if (isWriteBlocked || isSaving || hasBlockedAffectableParent) return;
            onSave();
          }}
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
        >
          <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-3.5">
          {hasBlockedAffectableParent && selectedParent && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900"
            >
              La cuenta padre <strong className="font-mono">{selectedParent.code}</strong> es afectable y ya tiene movimientos o saldo inicial. Para evitar doble conteo (2×), elige una cuenta acumuladora o reclasifica sus movimientos primero.
            </div>
          )}
          {!editingAccountId && selectedParent?.isAffectable && !parentHasActivity && (
            <div
              role="status"
              className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900"
            >
              La cuenta padre <strong className="font-mono">{selectedParent.code}</strong> se convertirá automáticamente en cuenta acumuladora (no afectable) al crear esta subcuenta.
            </div>
          )}
          {formError && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800"
            >
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="acc-parent"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
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
                <label
                  htmlFor="acc-code"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Código de Cuenta ({activeCompany?.maskFormat || 'XXX-XX-XXX'}) *
                </label>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                  computedLevel >= 3
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  N{computedLevel} · {computedLevel >= 3 ? 'Afectable' : 'Mayor'}
                </span>
              </div>
              <input
                id="acc-code"
                type="text"
                required
                pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*"
                title="Código jerárquico compatible con máscara CONTPAQi (ej. 601-01-006, 6010-001-0001 o 102-01-01-001)"
                disabled={Boolean(editingAccountId)}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono disabled:bg-slate-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="acc-name"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
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
              if (found) {
                setType(found.type);
                setNature(found.nature);
              }
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="acc-type"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
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
              <label
                htmlFor="acc-nature"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Naturaleza
              </label>
              <select
                id="acc-nature"
                value={nature}
                onChange={(e) => setNature(e.target.value as 'DEUDORA' | 'ACREEDORA')}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="DEUDORA">DEUDORA (Cargos +)</option>
                <option value="ACREEDORA">ACREEDORA (Abonos +)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="acc-init-bal"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Saldo Apertura Ejercicio
              </label>
              <input
                id="acc-init-bal"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={initialBalance}
                onChange={(e) => setInitialBalance(Number(e.target.value || 0))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
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
              disabled={isSaving || isWriteBlocked || hasBlockedAffectableParent}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              {isSaving ? 'Guardando...' : editingAccountId ? 'Guardar Cambios' : 'Crear Cuenta'}
            </button>
          </div>
        </form>
    </dialog>
  );
}
