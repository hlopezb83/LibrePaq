import { supabase } from '../supabase';
import type { AdminPlatformMetrics, AdminCompanySummary, AdminUserSummary } from '../../shared/admin-types';
import { isDemoCompanyRecord, isSatErrorCode } from '../../shared/admin-constants';
import { adminApi } from '../api/admin.api';
import { hasPlatformAdminAccess, isSuperAdminEmail, normalizePlatformRole } from '../../shared/superadmin';
import { fetchAllRows } from './supabase-pagination';

type Row = Record<string, unknown>;

const inferName = (name: string): string | undefined =>
  /^Despacho Contable\s*-\s*(.+)$/i.exec(name.trim())?.[1]?.trim() || undefined;

async function countTableExactForCompany(table: 'polizas' | 'cfdi_documents', companyId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('company_id', companyId);
  return error ? 0 : (count ?? 0);
}

async function fetchCompanyCountsBatched(
  companyIds: string[]
): Promise<{ polMap: Map<string, number>; cfdiMap: Map<string, number> }> {
  const polMap = new Map<string, number>();
  const cfdiMap = new Map<string, number>();
  const BATCH_SIZE = 20;
  for (let i = 0; i < companyIds.length; i += BATCH_SIZE) {
    const batch = companyIds.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (cid) => {
        const [polCnt, cfdiCnt] = await Promise.all([
          countTableExactForCompany('polizas', cid),
          countTableExactForCompany('cfdi_documents', cid)
        ]);
        polMap.set(cid, polCnt);
        cfdiMap.set(cid, cfdiCnt);
      })
    );
  }
  return { polMap, cfdiMap };
}

function mapUserProfileRow(p: Row, compList: Row[]): AdminUserSummary {
  const uid = String(p.id);
  const email = String(p.email || '').toLowerCase();
  const platformRole = normalizePlatformRole(
    p.platform_role ? String(p.platform_role) : null, Boolean(p.is_superadmin), email
  );
  const isSuper = platformRole === 'SUPERADMIN';
  const meta = (p.raw_user_meta_data as Row | undefined) || {};
  const displayName = String(p.full_name || email.split('@')[0] || 'Contador');
  const gclid = p.gclid ? String(p.gclid) : meta.gclid ? String(meta.gclid) : undefined;
  const rawSrc = String(p.acquisition_source || meta.acquisition_source || '');
  const acquisitionSource: AdminUserSummary['acquisitionSource'] =
    rawSrc === 'google_ads' || gclid ? 'google_ads' : rawSrc === 'utm' ? 'utm' : rawSrc ? 'organic_or_direct' : undefined;

  return {
    id: uid, email: String(p.email || ''), fullName: displayName,
    workspaceId: isSuper ? undefined : String(p.workspace_id || meta.workspace_id || `ws_${uid.slice(0, 8)}`),
    workspaceName: isSuper ? undefined : String(p.workspace_name || meta.workspace_name || `Workspace — ${displayName}`),
    provider: (p.provider as 'google' | 'email') || 'email', acquisitionSource, gclid,
    utmCampaign: p.utm_campaign ? String(p.utm_campaign) : meta.utm_campaign ? String(meta.utm_campaign) : undefined,
    utmTerm: p.utm_term ? String(p.utm_term) : meta.utm_term ? String(meta.utm_term) : undefined,
    isSuperAdmin: isSuper, platformRole, createdAt: String(p.created_at || new Date().toISOString()),
    lastSignInAt: p.last_sign_in_at ? String(p.last_sign_in_at) : undefined,
    companiesCount: compList.filter((c) => String(c.user_id || '') === uid).length,
    status: (p.status as 'ACTIVO' | 'SUSPENDIDO') || 'ACTIVO'
  };
}

