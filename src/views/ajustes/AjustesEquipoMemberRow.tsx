import { Ban, Building2, Check, Copy, HelpCircle } from 'lucide-react';
import type { Company } from '../../shared/types';
import {
  DESPACHO_ROLE_LABELS,
  DESPACHO_ROLES,
  type DespachoRole,
  type WorkspaceMemberRecord
} from '../../shared/types/despacho-rbac.types';

export const MEMBER_STATUS_BADGE: Record<WorkspaceMemberRecord['status'], string> = {
  ACTIVO: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  INVITADO: 'bg-amber-50 text-amber-800 border-amber-200',
  REVOCADO: 'bg-rose-50 text-rose-800 border-rose-200'
};

export const MEMBER_STATUS_LABEL: Record<WorkspaceMemberRecord['status'], string> = {
  ACTIVO: 'Activo',
  INVITADO: 'Pendiente de ingreso',
  REVOCADO: 'Revocado'
};

export function resolveActiveRoleLabel(role: DespachoRole | 'OWNER' | null): string {
  if (!role) return 'Verificando permisos...';
  if (role === 'OWNER') return 'Titular del Despacho';
  return DESPACHO_ROLE_LABELS[role];
}

export function buildAccessInstructions(email: string, role: DespachoRole): string {
  return `Hola, ya quedó autorizado tu acceso en LibrePaq Pro ERP (${DESPACHO_ROLE_LABELS[role]}).\nIngresa a https://librepaq.com e inicia sesión (o crea tu cuenta) usando exactamente este correo: ${email}`;
}

export function AjustesEquipoRoleGuide() {
  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-700">
      <summary className="cursor-pointer font-semibold text-slate-800 inline-flex items-center gap-1.5 select-none">
        <HelpCircle className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
        ¿Qué puede hacer cada rol en el despacho?
      </summary>
      <ul className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700 pl-1">
        <li><strong>Socio:</strong> Control total, administración de equipo y configuración fiscal.</li>
        <li><strong>Contador:</strong> Operación contable y fiscal completa (pólizas, catálogo, CFDIs, DIOT y cierre).</li>
        <li><strong>Auxiliar:</strong> Captura de pólizas y carga de CFDIs del periodo abierto.</li>
        <li><strong>Cliente (Solo lectura):</strong> Consulta de reportes, pólizas, XML y exportación Excel/PDF sin editar.</li>
      </ul>
    </details>
  );
}

export interface AjustesEquipoMemberRowProps {
  variant: 'table' | 'card';
  member: WorkspaceMemberRecord;
  companies: Company[];
  canManageTeam: boolean;
  isEditing: boolean;
  editingCompanyIds: string[];
  setEditingCompanyIds: (ids: string[]) => void;
  onStartEditCompanies: (member: WorkspaceMemberRecord, assignedIds: string[]) => void;
  onCancelEditCompanies: () => void;
  onSaveCompanies: (memberId: string, companyIds: string[]) => void;
  isSavingCompanies: boolean;
  onChangeRole: (memberId: string, role: DespachoRole) => void;
  isChangingRole: boolean;
  confirmRevokeId: string | null;
  setConfirmRevokeId: (id: string | null) => void;
  onConfirmRevoke: (memberId: string) => void;
  isRevoking: boolean;
  copiedMemberId: string | null;
  onCopyInstructions: (member: WorkspaceMemberRecord) => void;
}

