import type { Database } from 'bun:sqlite';
import { db } from '../connection';
import {
  canRoleWrite,
  DESPACHO_ROLE_RANK,
  DESPACHO_ROLES,
  type AssignCompanyAccessPayload,
  type CompanyAuditLogRecord,
  type CompanyMemberAccessRecord,
  type DespachoRole,
  type EffectiveCompanyRoleResult,
  type InviteMemberPayload,
  type RecordCompanyAuditPayload,
  type WorkspaceMemberRecord
} from '../../shared/types/despacho-rbac.types';
import {
  DESPACHO_RBAC_DDL,
  mapAccessRow,
  mapAuditRow,
  mapMemberRow,
  type AccessDbRow,
  type AuditDbRow,
  type MemberDbRow
} from './workspace-members.helpers';

const VALID_ROLES = new Set<string>(DESPACHO_ROLES);

/** Crea de forma idempotente las tablas y los índices RBAC de despacho en SQLite. */
export function ensureDespachoRbacTables(targetDb: Database = db): void {
  targetDb.exec(DESPACHO_RBAC_DDL);
}

function listAccessByMember(memberIds: string[]): Map<string, AccessDbRow[]> {
  const byMember = new Map<string, AccessDbRow[]>();
  if (memberIds.length === 0) return byMember;
  const placeholders = memberIds.map(() => '?').join(', ');
  const rows = db
    .query(`SELECT * FROM company_member_access WHERE member_id IN (${placeholders}) ORDER BY created_at ASC`)
    .all(...memberIds) as AccessDbRow[];
  for (const r of rows) {
    const list = byMember.get(r.member_id) ?? [];
    list.push(r);
    byMember.set(r.member_id, list);
  }
  return byMember;
}

export function listWorkspaceMembersRepo(workspaceId: string): WorkspaceMemberRecord[] {
  ensureDespachoRbacTables(db);
  const rows = db
    .query('SELECT * FROM workspace_members WHERE workspace_id = ? ORDER BY created_at ASC')
    .all(workspaceId) as MemberDbRow[];
  const accessMap = listAccessByMember(rows.map((r) => r.id));
  return rows.map((r) => mapMemberRow(r, accessMap.get(r.id) ?? []));
}

export function inviteWorkspaceMemberRepo(payload: InviteMemberPayload): WorkspaceMemberRecord {
  ensureDespachoRbacTables(db);
  const wsId = payload.workspaceId.trim();
  const email = payload.email.trim().toLowerCase();
  if (!wsId || !email.includes('@')) throw new Error('workspaceId y correo válido son requeridos.');
  if (!VALID_ROLES.has(payload.role)) throw new Error('Rol de despacho inválido.');

  const now = new Date().toISOString();
  const invitedBy = (payload.invitedBy || 'socio@despacho.local').trim();
  const companyIds = Array.from(new Set((payload.companyIds ?? []).map((c) => c.trim()).filter(Boolean)));

  const memberId = db.transaction(() => {
    const existing = db
      .query('SELECT * FROM workspace_members WHERE workspace_id = ? AND lower(email) = ?')
      .get(wsId, email) as MemberDbRow | null;
    let id = existing?.id ?? `mem_${crypto.randomUUID().slice(0, 12)}`;
    if (existing) {
      if (existing.status !== 'REVOCADO') {
        throw new Error('Este correo ya tiene una membresía o invitación activa en el despacho.');
      }
      db.prepare(
        "UPDATE workspace_members SET role = ?, status = 'INVITADO', invited_by = ?, updated_at = ? WHERE id = ?"
      ).run(payload.role, invitedBy, now, existing.id);
      id = existing.id;
    } else {
      db.prepare(
        `INSERT INTO workspace_members (id, workspace_id, user_id, email, role, status, invited_by, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, 'INVITADO', ?, ?, ?)`
      ).run(id, wsId, email, payload.role, invitedBy, now, now);
    }
    if (companyIds.length > 0) {
      db.prepare('DELETE FROM company_member_access WHERE member_id = ?').run(id);
      const ins = db.prepare(
        'INSERT INTO company_member_access (id, company_id, member_id, user_id, role_override, created_at) VALUES (?, ?, ?, ?, NULL, ?)'
      );
      for (const cid of companyIds) {
        ins.run(`cma_${crypto.randomUUID().slice(0, 12)}`, cid, id, existing?.user_id ?? null, now);
      }
    }
    return id;
  })();

  const row = db.query('SELECT * FROM workspace_members WHERE id = ?').get(memberId) as MemberDbRow;
  const access = db.query('SELECT * FROM company_member_access WHERE member_id = ?').all(memberId) as AccessDbRow[];
  return mapMemberRow(row, access);
}

