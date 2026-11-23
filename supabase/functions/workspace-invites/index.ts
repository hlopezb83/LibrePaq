/**
 * Supabase Edge Function: workspace-invites
 * Gestión multiusuario por despacho (RBAC por empresa) y bitácora contable.
 * Configurada con verify_jwt: false; valida Bearer JWT con supabase.auth.getUser(token).
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/admin-edge-auth.ts';
import {
  assertCompaniesBelongToWorkspace,
  getCallerContext,
  isWorkspaceMember,
  isWorkspaceSocio,
  mapAccess,
  mapAudit,
  mapMember,
  resolveCompanyRole,
  VALID_ROLES,
  type DespachoRole,
  type WorkspaceInvitesReqBody
} from './helpers.ts';

Deno.serve(async (req: Request) => {
  const headers = { ...corsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, headers);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) return jsonResponse({ ok: false, error: 'Configuración incompleta' }, 500, headers);
  const supabase = createClient(url, key);

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return jsonResponse({ ok: false, error: 'Authorization Bearer requerido' }, 401, headers);
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData?.user) return jsonResponse({ ok: false, error: 'Sesión inválida' }, 401, headers);

    const ctx = await getCallerContext(supabase, authData.user);
    if (ctx.suspended) return jsonResponse({ ok: false, error: 'Cuenta suspendida' }, 403, headers);

    const body = (await req.json().catch(() => ({}))) as WorkspaceInvitesReqBody;
    const action = String(body.action || '').trim().toUpperCase();
    const wsId = String(body.workspaceId || '').trim();
    const nowIso = new Date().toISOString();

    if (action === 'ACCEPT_PENDING_INVITES') {
      if (!ctx.email) return jsonResponse({ ok: true, acceptedCount: 0 }, 200, headers);
      const { data: pending } = await supabase
        .from('workspace_members')
        .select('id')
        .ilike('email', ctx.email)
        .eq('status', 'INVITADO');
      const ids = (pending || []).map((r) => String(r.id));
      if (ids.length > 0) {
        await supabase.from('workspace_members').update({ user_id: ctx.userId, status: 'ACTIVO', updated_at: nowIso }).in('id', ids);
        await supabase.from('company_member_access').update({ user_id: ctx.userId }).in('member_id', ids);
      }
      return jsonResponse({ ok: true, acceptedCount: ids.length }, 200, headers);
    }

    if (action === 'GET_COMPANY_ROLE') {
      const cid = String(body.companyId || '').trim();
      if (!cid) return jsonResponse({ ok: false, error: 'companyId requerido' }, 400, headers);
      const eff = await resolveCompanyRole(supabase, cid, ctx);
      return jsonResponse({ ok: true, companyId: cid, ...eff }, 200, headers);
    }

    if (action === 'LIST_COMPANY_AUDIT') {
      const cid = String(body.companyId || '').trim();
      if (!cid) return jsonResponse({ ok: false, error: 'companyId requerido' }, 400, headers);
      const eff = await resolveCompanyRole(supabase, cid, ctx);
      if (!eff.role) return jsonResponse({ ok: false, error: 'Sin acceso a la empresa' }, 403, headers);
      const limit = Math.min(200, Math.max(1, Number(body.limit || 50)));
      const { data, error } = await supabase
        .from('company_audit_logs')
        .select('*')
        .eq('company_id', cid)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return jsonResponse({ ok: false, error: error.message }, 500, headers);
      return jsonResponse({ ok: true, logs: (data || []).map(mapAudit) }, 200, headers);
    }

    if (action === 'RECORD_COMPANY_AUDIT') {
      const cid = String(body.companyId || '').trim();
      const auditAction = String(body.auditAction || '').trim();
      const entityType = String(body.entityType || '').trim();
      if (!cid || !auditAction || !entityType) {
        return jsonResponse({ ok: false, error: 'companyId, auditAction y entityType requeridos' }, 400, headers);
      }
      const eff = await resolveCompanyRole(supabase, cid, ctx);
      if (!eff.canWrite) return jsonResponse({ ok: false, error: 'Solo lectura: escritura bloqueada' }, 403, headers);
      const { data, error } = await supabase
        .from('company_audit_logs')
        .insert({
          id: `aud_${crypto.randomUUID().slice(0, 12)}`,
          company_id: cid,
          actor_user_id: ctx.userId,
          actor_email: ctx.email || 'usuario',
          action: auditAction,
          entity_type: entityType,
          entity_id: body.entityId ?? null,
          metadata: body.metadata ?? {},
          created_at: nowIso
        })
        .select()
        .single();
      if (error) return jsonResponse({ ok: false, error: error.message }, 500, headers);
      return jsonResponse({ ok: true, log: mapAudit(data) }, 200, headers);
    }

    if (!wsId) return jsonResponse({ ok: false, error: 'workspaceId requerido' }, 400, headers);

    if (action === 'LIST_MEMBERS') {
      if (!(await isWorkspaceMember(supabase, wsId, ctx))) {
        return jsonResponse({ ok: false, error: 'No perteneces a este despacho' }, 403, headers);
      }
      const { data: members, error } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: true });
      if (error) return jsonResponse({ ok: false, error: error.message }, 500, headers);
      const ids = (members || []).map((m) => String(m.id));
      const { data: accessRows } = ids.length
        ? await supabase.from('company_member_access').select('*').in('member_id', ids)
        : { data: [] };
      const byMember = new Map<string, Record<string, unknown>[]>();
      for (const a of accessRows || []) {
        const list = byMember.get(String(a.member_id)) || [];
        list.push(a);
        byMember.set(String(a.member_id), list);
      }
      return jsonResponse(
        { ok: true, members: (members || []).map((m) => mapMember(m, byMember.get(String(m.id)) || [])) },
        200,
        headers
      );
    }

    if (!(await isWorkspaceSocio(supabase, wsId, ctx))) {
      return jsonResponse({ ok: false, error: 'Solo el SOCIO o dueño del despacho puede gestionar miembros' }, 403, headers);
    }

    if (action === 'INVITE_MEMBER') {
      const email = String(body.email || '').trim().toLowerCase();
      const role = String(body.role || '').trim().toUpperCase() as DespachoRole;
      if (!email.includes('@') || !VALID_ROLES.has(role)) {
        return jsonResponse({ ok: false, error: 'Correo válido y rol válido son requeridos' }, 400, headers);
      }
      const cids = Array.isArray(body.companyIds) ? Array.from(new Set(body.companyIds.filter((c) => typeof c === 'string' && c))) : [];
      const companyAuthErr = await assertCompaniesBelongToWorkspace(supabase, wsId, cids, ctx);
      if (companyAuthErr) return jsonResponse({ ok: false, error: companyAuthErr }, 403, headers);

      const { data: existing } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', wsId)
        .ilike('email', email)
        .maybeSingle();

      let memberRow: Record<string, unknown>;
      if (existing) {
        if (existing.status !== 'REVOCADO') {
          return jsonResponse({ ok: false, error: 'Este correo ya está registrado o invitado en el despacho' }, 409, headers);
        }
        const { data: upd, error: uErr } = await supabase
          .from('workspace_members')
          .update({ role, status: 'INVITADO', invited_by: ctx.email, updated_at: nowIso })
          .eq('id', existing.id)
          .select()
          .single();
        if (uErr) return jsonResponse({ ok: false, error: uErr.message }, 500, headers);
        memberRow = upd;
      } else {
        const { data: ins, error: iErr } = await supabase
          .from('workspace_members')
          .insert({
            id: `mem_${crypto.randomUUID().slice(0, 12)}`,
            workspace_id: wsId,
            user_id: null,
            email,
            role,
            status: 'INVITADO',
            invited_by: ctx.email || 'socio',
            created_at: nowIso,
            updated_at: nowIso
          })
          .select()
          .single();
        if (iErr) return jsonResponse({ ok: false, error: iErr.message }, 500, headers);
        memberRow = ins;
      }
      if (cids.length > 0) {
        await supabase.from('company_member_access').delete().eq('member_id', memberRow.id);
        await supabase.from('company_member_access').insert(
          cids.map((cid) => ({
            id: `cma_${crypto.randomUUID().slice(0, 12)}`,
            company_id: cid,
            member_id: memberRow.id,
            user_id: memberRow.user_id ?? null,
            role_override: null,
            created_at: nowIso
          }))
        );
      }
      const { data: access } = await supabase.from('company_member_access').select('*').eq('member_id', memberRow.id);
      return jsonResponse({ ok: true, member: mapMember(memberRow, access || []) }, 200, headers);
    }

    if (action === 'UPDATE_MEMBER_ROLE') {
      const mid = String(body.memberId || '').trim();
      const role = String(body.role || '').trim().toUpperCase() as DespachoRole;
      if (!mid || !VALID_ROLES.has(role)) return jsonResponse({ ok: false, error: 'memberId y role válidos requeridos' }, 400, headers);
      const { data, error } = await supabase
        .from('workspace_members')
        .update({ role, updated_at: nowIso })
        .eq('id', mid)
        .eq('workspace_id', wsId)
        .select()
        .single();
      if (error || !data) return jsonResponse({ ok: false, error: error?.message || 'Miembro no encontrado' }, 404, headers);
      return jsonResponse({ ok: true, member: mapMember(data) }, 200, headers);
    }

    if (action === 'REVOKE_MEMBER') {
      const mid = String(body.memberId || '').trim();
      if (!mid) return jsonResponse({ ok: false, error: 'memberId requerido' }, 400, headers);
      const { data, error } = await supabase
        .from('workspace_members')
        .update({ status: 'REVOCADO', updated_at: nowIso })
        .eq('id', mid)
        .eq('workspace_id', wsId)
        .select()
        .single();
      if (error || !data) return jsonResponse({ ok: false, error: error?.message || 'Miembro no encontrado' }, 404, headers);
      return jsonResponse({ ok: true, member: mapMember(data) }, 200, headers);
    }

    if (action === 'ASSIGN_COMPANY_ACCESS') {
      const mid = String(body.memberId || '').trim();
      if (!mid) return jsonResponse({ ok: false, error: 'memberId requerido' }, 400, headers);
      const { data: member } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('id', mid)
        .eq('workspace_id', wsId)
        .maybeSingle();
      if (!member) return jsonResponse({ ok: false, error: 'Miembro no encontrado en el despacho' }, 404, headers);
      const cids = Array.isArray(body.companyIds) ? Array.from(new Set(body.companyIds.filter((c) => typeof c === 'string' && c))) : [];
      const companyAuthErr = await assertCompaniesBelongToWorkspace(supabase, wsId, cids, ctx);
      if (companyAuthErr) return jsonResponse({ ok: false, error: companyAuthErr }, 403, headers);

      const roleOverride = body.roleOverride && VALID_ROLES.has(body.roleOverride as DespachoRole) ? body.roleOverride : null;
      await supabase.from('company_member_access').delete().eq('member_id', mid);
      if (cids.length > 0) {
        const { error: insErr } = await supabase.from('company_member_access').insert(
          cids.map((cid) => ({
            id: `cma_${crypto.randomUUID().slice(0, 12)}`,
            company_id: cid,
            member_id: mid,
            user_id: member.user_id ?? null,
            role_override: roleOverride,
            created_at: nowIso
          }))
        );
        if (insErr) return jsonResponse({ ok: false, error: insErr.message }, 500, headers);
      }
      const { data: access } = await supabase.from('company_member_access').select('*').eq('member_id', mid);
      return jsonResponse({ ok: true, companyAccess: (access || []).map(mapAccess) }, 200, headers);
    }

    return jsonResponse({ ok: false, error: `Acción '${action}' no soportada` }, 400, headers);
  } catch (err: unknown) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : 'Error interno' }, 500, headers);
  }
});
