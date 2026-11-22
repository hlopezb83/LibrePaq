import { supabase } from '../supabase';
import { BASE_COMPANY_ACCOUNTS } from '../../shared/catalogs/base-accounts.seed';
import type { AccountWithBalance, Company } from '../../shared/types';
import { mapSupabaseCompany, mapSupabaseAccount } from './supabase-mappers';
import { assertSupabasePeriodOpen } from './supabase-polizas';
import { supabaseFielAndSoap } from './supabase-fiel-soap';
import { supabaseReportsAndDashboard } from './supabase-reports-dashboard';

export { mapSupabaseCompany, mapSupabaseAccount };

export const supabaseCompaniesAndAccounts = {
  async getCompanies(): Promise<Company[]> {
    if (!supabase) return [];
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData?.user;

    let query = supabase.from('companies').select('*').order('created_at', { ascending: true });
    if (currentUser?.id) {
      query = query.eq('user_id', currentUser.id);
    } else {
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

    const bankName = payload.initialBankName
      ? `${payload.initialBankName} Cta ${payload.initialBankAccount || 'Principal'}`
      : null;

    // Sembrar catálogo estándar SAT Anexo 24 en Supabase
    const accountsToInsert = BASE_COMPANY_ACCOUNTS.map((base) => ({
      id: `${companyId}_${base.code}`,
      company_id: companyId,
      code: base.code,
      name: base.code === '102-01-001' && bankName ? bankName : base.name,
      parent_code: base.parentCode ?? null,
      type: base.type,
      nature: base.nature,
      level: base.level,
      is_affectable: base.isAffectable,
      sat_group_code: base.satGroupCode,
      currency: base.currency,
      initial_balance: 0.0
    }));

    for (let i = 0; i < accountsToInsert.length; i += 100) {
      const chunk = accountsToInsert.slice(i, i + 100);
      const { error: seedErr } = await supabase.from('accounts').insert(chunk);
      if (seedErr) {
        console.warn('[Supabase] Advertencia al sembrar lote de cuentas:', seedErr.message);
      }
    }

    // Póliza de Apertura en Supabase si se configuró saldo inicial en bancos
    const bankBalance = Number(payload.initialBankBalance || 0);
    if (payload.createOpeningEntry && bankBalance > 0) {
      const polizaId = `pol_${companyId}_apertura`;
      const fecha = `${currentYear}-${String(Math.min(12, currentPeriod)).padStart(2, '0')}-01`;
      const now = new Date().toISOString();

      await supabase.from('polizas').insert({
        id: polizaId,
        company_id: companyId,
        tipo: 'DIARIO',
        folio: 1,
        fecha,
        ejercicio: currentYear,
        periodo: currentPeriod,
        concepto: `Asiento de Apertura - Saldo Inicial en Bancos (${payload.initialBankName || 'Bancos'}) y Capital Social`,
        cfdi_uuid: null,
        origin: 'MANUAL',
        created_at: now
      });

      await supabase.from('poliza_movements').insert([
        {
          id: `mov_${polizaId}_1`,
          poliza_id: polizaId,
          account_id: `${companyId}_102-01-001`,
          account_code: '102-01-001',
          account_name: bankName || 'Bancos Nacionales Moneda Nacional',
          referencia: 'APERTURA',
          concepto: `Apertura cuenta bancaria ${payload.initialBankName || 'Bancos'}`,
          cargo: bankBalance,
          abono: 0
        },
        {
          id: `mov_${polizaId}_2`,
          poliza_id: polizaId,
          account_id: `${companyId}_301-01-001`,
          account_code: '301-01-001',
          account_name: 'Capital Fijo',
          referencia: 'APERTURA',
          concepto: 'Aportación de Capital Social Inicial',
          cargo: 0,
          abono: bankBalance
        }
      ]);
    }

    // Persistir credenciales e.firma en Cloud si fueron capturadas en Onboarding
    if (payload.fielCerBase64 && payload.fielKeyBase64) {
      try {
        if (payload.fielPassword) {
          await supabaseFielAndSoap.saveFielCredentials({
            companyId,
            cerBase64: payload.fielCerBase64,
            keyBase64: payload.fielKeyBase64,
            passphrase: payload.fielPassword
          });
        } else {
          await supabase.from('fiel_credentials').insert({
            company_id: companyId,
            cer_base64: payload.fielCerBase64,
            key_base64: payload.fielKeyBase64,
            rfc_titular: cleanRfc,
            nombre_titular: payload.name.trim(),
            updated_at: new Date().toISOString()
          });
        }
      } catch (fielErr) {
        console.warn('[Supabase] Advertencia al persistir FIEL en onboarding:', fielErr);
      }
    }

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
    const { error: rpcError } = await supabase.rpc('delete_company_cascade', { company_id_param: companyId });
    if (!rpcError) return { deleted: true };

    // Fallback secuencial cliente si la RPC en PostgreSQL no está disponible
    const { data: pols } = await supabase.from('polizas').select('id').eq('company_id', companyId);
    const polIds = (pols || []).map((p: { id: string }) => p.id);
    if (polIds.length > 0) await supabase.from('poliza_movements').delete().in('poliza_id', polIds);
    await Promise.allSettled([
      supabase.from('polizas').delete().eq('company_id', companyId),
      supabase.from('cfdi_documents').delete().eq('company_id', companyId),
      supabase.from('bank_statement_lines').delete().eq('company_id', companyId),
      supabase.from('fixed_assets').delete().eq('company_id', companyId),
      supabase.from('third_parties').delete().eq('company_id', companyId)
    ]);
    await supabase.from('accounts').delete().eq('company_id', companyId);
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

    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('company_id', companyId)
      .order('code', { ascending: true });
    if (error) {
      console.error('[Supabase] Error al consultar cuentas:', error);
      throw new Error(`[Supabase Error ${error.code || 'UNKNOWN'}]: ${error.message}`);
    }
    return (data || []).map(mapSupabaseAccount);
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
    const id = `${payload.companyId}_${payload.code}`;
    const { error } = await supabase.from('accounts').insert({
      id,
      company_id: payload.companyId,
      code: payload.code.trim(),
      name: payload.name.trim(),
      parent_code: payload.parentCode?.trim() || null,
      type: payload.type,
      nature: payload.nature,
      level: payload.level,
      is_affectable: payload.isAffectable,
      sat_group_code: payload.satGroupCode.trim(),
      currency: 'MXN',
      initial_balance: Number(payload.initialBalance || 0)
    });
    if (error) throw new Error(error.message);
    return { id, code: payload.code, name: payload.name };
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
    const { error } = await supabase.from('accounts').update({
      name: payload.name.trim(), sat_group_code: payload.satGroupCode.trim(),
      nature: payload.nature, type: payload.type, initial_balance: Number(payload.initialBalance || 0)
    }).eq('id', accountId);
    if (error) throw new Error(error.message);
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