export function updateWorkspaceMemberRoleRepo(
  workspaceId: string,
  memberId: string,
  role: DespachoRole
): WorkspaceMemberRecord {
  ensureDespachoRbacTables(db);
  if (!VALID_ROLES.has(role)) throw new Error('Rol de despacho inválido.');
  const now = new Date().toISOString();
  const res = db
    .prepare('UPDATE workspace_members SET role = ?, updated_at = ? WHERE id = ? AND workspace_id = ?')
    .run(role, now, memberId, workspaceId);
  if (res.changes === 0) throw new Error('Miembro no encontrado en el despacho.');
  const row = db.query('SELECT * FROM workspace_members WHERE id = ?').get(memberId) as MemberDbRow;
  const access = db.query('SELECT * FROM company_member_access WHERE member_id = ?').all(memberId) as AccessDbRow[];
  return mapMemberRow(row, access);
}

export function revokeWorkspaceMemberRepo(workspaceId: string, memberId: string): WorkspaceMemberRecord {
  ensureDespachoRbacTables(db);
  const now = new Date().toISOString();
  const res = db
    .prepare("UPDATE workspace_members SET status = 'REVOCADO', updated_at = ? WHERE id = ? AND workspace_id = ?")
    .run(now, memberId, workspaceId);
  if (res.changes === 0) throw new Error('Miembro no encontrado en el despacho.');
  const row = db.query('SELECT * FROM workspace_members WHERE id = ?').get(memberId) as MemberDbRow;
  const access = db.query('SELECT * FROM company_member_access WHERE member_id = ?').all(memberId) as AccessDbRow[];
  return mapMemberRow(row, access);
}

export function assignCompanyAccessRepo(payload: AssignCompanyAccessPayload): CompanyMemberAccessRecord[] {
  ensureDespachoRbacTables(db);
  const member = db
    .query('SELECT * FROM workspace_members WHERE id = ? AND workspace_id = ?')
    .get(payload.memberId, payload.workspaceId) as MemberDbRow | null;
  if (!member) throw new Error('Miembro no encontrado en el despacho.');
  if (payload.roleOverride && !VALID_ROLES.has(payload.roleOverride)) throw new Error('Rol override inválido.');

  const now = new Date().toISOString();
  const cids = Array.from(new Set(payload.companyIds.map((c) => c.trim()).filter(Boolean)));
  db.transaction(() => {
    db.prepare('DELETE FROM company_member_access WHERE member_id = ?').run(member.id);
    const ins = db.prepare(
      'INSERT INTO company_member_access (id, company_id, member_id, user_id, role_override, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const cid of cids) {
      ins.run(`cma_${crypto.randomUUID().slice(0, 12)}`, cid, member.id, member.user_id ?? null, payload.roleOverride ?? null, now);
    }
  })();

  const rows = db.query('SELECT * FROM company_member_access WHERE member_id = ? ORDER BY created_at ASC').all(member.id) as AccessDbRow[];
  return rows.map(mapAccessRow);
}

export function acceptPendingInvitesRepo(userId: string, email: string): { acceptedCount: number } {
  ensureDespachoRbacTables(db);
  const cleanEmail = email.trim().toLowerCase();
  if (!userId || !cleanEmail) return { acceptedCount: 0 };
  const now = new Date().toISOString();
  const pending = db
    .query("SELECT id FROM workspace_members WHERE lower(email) = ? AND status = 'INVITADO'")
    .all(cleanEmail) as Array<{ id: string }>;
  if (pending.length === 0) return { acceptedCount: 0 };
  db.transaction(() => {
    for (const row of pending) {
      db.prepare("UPDATE workspace_members SET user_id = ?, status = 'ACTIVO', updated_at = ? WHERE id = ?").run(userId, now, row.id);
      db.prepare('UPDATE company_member_access SET user_id = ? WHERE member_id = ?').run(userId, row.id);
    }
  })();
  return { acceptedCount: pending.length };
}