export function AjustesEquipoMemberRow({
  variant,
  member: m,
  companies,
  canManageTeam,
  isEditing,
  editingCompanyIds,
  setEditingCompanyIds,
  onStartEditCompanies,
  onCancelEditCompanies,
  onSaveCompanies,
  isSavingCompanies,
  onChangeRole,
  isChangingRole,
  confirmRevokeId,
  setConfirmRevokeId,
  onConfirmRevoke,
  isRevoking,
  copiedMemberId,
  onCopyInstructions
}: AjustesEquipoMemberRowProps) {
  const assignedIds = (m.companyAccess ?? []).map((a) => a.companyId);
  const assignedCompanies = companies.filter((c) => assignedIds.includes(c.id));
  const isRevoked = m.status === 'REVOCADO';
  const isCopied = copiedMemberId === m.id;

  const toggleEditingCompany = (companyId: string) => {
    setEditingCompanyIds(
      editingCompanyIds.includes(companyId)
        ? editingCompanyIds.filter((id) => id !== companyId)
        : [...editingCompanyIds, companyId]
    );
  };

  const roleSelect = (
    <select
      aria-label={`Rol de ${m.email}`}
      disabled={!canManageTeam || isRevoked || isChangingRole}
      value={m.role}
      onChange={(e) => onChangeRole(m.id, e.target.value as DespachoRole)}
      className="w-full sm:w-auto max-w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      {DESPACHO_ROLES.map((r) => (
        <option key={r} value={r}>
          {DESPACHO_ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );

  const companiesControl = isEditing ? (
    <fieldset className="space-y-2 border border-slate-200 rounded-xl p-2.5 bg-slate-50/70">
      <legend className="text-[11px] font-bold text-slate-700 px-1">
        Empresas autorizadas para {m.email}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {companies.map((c) => (
          <label
            key={c.id}
            className="inline-flex items-center gap-1.5 text-[11px] py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-blue-300"
          >
            <input
              type="checkbox"
              checked={editingCompanyIds.includes(c.id)}
              onChange={() => toggleEditingCompany(c.id)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span className="font-mono font-semibold text-slate-800">{c.rfc}</span>
            <span className="text-slate-600 truncate max-w-[140px]">· {c.name}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <button
          type="button"
          disabled={!canManageTeam || isSavingCompanies}
          onClick={() => onSaveCompanies(m.id, editingCompanyIds)}
          className="px-2.5 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSavingCompanies ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={onCancelEditCompanies}
          className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </fieldset>
  ) : (
    <div className="space-y-1">
      <button
        type="button"
        aria-expanded={isEditing}
        disabled={!canManageTeam || isRevoked}
        title={
          !canManageTeam
            ? 'Solo el Titular o un Socio puede modificar empresas asignadas'
            : isRevoked
            ? 'Usuario revocado'
            : 'Editar empresas visibles'
        }
        onClick={() => onStartEditCompanies(m, assignedIds)}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-800 hover:underline disabled:text-slate-500 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
      >
        <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>
          {assignedIds.length === 0
            ? 'Todas las empresas'
            : `${assignedIds.length} empresa(s) asignada(s)`}
        </span>
      </button>
      {assignedCompanies.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {assignedCompanies.slice(0, 3).map((c) => (
            <span
              key={c.id}
              title={`${c.rfc} · ${c.name}`}
              className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] font-semibold text-slate-700"
            >
              {c.rfc}
            </span>
          ))}
          {assignedCompanies.length > 3 && (
            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-600">
              +{assignedCompanies.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );

  const actionsControl = (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {!isRevoked && (
        <button
          type="button"
          onClick={() => onCopyInstructions(m)}
          title="Copiar enlace de acceso e instrucciones para este colaborador o cliente"
          aria-label={`Copiar enlace e instrucciones de acceso para ${m.email}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold cursor-pointer"
        >
          {isCopied ? (
            <>
              <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />
              <span className="text-emerald-700">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-slate-500" aria-hidden="true" />
              <span>Copiar acceso</span>
            </>
          )}
        </button>
      )}

      {confirmRevokeId === m.id ? (
        <div
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setConfirmRevokeId(null);
            }
          }}
          className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg px-2 py-0.5"
        >
          <button
            type="button"
            disabled={!canManageTeam || isRevoking}
            onClick={() => onConfirmRevoke(m.id)}
            className="px-2 py-1 rounded text-[11px] font-bold text-rose-800 hover:bg-rose-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmar
          </button>
          <span className="text-rose-300" aria-hidden="true">|</span>
          <button
            type="button"
            autoFocus
            onClick={() => setConfirmRevokeId(null)}
            className="px-2 py-1 rounded text-[11px] font-semibold text-slate-700 hover:bg-white cursor-pointer"
          >
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!canManageTeam || isRevoked || isRevoking}
          aria-label={`Revocar acceso de ${m.email}`}
          title={
            isRevoked
              ? 'Este acceso ya fue revocado'
              : !canManageTeam
              ? 'Solo el Titular o un Socio puede revocar accesos'
              : `Revocar acceso de ${m.email}`
          }
          onClick={() => setConfirmRevokeId(m.id)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Ban className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Revocar</span>
        </button>
      )}
    </div>
  );

  if (variant === 'card') {
    return (
      <li className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3 text-xs">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="font-semibold text-slate-900 break-all">{m.email}</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${MEMBER_STATUS_BADGE[m.status]}`}>
            {MEMBER_STATUS_LABEL[m.status]}
          </span>
        </div>
        <div className="space-y-1">
          <span className="block text-[11px] font-semibold text-slate-600">Rol</span>
          {roleSelect}
        </div>
        <div className="space-y-1">
          <span className="block text-[11px] font-semibold text-slate-600">Empresas visibles</span>
          {companiesControl}
        </div>
        <div className="pt-2 border-t border-slate-200 flex justify-end">{actionsControl}</div>
      </li>
    );
  }

  return (
    <tr className="align-top">
      <td className="py-2.5 px-3 font-medium text-slate-900">{m.email}</td>
      <td className="py-2.5 px-3 whitespace-nowrap">
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${MEMBER_STATUS_BADGE[m.status]}`}>
          {MEMBER_STATUS_LABEL[m.status]}
        </span>
      </td>
      <td className="py-2.5 px-3">{roleSelect}</td>
      <td className="py-2.5 px-3">{companiesControl}</td>
      <td className="py-2.5 px-3 text-right">{actionsControl}</td>
    </tr>
  );
}
