import { getRequiredSupabase, supabase } from '../supabase';
import type { AccountNature, AccountType, AccountWithBalance, Company } from '../../shared/types';
import { fetchAllRows } from './supabase-pagination';

export function mapSupabaseCompany(row: Record<string, unknown>): Company {
  return {
    id: String(row.id),
    name: String(row.name),
    rfc: String(row.rfc),
    regimenFiscal: String(row.regimen_fiscal),
    codigoPostal: String(row.codigo_postal),
    maskFormat: String(row.mask_format || 'XXX-XX-XXX'),
    currentYear: Number(row.current_year || 2026),
    currentPeriod: Number(row.current_period || 10),
    createdAt: String(row.created_at || new Date().toISOString()),
    userId: row.user_id ? String(row.user_id) : null,
    organizationId: row.organization_id ? String(row.organization_id) : null
  };
}

export function mapSupabaseAccount(row: Record<string, unknown>): AccountWithBalance {
  const isAffectable = Boolean(row.is_affectable);
  const initialBalance = Number(row.initial_balance || 0);
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    code: String(row.code),
    name: String(row.name),
    parentCode: row.parent_code ? String(row.parent_code) : null,
    type: row.type as AccountType,
    nature: row.nature as AccountNature,
    level: Number(row.level || 1),
    isAffectable,
    satGroupCode: String(row.sat_group_code || ''),
    currency: (row.currency as 'MXN' | 'USD') || 'MXN',
    initialBalance,
    initialBalanceComputed: initialBalance,
    periodCharges: 0,
    periodCredits: 0,
    finalBalance: initialBalance
  };
}

export async function fetchCompanyAccountsFromDb(companyId: string): Promise<AccountWithBalance[]> {
  if (!supabase) return [];
  const data = await fetchAllRows(async (from, to) =>
    getRequiredSupabase()
      .from('accounts')
      .select('*')
      .eq('company_id', companyId)
      .order('code', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  );
  return data.map(mapSupabaseAccount);
}
