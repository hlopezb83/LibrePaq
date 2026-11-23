import { db } from '../connection';
import { tableColumns } from './admin-enterprise.helpers';
import type {
  AdminCompanyDetail,
  AdminCompanySummary,
  AdminFielExpirySummary,
  AdminPlatformMetrics,
  AdminSatHealthResponse,
  AdminSatRequestSummary,
  AdminUserSummary
} from '../../shared/admin-types';

export type AdminCompanyWithWorkspace = AdminCompanySummary & { userWorkspaceId?: string | null };

const NON_DEMO = "rfc != 'CEJ2106158A0' AND name NOT LIKE '[DEMO]%'";
const SUPERADMIN_ID = 'usr_owner_hlopez';
const SUPERADMIN_CREATED = '2026-10-23T00:11:55.952Z';

function countQ(sql: string, ...params: (string | number)[]): number {
  const row = db.query(sql).get(...params) as { c: number } | null;
  return Number(row?.c ?? 0);
}

function pickLatestIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export function getAdminUsersRepo(): AdminUserSummary[] {
  const ovRows = db.query('SELECT user_id, status, updated_at FROM admin_user_overrides').all() as Array<{
    user_id: string; status: string; updated_at: string;
  }>;
  const overrides = new Map(ovRows.map((r) => [r.user_id, { status: (r.status === 'SUSPENDIDO' ? 'SUSPENDIDO' : 'ACTIVO') as 'ACTIVO' | 'SUSPENDIDO', updatedAt: r.updated_at }]));

  const compRows = db
    .query("SELECT user_id, COUNT(*) as c, MIN(created_at) as first_at FROM companies WHERE user_id IS NOT NULL AND user_id != 'demo' GROUP BY user_id")
    .all() as Array<{ user_id: string; c: number; first_at: string }>;
  const countsMap = new Map(compRows.map((r) => [r.user_id, { count: Number(r.c), firstAt: r.first_at }]));

  const users: AdminUserSummary[] = [{
    id: SUPERADMIN_ID,
    email: 'hlopezb@gmail.com',
    fullName: 'Hector Lopez',
    provider: 'google',
    isSuperAdmin: true,
    createdAt: SUPERADMIN_CREATED,
    lastSignInAt: new Date().toISOString(),
    companiesCount: countsMap.get(SUPERADMIN_ID)?.count ?? 0,
    status: overrides.get(SUPERADMIN_ID)?.status ?? 'ACTIVO'
  }];

  const extraIds = new Set<string>([...countsMap.keys(), ...overrides.keys()]);
  extraIds.delete(SUPERADMIN_ID);
  for (const uid of extraIds) {
    const ov = overrides.get(uid);
    const comp = countsMap.get(uid);
    users.push({
      id: uid,
      email: uid.includes('@') ? uid : `${uid}@librepaq.local`,
      fullName: 'Usuario Registrado',
      provider: 'email',
      isSuperAdmin: false,
      createdAt: comp?.firstAt ?? ov?.updatedAt ?? new Date().toISOString(),
      companiesCount: comp?.count ?? 0,
      status: ov?.status ?? 'ACTIVO'
    });
  }
  return users;
}

export function getAdminMetricsRepo(): AdminPlatformMetrics {
  const users = getAdminUsersRepo();
  const nowMs = Date.now();
  const since7dMs = nowMs - 7 * 86_400_000;
  const since30dMs = nowMs - 30 * 86_400_000;
  const since7dIso = new Date(since7dMs).toISOString();

  return {
    totalUsers: users.length,
    newUsers7d: users.filter((u) => new Date(u.createdAt).getTime() >= since7dMs).length,
    newUsers30d: users.filter((u) => new Date(u.createdAt).getTime() >= since30dMs).length,
    totalCompanies: countQ(`SELECT COUNT(*) as c FROM companies WHERE ${NON_DEMO}`),
    activeCompaniesCount: countQ(
      `SELECT COUNT(*) as c FROM companies c WHERE ${NON_DEMO} AND (EXISTS (SELECT 1 FROM polizas p WHERE p.company_id = c.id) OR EXISTS (SELECT 1 FROM cfdi_documents cf WHERE cf.company_id = c.id))`
    ),
    companiesWithFielCount: countQ(
      `SELECT COUNT(DISTINCT f.company_id) as c FROM fiel_credentials f INNER JOIN companies c ON c.id = f.company_id WHERE ${NON_DEMO}`
    ),
    totalPolizas: countQ(`SELECT COUNT(*) as c FROM polizas WHERE company_id IN (SELECT id FROM companies WHERE ${NON_DEMO})`),
    totalCfdis: countQ(`SELECT COUNT(*) as c FROM cfdi_documents WHERE company_id IN (SELECT id FROM companies WHERE ${NON_DEMO})`),
    satErrors7d: countQ(
      `SELECT COUNT(*) as c FROM sat_download_requests WHERE created_at >= ? AND (estado_solicitud = 'ERROR' OR COALESCE(codigo_estado_sat, '') NOT IN ('', '5000', '3'))`,
      since7dIso
    ),
    supabaseConnected: true,
    googleAdsActive: true,
    satSoapOnline: true,
    lastSyncIso: new Date().toISOString()
  };
}

