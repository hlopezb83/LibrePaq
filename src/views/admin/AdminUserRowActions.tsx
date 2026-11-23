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
  const selectRef = useRef<HTMLSelectElement>(null);
  const pendingRoleLabel = pendingRole
    ? ADMIN_ROLE_OPTIONS.find((opt) => opt.value === pendingRole)?.label ?? pendingRole
    : '';

  const cancelPendingRole = () => {
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
        value={pendingRole ?? currentRole}
        onChange={(e) => {
          const nextRole = e.target.value as PlatformRole;
          setPendingRole(nextRole === currentRole ? null : nextRole);
        }}
        className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-800 cursor-pointer disabled:opacity-60"
      >
        {ADMIN_ROLE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {pendingRole && (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-label={`Confirmar cambio de rol para ${user.fullName}`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
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
            onClick={cancelPendingRole}
            className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isMutating}
            onClick={() => {
              onChangeUserRole(user.id, pendingRole);
              setPendingRole(null);
            }}
            className="px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-800 font-bold text-white cursor-pointer disabled:opacity-50"
          >
            Confirmar
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
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreFocusRef = useRef(false);
  const nextStatus: 'ACTIVO' | 'SUSPENDIDO' = isSuspended ? 'ACTIVO' : 'SUSPENDIDO';

  useEffect(() => {
    if (!pendingStatus && shouldRestoreFocusRef.current) {
      shouldRestoreFocusRef.current = false;
      statusBtnRef.current?.focus();
    }
  }, [pendingStatus]);

  const cancelPendingStatus = () => {
    shouldRestoreFocusRef.current = true;
    setPendingStatus(null);
  };

  if (pendingStatus) {
    return (
      <div
        role="alertdialog"
        aria-modal="false"
        aria-label={`Confirmar cambio de estado para ${user.fullName}`}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            cancelPendingStatus();
          }
        }}
        className="inline-flex flex-wrap items-center justify-end gap-1.5 p-1.5 rounded-lg bg-red-50 border border-red-200 text-[11px]"
      >
        <span className="font-bold text-red-900">
          {pendingStatus === 'SUSPENDIDO' ? '¿Suspender?' : '¿Reactivar?'}
        </span>
        <button
          type="button"
          autoFocus
          onClick={cancelPendingStatus}
          className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={isMutating}
          onClick={() => {
            onToggleUserStatus(user.id, pendingStatus);
            setPendingStatus(null);
          }}
          className={`px-2 py-0.5 rounded font-bold text-white cursor-pointer disabled:opacity-50 ${
            pendingStatus === 'SUSPENDIDO' ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800'
          }`}
        >
          Confirmar
        </button>
      </div>
    );
  }

  return (
    <button
      ref={statusBtnRef}
      type="button"
      disabled={isMutating}
      onClick={() => setPendingStatus(nextStatus)}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer disabled:opacity-50 ${
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
