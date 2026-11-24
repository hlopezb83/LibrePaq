import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, Copy, Info, Loader2, RefreshCw, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { checkIsSuperAdmin, useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { useSupportSession } from '../../lib/support-impersonation';
import { workspaceRbacClient } from '../../lib/workspace-rbac-client';
import type { Company } from '../../shared/types';
import { DESPACHO_ROLE_LABELS, DESPACHO_ROLES, type DespachoRole, type WorkspaceMemberRecord } from '../../shared/types/despacho-rbac.types';
import { AjustesBitacoraCard } from './AjustesBitacoraCard';
import { AjustesEquipoMemberRow, AjustesEquipoRoleGuide, buildAccessInstructions, resolveActiveRoleLabel } from './AjustesEquipoMemberRow';

export interface AjustesEquipoTabProps {
  activeCompany: Company | null;
  companies: Company[];
  toast: { success: (msg: string) => void; error: (msg: string) => void; info?: (msg: string) => void };
}

export function AjustesEquipoTab({ activeCompany, companies, toast }: AjustesEquipoTabProps) {
  const { user, session, isGuest, hasAdminAccess } = useAuth();
  const isAuthenticated = Boolean(user && (session || isGuest));
  const supportSession = useSupportSession();
  const isSupportImpersonation = Boolean(supportSession && (hasAdminAccess || checkIsSuperAdmin(user)));
  const { workspace, isReadOnlySupportMode, effectiveCompanyRole } = useCompany();
  const queryClient = useQueryClient();
  const { copiedKey, copy } = useCopyToClipboard<string>(2200);

  const ownWorkspaceId = !isAuthenticated ? '' : (workspace?.id || (user ? `ws_${user.id.slice(0, 8)}` : ''));
  const isOwnWorkspace = !activeCompany?.userId || activeCompany.userId === 'demo' || activeCompany.userId === user?.id;
  const workspaceId = !isAuthenticated
    ? ''
    : isOwnWorkspace
      ? ownWorkspaceId
      : `ws_${activeCompany.userId!.slice(0, 8)}`;
  const isReadOnlyClientRole = effectiveCompanyRole === 'CLIENTE_LECTURA';
  const canManageTeam = !isReadOnlySupportMode && !isSupportImpersonation && (effectiveCompanyRole === 'OWNER' || effectiveCompanyRole === 'SOCIO');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<DespachoRole>('CONTADOR');
  const [inviteCompanyIds, setInviteCompanyIds] = useState<string[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingCompanyIds, setEditingCompanyIds] = useState<string[]>([]);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [lastAuthorized, setLastAuthorized] = useState<{ email: string; role: DespachoRole } | null>(null);

  const { data: members = [], isLoading: membersLoading, isError: membersIsError, error: membersError, refetch: refetchMembers } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspaceRbacClient.listWorkspaceMembers(workspaceId),
    enabled: isAuthenticated && Boolean(workspaceId) && !isReadOnlyClientRole
  });

  const { data: auditLogs = [], isLoading: auditLoading, isError: auditIsError, error: auditError, refetch: refetchAudit } = useQuery({
    queryKey: ['company-audit-logs', activeCompany?.id],
    queryFn: () => workspaceRbacClient.listCompanyAuditLogs(activeCompany!.id, 60),
    enabled: isAuthenticated && Boolean(activeCompany?.id)
  });

  const refreshMembers = () => void queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });

  const inviteMutation = useMutation({
    mutationFn: () => workspaceRbacClient.inviteWorkspaceMember({
      workspaceId, email: inviteEmail.trim().toLowerCase(), role: inviteRole,
      companyIds: inviteCompanyIds.length > 0 ? inviteCompanyIds : undefined
    }),
    onSuccess: (created) => {
      toast.success(`Acceso autorizado para ${created.email} (${DESPACHO_ROLE_LABELS[created.role]})`);
      setLastAuthorized({ email: created.email, role: created.role });
      setInviteEmail(''); setInviteCompanyIds([]); refreshMembers();
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: DespachoRole }) => workspaceRbacClient.updateWorkspaceMemberRole(workspaceId, memberId, role),
    onSuccess: (u) => { toast.success(`Rol actualizado para ${u.email}: ${DESPACHO_ROLE_LABELS[u.role]}`); refreshMembers(); },
    onError: (err: Error) => toast.error(err.message)
  });

  const revokeMutation = useMutation({
    mutationFn: (memberId: string) => workspaceRbacClient.revokeWorkspaceMember(workspaceId, memberId),
    onSuccess: (r) => { setConfirmRevokeId(null); toast.success(`Acceso revocado para ${r.email}`); refreshMembers(); },
    onError: (err: Error) => toast.error(err.message)
  });

  const accessMutation = useMutation({
    mutationFn: ({ memberId, companyIds }: { memberId: string; companyIds: string[] }) => workspaceRbacClient.assignCompanyAccess({ workspaceId, memberId, companyIds }),
    onSuccess: () => { toast.success('Empresas visibles actualizadas'); setEditingMemberId(null); refreshMembers(); },
    onError: (err: Error) => toast.error(err.message)
  });

  const handleInviteSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.includes('@')) { toast.error('Ingresa un correo electrónico válido'); return; }
    if (inviteRole === 'CLIENTE_LECTURA' && inviteCompanyIds.length === 0) {
      toast.error('Para el rol Cliente Solo Lectura debes seleccionar al menos una empresa.');
      return;
    }
    inviteMutation.mutate();
  };

  const handleCopyInstructions = (email: string, role: DespachoRole, key: string) => {
    void copy(buildAccessInstructions(email, role), key).then((ok) => {
      if (ok) toast.success(`Instrucciones de acceso copiadas para ${email}`);
      else toast.error('No se pudo copiar las instrucciones al portapapeles.');
    });
  };

  const sharedRowProps = {
    companies, canManageTeam, editingCompanyIds, setEditingCompanyIds, confirmRevokeId, setConfirmRevokeId,
    onStartEditCompanies: (mem: WorkspaceMemberRecord, ids: string[]) => { setEditingMemberId(mem.id); setEditingCompanyIds(ids); },
    onCancelEditCompanies: () => setEditingMemberId(null),
    onSaveCompanies: (memberId: string, companyIds: string[]) => accessMutation.mutate({ memberId, companyIds }),
    isSavingCompanies: accessMutation.isPending,
    onChangeRole: (memberId: string, role: DespachoRole) => {
      const target = members.find((mem) => mem.id === memberId);
      if (role === 'CLIENTE_LECTURA' && (!target || (target.companyAccess?.length ?? 0) === 0)) {
        toast.error('Asigna al menos una empresa al miembro antes de cambiarlo a Cliente Solo Lectura.');
        if (target) {
          setEditingMemberId(target.id);
          setEditingCompanyIds([]);
        }
        return;
      }
      roleMutation.mutate({ memberId, role });
    },
    isChangingRole: roleMutation.isPending,
    onConfirmRevoke: (memberId: string) => revokeMutation.mutate(memberId),
    isRevoking: revokeMutation.isPending,
    copiedMemberId: copiedKey,
    onCopyInstructions: (mem: WorkspaceMemberRecord) => handleCopyInstructions(mem.email, mem.role, mem.id)
  };

  return (
    <section className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-300/90 p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Equipo del Despacho y Permisos por Empresa</h2>
              <p className="text-xs text-slate-600">Autoriza contadores, auxiliares o clientes de solo lectura y delimita qué empresas pueden consultar por RFC.</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200 self-start">
            Rol activo: {resolveActiveRoleLabel(effectiveCompanyRole)}
          </span>
        </div>

        <AjustesEquipoRoleGuide />

        {isSupportImpersonation ? (
          <div role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            Modo soporte de solo lectura: la autorización de colaboradores y cambios de permisos están deshabilitados.
          </div>
        ) : isReadOnlyClientRole ? (
          <div role="status" className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950 flex items-start gap-2">
            <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" aria-hidden="true" />
            <span>Acceso Cliente Solo Lectura: la administración del equipo y autorizaciones corresponde al Titular o Socio del despacho.</span>
          </div>
        ) : (
          <>
            {!canManageTeam && (
              <div role="status" className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950 flex items-start gap-2">
                <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" aria-hidden="true" />
                <span>Tu rol actual no permite autorizar colaboradores, cambiar roles ni revocar accesos. Estas acciones corresponden al Titular del Despacho o a un Socio.</span>
              </div>
            )}

            <form onSubmit={handleInviteSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-200">
              <div className="md:col-span-5">
                <label htmlFor="rbac-invite-email" className="block text-xs font-semibold text-slate-700 mb-1">Correo del colaborador o cliente</label>
                <input id="rbac-invite-email" type="email" required disabled={!canManageTeam || inviteMutation.isPending} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="auxiliar@despacho.mx" className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:bg-slate-100 disabled:cursor-not-allowed" />
              </div>
              <div className="md:col-span-4">
                <label htmlFor="rbac-invite-role" className="block text-xs font-semibold text-slate-700 mb-1">Rol asignado</label>
                <select id="rbac-invite-role" disabled={!canManageTeam || inviteMutation.isPending} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as DespachoRole)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:bg-slate-100 disabled:cursor-not-allowed">
                  {DESPACHO_ROLES.map((r) => (<option key={r} value={r}>{DESPACHO_ROLE_LABELS[r]}</option>))}
                </select>
              </div>
              <div className="md:col-span-3 flex items-end">
                <button type="submit" disabled={!canManageTeam || inviteMutation.isPending} aria-busy={inviteMutation.isPending} title={!canManageTeam ? 'Solo el Titular o un Socio puede autorizar accesos' : undefined} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                  {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <UserPlus className="w-4 h-4" aria-hidden="true" />}
                  <span>{inviteMutation.isPending ? 'Guardando...' : 'Autorizar acceso'}</span>
                </button>
              </div>

              {companies.length > 0 && canManageTeam && (
                <fieldset className="md:col-span-12 space-y-1.5 pt-1">
                  <legend className="text-[11px] font-semibold text-slate-600 mb-1">
                    {inviteRole === 'CLIENTE_LECTURA'
                      ? 'Empresas visibles (obligatorio seleccionar al menos 1 empresa para Cliente Solo Lectura):'
                      : 'Empresas visibles (si no marcas ninguna, tendrá acceso a todas):'}
                  </legend>
                  <div className="flex flex-wrap items-center gap-2">
                    {companies.map((c) => (
                      <label key={c.id} className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] cursor-pointer hover:border-blue-300">
                        <input type="checkbox" checked={inviteCompanyIds.includes(c.id)} onChange={() => setInviteCompanyIds((prev) => (prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                        <span className="font-mono font-semibold text-slate-800">{c.rfc}</span>
                        <span className="text-slate-600 truncate max-w-[160px]">· {c.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </form>

            <p className="text-[11px] text-slate-600">
              Nota: LibrePaq Pro no envía correo automático al autorizar. Comparte el enlace <span className="font-mono font-semibold text-slate-800">https://librepaq.com</span> para que la persona active su acceso iniciando sesión con ese mismo correo.
            </p>

            {lastAuthorized && (
              <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-2">
                <span><strong>Acceso autorizado para {lastAuthorized.email}</strong> ({DESPACHO_ROLE_LABELS[lastAuthorized.role]}). Pídele iniciar sesión con ese correo en <span className="font-mono font-semibold">https://librepaq.com</span>.</span>
                <button type="button" onClick={() => handleCopyInstructions(lastAuthorized.email, lastAuthorized.role, 'last-authorized')} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 font-semibold hover:bg-emerald-100 cursor-pointer shrink-0">
                  {copiedKey === 'last-authorized' ? <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                  <span>{copiedKey === 'last-authorized' ? 'Instrucciones copiadas' : 'Copiar enlace e instrucciones'}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-300/90 p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-700" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-900">
            Miembros del Despacho{!isReadOnlyClientRole ? ` (${members.length})` : ''}
          </h3>
        </div>
        {isReadOnlyClientRole ? (
          <p role="status" className="text-xs text-slate-600 p-3 rounded-xl bg-slate-50 border border-slate-200">
            Por seguridad del despacho, el listado de colaboradores y permisos no está visible para el rol Cliente Solo Lectura.
          </p>
        ) : membersIsError ? (
          <div role="alert" className="p-4 rounded-xl border border-red-200 bg-red-50/70 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-red-900">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
              <span>{membersError instanceof Error ? membersError.message : 'Error al cargar los miembros del despacho.'}</span>
            </div>
            <button type="button" onClick={() => void refetchMembers()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Reintentar
            </button>
          </div>
        ) : membersLoading ? (
          <p role="status" aria-live="polite" aria-busy="true" className="text-xs text-slate-600">Cargando miembros del despacho...</p>
        ) : members.length === 0 ? (
          <div className="py-4 px-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
            <p className="text-xs text-slate-600">Aún no hay colaboradores ni clientes autorizados en este despacho.</p>
            {canManageTeam && (
              <button type="button" onClick={() => document.getElementById('rbac-invite-email')?.focus()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold cursor-pointer">
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" /> Autorizar primer colaborador
              </button>
            )}
          </div>
        ) : (
          <>
            <ul className="md:hidden space-y-3">
              {members.map((m) => (
                <AjustesEquipoMemberRow key={m.id} variant="card" member={m} isEditing={editingMemberId === m.id} {...sharedRowProps} />
              ))}
            </ul>
            <div tabIndex={0} role="region" aria-label="Tabla de miembros del despacho" className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <caption className="visually-hidden">Miembros autorizados y permisos por empresa del despacho</caption>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th scope="col" className="py-2 px-3 font-semibold">Correo</th>
                    <th scope="col" className="py-2 px-3 font-semibold">Estatus</th>
                    <th scope="col" className="py-2 px-3 font-semibold">Rol</th>
                    <th scope="col" className="py-2 px-3 font-semibold">Empresas</th>
                    <th scope="col" className="py-2 px-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((m) => (
                    <AjustesEquipoMemberRow key={m.id} variant="table" member={m} isEditing={editingMemberId === m.id} {...sharedRowProps} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <AjustesBitacoraCard activeCompany={activeCompany} auditLogs={auditLogs} isLoading={auditLoading} isError={auditIsError} error={auditError} onRefresh={() => void refetchAudit()} />
    </section>
  );
}
