import type React from 'react';
import { Lock, LockOpen, ShieldAlert } from 'lucide-react';
import { AlertBanner, Button, ModalShell } from '../ui';

interface PeriodLockConfirmDialogProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  isPeriodLocked: boolean;
  companyName: string;
  companyRfc: string;
  period: number;
  year: number;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function PeriodLockConfirmDialog({
  dialogRef,
  isPeriodLocked,
  companyName,
  companyRfc,
  period,
  year,
  isPending,
  onCancel,
  onConfirm
}: PeriodLockConfirmDialogProps) {
  const periodLabel = `P${String(period).padStart(2, '0')}/${year}`;

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={true}
      onClose={onCancel}
      role="alertdialog"
      maxWidth="md"
      noPrint
      busy={isPending}
      titleId="period-lock-confirm-title"
      descriptionId="period-lock-confirm-desc"
      icon={
        isPeriodLocked ? (
          <LockOpen className="w-5 h-5" aria-hidden="true" />
        ) : (
          <Lock className="w-5 h-5" aria-hidden="true" />
        )
      }
      iconTone={isPeriodLocked ? 'emerald' : 'amber'}
      title={
        isPeriodLocked
          ? `¿Reabrir el periodo ${periodLabel}?`
          : `¿Bloquear el periodo ${periodLabel}?`
      }
      subtitle={
        isPeriodLocked
          ? `Al reabrir ${periodLabel} para ${companyName} (${companyRfc}), se volverá a permitir el registro y modificación de pólizas, CFDIs e inventarios.`
          : `Al bloquear ${periodLabel} para ${companyName} (${companyRfc}), nadie podrá capturar, editar ni eliminar pólizas o inventarios de ese mes ante el SAT.`
      }
      footer={
        <>
          <Button
            variant="secondary"
            autoFocus
            disabled={isPending}
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={isPending}
            title={isPending ? 'Actualizando candado de periodo...' : undefined}
            onClick={onConfirm}
          >
            {isPending
              ? 'Actualizando...'
              : isPeriodLocked
              ? 'Sí, reabrir periodo'
              : 'Sí, bloquear periodo'}
          </Button>
        </>
      }
    >
      <AlertBanner
        tone={isPeriodLocked ? 'info' : 'warning'}
        icon={<ShieldAlert className="w-4 h-4" aria-hidden="true" />}
      >
        Esta acción queda registrada en la Bitácora Contable de la empresa.
      </AlertBanner>
    </ModalShell>
  );
}