export const supabaseAdminApi = {
  async getAdminCompanies(): Promise<AdminCompanySummary[]> {
    const client = supabase;
    if (!client) return [];
    let compRows: Row[];
    try {
      compRows = await fetchAllRows<Row>((from, to) =>
        client.from('companies').select('*').order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to)
      );
    } catch (err) {
      console.warn('Error al consultar empresas en Supabase Cloud:', err instanceof Error ? err.message : String(err));
      return [];
    }

    const [profRows, authRes] = await Promise.all([
      fetchAllRows<Row>((from, to) =>
        client.from('user_profiles').select('*').order('id', { ascending: true }).range(from, to)
      ).catch(() => [] as Row[]),
      client.auth.getUser()
    ]);

    const profilesById = new Map<string, Row>();
    for (const p of profRows) if (p.id) profilesById.set(String(p.id), p);
    const currentUser = authRes.data?.user;
    const callerProfile = currentUser?.id ? profilesById.get(currentUser.id) : undefined;
    const callerRole = normalizePlatformRole(
      callerProfile?.platform_role ? String(callerProfile.platform_role) : null,
      Boolean(callerProfile?.is_superadmin), currentUser?.email
    );
    const hasAdminAccess = hasPlatformAdminAccess(callerRole);

    let polMap = new Map<string, number>(), cfdiMap = new Map<string, number>();
    const fielMap = new Map<string, string | null>();
    if (hasAdminAccess && compRows.length > 0) {
      const companyIds = compRows.map((c) => String(c.id));
      const [counts, fielRows] = await Promise.all([
        fetchCompanyCountsBatched(companyIds),
        fetchAllRows<Row>((from, to) =>
          client.from('fiel_credentials').select('company_id, valid_to').order('company_id', { ascending: true }).range(from, to)
        ).catch(() => [] as Row[])
      ]);
      polMap = counts.polMap;
      cfdiMap = counts.cfdiMap;
      for (const f of fielRows) if (f.company_id) fielMap.set(String(f.company_id), f.valid_to ? String(f.valid_to) : null);
    }

    return compRows.map((c: Row) => {
      const id = String(c.id), rawUserId = c.user_id ? String(c.user_id) : undefined, name = String(c.name || '');
      const isDemo = isDemoCompanyRecord({ rfc: c.rfc, name, user_id: rawUserId });
      const base: AdminCompanySummary = {
        id, name, rfc: String(c.rfc), regimenFiscal: String(c.regimen_fiscal || '601 - General de Ley Personas Morales'),
        codigoPostal: String(c.codigo_postal || '64000'), currentYear: Number(c.current_year || 2026),
        currentPeriod: Number(c.current_period || 10), ownerType: isDemo ? 'demo' : 'user',
        createdAt: String(c.created_at || new Date().toISOString()),
        ...(hasAdminAccess ? { polizasCount: polMap.get(id) ?? 0, cfdisCount: cfdiMap.get(id) ?? 0, hasFiel: fielMap.has(id), fielValidTo: fielMap.get(id) ?? null } : {})
      };
      if (isDemo) return base;

      const profile = rawUserId ? profilesById.get(rawUserId) : undefined;
      if (profile) {
        const email = String(profile.email || '');
        const isSuper = normalizePlatformRole(profile.platform_role ? String(profile.platform_role) : null, Boolean(profile.is_superadmin), email) === 'SUPERADMIN';
        return {
          ...base, userId: rawUserId, userEmail: email || undefined,
          userFullName: String(profile.full_name || email.split('@')[0] || 'Usuario Registrado'),
          userProvider: (profile.provider as 'google' | 'email') || 'email',
          userWorkspaceId: profile.workspace_id ? String(profile.workspace_id) : null,
          userIsSuperAdmin: isSuper, ownerType: isSuper ? 'superadmin' : 'user'
        };
      }
      if (currentUser && currentUser.id === rawUserId) {
        const email = currentUser.email || 'hlopezb@gmail.com', isSuper = isSuperAdminEmail(email);
        return {
          ...base, userId: rawUserId, userEmail: email,
          userFullName: String(currentUser.user_metadata?.full_name || 'Hector Lopez'),
          userProvider: (currentUser.app_metadata?.provider as 'google' | 'email') || 'email',
          userIsSuperAdmin: isSuper, ownerType: isSuper ? 'superadmin' : 'user'
        };
      }
      return { ...base, userId: rawUserId, userFullName: inferName(name) || 'Usuario Registrado' };
    });
  },

  async getAdminUsers(): Promise<AdminUserSummary[]> {
    const client = supabase;
    if (!client) return [];
    const [profiles, compList] = await Promise.all([
      fetchAllRows<Row>((from, to) =>
        client.from('user_profiles').select('*').order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to)
      ).catch(() => [] as Row[]),
      fetchAllRows<Row>((from, to) =>
        client.from('companies').select('*').order('id', { ascending: true }).range(from, to)
      ).catch(() => [] as Row[])
    ]);
    if (profiles.length > 0) return profiles.map((p) => mapUserProfileRow(p, compList));

    const { data: authData } = await client.auth.getUser();
    const u = authData?.user, ownerId = u?.id || 'usr_owner_hlopez';
    const fallbackUsers: AdminUserSummary[] = [{
      id: ownerId, email: u?.email || 'hlopezb@gmail.com', fullName: u?.user_metadata?.full_name || 'Hector Lopez',
      provider: (u?.app_metadata?.provider as 'google' | 'email') || 'email', isSuperAdmin: true,
      createdAt: u?.created_at || '2026-10-23T00:11:55.952Z', lastSignInAt: u?.last_sign_in_at || new Date().toISOString(),
      companiesCount: compList.filter((c) => String(c.user_id || '') === ownerId).length, status: 'ACTIVO'
    }];

    const seen = new Set<string>([ownerId]);
    for (const c of compList) {
      const uid = c.user_id ? String(c.user_id) : '';
      if (!uid || uid === 'demo' || seen.has(uid)) continue;
      seen.add(uid);
      fallbackUsers.push({
        id: uid, email: `UID ${uid.slice(0, 8)}… (habilitar política RLS)`,
        fullName: inferName(String(c.name || '')) || 'Usuario Registrado', provider: 'google', isSuperAdmin: false,
        createdAt: String(c.created_at || new Date().toISOString()),
        companiesCount: compList.filter((r) => String(r.user_id || '') === uid).length, status: 'ACTIVO'
      });
    }
    return fallbackUsers;
  },

  async getAdminMetrics(): Promise<AdminPlatformMetrics> {
    const flags = { supabaseConnected: Boolean(supabase), googleAdsActive: true, satSoapOnline: true, lastSyncIso: new Date().toISOString() };
    if (!supabase) {
      return { totalUsers: 1, newUsers7d: 0, newUsers30d: 0, totalCompanies: 0, activeCompaniesCount: 0, companiesWithFielCount: 0, totalPolizas: 0, totalCfdis: 0, satErrors7d: 0, ...flags };
    }

    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_get_platform_summary');
    if (!rpcErr && rpcData && typeof rpcData === 'object') {
      const s = rpcData as Row;
      return {
        totalUsers: Number(s.totalUsers ?? 1), newUsers7d: Number(s.newUsers7d ?? 0), newUsers30d: Number(s.newUsers30d ?? 0),
        totalCompanies: Number(s.totalCompanies ?? 0), activeCompaniesCount: Number(s.activeCompaniesCount ?? 0),
        companiesWithFielCount: Number(s.companiesWithFielCount ?? 0), totalPolizas: Number(s.totalPolizas ?? 0),
        totalCfdis: Number(s.totalCfdis ?? 0), satErrors7d: Number(s.satErrors7d ?? 0), ...flags
      };
    }

    const client = supabase;
    const since7d = Date.now() - 7 * 86400000, since30d = Date.now() - 30 * 86400000;
    const since7dIso = new Date(since7d).toISOString();
    const [usrRows, compRows, satRows] = await Promise.all([
      fetchAllRows<Row>((from, to) =>
        client.from('user_profiles').select('id, created_at').order('id', { ascending: true }).range(from, to)
      ).catch(() => [] as Row[]),
      fetchAllRows<Row>((from, to) =>
        client.from('companies').select('id, name, rfc, user_id').order('id', { ascending: true }).range(from, to)
      ).catch(() => [] as Row[]),
      fetchAllRows<Row>((from, to) =>
        client.from('sat_download_requests').select('id, estado_solicitud, codigo_estado_sat').gte('created_at', since7dIso).order('id', { ascending: true }).range(from, to)
      ).catch(() => [] as Row[])
    ]);
    const realCompanies = compRows.filter((c) => !isDemoCompanyRecord({ rfc: c.rfc, name: c.name }));
    const realIds = realCompanies.map((c) => String(c.id));

    let totalPolizas = 0, totalCfdis = 0, activeCompaniesCount = 0, companiesWithFielCount = 0;
    if (realIds.length > 0) {
      const [{ polMap, cfdiMap }, fielRows] = await Promise.all([
        fetchCompanyCountsBatched(realIds),
        fetchAllRows<Row>((from, to) =>
          client.from('fiel_credentials').select('company_id').in('company_id', realIds).order('company_id', { ascending: true }).range(from, to)
        ).catch(() => [] as Row[])
      ]);
      for (const cid of realIds) {
        const p = polMap.get(cid) ?? 0, c = cfdiMap.get(cid) ?? 0;
        totalPolizas += p;
        totalCfdis += c;
        if (p > 0 || c > 0) activeCompaniesCount += 1;
      }
      companiesWithFielCount = new Set(fielRows.map((f) => String(f.company_id))).size;
    }

    const satErrors7d = satRows.filter((r) => isSatErrorCode(r.estado_solicitud, r.codigo_estado_sat)).length;
    const distinctUsers = new Set(realCompanies.map((c) => String(c.user_id || '')).filter((id) => id && id !== 'demo'));

    return {
      totalUsers: Math.max(1, distinctUsers.size, usrRows.length),
      newUsers7d: usrRows.filter((u) => new Date(String(u.created_at || 0)).getTime() >= since7d).length,
      newUsers30d: usrRows.filter((u) => new Date(String(u.created_at || 0)).getTime() >= since30d).length,
      totalCompanies: realCompanies.length, activeCompaniesCount, companiesWithFielCount,
      totalPolizas, totalCfdis, satErrors7d, ...flags
    };
  },

  getBroadcastMessage: adminApi.getBroadcastMessage,
  setBroadcastMessage: adminApi.setBroadcastMessage,

  async updateUserProfileWorkspace(payload: {
    userId: string; workspaceId: string; workspaceName: string; acquisitionSource?: string;
    gclid?: string | null; utmCampaign?: string | null; utmTerm?: string | null;
  }): Promise<void> {
    if (!supabase) return;
    try {
      const attrs = {
        workspace_id: payload.workspaceId, workspace_name: payload.workspaceName,
        acquisition_source: payload.acquisitionSource || 'organic_or_direct',
        gclid: payload.gclid || null, utm_campaign: payload.utmCampaign || null, utm_term: payload.utmTerm || null
      };
      await supabase.auth.updateUser({ data: { ...attrs, workspace_created_at: new Date().toISOString() } });
      await supabase.from('user_profiles').update(attrs).eq('id', payload.userId);
    } catch { /* best-effort update */ }
  }
};
