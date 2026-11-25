import React from 'react';
import { CheckCircle2, Layers, Lock, Sparkles } from 'lucide-react';
import {
  AlertBanner,
  Button,
  FormField,
  Input,
  ModalShell,
  Select,
  StatusBadge
} from '../../components/ui';
import type { AccountType, AccountWithBalance, Company } from '../../shared/types';
import { AccountEditorSubtitle } from './AccountEditorHeader';
import { isValidAccountMask } from './catalogoCsvIo';
import { SatGroupCodePicker } from './SatGroupCodePicker';

export interface AccountEditorModalProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  editingAccountId: string | null;
  editingIsAffectable?: boolean;
  isAffectable?: boolean;
  setIsAffectable?: (val: boolean) => void;
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
  dialogRef, editingAccountId, editingIsAffectable = true, isAffectable = true, setIsAffectable,
  isJanLocked = false, activeCompany, currentYear, formError, parentCode, setParentCode,
  parentAccounts, accounts, code, setCode, name, setName,
  satGroupCode, setSatGroupCode, type, setType, nature, setNature,
  setLevel, initialBalanceRaw, setInitialBalanceRaw,
  suggestNextCodeForParent, onClose, onSave, isSaving, isWriteBlocked = false
}: AccountEditorModalProps) {
  const selectedParent = parentCode ? accounts.find((a) => a.code === parentCode) : undefined;
  const computedLevel = Math.min(4, selectedParent ? selectedParent.level + 1 : 1);
  const parentHasActivity = Boolean(
    selectedParent &&
      (selectedParent.periodCharges > 0 ||
        selectedParent.periodCredits > 0 ||
        Math.abs(selectedParent.initialBalanceComputed) >= 0.01 ||
        Math.abs(selectedParent.initialBalance) >= 0.01)
  );
  const hasBlockedAffectableParent = Boolean(!editingAccountId && selectedParent?.isAffectable && parentHasActivity);
  const trimmedCode = code.trim();
  const isDuplicateCode = Boolean(!editingAccountId && trimmedCode && accounts.some((a) => a.code === trimmedCode));
  const isMaskInvalid = Boolean(!editingAccountId && trimmedCode && !isValidAccountMask(trimmedCode));
  const effectiveAffectable = editingAccountId ? editingIsAffectable : computedLevel === 1 ? false : computedLevel >= 3 ? true : isAffectable;
  const isAccumulative = !effectiveAffectable;
  const isFinancialFieldsLocked = Boolean((editingAccountId && isJanLocked) || isAccumulative);
  const financialLockBadge =
    editingAccountId && isJanLocked
      ? 'Enero cerrado'
      : isAccumulative
      ? 'Cuenta acumuladora'
      : null;
  const financialLockTitle =
    editingAccountId && isJanLocked
      ? 'Enero está cerrado ante el SAT; saldo inicial y naturaleza no pueden modificarse'
      : isAccumulative
      ? 'Las cuentas acumuladoras calculan su saldo automáticamente desde sus subcuentas'
      : undefined;
  const submitDisabledTitle = isWriteBlocked
    ? 'Periodo bloqueado o modo solo lectura'
    : hasBlockedAffectableParent
    ? 'La cuenta padre seleccionada es afectable y ya tiene actividad'
    : isDuplicateCode
    ? 'El código contable ya existe en el catálogo'
    : isMaskInvalid
    ? 'Usa segmentos alfanuméricos separados por guion (ej. 601-01-006)'
    : undefined;
  const isSubmitDisabled =
    isSaving || isWriteBlocked || hasBlockedAffectableParent || isDuplicateCode || isMaskInvalid;

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={Boolean(editingAccountId || code)}
      onClose={onClose}
      busy={isSaving}
      titleId="modal-account-title"
      title={editingAccountId ? 'Editar Cuenta Contable' : 'Nueva Cuenta Contable'}
      subtitle={<AccountEditorSubtitle activeCompany={activeCompany} currentYear={currentYear} />}
      icon={<Layers className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      maxWidth="xl"
      footer={
        <>
          <Button variant="secondary" size="md" disabled={isSaving} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="account-editor-form"
            variant="primary"
            size="md"
            loading={isSaving}
            disabled={isSubmitDisabled}
            title={submitDisabledTitle}
            leftIcon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
          >
            {isSaving ? 'Guardando...' : editingAccountId ? 'Guardar Cambios' : 'Crear Cuenta'}
          </Button>
        </>
      }
    >
      <form
        id="account-editor-form"
        method="post"
        onSubmit={(e) => {
          e.preventDefault();
          if (isSubmitDisabled) return;
          onSave();
        }}
        className="space-y-3.5"
      >
        {hasBlockedAffectableParent && selectedParent && (
          <AlertBanner tone="danger">
            La cuenta padre <strong className="font-mono">{selectedParent.code}</strong> es afectable y ya tiene movimientos o saldo inicial. Elige una acumuladora.
          </AlertBanner>
        )}
        {!editingAccountId && selectedParent?.isAffectable && !parentHasActivity && (
          <AlertBanner tone="warning">
            La cuenta padre <strong className="font-mono">{selectedParent.code}</strong> pasará a ser acumuladora al crear esta subcuenta.
          </AlertBanner>
        )}
        {formError && <AlertBanner tone="danger">{formError}</AlertBanner>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Subcuenta de (Cuenta Padre)" htmlFor="acc-parent">
            <Select
              id="acc-parent"
              disabled={Boolean(editingAccountId)}
              title={editingAccountId ? 'No se puede cambiar la cuenta padre al editar' : undefined}
              value={parentCode}
              onChange={(e) => {
                const pCode = e.target.value;
                setParentCode(pCode);
                const parentObj = accounts.find((a) => a.code === pCode);
                if (parentObj) {
                  const nextLvl = Math.min(4, parentObj.level + 1);
                  setType(parentObj.type);
                  setNature(parentObj.nature);
                  setLevel(nextLvl);
                  setIsAffectable?.(nextLvl >= 3);
                  if (parentObj.satGroupCode) setSatGroupCode(parentObj.satGroupCode);
                  setCode(suggestNextCodeForParent(pCode));
                } else {
                  setLevel(1);
                  setIsAffectable?.(false);
                }
              }}
              className="font-mono"
            >
              <option value="">-- Rubro Principal (Nivel 1) --</option>
              {parentAccounts.map((pa) => (
                <option key={pa.id} value={pa.code}>
                  [N{pa.level}] {pa.code} - {pa.name}
                </option>
              ))}
            </Select>
          </FormField>

          <div>
            <div className="flex items-center justify-between gap-1 mb-1">
              <label htmlFor="acc-code" className="block text-xs font-semibold text-slate-700">
                Código ({activeCompany?.maskFormat || 'XXX-XX-XXX'}) <span className="text-red-700">*</span>
              </label>
              <StatusBadge tone={effectiveAffectable ? 'emerald' : 'amber'} shape="tag">
                N{computedLevel} · {effectiveAffectable ? 'Afectable' : 'Mayor'}
              </StatusBadge>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                id="acc-code"
                type="text"
                required
                aria-invalid={isDuplicateCode || isMaskInvalid}
                disabled={Boolean(editingAccountId)}
                title={editingAccountId ? 'El código contable no puede modificarse después de crear la cuenta' : undefined}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`font-mono text-sm ${
                  isDuplicateCode || isMaskInvalid ? 'border-red-500! ring-1 ring-red-400' : ''
                }`}
              />
              {!editingAccountId && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setCode(suggestNextCodeForParent(parentCode))}
                  title="Sugerir siguiente código disponible"
                  className="bg-blue-50! hover:bg-blue-100! text-blue-800! border-blue-200!"
                  leftIcon={<Sparkles className="w-3 h-3" aria-hidden="true" />}
                >
                  Sugerir
                </Button>
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

        {!editingAccountId && computedLevel === 2 && setIsAffectable && (
          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs font-semibold text-blue-950 cursor-pointer select-none">
            <input type="checkbox" checked={isAffectable} onChange={(e) => setIsAffectable(e.target.checked)} className="rounded border-blue-400 text-blue-700 focus:ring-blue-600" />
            <span>Cuenta N2 afectable (permite recibir pólizas y saldo inicial directamente)</span>
          </label>
        )}

        <FormField label="Nombre de la Cuenta Contable" htmlFor="acc-name" required>
          <Input
            id="acc-name"
            type="text"
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Publicidad y Marketing Digital"
            className="text-sm"
          />
        </FormField>

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
          <FormField label="Rubro Contable" htmlFor="acc-type">
            <Select
              id="acc-type"
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
            >
              <option value="ACTIVO">ACTIVO</option>
              <option value="PASIVO">PASIVO</option>
              <option value="CAPITAL">CAPITAL</option>
              <option value="INGRESOS">INGRESOS</option>
              <option value="COSTOS">COSTOS</option>
              <option value="GASTOS">GASTOS</option>
              <option value="ORDEN">ORDEN (800)</option>
            </Select>
          </FormField>

          <div>
            <div className="flex items-center justify-between gap-1 mb-1">
              <label htmlFor="acc-nature" className="block text-xs font-semibold text-slate-700">Naturaleza</label>
              {financialLockBadge && (
                <StatusBadge tone="amber" shape="tag" icon={<Lock className="w-2.5 h-2.5" aria-hidden="true" />} className="text-[9px]!">
                  {financialLockBadge}
                </StatusBadge>
              )}
            </div>
            <Select id="acc-nature" disabled={isFinancialFieldsLocked} title={financialLockTitle} value={nature} onChange={(e) => setNature(e.target.value as 'DEUDORA' | 'ACREEDORA')}>
              <option value="DEUDORA">DEUDORA (Cargos +)</option>
              <option value="ACREEDORA">ACREEDORA (Abonos +)</option>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-1 mb-1">
              <label htmlFor="acc-init-bal" className="block text-xs font-semibold text-slate-700">Saldo Apertura</label>
              {financialLockBadge && (
                <StatusBadge tone="amber" shape="tag" icon={<Lock className="w-2.5 h-2.5" aria-hidden="true" />} className="text-[9px]!">
                  Bloqueado
                </StatusBadge>
              )}
            </div>
            <Input
              id="acc-init-bal" type="text" inputMode="decimal" disabled={isFinancialFieldsLocked} title={financialLockTitle}
              value={initialBalanceRaw} onChange={(e) => setInitialBalanceRaw(e.target.value.replace(/[^0-9.-]/g, ''))}
              placeholder="0.00" className="font-mono tabular-nums text-right"
            />
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
