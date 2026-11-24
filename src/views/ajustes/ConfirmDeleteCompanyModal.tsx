import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { AlertBanner, Button, FormField, Input, ModalShell } from '../../components/ui';
import type { Company } from '../../shared/types';

export interface ConfirmDeleteCompanyModalProps {
  targetCompany: Company | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirmDelete: (companyId: string) => void;
}

export function ConfirmDeleteCompanyModal({
  targetCompany,
  isDeleting,
  onClose,
  onConfirmDelete
}: ConfirmDeleteCompanyModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rfcInput, setRfcInput] = useState('');

  useEffect(() => {
    setRfcInput('');
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (targetCompany && !dlg.open) {
      dlg.showModal();
    } else if (!targetCompany && dlg.open) {
      dlg.close();
    }
  }, [targetCompany]);

  const expectedRfc = targetCompany?.rfc.trim().toUpperCase() ?? '';
  const isRfcMatch = Boolean(expectedRfc && rfcInput.trim().toUpperCase() === expectedRfc);

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={Boolean(targetCompany)}
      onClose={onClose}
      busy={isDeleting}
      role="alertdialog"
      maxWidth="md"
      icon={<AlertTriangle className="w-5 h-5" aria-hidden="true" />}
      iconTone="red"
      titleId="confirm-delete-company-title"
      descriptionId="confirm-delete-company-desc"
      title="Confirmar baja definitiva de empresa"
      subtitle={
        targetCompany ? (
          <>
            <strong className="text-slate-900">{targetCompany.name}</strong> ·{' '}
            <span className="font-mono font-bold text-slate-800">{expectedRfc}</span>
          </>
        ) : undefined
      }
      closeLabel="Cerrar confirmación de baja"
      footer={
        <>
          <Button variant="secondary" disabled={isDeleting} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="confirm-delete-company-form"
            variant="danger"
            disabled={!isRfcMatch || isDeleting}
            loading={isDeleting}
            title={!isRfcMatch ? `Escribe ${expectedRfc} para habilitar la baja definitiva` : undefined}
            leftIcon={isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : undefined}
          >
            {isDeleting ? 'Eliminando...' : 'Sí, eliminar permanentemente'}
          </Button>
        </>
      }
    >
      {targetCompany && (
        <form
          id="confirm-delete-company-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (isRfcMatch && !isDeleting) {
              onConfirmDelete(targetCompany.id);
            }
          }}
          className="space-y-4 text-xs"
        >
          <AlertBanner tone="danger">
            Esta acción eliminará de forma irreversible todas las pólizas, catálogos, CFDIs y conciliaciones vinculados a esta empresa.
          </AlertBanner>

          <FormField
            htmlFor="confirm-delete-rfc-input"
            label={
              <>
                Para confirmar, escribe el RFC exacto:{' '}
                <span className="font-mono text-red-700">{expectedRfc}</span>
              </>
            }
          >
            <Input
              id="confirm-delete-rfc-input"
              type="text"
              autoFocus
              disabled={isDeleting}
              value={rfcInput}
              onChange={(e) => setRfcInput(e.target.value.toUpperCase())}
              placeholder={expectedRfc}
              className="font-mono font-bold uppercase"
            />
          </FormField>
        </form>
      )}
    </ModalShell>
  );
}
