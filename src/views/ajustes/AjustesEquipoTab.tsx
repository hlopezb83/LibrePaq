import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Building2, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { workspaceRbacClient } from '../../lib/workspace-rbac-client';
import type { Company } from '../../shared/types';
import {
  DESPACHO_ROLE_LABELS,
  DESPACHO_ROLES,
  type DespachoRole,
  type WorkspaceMemberRecord
} from '../../shared/types/despacho-rbac.types';
import { AjustesBitacoraCard } from './AjustesBitacoraCard';

export interface AjustesEquipoTabProps {
  activeCompany: Company | null;
  companies: Company[];
  toast: { success: (msg: string) => void; error: (msg: string) => void };
}

const STATUS_BADGE: Record<WorkspaceMemberRecord['status'], string> = {
  ACTIVO: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  INVITADO: 'bg-amber-50 text-amber-800 border-amber-200',
  REVOCADO: 'bg-rose-50 text-rose-800 border-rose-200'
};

export function AjustesEquipoTab({ activeCompany, companies, toast }: AjustesEquipoTabProps) {
  const { user } = useAuth();
  const { workspace, isReadOnlySupportMode, effectiveCompanyRole } = useCompany();
  const queryClient = useQueryClient();
  const workspaceId = workspace?.id || (user ? `ws_${user.id.slice(0, 8)}` : 'ws_demo');
  const canManageTeam = !isReadOnlySupportMode && (effectiveCompanyRole === 'OWNER' || effectiveCompanyRole === 'SOCIO');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<DespachoRole>('CONTADOR');
  const [inviteCompanyIds, setInviteCompanyIds] = useState<string[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingCompanyIds, setEditingCompanyIds] = useState<string[]>([]);

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspaceRbacClient.listWorkspaceMembers(workspaceId),
    enabled: Boolean(workspaceId)
  });

  const { data: auditLogs = [], isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['company-audit-logs', activeCompany?.id],
    queryFn: () => workspaceRbacClient.listCompanyAuditLogs(activeCompany!.id, 60),
    enabled: Boolean(activeCompany?.id)
  });

  const refreshMembers = () => void queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });

  const inviteMutation = useMutation({
    mutationFn: () =>
      workspaceRbacClient.inviteWorkspaceMember({
        workspaceId,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        companyIds: inviteCompanyIds.length > 0 ? inviteCompanyIds : undefined
      }),
    onSuccess: (created) => {
      toast.success(`Invitación enviada a ${created.email} (${created.role})`);
      setInviteEmail('');
      setInviteCompanyIds([]);
      refreshMembers();
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: DespachoRole }) =>
      workspaceRbacClient.updateWorkspaceMemberRole(workspaceId, memberId, role),
    onSuccess: (u) => { toast.success(`Rol actualizado para ${u.email}: ${u.role}`); refreshMembers(); },
    onError: (err: Error) => toast.error(err.message)
  });

  const revokeMutation = useMutation({
    mutationFn: (memberId: string) => workspaceRbacClient.revokeWorkspaceMember(workspaceId, memberId),
    onSuccess: (r) => { toast.success(`Acceso revocado para ${r.email}`); refreshMembers(); },
    onError: (err: Error) => toast.error(err.message)
  });

  const accessMutation = useMutation({
    mutationFn: ({ memberId, companyIds }: { memberId: string; companyIds: string[] }) =>
      workspaceRbacClient.assignCompanyAccess({ workspaceId, memberId, companyIds }),
    onSuccess: () => { toast.success('Empresas visibles actualizadas'); setEditingMemberId(null); refreshMembers(); },
    onError: (err: Error) => toast.error(err.message)
  });

  const handleInviteSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.includes('@')) { toast.error('Ingresa un correo electrónico válido'); return; }
    inviteMutation.mutate();
  };

  const toggleCompany = (list: string[], id: string, setter: (next: string[]) => void) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  return (
    <section className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-300/90 p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Equipo del Despacho y Control RBAC por Empresa</h2>
              <p className="text-xs text-slate-600">Invita contadores, auxiliares o clientes de solo lectura y restringe su acceso por RFC.</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 self-start">
            Rol activo: {effectiveCompanyRole || 'OWNER'}
          </span>
        </div>

        <form onSubmit={handleInviteSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-200">
          <div className="md:col-span-5">
            <label htmlFor="rbac-invite-email" className="block text-xs font-semibold text-slate-700 mb-1">Correo del colaborador o cliente</label>
            <input
              id="rbac-invite-email"
              type="email"
              required
              disabled={!canManageTeam || inviteMutation.isPending}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="auxiliar@despacho.mx"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-blue-700 disabled:bg-slate-100"
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="rbac-invite-role" className="block text-xs font-semibold text-slate-700 mb-1">Rol asignado</label>
            <select
              id="rbac-invite-role"
              disabled={!canManageTeam || inviteMutation.isPending}
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as DespachoRole)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-blue-700 disabled:bg-slate-100"
            >
              {DESPACHO_ROLES.map((r) => (
                <option key={r} value={r}>{DESPACHO_ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3 flex items-end">
            <button
              type="submit"
              disabled={!canManageTeam || inviteMutation.isPending}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              <span>{inviteMutation.isPending ? 'Enviando...' : 'Invitar miembro'}</span>
            </button>
          </div>

          {companies.length > 0 && canManageTeam && (
            <div className="md:col-span-12 flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-semibold text-slate-600">Empresas visibles (vacío = todas):</span>
              {companies.map((c) => (
                <label key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] cursor-pointer">
                  <input type="checkbox" checked={inviteCompanyIds.includes(c.id)} onChange={() => toggleCompany(inviteCompanyIds, c.id, setInviteCompanyIds)} />
                  <span className="font-medium text-slate-800">{c.rfc}</span>
                </label>
              ))}
            </div>
          )}
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-300/90 p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-700" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-900">Miembros del Despacho ({members.length})</h3>
        </div>
        {membersLoading ? (
          <p className="text-xs text-slate-500">Cargando miembros...</p>
        ) : members.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">Aún no hay colaboradores invitados en este despacho.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="py-2 pr-3 font-semibold">Correo</th>
                  <th className="py-2 pr-3 font-semibold">Estatus</th>
                  <th className="py-2 pr-3 font-semibold">Rol</th>
                  <th className="py-2 pr-3 font-semibold">Empresas</th>
                  <th className="py-2 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => {
                  const assignedIds = (m.companyAccess ?? []).map((a) => a.companyId);
                  const isEditing = editingMemberId === m.id;
                  return (
                    <tr key={m.id} className="align-top">
                      <td className="py-2.5 pr-3 font-medium text-slate-900">{m.email}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_BADGE[m.status]}`}>{m.status}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <select
                          aria-label={`Rol de ${m.email}`}
                          disabled={!canManageTeam || m.status === 'REVOCADO' || roleMutation.isPending}
                          value={m.role}
                          onChange={(e) => roleMutation.mutate({ memberId: m.id, role: e.target.value as DespachoRole })}
                          className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs disabled:bg-slate-100"
                        >
                          {DESPACHO_ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
                        </select>
                      </td>
                      <td className="py-2.5 pr-3">
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap gap-1.5">
                              {companies.map((c) => (
                                <label key={c.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-slate-200 bg-slate-50 cursor-pointer">
                                  <input type="checkbox" checked={editingCompanyIds.includes(c.id)} onChange={() => toggleCompany(editingCompanyIds, c.id, setEditingCompanyIds)} />
                                  <span>{c.rfc}</span>
                                </label>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => accessMutation.mutate({ memberId: m.id, companyIds: editingCompanyIds })} className="px-2 py-0.5 rounded bg-blue-600 text-white text-[11px] font-bold cursor-pointer">Guardar</button>
                              <button type="button" onClick={() => setEditingMemberId(null)} className="px-2 py-0.5 rounded border border-slate-300 text-[11px] cursor-pointer">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!canManageTeam || m.status === 'REVOCADO'}
                            onClick={() => { setEditingMemberId(m.id); setEditingCompanyIds(assignedIds); }}
                            className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline disabled:text-slate-400 cursor-pointer"
                          >
                            <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{assignedIds.length === 0 ? 'Todas las empresas' : `${assignedIds.length} restringida(s)`}</span>
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          disabled={!canManageTeam || m.status === 'REVOCADO' || revokeMutation.isPending}
                          onClick={() => revokeMutation.mutate(m.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-semibold disabled:opacity-40 cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Revocar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AjustesBitacoraCard activeCompany={activeCompany} auditLogs={auditLogs} isLoading={auditLoading} onRefresh={() => void refetchAudit()} />
    </section>
  );
}