export function getAdminCompaniesRepo(): AdminCompanyWithWorkspace[] {
  const rows = db
    .query('SELECT id, name, rfc, regimen_fiscal, codigo_postal, current_year, current_period, user_id, created_at FROM companies ORDER BY created_at DESC')
    .all() as Array<{
      id: string; name: string; rfc: string; regimen_fiscal: string; codigo_postal: string;
      current_year: number; current_period: number; user_id: string | null; created_at: string;
    }>;

  const polByComp = new Map(
    (db.query('SELECT company_id, COUNT(*) as cnt, MAX(created_at) as last_at FROM polizas GROUP BY company_id').all() as Array<{
      company_id: string; cnt: number; last_at: string | null;
    }>).map((r) => [r.company_id, r])
  );
  const cfdiByComp = new Map(
    (db.query('SELECT company_id, COUNT(*) as cnt, MAX(fecha) as last_date FROM cfdi_documents GROUP BY company_id').all() as Array<{
      company_id: string; cnt: number; last_date: string | null;
    }>).map((r) => [r.company_id, r])
  );
  const fielByComp = new Map(
    (db.query('SELECT company_id, valid_to FROM fiel_credentials').all() as Array<{ company_id: string; valid_to: string }>)
      .map((r) => [r.company_id, r.valid_to])
  );
  const workspaceByUserId = new Map<string, string | null>();
  const profileCols = tableColumns('user_profiles');
  if (profileCols.has('workspace_id')) {
    const profRows = db.query('SELECT id, workspace_id FROM user_profiles').all() as Array<{ id: string; workspace_id: string | null }>;
    for (const p of profRows) workspaceByUserId.set(p.id, p.workspace_id ?? null);
  }
  const usersById = new Map(getAdminUsersRepo().map((u) => [u.id, u]));

  return rows.map((r) => {
    const rawUserId = r.user_id ?? undefined;
    const pol = polByComp.get(r.id);
    const cfdi = cfdiByComp.get(r.id);
    const fielValidTo = fielByComp.get(r.id) ?? null;
    const isDemo =
      !rawUserId ||
      rawUserId === 'demo' ||
      r.rfc.toUpperCase() === 'CEJ2106158A0' ||
      r.name.toUpperCase().startsWith('[DEMO]');
    const base: AdminCompanyWithWorkspace = {
      id: r.id,
      name: r.name,
      rfc: r.rfc,
      regimenFiscal: r.regimen_fiscal,
      codigoPostal: r.codigo_postal,
      currentYear: r.current_year,
      currentPeriod: r.current_period,
      createdAt: r.created_at,
      polizasCount: Number(pol?.cnt ?? 0),
      cfdisCount: Number(cfdi?.cnt ?? 0),
      hasFiel: fielValidTo !== null,
      fielValidTo,
      lastActivityAt: pickLatestIso(pol?.last_at ?? null, cfdi?.last_date ?? null),
      userWorkspaceId: !isDemo && rawUserId ? (workspaceByUserId.get(rawUserId) ?? null) : null
    };

    if (isDemo) {
      return { ...base, ownerType: 'demo' as const };
    }
    const owner = usersById.get(rawUserId);
    const isSuper = Boolean(owner?.isSuperAdmin);
    return {
      ...base,
      userId: rawUserId,
      userEmail: owner?.email,
      userFullName: owner?.fullName || 'Usuario Registrado',
      userProvider: owner?.provider,
      userIsSuperAdmin: isSuper,
      ownerType: isSuper ? ('superadmin' as const) : ('user' as const)
    };
  });
}

