import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Info, Loader2, RefreshCw, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { AlertBanner, Button, EmptyState, FormField, Input, Select, StatusBadge } from '../../components/ui';
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
          <StatusBadge tone="slate" className="self-start">
            Rol activo: {resolveActiveRoleLabel(effectiveCompanyRole)}
          </StatusBadge>
        </div>

        <AjustesEquipoRoleGuide />

        {isSupportImpersonation ? (
          <AlertBanner tone="warning">
            Modo soporte de solo lectura: la autorización de colaboradores y cambios de permisos están deshabilitados.
          </AlertBanner>
        ) : isReadOnlyClientRole ? (
          <AlertBanner tone="info" icon={<Info className="w-4 h-4" aria-hidden="true" />}>
            Acceso Cliente Solo Lectura: la administración del equipo y autorizaciones corresponde al Titular o Socio del despacho.
          </AlertBanner>
        ) : (
          <>
            {!canManageTeam && (
              <AlertBanner tone="info" icon={<Info className="w-4 h-4" aria-hidden="true" />}>
                Tu rol actual no permite autorizar colaboradores, cambiar roles ni revocar accesos. Estas acciones corresponden al Titular del Despacho o a un Socio.
              </AlertBanner>
            )}

            <form onSubmit={handleInviteSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-200">
              <FormField htmlFor="rbac-invite-email" label="Correo del colaborador o cliente" className="md:col-span-5">
                <Input id="rbac-invite-email" type="email" required disabled={!canManageTeam || inviteMutation.isPending} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="auxiliar@despacho.mx" />
              </FormField>
              <FormField htmlFor="rbac-invite-role" label="Rol asignado" className="md:col-span-4">
                <Select id="rbac-invite-role" disabled={!canManageTeam || inviteMutation.isPending} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as DespachoRole)}>
                  {DESPACHO_ROLES.map((r) => (<option key={r} value={r}>{DESPACHO_ROLE_LABELS[r]}</option>))}
                </Select>
              </FormField>
              <div className="md:col-span-3 flex items-end">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={!canManageTeam || inviteMutation.isPending}
                  loading={inviteMutation.isPending}
                  title={!canManageTeam ? 'Solo el Titular o un Socio puede autorizar accesos' : undefined}
                  leftIcon={inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <UserPlus className="w-4 h-4" aria-hidden="true" />}
                >
                  {inviteMutation.isPending ? 'Guardando...' : 'Autorizar acceso'}
                </Button>
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
              <AlertBanner
                tone="success"
                action={
                  <Button
                    variant="export-outline"
                    size="sm"
                    leftIcon={copiedKey === 'last-authorized' ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                    onClick={() => handleCopyInstructions(lastAuthorized.email, lastAuthorized.role, 'last-authorized')}
                  >
                    {copiedKey === 'last-authorized' ? 'Instrucciones copiadas' : 'Copiar enlace e instrucciones'}
                  </Button>
                }
              >
                <strong>Acceso autorizado para {lastAuthorized.email}</strong> ({DESPACHO_ROLE_LABELS[lastAuthorized.role]}). Pídele iniciar sesión con ese correo en <span className="font-mono font-semibold">https://librepaq.com</span>.
              </AlertBanner>
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
          <AlertBanner
            tone="danger"
            action={
              <Button variant="danger" size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />} onClick={() => void refetchMembers()}>
                Reintentar
              </Button>
            }
          >
            {membersError instanceof Error ? membersError.message : 'Error al cargar los miembros del despacho.'}
          </AlertBanner>
        ) : membersLoading ? (
          <p role="status" aria-live="polite" aria-busy="true" className="text-xs text-slate-600">Cargando miembros del despacho...</p>
        ) : members.length === 0 ? (
          <EmptyState
            variant="dashed"
            tone="slate"
            icon={<Users className="w-5 h-5" aria-hidden="true" />}
            title="Sin colaboradores autorizados"
            description="Aún no hay colaboradores ni clientes autorizados en este despacho."
            actions={
              canManageTeam ? (
                <Button variant="primary" size="sm" leftIcon={<UserPlus className="w-3.5 h-3.5" aria-hidden="true" />} onClick={() => document.getElementById('rbac-invite-email')?.focus()}>
                  Autorizar primer colaborador
                </Button>
              ) : undefined
            }
          />
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
