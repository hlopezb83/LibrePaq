import { supabase } from '../supabase';
import { assertAccountingInvariant } from '../../shared/accounting-engine';
import { fetchAllRows } from './supabase-pagination';
import {
  clearCompanyChildTables,
  restoreBackupChildTables
} from './supabase-backup-mappers';
import type {
  Account, AccountNature, AccountType, Company, CompanyBackupBundle,
  FixedAssetRecord, PeriodLock, Poliza, TaxParametersRecord
} from '../../shared/types';
import { mapSupabaseAccount, supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import { mapSupabasePoliza } from './supabase-polizas';
import { mapSupabaseCfdi } from './supabase-cfdi';
import { supabaseFiscalAndAssets } from './supabase-fiscal-assets';

export const supabaseBackupRestore = {
  async batchImportAccounts(
    companyId: string,
    rows: Array<{
      id?: string;
      code: string;
      name: string;
      parentCode?: string | null;
      type?: string;
      nature?: string;
      level?: number;
      satGroupCode?: string;
      isAffectable?: boolean;
      initialBalance?: number;
    }>
  ): Promise<{ importedCount: number; updatedCount: number }> {
    if (!supabase) throw new Error('Supabase no disponible');

    const accountsToUpsert = rows.map((r) => {
      const code = r.code.trim();
      const codeDigits = code.replace(/[^0-9]/g, '');
      const firstDigit = codeDigits[0] || '1';
      const dType: AccountType = firstDigit === '1' ? 'ACTIVO' : firstDigit === '2' ? 'PASIVO' : firstDigit === '3' ? 'CAPITAL' : firstDigit === '4' ? 'INGRESOS' : firstDigit === '5' ? 'COSTOS' : 'GASTOS';
      const dNat: AccountNature = dType === 'ACTIVO' || dType === 'COSTOS' || dType === 'GASTOS' ? 'DEUDORA' : 'ACREEDORA';

      return {
        id: r.id || `${companyId}_${code}`,
        company_id: companyId,
        code,
        name: r.name.trim(),
        parent_code: r.parentCode || null,
        level: r.level !== undefined && Number(r.level) >= 1 ? Number(r.level) : code.endsWith('00-000') ? 1 : code.endsWith('-000') ? 2 : 3,
        type: (r.type as AccountType) || dType,
        nature: (r.nature as AccountNature) || dNat,
        sat_group_code: r.satGroupCode || null,
        is_affectable: r.isAffectable !== undefined ? r.isAffectable : true,
        initial_balance: Number(r.initialBalance || 0)
      };
    });

    const { error } = await supabase.from('accounts').upsert(accountsToUpsert, {
      onConflict: 'id'
    });

    if (error) throw new Error(error.message);

    return {
      importedCount: accountsToUpsert.length,
      updatedCount: 0
    };
  },

  async exportCompanyBackup(companyId: string): Promise<CompanyBackupBundle> {
    const client = supabase;
    if (!client) throw new Error('Supabase no disponible');

    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const company = companies.find((c) => c.id === companyId);
    if (!company) throw new Error(`Empresa no encontrada: ${companyId}`);

    const [
      rawAccounts, rawCfdis, rawPolizas,
      thirdParties, fixedAssetsRes,
      periodLocksRes, taxParamsRes, rawBankLines
    ] = await Promise.all([
      fetchAllRows((from, to) => client.from('accounts').select('*').eq('company_id', companyId).order('id').range(from, to)),
      fetchAllRows((from, to) => client.from('cfdi_documents').select('*').eq('company_id', companyId).order('id').range(from, to)),
      fetchAllRows((from, to) => client.from('polizas').select('*, poliza_movements(*)').eq('company_id', companyId).order('id').range(from, to)),
      supabaseFiscalAndAssets.getThirdParties(companyId),
      supabaseFiscalAndAssets.getFixedAssets(companyId),
      client.from('period_locks').select('*').eq('company_id', companyId),
      client.from('tax_parameters').select('*').eq('company_id', companyId),
      fetchAllRows((from, to) => client.from('bank_statement_lines').select('*').eq('company_id', companyId).order('id').range(from, to))
    ]);

    const accounts: Account[] = rawAccounts.map((r) => mapSupabaseAccount(r as Record<string, unknown>));
    const cfdis = rawCfdis.map((r) => mapSupabaseCfdi(r as Record<string, unknown>));
    const polizas: Poliza[] = rawPolizas.map((r) =>
      mapSupabasePoliza(r as Record<string, unknown>, (r as Record<string, unknown>).poliza_movements)
    );
    const fixedAssets: FixedAssetRecord[] = fixedAssetsRes.assets;

    const periodLocks: PeriodLock[] = (periodLocksRes.data || []).map((r) => ({
      companyId: String(r.company_id),
      ejercicio: Number(r.ejercicio),
      periodo: Number(r.periodo),
      isLocked: Boolean(r.is_locked),
      lockedAt: r.locked_at ? String(r.locked_at) : null,
      notes: r.notes ? String(r.notes) : ''
    }));

    const taxParameters: TaxParametersRecord[] = (taxParamsRes.data || []).map((r) => ({
      companyId: String(r.company_id),
      ejercicio: Number(r.ejercicio),
      coeficienteUtilidad: Number(r.coeficiente_utilidad || 0.1845),
      perdidasFiscalesPendientes: Number(r.perdidas_fiscales_pendientes || 0),
      pagosProvisionalesAnteriores: Number(r.pagos_provisionales_anteriores || 0),
      saldoFavorIvaAnterior: Number(r.saldo_favor_iva_anterior || 0),
      tipoCambioDofCierre: Number(r.tipo_cambio_dof_cierre || 19.865)
    }));

    const bankStatementLines = (rawBankLines as Array<Record<string, unknown>>).map((b) => ({
      id: String(b.id), companyId: String(b.company_id), accountId: String(b.account_id),
      fecha: String(b.fecha), ejercicio: Number(b.ejercicio), periodo: Number(b.periodo),
      referencia: String(b.referencia || ''), descripcion: String(b.descripcion || ''),
      cargoBanco: Number(b.cargo_banco || 0), abonoBanco: Number(b.abono_banco || 0),
      matchedMovementId: b.matched_movement_id ? String(b.matched_movement_id) : null,
      matchedPolizaFolio: b.matched_poliza_folio ? String(b.matched_poliza_folio) : null
    }));

    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      company,
      accounts,
      cfdis,
      polizas,
      thirdParties,
      fixedAssets,
      periodLocks,
      taxParameters,
      bankStatementLines
    };
  },

  async restoreCompanyBackup(bundle: CompanyBackupBundle): Promise<Company> {
    const client = supabase;
    if (!client) throw new Error('Supabase no disponible');

    assertAccountingInvariant(
      Boolean(bundle && bundle.company && bundle.company.rfc),
      'INVALID_BACKUP_BUNDLE',
      'El archivo de respaldo JSON no tiene una estructura válida de LibrePaq.'
    );

    const comp = bundle.company;
    const { data: authData } = await client.auth.getUser();
    const userId = authData?.user?.id || comp.userId || null;

    const { error: compErr } = await client.from('companies').upsert({
      id: comp.id,
      name: comp.name,
      rfc: comp.rfc,
      regimen_fiscal: comp.regimenFiscal,
      codigo_postal: comp.codigoPostal,
      mask_format: comp.maskFormat || 'XXX-XX-XXX',
      current_year: comp.currentYear || 2026,
      current_period: comp.currentPeriod || 10,
      created_at: comp.createdAt || new Date().toISOString(),
      user_id: userId
    });

    if (compErr) throw new Error(compErr.message);

    await clearCompanyChildTables(client, comp.id);
    await restoreBackupChildTables(
      client,
      comp.id,
      bundle,
      this.batchImportAccounts.bind(this)
    );

    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const restored = companies.find((c) => c.id === comp.id);
    if (!restored) throw new Error('No se pudo encontrar la empresa restaurada.');
    return restored;
  }
};
