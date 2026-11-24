import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRightLeft, Loader2, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { MESES_SAT } from '../../shared/sat-constants';
import type { AccountWithBalance } from '../../shared/types';

interface ReclassifyAccountModalProps {
  isOpen: boolean;
  companyId: string;
  currentYear: number;
  currentPeriod: number;
  isPeriodLocked: boolean;
  isReadOnlyClient: boolean;
  accounts: AccountWithBalance[];
  onClose: () => void;
}

export function ReclassifyAccountModal({
  isOpen,
  companyId,
  currentYear,
  currentPeriod,
  isPeriodLocked,
  isReadOnlyClient,
  accounts,
  onClose
}: ReclassifyAccountModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const prevIsOpenRef = useRef(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  const affectableAccounts = useMemo(
    () => accounts.filter((a) => a.isAffectable),
    [accounts]
  );

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [periodFrom, setPeriodFrom] = useState<number>(currentPeriod);
  const [periodTo, setPeriodTo] = useState<number>(currentPeriod);
  const [confirmImpact, setConfirmImpact] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useDialogLightDismiss(dialogRef, onClose, { isOpen });

  useEffect(() => {
    const dialog = dialogRef.current;
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (justOpened) {
      setFormError(null);
      setConfirmImpact(false);
      setPeriodFrom(currentPeriod);
      setPeriodTo(currentPeriod);
      const firstId = affectableAccounts[0]?.id || '';
      const secondId = affectableAccounts.find((a) => a.id !== firstId)?.id || '';
      setFromAccountId(firstId);
      setToAccountId(secondId);
    }

    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, currentPeriod, affectableAccounts]);

  const minPeriod = Math.min(periodFrom, periodTo);
  const maxPeriod = Math.max(periodFrom, periodTo);
  const overlapsLockedPeriod =
    isPeriodLocked && currentPeriod >= minPeriod && currentPeriod <= maxPeriod;

  const fromAccount = useMemo(
    () => affectableAccounts.find((a) => a.id === fromAccountId) ?? null,
    [affectableAccounts, fromAccountId]
  );
  const toAccount = useMemo(
    () => affectableAccounts.find((a) => a.id === toAccountId) ?? null,
    [affectableAccounts, toAccountId]
  );

  const reclassifyMutation = useMutation({
    mutationFn: async () => {
      if (isReadOnlyClient) {
        throw new Error('Acceso de solo lectura: no puedes reclasificar cuentas.');
      }
      if (overlapsLockedPeriod) {
        throw new Error(
          `El rango seleccionado incluye el periodo bloqueado P${String(currentPeriod).padStart(2, '0')}/${currentYear}.`
        );
      }
      if (!fromAccountId || !toAccountId) {
        throw new Error('Selecciona cuenta origen y cuenta destino.');
      }
      if (fromAccountId === toAccountId) {
        throw new Error('La cuenta origen y la cuenta destino deben ser distintas.');
      }
      return apiClient.reclassifyAccountMovements({
        companyId,
        fromAccountId,
        toAccountId,
        ejercicio: currentYear,
        periodFrom: minPeriod,
        periodTo: maxPeriod
      });
    },
    onSuccess: (res) => {
      invalidateAccountingQueries(queryClient, [
        'accounts', 'polizas', 'account-ledger', 'reports', 'dashboard', 'fiscal-workpaper', 'diot', 'sat-xml'
      ]);
      if (res.updatedMovementsCount === 0) {
        toast.info('Sin movimientos por reclasificar', 'No se encontraron partidas en la cuenta origen dentro del rango seleccionado.');
      } else {
        toast.success(
          'Reclasificación Masiva Completada',
          `Se reclasificaron ${res.updatedMovementsCount} movimiento(s) en ${res.affectedPolizasCount} póliza(s).`
        );
      }
      onClose();
    },
    onError: (err: Error) => {
      setFormError(err.message);
      toast.error('Error al reclasificar cuenta', err.message);
    }
  });

  if (!isOpen) return null;

  const isSubmitDisabled =
    reclassifyMutation.isPending ||
    isReadOnlyClient ||
    overlapsLockedPeriod ||
    !fromAccountId ||
    !toAccountId ||
    fromAccountId === toAccountId ||
    !confirmImpact;

  const disabledReason = isReadOnlyClient
    ? 'Acceso de solo lectura: no puedes reclasificar cuentas'
    : overlapsLockedPeriod
    ? `El rango incluye el periodo bloqueado P${String(currentPeriod).padStart(2, '0')}/${currentYear}`
    : !fromAccountId || !toAccountId || fromAccountId === toAccountId
    ? 'Selecciona una cuenta origen y una cuenta destino distintas'
    : !confirmImpact
    ? 'Marca la casilla de confirmación antes de ejecutar la reclasificación'
    : 'Ejecutar reclasificación masiva';

  const periodSelectors = [
    { id: 'reclass-pfrom', label: `Periodo Inicial (${currentYear})`, value: periodFrom, onChange: setPeriodFrom },
    { id: 'reclass-pto', label: `Periodo Final (${currentYear})`, value: periodTo, onChange: setPeriodTo }
  ];

  return createPortal(
    <dialog
      ref={dialogRef}
      closedby={reclassifyMutation.isPending ? 'none' : 'any'}
      onCancel={(e) => {
        e.preventDefault();
        if (!reclassifyMutation.isPending) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !reclassifyMutation.isPending) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      onClose={onClose}
      aria-labelledby="reclassify-modal-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-[calc(100vw-1rem)] sm:w-full max-w-lg max-h-[92dvh] open:flex open:flex-col overflow-hidden backdrop:bg-slate-900/60 p-0 m-auto"
    >
      <header className="p-4 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="reclassify-modal-title" className="text-sm font-bold text-slate-900">
              Reclasificación Masiva de Cuentas
            </h2>
            <p className="text-xs text-slate-500">
              Traslada movimientos entre cuentas afectables en {currentYear} respetando candados SAT.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={reclassifyMutation.isPending}
          aria-label="Cerrar modal de reclasificación"
          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer disabled:opacity-40"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </header>

      <div className="p-4 space-y-4 text-xs flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {formError && (
          <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        {overlapsLockedPeriod && (
          <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              El rango seleccionado (P{String(minPeriod).padStart(2, '0')}–P{String(maxPeriod).padStart(2, '0')}) incluye el periodo bloqueado P{String(currentPeriod).padStart(2, '0')}/{currentYear}.
            </span>
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="reclass-from" className="font-bold text-slate-800 block">
            Cuenta Origen (afectable)
          </label>
          <select
            id="reclass-from"
            value={fromAccountId}
            onChange={(e) => {
              const nextFrom = e.target.value;
              setFromAccountId(nextFrom);
              if (nextFrom === toAccountId) {
                const nextDistinct = affectableAccounts.find((a) => a.id !== nextFrom)?.id || '';
                setToAccountId(nextDistinct);
              }
            }}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono"
          >
            {affectableAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} — {acc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="reclass-to" className="font-bold text-slate-800 block">
            Cuenta Destino (afectable)
          </label>
          <select
            id="reclass-to"
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono"
          >
            {affectableAccounts
              .filter((acc) => acc.id !== fromAccountId)
              .map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} — {acc.name}
                </option>
              ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {periodSelectors.map((sel) => (
            <div key={sel.id} className="space-y-1">
              <label htmlFor={sel.id} className="font-bold text-slate-800 block">
                {sel.label}
              </label>
              <select
                id={sel.id}
                value={sel.value}
                onChange={(e) => sel.onChange(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono"
              >
                {MESES_SAT.map((m) => (
                  <option key={m.periodo} value={m.periodo}>
                    P{String(m.periodo).padStart(2, '0')} — {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {fromAccount && toAccount && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="font-bold text-slate-800">Resumen de Impacto</div>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              Se reasignarán todos los movimientos de{' '}
              <strong className="font-mono text-slate-900">{fromAccount.code}</strong> ({fromAccount.name}) hacia{' '}
              <strong className="font-mono text-slate-900">{toAccount.code}</strong> ({toAccount.name}) en{' '}
              <strong className="font-mono">
                P{String(minPeriod).padStart(2, '0')}–P{String(maxPeriod).padStart(2, '0')}/{currentYear}
              </strong>.
            </p>
            <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmImpact}
                onChange={(e) => setConfirmImpact(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
              />
              <span className="text-[11px] font-semibold text-slate-800">
                Confirmo trasladar los movimientos del rango seleccionado (acción masiva sobre pólizas abiertas).
              </span>
            </label>
          </div>
        )}

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-[11px] leading-relaxed">
          <strong>Protección de Candado SAT:</strong> Si cualquiera de los periodos afectados tiene candado fiscal activo, la operación será rechazada automáticamente sin alterar las pólizas cerradas.
        </div>
      </div>

      <footer className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          disabled={reclassifyMutation.isPending}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200/70 cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={isSubmitDisabled}
          title={disabledReason}
          onClick={() => reclassifyMutation.mutate()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
        >
          {reclassifyMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRightLeft className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{reclassifyMutation.isPending ? 'Reclasificando...' : 'Ejecutar Reclasificación'}</span>
        </button>
      </footer>
    </dialog>,
    document.body
  );
}
