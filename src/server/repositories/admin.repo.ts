import { db } from '../connection';
import type {
  AdminPlatformMetrics,
  AdminCompanySummary,
  AdminUserSummary
} from '../../shared/admin-types';

export function getAdminMetricsRepo(): AdminPlatformMetrics {
  const compRow = db
    .query(
      "SELECT COUNT(*) as c FROM companies WHERE rfc != 'CEJ2106158A0' AND name NOT LIKE '[DEMO]%'"
    )
    .get() as { c: number } | null;
  const polRow = db
    .query(
      "SELECT COUNT(*) as c FROM polizas WHERE company_id IN (SELECT id FROM companies WHERE rfc != 'CEJ2106158A0' AND name NOT LIKE '[DEMO]%')"
    )
    .get() as { c: number } | null;
  const cfdiRow = db
    .query(
      "SELECT COUNT(*) as c FROM cfdi_documents WHERE company_id IN (SELECT id FROM companies WHERE rfc != 'CEJ2106158A0' AND name NOT LIKE '[DEMO]%')"
    )
    .get() as { c: number } | null;

  return {
    totalUsers: 1, // hlopezb@gmail.com
    totalCompanies: compRow?.c ?? 0,
    totalPolizas: polRow?.c ?? 0,
    totalCfdis: cfdiRow?.c ?? 0,
    supabaseConnected: true,
    googleAdsActive: true,
    satSoapOnline: true,
    lastSyncIso: new Date().toISOString()
  };
}

export function getAdminCompaniesRepo(): AdminCompanySummary[] {
  const rows = db.query(`
    SELECT id, name, rfc, regimen_fiscal, codigo_postal, current_year, current_period, user_id, created_at
    FROM companies
    ORDER BY created_at DESC
  `).all() as Array<{
    id: string;
    name: string;
    rfc: string;
    regimen_fiscal: string;
    codigo_postal: string;
    current_year: number;
    current_period: number;
    user_id: string | null;
    created_at: string;
  }>;

  const usersById = new Map(getAdminUsersRepo().map((u) => [u.id, u]));

  return rows.map((r) => {
    const rawUserId = r.user_id ?? undefined;
    if (!rawUserId || rawUserId === 'demo') {
      return {
        id: r.id,
        name: r.name,
        rfc: r.rfc,
        regimenFiscal: r.regimen_fiscal,
        codigoPostal: r.codigo_postal,
        currentYear: r.current_year,
        currentPeriod: r.current_period,
        ownerType: 'demo' as const,
        createdAt: r.created_at
      };
    }

    const owner = usersById.get(rawUserId);
    const isSuper = Boolean(owner?.isSuperAdmin);
    return {
      id: r.id,
      name: r.name,
      rfc: r.rfc,
      regimenFiscal: r.regimen_fiscal,
      codigoPostal: r.codigo_postal,
      currentYear: r.current_year,
      currentPeriod: r.current_period,
      userId: rawUserId,
      userEmail: owner?.email,
      userFullName: owner?.fullName || 'Usuario Registrado',
      userProvider: owner?.provider,
      userIsSuperAdmin: isSuper,
      ownerType: isSuper ? ('superadmin' as const) : ('user' as const),
      createdAt: r.created_at
    };
  });
}

export function getAdminUsersRepo(): AdminUserSummary[] {
  // En servidor local/test retorna el superadmin oficial
  return [
    {
      id: 'usr_owner_hlopez',
      email: 'hlopezb@gmail.com',
      fullName: 'Hector Lopez',
      provider: 'google',
      isSuperAdmin: true,
      createdAt: '2026-10-23T00:11:55.952Z',
      lastSignInAt: new Date().toISOString(),
      companiesCount: 5,
      status: 'ACTIVO'
    }
  ];
}
