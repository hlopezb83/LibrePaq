import { supabase } from '../supabase';
import type {
  AdminPlatformMetrics,
  AdminCompanySummary,
  AdminUserSummary
} from '../../shared/admin-types';
import { adminApi } from '../api/admin.api';

function inferNameFromCompany(companyName: string): string | undefined {
  const match = /^Despacho Contable\s*-\s*(.+)$/i.exec(companyName.trim());
  return match?.[1]?.trim() || undefined;
}

export const supabaseAdminApi = {
  async getAdminCompanies(): Promise<AdminCompanySummary[]> {
    if (!supabase) return [];

    const [compRes, profRes, authRes] = await Promise.all([
      supabase.from('companies').select('*').order('created_at', { ascending: false }),
      supabase.from('user_profiles').select('*'),
      supabase.auth.getUser()
    ]);

    if (compRes.error || !compRes.data) {
      console.warn('Error al consultar empresas en Supabase Cloud:', compRes.error?.message);
      return [];
    }

    const profilesById = new Map<string, Record<string, unknown>>();
    for (const p of (profRes.data || []) as Array<Record<string, unknown>>) {
      if (p.id) profilesById.set(String(p.id), p);
    }
    const currentUser = authRes.data?.user;

    return compRes.data.map((c: Record<string, unknown>) => {
      const rawUserId = c.user_id ? String(c.user_id) : undefined;
      const companyName = String(c.name || '');

      const isDemo =
        !rawUserId ||
        rawUserId === 'demo' ||
        String(c.rfc || '').toUpperCase() === 'CEJ2106158A0' ||
        companyName.toUpperCase().startsWith('[DEMO]');

      if (isDemo) {
        return {
          id: String(c.id),
          name: companyName,
          rfc: String(c.rfc),
          regimenFiscal: String(c.regimen_fiscal || '601 - General de Ley Personas Morales'),
          codigoPostal: String(c.codigo_postal || '64000'),
          currentYear: Number(c.current_year || 2026),
          currentPeriod: Number(c.current_period || 10),
          ownerType: 'demo',
          createdAt: String(c.created_at || new Date().toISOString())
        };
      }

      const profile = profilesById.get(rawUserId);
      if (profile) {
        const email = String(profile.email || '');
        const isSuper = email.toLowerCase() === 'hlopezb@gmail.com' || Boolean(profile.is_superadmin);
        return {
          id: String(c.id),
          name: companyName,
          rfc: String(c.rfc),
          regimenFiscal: String(c.regimen_fiscal || '601 - General de Ley Personas Morales'),
          codigoPostal: String(c.codigo_postal || '64000'),
          currentYear: Number(c.current_year || 2026),
          currentPeriod: Number(c.current_period || 10),
          userId: rawUserId,
          userEmail: email || undefined,
          userFullName: String(profile.full_name || email.split('@')[0] || 'Usuario Registrado'),
          userProvider: (profile.provider as 'google' | 'email') || 'email',
          userIsSuperAdmin: isSuper,
          ownerType: isSuper ? 'superadmin' : 'user',
          createdAt: String(c.created_at || new Date().toISOString())
        };
      }

      if (currentUser && currentUser.id === rawUserId) {
        const email = currentUser.email || 'hlopezb@gmail.com';
        const isSuper = email.toLowerCase() === 'hlopezb@gmail.com';
        return {
          id: String(c.id),
          name: companyName,
          rfc: String(c.rfc),
          regimenFiscal: String(c.regimen_fiscal || '601 - General de Ley Personas Morales'),
          codigoPostal: String(c.codigo_postal || '64000'),
          currentYear: Number(c.current_year || 2026),
          currentPeriod: Number(c.current_period || 10),
          userId: rawUserId,
          userEmail: email,
          userFullName: String(currentUser.user_metadata?.full_name || 'Hector Lopez'),
          userProvider: (currentUser.app_metadata?.provider as 'google' | 'email') || 'email',
          userIsSuperAdmin: isSuper,
          ownerType: isSuper ? 'superadmin' : 'user',
          createdAt: String(c.created_at || new Date().toISOString())
        };
      }

      return {
        id: String(c.id),
        name: companyName,
        rfc: String(c.rfc),
        regimenFiscal: String(c.regimen_fiscal || '601 - General de Ley Personas Morales'),
        codigoPostal: String(c.codigo_postal || '64000'),
        currentYear: Number(c.current_year || 2026),
        currentPeriod: Number(c.current_period || 10),
        userId: rawUserId,
        userFullName: inferNameFromCompany(companyName) || 'Usuario Registrado',
        ownerType: 'user',
        createdAt: String(c.created_at || new Date().toISOString())
      };
    });
  },

  async getAdminUsers(): Promise<AdminUserSummary[]> {
    if (!supabase) return [];

    const { data: profiles, error: profErr } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: allCompanies } = await supabase.from('companies').select('*');
    const compList = (allCompanies || []) as Array<Record<string, unknown>>;

    if (!profErr && profiles && profiles.length > 0) {
      return profiles.map((p: Record<string, unknown>) => {
        const uid = String(p.id);
        const email = String(p.email || '').toLowerCase();
        const isSuper = email === 'hlopezb@gmail.com' || Boolean(p.is_superadmin);
        const userCompCount = compList.filter((c) => String(c.user_id || '') === uid).length;
        const meta = (p.raw_user_meta_data as Record<string, unknown> | undefined) || {};

        const displayName = String(p.full_name || email.split('@')[0] || 'Contador');
        const gclid = p.gclid ? String(p.gclid) : meta.gclid ? String(meta.gclid) : undefined;
        const rawSource = String(p.acquisition_source || meta.acquisition_source || '');
        const acquisitionSource: AdminUserSummary['acquisitionSource'] =
          rawSource === 'google_ads' || gclid
            ? 'google_ads'
            : rawSource === 'utm'
            ? 'utm'
            : rawSource
            ? 'organic_or_direct'
            : undefined;

        return {
          id: uid,
          email: String(p.email || ''),
          fullName: displayName,
          workspaceId: isSuper
            ? undefined
            : String(p.workspace_id || meta.workspace_id || `ws_${uid.slice(0, 8)}`),
          workspaceName: isSuper
            ? undefined
            : String(p.workspace_name || meta.workspace_name || `Workspace — ${displayName}`),
          provider: (p.provider as 'google' | 'email') || 'email',
          acquisitionSource,
          gclid,
          utmCampaign: p.utm_campaign
            ? String(p.utm_campaign)
            : meta.utm_campaign
            ? String(meta.utm_campaign)
            : undefined,
          utmTerm: p.utm_term
            ? String(p.utm_term)
            : meta.utm_term
            ? String(meta.utm_term)
            : undefined,
          isSuperAdmin: isSuper,
          createdAt: String(p.created_at || new Date().toISOString()),
          lastSignInAt: p.last_sign_in_at ? String(p.last_sign_in_at) : undefined,
          companiesCount: userCompCount,
          status: (p.status as 'ACTIVO' | 'SUSPENDIDO') || 'ACTIVO'
        };
      });
    }

    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData?.user;
    const ownerId = currentUser?.id || 'usr_owner_hlopez';
    const ownerEmail = currentUser?.email || 'hlopezb@gmail.com';
    const ownerName = currentUser?.user_metadata?.full_name || 'Hector Lopez';

    const fallbackUsers: AdminUserSummary[] = [
      {
        id: ownerId,
        email: ownerEmail,
        fullName: ownerName,
        provider: (currentUser?.app_metadata?.provider as 'google' | 'email') || 'email',
        isSuperAdmin: true,
        createdAt: currentUser?.created_at || '2026-10-23T00:11:55.952Z',
        lastSignInAt: currentUser?.last_sign_in_at || new Date().toISOString(),
        companiesCount: compList.filter((c) => String(c.user_id || '') === ownerId).length,
        status: 'ACTIVO'
      }
    ];

    const seenIds = new Set<string>([ownerId]);
    for (const c of compList) {
      const uid = c.user_id ? String(c.user_id) : '';
      if (!uid || uid === 'demo' || seenIds.has(uid)) continue;
      seenIds.add(uid);
      const inferredName = inferNameFromCompany(String(c.name || '')) || 'Usuario Registrado';
      fallbackUsers.push({
        id: uid,
        email: `UID ${uid.slice(0, 8)}… (habilitar política RLS)`,
        fullName: inferredName,
        provider: 'google',
        isSuperAdmin: false,
        createdAt: String(c.created_at || new Date().toISOString()),
        companiesCount: compList.filter((row) => String(row.user_id || '') === uid).length,
        status: 'ACTIVO'
      });
    }

    return fallbackUsers;
  },

  async getAdminMetrics(): Promise<AdminPlatformMetrics> {
    if (!supabase) {
      return {
        totalUsers: 1,
        totalCompanies: 0,
        totalPolizas: 0,
        totalCfdis: 0,
        supabaseConnected: false,
        googleAdsActive: true,
        satSoapOnline: true,
        lastSyncIso: new Date().toISOString()
      };
    }

    const [usrRes, compRes] = await Promise.all([
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('companies').select('id, name, rfc, user_id')
    ]);

    const compRows = (compRes.data || []) as Array<Record<string, unknown>>;
    const realCompanies = compRows.filter(
      (c) =>
        String(c.rfc || '').toUpperCase() !== 'CEJ2106158A0' &&
        !String(c.name || '').toUpperCase().startsWith('[DEMO]')
    );
    const realCompanyIds = realCompanies.map((c) => String(c.id));

    let polCount = 0;
    let cfdiCount = 0;
    if (realCompanyIds.length > 0) {
      const [polRes, cfdiRes] = await Promise.all([
        supabase.from('polizas').select('*', { count: 'exact', head: true }).in('company_id', realCompanyIds),
        supabase.from('cfdi_documents').select('*', { count: 'exact', head: true }).in('company_id', realCompanyIds)
      ]);
      polCount = polRes.count ?? 0;
      cfdiCount = cfdiRes.count ?? 0;
    }

    const distinctTenantUsers = new Set(
      realCompanies.map((c) => (c.user_id ? String(c.user_id) : '')).filter((id) => id && id !== 'demo')
    );
    const inferredMinUsers = Math.max(1, distinctTenantUsers.size);

    return {
      totalUsers: Math.max(inferredMinUsers, usrRes.count ?? 0),
      totalCompanies: realCompanies.length,
      totalPolizas: polCount,
      totalCfdis: cfdiCount,
      supabaseConnected: true,
      googleAdsActive: true,
      satSoapOnline: true,
      lastSyncIso: new Date().toISOString()
    };
  },

  getBroadcastMessage: adminApi.getBroadcastMessage,
  setBroadcastMessage: adminApi.setBroadcastMessage,

  async updateUserProfileWorkspace(payload: {
    userId: string;
    workspaceId: string;
    workspaceName: string;
    acquisitionSource?: string;
    gclid?: string | null;
    utmCampaign?: string | null;
    utmTerm?: string | null;
  }): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.auth.updateUser({
        data: {
          workspace_id: payload.workspaceId,
          workspace_name: payload.workspaceName,
          workspace_created_at: new Date().toISOString(),
          acquisition_source: payload.acquisitionSource || 'organic_or_direct',
          gclid: payload.gclid || null,
          utm_campaign: payload.utmCampaign || null,
          utm_term: payload.utmTerm || null
        }
      });
      await supabase
        .from('user_profiles')
        .update({
          workspace_id: payload.workspaceId,
          workspace_name: payload.workspaceName,
          acquisition_source: payload.acquisitionSource || 'organic_or_direct',
          gclid: payload.gclid || null,
          utm_campaign: payload.utmCampaign || null,
          utm_term: payload.utmTerm || null
        })
        .eq('id', payload.userId);
    } catch {
      // best-effort update
    }
  }
};
