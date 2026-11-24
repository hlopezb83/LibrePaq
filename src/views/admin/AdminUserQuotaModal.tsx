import { useCallback, useEffect, useRef, useState } from 'react';
import { Gauge } from 'lucide-react';
import { AlertBanner, Button, ModalShell } from '../../components/ui';
import { SuperAdminQuotaCard } from './SuperAdminQuotaCard';

export interface AdminUserQuotaTarget {
  userId: string;
  fullName: string;
  email: string;
  workspaceId: string;
  workspaceName?: string;
}

interface AdminUserQuotaModalProps {
  target: AdminUserQuotaTarget | null;
  canEdit?: boolean;
  onClose: () => void;
}

export function AdminUserQuotaModal({ target, canEdit = true, onClose }: AdminUserQuotaModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const handleStateChange = useCallback((state: { isDirty: boolean; isSaving: boolean }) => {
    setIsDirty(state.isDirty);
    setIsSaving(state.isSaving);
    if (!state.isDirty) setShowDiscardConfirm(false);
  }, []);

  const requestClose = useCallback(() => {
    if (isSaving) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    setShowDiscardConfirm(false);
    onClose();
  }, [isSaving, isDirty, onClose]);

  const confirmDiscardAndClose = () => {
    setShowDiscardConfirm(false);
    setIsDirty(false);
    onClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (target) {
      setShowDiscardConfirm(false);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [target]);

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={Boolean(target)}
      onClose={requestClose}
      busy={isSaving}
      deferClose={isDirty}
      usePortal
      maxWidth="2xl"
      icon={<Gauge className="w-4 h-4" aria-hidden="true" />}
      iconTone="blue"
      titleId="admin-user-quota-modal-title"
      title={target ? `Plan y Cuota — ${target.workspaceName || target.fullName}` : 'Plan y Cuota del Despacho'}
      subtitle={
        target ? (
          <>
            {target.email} · <span className="font-mono text-[11px]">{target.workspaceId}</span>
          </>
        ) : undefined
      }
      closeLabel="Cerrar modal de plan y cuota"
      bodyClassName="space-y-3"
    >
      {showDiscardConfirm && isDirty && (
        <AlertBanner
          tone="warning"
          title="Cambios sin guardar"
          action={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowDiscardConfirm(false)}>
                Seguir editando
              </Button>
              <Button variant="danger" size="sm" onClick={confirmDiscardAndClose}>
                Descartar y cerrar
              </Button>
            </div>
          }
        >
          Tienes cambios sin guardar en la cuota. ¿Deseas descartarlos?
        </AlertBanner>
      )}

      {target && (
        <SuperAdminQuotaCard
          workspaceId={target.workspaceId}
          userId={target.userId}
          canEdit={canEdit}
          onStateChange={handleStateChange}
        />
      )}
    </ModalShell>
  );
}
