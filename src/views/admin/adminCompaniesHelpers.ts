import type { AdminCompanySummary, AdminUserSummary } from '../../shared/admin-types';

export type CompanySort = 'createdAt' | 'polizasCount' | 'cfdisCount';

export type EnrichedAdminCompany = AdminCompanySummary & {
  resolvedOwnerType: 'demo' | 'superadmin' | 'user';
};

export function enrichAndSortCompanies(
  companies: AdminCompanySummary[],
  usersById: Map<string, AdminUserSummary>,
  sortBy: CompanySort,
  sortDir: 'asc' | 'desc'
): EnrichedAdminCompany[] {
  const enriched: EnrichedAdminCompany[] = companies.map((c) => {
    if (!c.userId || c.ownerType === 'demo') return { ...c, resolvedOwnerType: 'demo' as const };
    const matched = usersById.get(c.userId);
    const userEmail = c.userEmail || (matched && !matched.email.startsWith('UID ') ? matched.email : undefined);
    const userFullName = c.userFullName || matched?.fullName || 'Usuario Registrado';
    const userProvider = c.userProvider || matched?.provider;
    const userIsSuperAdmin = Boolean(c.userIsSuperAdmin ?? matched?.isSuperAdmin);
    return {
      ...c,
      userEmail,
      userFullName,
      userProvider,
      userIsSuperAdmin,
      resolvedOwnerType: userIsSuperAdmin ? ('superadmin' as const) : ('user' as const)
    };
  });

  const factor = sortDir === 'asc' ? 1 : -1;
  return enriched.sort((a, b) => {
    if (sortBy === 'polizasCount') return ((a.polizasCount ?? 0) - (b.polizasCount ?? 0)) * factor;
    if (sortBy === 'cfdisCount') return ((a.cfdisCount ?? 0) - (b.cfdisCount ?? 0)) * factor;
    return ((Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0)) * factor;
  });
}
