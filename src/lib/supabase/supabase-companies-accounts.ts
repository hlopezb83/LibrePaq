import { getRequiredSupabase, supabase } from '../supabase';
import { assertAccountingInvariant, validateAccountHierarchy } from '../../shared/accounting-engine';
import type { AccountWithBalance, Company } from '../../shared/types';
import { mapSupabaseCompany, mapSupabaseAccount } from './supabase-mappers';
import { fetchAllRows } from './supabase-pagination';
import { assertSupabasePeriodOpen } from './supabase-polizas';
import { seedCompanyDefaultsInSupabase } from './supabase-company-seeder';
import { supabaseReportsAndDashboard } from './supabase-reports-dashboard';

export { mapSupabaseCompany, mapSupabaseAccount };

export const supabaseCompaniesAndAccounts = {
  async getCompanies(): Promise<Company[]> {
    if (!supabase) return [];
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData?.user;

    let query = supabase.from('companies').select('*').order('created_at', { ascending: true });
    if (!currentUser?.id) {
      query = query.or('user_id.is.null,user_id.eq.demo');
    }

    let { data, error } = await query;
    if (error && error.message?.includes('user_id')) {
      const fallback = await supabase.from('companies').select('*').order('created_at', { ascending: true });
      data = fallback.data;
      error = fallback.error;
    }
    if (error) {
      console.error('[Supabase] Error al consultar empresas:', error);
      throw new Error(`[Supabase Error ${error.code || 'UNKNOWN'}]: ${error.message}`);
    }

    // Al entrar un usuario nuevo se aprovisiona su Workspace vacío (sin crear empresas falsas automáticamente)
    return (data || []).map(mapSupabaseCompany);
  },

  async createCompany(payload: {
    name: string;
    rfc: string;
    regimenFiscal: string;
    codigoPostal: string;
    currentYear?: number;
    currentPeriod?: number;
    catalogPreset?: 'SAT_STANDARD' | 'RESICO_SIMPLIFIED' | 'CUSTOM';
    initialBankName?: string;
    initialBankAccount?: string;
    initialBankBalance?: number;
    createOpeningEntry?: boolean;
    fielCerBase64?: string;
    fielKeyBase64?: string;
    fielPassword?: string;
  }): Promise<Company> {
    if (!supabase) throw new Error('Supabase no está configurado');

    const cleanRfc = payload.rfc.trim().toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
    const companyId = `comp_${cleanRfc.toLowerCase()}_${Date.now().toString(36)}`;
    const currentYear = payload.currentYear ?? 2026;
    const currentPeriod = payload.currentPeriod ?? 10;
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;

    const { data, error } = await supabase
      .from('companies')
      .insert({
        id: companyId,
        name: payload.name.trim(),
        rfc: cleanRfc,
        regimen_fiscal: payload.regimenFiscal.trim(),
        codigo_postal: payload.codigoPostal.trim(),
        mask_format: 'XXX-XX-XXX',
        current_year: currentYear,
        current_period: currentPeriod,
        created_at: new Date().toISOString(),
        user_id: userId
      })
      .select()
      .single();

    if (error) throw new Error(`Error al registrar empresa en la nube: ${error.message}`);

    await seedCompanyDefaultsInSupabase(supabase, {
      companyId,
      cleanRfc,
      name: payload.name,
      currentYear,
      currentPeriod,
      catalogPreset: payload.catalogPreset,
      initialBankName: payload.initialBankName,
      initialBankAccount: payload.initialBankAccount,
      initialBankBalance: payload.initialBankBalance,
      createOpeningEntry: payload.createOpeningEntry,
      fielCerBase64: payload.fielCerBase64,
      fielKeyBase64: payload.fielKeyBase64,
      fielPassword: payload.fielPassword
    });

    return mapSupabaseCompany(data);
  },

  async updateCompany(
    companyId: string,
    payload: {
      name: string;
      rfc: string;
      regimenFiscal: string;
      codigoPostal: string;
    }
  ): Promise<Company> {
    if (!supabase) throw new Error('Supabase no disponible');
    const { data, error } = await supabase
      .from('companies')
      .update({
        name: payload.name.trim(),
        rfc: payload.rfc.trim().toUpperCase(),
        regimen_fiscal: payload.regimenFiscal.trim(),
        codigo_postal: payload.codigoPostal.trim()
      })
      .eq('id', companyId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapSupabaseCompany(data);
  },

  async deleteCompany(companyId: string): Promise<{ deleted: boolean }> {
    if (!supabase) return { deleted: false };
    const existing = await this.getCompanies();
    if (existing.length <= 1 && existing.some((c) => c.id === companyId)) {
      throw new Error('Debe existir al menos una empresa activa en el sistema.');
    }

    const { error: rpcError } = await supabase.rpc('delete_company_cascade', { company_id_param: companyId });
    if (!rpcError) return { deleted: true };

    // Fallback secuencial cliente si la RPC en PostgreSQL no está disponible
    const { data: pols } = await supabase.from('polizas').select('id').eq('company_id', companyId);
    const polIds = (pols || []).map((p: { id: string }) => p.id);
    if (polIds.length > 0) {
      const { error: movErr } = await supabase.from('poliza_movements').delete().in('poliza_id', polIds);
      if (movErr) throw new Error(movErr.message);
    }
    const childTables = [
      'bank_statement_matches',
      'inventory_periods',
      'accounting_rules',
      'annual_tax_snapshots',
      'company_audit_logs',
      'bank_statement_lines',
      'cfdi_documents',
      'polizas',
      'fixed_assets',
      'third_parties',
      'period_locks',
      'tax_parameters',
      'fiel_credentials',
      'sat_download_requests',
      'accounts'
    ];
    for (const table of childTables) {
      const { error: childErr } = await supabase.from(table).delete().eq('company_id', companyId);
      if (childErr) throw new Error(`[Delete ${table}] ${childErr.message}`);
    }
    const { error } = await supabase.from('companies').delete().eq('id', companyId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  },

  async updateCompanyPeriod(
    companyId: string,
    currentYear: number,
    currentPeriod: number
  ): Promise<Company> {
    if (!supabase) throw new Error('Supabase no disponible');
    const { data, error } = await supabase
      .from('companies')
      .update({
        current_year: currentYear,
        current_period: currentPeriod
      })
      .eq('id', companyId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapSupabaseCompany(data);
  },

  async getAccounts(
    companyId: string,
    year?: number,
    period?: number
  ): Promise<AccountWithBalance[]> {
    if (!supabase) return [];

    if (year !== undefined && period !== undefined) {
      try {
        const report = await supabaseReportsAndDashboard.getReports(companyId, year, period);
        if (report?.trialBalance && report.trialBalance.length > 0) {
          return report.trialBalance;
        }
      } catch {
        // Fallback a cuentas base si la consulta de balanza falla
      }
    }

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
  },

  async createAccount(payload: {
    companyId: string;
    code: string;
    name: string;
    parentCode: string | null;
    type: string;
    nature: string;
    level: number;
    isAffectable: boolean;
    satGroupCode: string;
    initialBalance: number;
  }): Promise<{ id: string; code: string; name: string }> {
    if (!supabase) throw new Error('Supabase no disponible');
    const cleanCode = payload.code.trim();
    const cleanParent = payload.parentCode?.trim() || null;
    const existingAccounts = await this.getAccounts(payload.companyId);
    const duplicate = existingAccounts.find((a) => a.code === cleanCode);
    assertAccountingInvariant(
      duplicate === undefined,
      'DUPLICATE_ACCOUNT_CODE',
      `Ya existe una cuenta con el código ${cleanCode}.`
    );

    const hierarchy = validateAccountHierarchy(existingAccounts, cleanParent, cleanCode);
    const resolvedLevel = cleanParent ? hierarchy.level : payload.level;

    const id = `${payload.companyId}_${cleanCode}`;
    const { error } = await supabase.from('accounts').insert({
      id,
      company_id: payload.companyId,
      code: cleanCode,
      name: payload.name.trim(),
      parent_code: cleanParent,
      type: payload.type,
      nature: payload.nature,
      level: resolvedLevel,
      is_affectable: payload.isAffectable,
      sat_group_code: payload.satGroupCode.trim(),
      currency: 'MXN',
      initial_balance: Number(payload.initialBalance || 0)
    });
    if (error) throw new Error(error.message);
    return { id, code: cleanCode, name: payload.name };
  },

  async updateAccount(
    accountId: string,
    payload: { name: string; satGroupCode: string; type: string; nature: string; initialBalance: number; }
  ): Promise<{ updated: boolean }> {
    if (!supabase) return { updated: false };
    const { data: ex } = await supabase.from('accounts').select('company_id, initial_balance, nature').eq('id', accountId).maybeSingle();
    if (ex && (Math.abs(Number(ex.initial_balance) - Number(payload.initialBalance || 0)) > 0.001 || ex.nature !== payload.nature)) {
      const { data: comp } = await supabase.from('companies').select('current_year').eq('id', ex.company_id).maybeSingle();
      await assertSupabasePeriodOpen(String(ex.company_id), comp?.current_year || 2026, 1);
    }
    const cleanName = payload.name.trim();
    const { error } = await supabase.from('accounts').update({
      name: cleanName, sat_group_code: payload.satGroupCode.trim(),
      nature: payload.nature, type: payload.type, initial_balance: Number(payload.initialBalance || 0)
    }).eq('id', accountId);
    if (error) throw new Error(error.message);
    const { error: movErr } = await supabase
      .from('poliza_movements')
      .update({ account_name: cleanName })
      .eq('account_id', accountId);
    if (movErr) throw new Error(movErr.message);
    return { updated: true };
  },

  async deleteAccount(accountId: string): Promise<{ deleted: boolean; hasMovements?: boolean }> {
    if (!supabase) return { deleted: false, hasMovements: false };
    const { count: movCount } = await supabase.from('poliza_movements').select('id', { count: 'exact', head: true }).eq('account_id', accountId);
    if (movCount && movCount > 0) return { deleted: false, hasMovements: true };

    const { data: acc } = await supabase.from('accounts').select('code, company_id').eq('id', accountId).maybeSingle();
    if (acc) {
      const { count: childCount } = await supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('company_id', acc.company_id).eq('parent_code', acc.code);
      if (childCount && childCount > 0) throw new Error('No se puede eliminar una cuenta que contiene subcuentas dependientes.');
    }
    const { error } = await supabase.from('accounts').delete().eq('id', accountId);
    if (error) throw new Error(error.message);
    return { deleted: true, hasMovements: false };
  }
};
