import { useEffect, useRef, useState } from 'react';
import { Ban, Loader2, RotateCcw } from 'lucide-react';
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
  const selectRef = useRef<HTMLSelectElement>(null);
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
    requestAnimationFrame(() => selectRef.current?.focus());
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={`role-select-${user.id}`} className="visually-hidden">
        Nivel de acceso para {user.email}
      </label>
      <select
        ref={selectRef}
        id={`role-select-${user.id}`}
        disabled={isMutating}
        title={isMutating ? 'Actualización de usuario en curso...' : undefined}
        value={pendingRole ?? currentRole}
        onChange={(e) => {
          const nextRole = e.target.value as PlatformRole;
          setPendingRole(nextRole === currentRole ? null : nextRole);
        }}
        className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-800 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {ADMIN_ROLE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {pendingRole && (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-label={`Confirmar cambio de rol para ${user.email}`}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !isMutating) {
              e.preventDefault();
              cancelPendingRole();
            }
          }}
          className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-lg bg-amber-50 border border-amber-300 text-[11px]"
        >
          <span className="font-bold text-amber-950">¿Asignar rol {pendingRoleLabel}?</span>
          <button
            type="button"
            autoFocus
            disabled={isMutating}
            onClick={cancelPendingRole}
            className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isMutating}
            aria-busy={isMutating}
            onClick={() => {
              setSubmittedPendingRole(true);
              onChangeUserRole(user.id, pendingRole);
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-800 font-bold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMutating && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
            <span>{isMutating ? 'Guardando...' : 'Confirmar'}</span>
          </button>
        </div>
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
    const isReactivate = pendingStatus === 'ACTIVO';
    return (
      <div
        role="alertdialog"
        aria-modal="false"
        aria-label={`Confirmar cambio de estado para ${user.email}`}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !isMutating) {
            e.preventDefault();
            cancelPendingStatus();
          }
        }}
        className={`inline-flex flex-wrap items-center justify-end gap-1.5 p-1.5 rounded-lg border text-[11px] whitespace-normal max-w-[240px] ${
          isReactivate ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
        }`}
      >
        <span className={`font-bold text-left break-all ${isReactivate ? 'text-emerald-900' : 'text-red-900'}`}>
          {pendingStatus === 'SUSPENDIDO'
            ? `¿Suspender a ${user.email}?`
            : `¿Reactivar a ${user.email}?`}
        </span>
        <button
          type="button"
          autoFocus
          disabled={isMutating}
          onClick={cancelPendingStatus}
          className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={isMutating}
          aria-busy={isMutating}
          onClick={() => {
            setSubmittedPendingStatus(true);
            onToggleUserStatus(user.id, pendingStatus);
          }}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            pendingStatus === 'SUSPENDIDO' ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800'
          }`}
        >
          {isMutating && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
          <span>{isMutating ? 'Aplicando...' : 'Confirmar'}</span>
        </button>
      </div>
    );
  }

  return (
    <button
      ref={statusBtnRef}
      type="button"
      disabled={isMutating}
      title={isMutating ? 'Actualización de usuario en curso...' : undefined}
      onClick={() => setPendingStatus(nextStatus)}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        isSuspended
          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
          : 'bg-white hover:bg-red-50 text-red-700 border-red-200'
      }`}
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
