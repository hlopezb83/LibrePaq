import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft } from 'lucide-react';
import { AlertBanner, Button, FormField, ModalShell, Select } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
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

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={isOpen}
      onClose={onClose}
      busy={reclassifyMutation.isPending}
      usePortal={true}
      maxWidth="lg"
      titleId="reclassify-modal-title"
      title="Reclasificación Masiva de Cuentas"
      subtitle={`Traslada movimientos entre cuentas afectables en ${currentYear} respetando candados SAT.`}
      icon={<ArrowRightLeft className="w-5 h-5" aria-hidden="true" />}
      iconTone="amber"
      closeLabel="Cerrar modal de reclasificación"
      footer={
        <>
          <Button
            variant="secondary"
            size="md"
            disabled={reclassifyMutation.isPending}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={reclassifyMutation.isPending}
            disabled={isSubmitDisabled}
            title={disabledReason}
            onClick={() => reclassifyMutation.mutate()}
            leftIcon={<ArrowRightLeft className="w-4 h-4" aria-hidden="true" />}
          >
            {reclassifyMutation.isPending ? 'Reclasificando...' : 'Ejecutar Reclasificación'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {formError && <AlertBanner tone="danger">{formError}</AlertBanner>}

        {overlapsLockedPeriod && (
          <AlertBanner tone="danger">
            El rango seleccionado (P{String(minPeriod).padStart(2, '0')}–P{String(maxPeriod).padStart(2, '0')}) incluye el periodo bloqueado P{String(currentPeriod).padStart(2, '0')}/{currentYear}.
          </AlertBanner>
        )}

        <FormField label="Cuenta Origen (afectable)" htmlFor="reclass-from">
          <Select
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
            className="font-mono"
          >
            {affectableAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} — {acc.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Cuenta Destino (afectable)" htmlFor="reclass-to">
          <Select
            id="reclass-to"
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
            className="font-mono"
          >
            {affectableAccounts
              .filter((acc) => acc.id !== fromAccountId)
              .map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} — {acc.name}
                </option>
              ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {periodSelectors.map((sel) => (
            <FormField key={sel.id} label={sel.label} htmlFor={sel.id}>
              <Select
                id={sel.id}
                value={sel.value}
                onChange={(e) => sel.onChange(Number(e.target.value))}
                className="font-mono"
              >
                {MESES_SAT.map((m) => (
                  <option key={m.periodo} value={m.periodo}>
                    P{String(m.periodo).padStart(2, '0')} — {m.nombre}
                  </option>
                ))}
              </Select>
            </FormField>
          ))}
        </div>

        {fromAccount && toAccount && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="font-bold text-slate-800">Resumen de Impacto</div>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              Se reasignarán todos los movimientos de{' '}
              <strong className="font-mono text-slate-900">{fromAccount.code}</strong> ({fromAccount.name}) hacia{' '}
              <strong className="font-mono text-slate-900">{toAccount.code}</strong> ({toAccount.name}) en{' '}
              <strong className="font-mono tabular-nums">
                P{String(minPeriod).padStart(2, '0')}–P{String(maxPeriod).padStart(2, '0')}/{currentYear}
              </strong>.
            </p>
            <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmImpact}
                onChange={(e) => setConfirmImpact(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              <span className="text-[11px] font-semibold text-slate-800">
                Confirmo trasladar los movimientos del rango seleccionado (acción masiva sobre pólizas abiertas).
              </span>
            </label>
          </div>
        )}

        <AlertBanner tone="warning" title="Protección de Candado SAT:">
          Si cualquiera de los periodos afectados tiene candado fiscal activo, la operación será rechazada automáticamente sin alterar las pólizas cerradas.
        </AlertBanner>
      </div>
    </ModalShell>
  );
}
