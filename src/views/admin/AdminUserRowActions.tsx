import { useEffect, useRef, useState } from 'react';
import { Ban, Loader2, RotateCcw } from 'lucide-react';
import { InlineConfirm, Select, getButtonClasses } from '../../components/ui';
import type { AdminUserSummary, PlatformRole } from '../../shared/admin-types';
import { ADMIN_ROLE_OPTIONS } from './adminFormatters';

interface AdminUserRoleControlProps {
  user: AdminUserSummary;
  currentRole: PlatformRole;
  isMutating: boolean;
  onChangeUserRole: (userId: string, nextRole: PlatformRole) => void;
}

export function AdminUserRoleControl({
  user,
  currentRole,
  isMutating,
  onChangeUserRole
}: AdminUserRoleControlProps) {
  const [pendingRole, setPendingRole] = useState<PlatformRole | null>(null);
  const [submittedPendingRole, setSubmittedPendingRole] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const pendingRoleLabel = pendingRole
    ? ADMIN_ROLE_OPTIONS.find((opt) => opt.value === pendingRole)?.label ?? pendingRole
    : '';

  useEffect(() => {
    if (submittedPendingRole && !isMutating) {
      setSubmittedPendingRole(false);
      setPendingRole(null);
    }
  }, [submittedPendingRole, isMutating]);

  const cancelPendingRole = () => {
    if (isMutating) return;
    setSubmittedPendingRole(false);
    setPendingRole(null);
    requestAnimationFrame(() => selectRef.current?.querySelector('select')?.focus());
  };

  return (
    <div ref={selectRef} className="space-y-1.5">
      <label htmlFor={`role-select-${user.id}`} className="visually-hidden">
        Nivel de acceso para {user.email}
      </label>
      <Select
        size="sm"
        id={`role-select-${user.id}`}
        disabled={isMutating}
        title={isMutating ? 'Actualización de usuario en curso...' : undefined}
        value={pendingRole ?? currentRole}
        onChange={(e) => {
          const nextRole = e.target.value as PlatformRole;
          setPendingRole(nextRole === currentRole ? null : nextRole);
        }}
        className="text-[11px] font-semibold"
      >
        {ADMIN_ROLE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </Select>
      {pendingRole && (
        <InlineConfirm
          tone="primary"
          busy={isMutating}
          message={`¿Asignar rol ${pendingRoleLabel}?`}
          cancelLabel="Cancelar"
          confirmLabel={isMutating ? 'Guardando...' : 'Confirmar'}
          ariaLabel={`Confirmar cambio de rol para ${user.email}`}
          onCancel={cancelPendingRole}
          onConfirm={() => {
            setSubmittedPendingRole(true);
            onChangeUserRole(user.id, pendingRole);
          }}
        />
      )}
    </div>
  );
}

interface AdminUserStatusControlProps {
  user: AdminUserSummary;
  isSuspended: boolean;
  isMutating: boolean;
  onToggleUserStatus: (userId: string, nextStatus: 'ACTIVO' | 'SUSPENDIDO') => void;
}

export function AdminUserStatusControl({
  user,
  isSuspended,
  isMutating,
  onToggleUserStatus
}: AdminUserStatusControlProps) {
  const [pendingStatus, setPendingStatus] = useState<'ACTIVO' | 'SUSPENDIDO' | null>(null);
  const [submittedPendingStatus, setSubmittedPendingStatus] = useState(false);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreFocusRef = useRef(false);
  const nextStatus: 'ACTIVO' | 'SUSPENDIDO' = isSuspended ? 'ACTIVO' : 'SUSPENDIDO';

  useEffect(() => {
    if (submittedPendingStatus && !isMutating) {
      setSubmittedPendingStatus(false);
      shouldRestoreFocusRef.current = true;
      setPendingStatus(null);
    }
  }, [submittedPendingStatus, isMutating]);

  useEffect(() => {
    if (!pendingStatus && shouldRestoreFocusRef.current) {
      shouldRestoreFocusRef.current = false;
      statusBtnRef.current?.focus();
    }
  }, [pendingStatus]);

  const cancelPendingStatus = () => {
    if (isMutating) return;
    shouldRestoreFocusRef.current = true;
    setSubmittedPendingStatus(false);
    setPendingStatus(null);
  };

  if (pendingStatus) {
    return (
      <InlineConfirm
        tone={pendingStatus === 'SUSPENDIDO' ? 'danger' : 'primary'}
        busy={isMutating}
        message={
          pendingStatus === 'SUSPENDIDO'
            ? `¿Suspender a ${user.email}?`
            : `¿Reactivar a ${user.email}?`
        }
        cancelLabel="Cancelar"
        confirmLabel={isMutating ? 'Aplicando...' : 'Confirmar'}
        ariaLabel={`Confirmar cambio de estado para ${user.email}`}
        onCancel={cancelPendingStatus}
        onConfirm={() => {
          setSubmittedPendingStatus(true);
          onToggleUserStatus(user.id, pendingStatus);
        }}
        className="max-w-[240px] justify-end"
      />
    );
  }

  return (
    <button
      ref={statusBtnRef}
      type="button"
      disabled={isMutating}
      aria-busy={isMutating || undefined}
      title={isMutating ? 'Actualización de usuario en curso...' : undefined}
      onClick={() => setPendingStatus(nextStatus)}
      className={getButtonClasses(
        isSuspended ? 'export-outline' : 'danger-outline',
        'sm',
        'text-[11px] font-bold'
      )}
    >
      {isMutating ? (
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
      ) : isSuspended ? (
        <RotateCcw className="w-3 h-3" aria-hidden="true" />
      ) : (
        <Ban className="w-3 h-3" aria-hidden="true" />
      )}
      {isSuspended ? 'Reactivar' : 'Suspender'}
      <span className="visually-hidden"> a {user.fullName}</span>
    </button>
  );
}