export function getAdminSatHealthRepo(): AdminSatHealthResponse {
  const since7dIso = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const agg = db.query(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN UPPER(COALESCE(estado_solicitud, '')) IN ('TERMINADA', 'COMPLETADA') THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN UPPER(COALESCE(estado_solicitud, '')) IN ('ACEPTADA', 'EN_PROCESO', 'SOLICITADA') THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN UPPER(COALESCE(estado_solicitud, '')) NOT IN ('TERMINADA', 'COMPLETADA', 'ACEPTADA', 'EN_PROCESO', 'SOLICITADA') THEN 1 ELSE 0 END) as failed
    FROM sat_download_requests WHERE created_at >= ?
  `).get(since7dIso) as { total: number; completed: number | null; pending: number | null; failed: number | null } | null;

  const breakdown = db.query(`
    SELECT COALESCE(NULLIF(codigo_estado_sat, ''), estado_solicitud) as code, COUNT(*) as count
    FROM sat_download_requests
    WHERE created_at >= ? AND (estado_solicitud = 'ERROR' OR COALESCE(codigo_estado_sat, '') NOT IN ('', '5000', '3'))
    GROUP BY code ORDER BY count DESC
  `).all(since7dIso) as Array<{ code: string; count: number }>;

  const recentRows = db.query(`
    SELECT s.id, s.company_id, c.name as company_name, c.rfc as company_rfc, s.tipo_solicitud,
           s.estado_solicitud, s.codigo_estado_sat, s.mensaje_sat, s.cfdis_descargados, s.created_at
    FROM sat_download_requests s INNER JOIN companies c ON c.id = s.company_id
    ORDER BY s.created_at DESC LIMIT 30
  `).all() as Array<{
    id: string; company_id: string; company_name: string; company_rfc: string; tipo_solicitud: string;
    estado_solicitud: string; codigo_estado_sat: string; mensaje_sat: string; cfdis_descargados: number; created_at: string;
  }>;

  const recentRequests: AdminSatRequestSummary[] = recentRows.map((r) => ({
    id: r.id, companyId: r.company_id, companyName: r.company_name, companyRfc: r.company_rfc,
    tipoSolicitud: r.tipo_solicitud, estadoSolicitud: r.estado_solicitud, codigoEstadoSat: r.codigo_estado_sat,
    mensajeSat: r.mensaje_sat, cfdisDescargados: Number(r.cfdis_descargados), createdAt: r.created_at
  }));

  const fielRows = db.query(`
    SELECT f.company_id, c.name as company_name, c.rfc as company_rfc, f.rfc_titular, f.numero_serie, f.valid_to
    FROM fiel_credentials f INNER JOIN companies c ON c.id = f.company_id ORDER BY f.valid_to ASC
  `).all() as Array<{
    company_id: string; company_name: string; company_rfc: string; rfc_titular: string; numero_serie: string; valid_to: string;
  }>;

  const nowMs = Date.now();
  const expiringFiels: AdminFielExpirySummary[] = fielRows.map((r) => ({
    companyId: r.company_id, companyName: r.company_name, companyRfc: r.company_rfc,
    rfcTitular: r.rfc_titular, numeroSerie: r.numero_serie, validTo: r.valid_to,
    daysRemaining: Math.ceil((new Date(r.valid_to).getTime() - nowMs) / 86_400_000)
  }));

  return {
    totalRequests7d: Number(agg?.total ?? 0),
    completedRequests7d: Number(agg?.completed ?? 0),
    pendingRequests7d: Number(agg?.pending ?? 0),
    failedRequests7d: Number(agg?.failed ?? 0),
    errorCodeBreakdown: breakdown.map((b) => ({ code: b.code, count: Number(b.count) })),
    recentRequests,
    expiringFiels,
    checkedAtIso: new Date().toISOString()
  };
}

export function getAdminCompanyDetailRepo(companyId: string): AdminCompanyDetail | null {
  const company = getAdminCompaniesRepo().find((c) => c.id === companyId);
  if (!company) return null;

  const fiel = db.query('SELECT numero_serie, valid_to FROM fiel_credentials WHERE company_id = ?')
    .get(companyId) as { numero_serie: string; valid_to: string } | null;
  const lock = db.query('SELECT is_locked FROM period_locks WHERE company_id = ? AND ejercicio = ? AND periodo = ?')
    .get(companyId, company.currentYear, company.currentPeriod) as { is_locked: number } | null;
  const lastPol = db.query('SELECT MAX(created_at) as d FROM polizas WHERE company_id = ?').get(companyId) as { d: string | null } | null;
  const lastCfdi = db.query('SELECT MAX(fecha) as d FROM cfdi_documents WHERE company_id = ?').get(companyId) as { d: string | null } | null;

  return {
    company,
    accountsCount: countQ('SELECT COUNT(*) as c FROM accounts WHERE company_id = ?', companyId),
    polizasCount: countQ('SELECT COUNT(*) as c FROM polizas WHERE company_id = ?', companyId),
    cfdisCount: countQ('SELECT COUNT(*) as c FROM cfdi_documents WHERE company_id = ?', companyId),
    bankLinesCount: countQ('SELECT COUNT(*) as c FROM bank_statement_lines WHERE company_id = ?', companyId),
    hasFiel: fiel !== null,
    fielValidTo: fiel?.valid_to ?? null,
    fielNumeroSerie: fiel?.numero_serie ?? null,
    isCurrentPeriodLocked: Boolean(lock?.is_locked),
    lastPolizaAt: lastPol?.d ?? null,
    lastCfdiDate: lastCfdi?.d ?? null
  };
}