export function recordCompanyAuditLogRepo(payload: RecordCompanyAuditPayload): CompanyAuditLogRecord {
  ensureDespachoRbacTables(db);
  const id = `aud_${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO company_audit_logs (id, company_id, actor_user_id, actor_email, action, entity_type, entity_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    payload.companyId,
    payload.actorUserId ?? null,
    (payload.actorEmail || 'sistema@librepaq.local').trim(),
    payload.action.trim(),
    payload.entityType.trim(),
    payload.entityId ?? null,
    JSON.stringify(payload.metadata ?? {}),
    now
  );
  const row = db.query('SELECT * FROM company_audit_logs WHERE id = ?').get(id) as AuditDbRow;
  return mapAuditRow(row);
}

export function listCompanyAuditLogsRepo(companyId: string, limit = 50): CompanyAuditLogRecord[] {
  ensureDespachoRbacTables(db);
  const safeLimit = Math.min(200, Math.max(1, Math.floor(limit || 50)));
  const rows = db
    .query('SELECT * FROM company_audit_logs WHERE company_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(companyId, safeLimit) as AuditDbRow[];
  return rows.map(mapAuditRow);
}

export function isWorkspaceSocioRepo(workspaceId: string, userId?: string | null, userEmail?: string | null): boolean {
  ensureDespachoRbacTables(db);
  if (!userId) return workspaceId === 'ws_demo';
  if (workspaceId === userId || workspaceId === `ws_${userId.slice(0, 8)}`) return true;
  const email = (userEmail || '').trim().toLowerCase();
  const rows = db
    .query("SELECT id, user_id, email FROM workspace_members WHERE workspace_id = ? AND status = 'ACTIVO' AND role = 'SOCIO'")
    .all(workspaceId) as Array<{ id: string; user_id: string | null; email: string }>;
  return rows.some((r) => r.user_id === userId || (!r.user_id && email !== '' && r.email.toLowerCase() === email));
}

export function getEffectiveCompanyRoleRepo(
  companyId: string,
  userId?: string | null,
  userEmail?: string | null
): EffectiveCompanyRoleResult {
  ensureDespachoRbacTables(db);
  const comp = db.query('SELECT id, user_id FROM companies WHERE id = ?').get(companyId) as { id: string; user_id: string | null } | null;
  if (!comp) return { companyId, role: null, canWrite: false, isReadOnlyClient: false };
  if (userId && comp.user_id === userId) {
    return { companyId, role: 'OWNER', canWrite: true, isReadOnlyClient: false };
  }

  const email = (userEmail || '').trim().toLowerCase();
  if (userId || email) {
    const activeMembers = db
      .query("SELECT * FROM workspace_members WHERE status = 'ACTIVO' AND (user_id = ? OR (? <> '' AND lower(email) = ?))")
      .all(userId ?? '', email, email) as MemberDbRow[];
    let bestRole: DespachoRole | null = null;
    for (const m of activeMembers) {
      const restricted = db.query('SELECT * FROM company_member_access WHERE member_id = ?').all(m.id) as AccessDbRow[];
      let candidate: DespachoRole | null = null;
      if (restricted.length > 0) {
        const hit = restricted.find((r) => r.company_id === companyId);
        if (hit) candidate = hit.role_override ?? m.role;
      } else if (
        comp.user_id &&
        (m.workspace_id === comp.user_id || m.workspace_id === `ws_${comp.user_id.slice(0, 8)}` || m.invited_by === comp.user_id)
      ) {
        candidate = m.role;
      }
      if (candidate && (!bestRole || DESPACHO_ROLE_RANK[candidate] > DESPACHO_ROLE_RANK[bestRole])) {
        bestRole = candidate;
      }
    }
    if (bestRole) {
      return { companyId, role: bestRole, canWrite: canRoleWrite(bestRole), isReadOnlyClient: bestRole === 'CLIENTE_LECTURA' };
    }
  }

  if (!comp.user_id || comp.user_id === 'demo') {
    return { companyId, role: 'OWNER', canWrite: true, isReadOnlyClient: false };
  }
  return { companyId, role: null, canWrite: false, isReadOnlyClient: false };
}
