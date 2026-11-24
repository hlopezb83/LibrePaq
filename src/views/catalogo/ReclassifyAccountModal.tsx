import { useEffect, useRef, useState } from 'react';
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
  const queryClient = useQueryClient();
  const toast = useToast();
  const affectableAccounts = accounts.filter((a) => a.isAffectable);

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [periodFrom, setPeriodFrom] = useState<number>(currentPeriod);
  const [periodTo, setPeriodTo] = useState<number>(currentPeriod);
  const [formError, setFormError] = useState<string | null>(null);

  useDialogLightDismiss(dialogRef, onClose, { isOpen });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      setFormError(null);
      setPeriodFrom(currentPeriod);
      setPeriodTo(currentPeriod);
      setFromAccountId((prev) => prev || affectableAccounts[0]?.id || '');
      setToAccountId((prev) => prev || affectableAccounts[1]?.id || '');
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, currentPeriod, affectableAccounts]);

  const reclassifyMutation = useMutation({
    mutationFn: async () => {
      if (isReadOnlyClient) {
        throw new Error('Acceso de solo lectura: no puedes reclasificar cuentas.');
      }
      if (isPeriodLocked && periodFrom === currentPeriod && periodTo === currentPeriod) {
        throw new Error(`El periodo P${String(currentPeriod).padStart(2, '0')}/${currentYear} está bloqueado ante el SAT.`);
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
        periodFrom: Math.min(periodFrom, periodTo),
        periodTo: Math.max(periodFrom, periodTo)
      });
    },
    onSuccess: (res) => {
      invalidateAccountingQueries(queryClient, [
        'accounts',
        'polizas',
        'account-ledger',
        'reports',
        'dashboard',
        'fiscal-workpaper',
        'diot',
        'sat-xml'
      ]);
      if (res.updatedMovementsCount === 0) {
        toast.info(
          'Sin movimientos por reclasificar',
          'No se encontraron partidas en la cuenta origen dentro del rango seleccionado.'
        );
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

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="reclassify-modal-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-lg max-h-[92dvh] open:flex open:flex-col overflow-hidden backdrop:bg-slate-900/60 p-0 m-auto"
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
          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </header>

      <div className="p-4 space-y-4 text-xs overflow-y-auto">
        {formError && (
          <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="reclass-from" className="font-bold text-slate-800 block">
            Cuenta Origen (afectable)
          </label>
          <select
            id="reclass-from"
            value={fromAccountId}
            onChange={(e) => setFromAccountId(e.target.value)}
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="reclass-pfrom" className="font-bold text-slate-800 block">
              Periodo Inicial ({currentYear})
            </label>
            <select
              id="reclass-pfrom"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono"
            >
              {MESES_SAT.map((m) => (
                <option key={m.periodo} value={m.periodo}>
                  P{String(m.periodo).padStart(2, '0')} — {m.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="reclass-pto" className="font-bold text-slate-800 block">
              Periodo Final ({currentYear})
            </label>
            <select
              id="reclass-pto"
              value={periodTo}
              onChange={(e) => setPeriodTo(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono"
            >
              {MESES_SAT.map((m) => (
                <option key={m.periodo} value={m.periodo}>
                  P{String(m.periodo).padStart(2, '0')} — {m.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

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
          disabled={reclassifyMutation.isPending || !fromAccountId || !toAccountId || fromAccountId === toAccountId}
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
    </dialog>
  );
}
