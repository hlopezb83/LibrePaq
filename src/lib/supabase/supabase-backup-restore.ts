import { supabase } from '../supabase';
import { logCompanyAuditEvent } from './audit-logger';
import { assertAccountingInvariant } from '../../shared/accounting-engine';
import { fetchAllRows } from './supabase-pagination';
import {
  clearCompanyChildTables,
  restoreBackupChildTables
} from './supabase-backup-mappers';
import {
  exportOptionalBackupTables,
  type ExtendedBackupBundle
} from './supabase-backup-optional';
import {
  batchImportAccountsWithClient,
  type BatchImportAccountRow
} from './supabase-backup-accounts';
import type {
  Account, Company, CompanyBackupBundle,
  FixedAssetRecord, PeriodLock, Poliza, TaxParametersRecord
} from '../../shared/types';
import { mapSupabaseAccount, supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import { mapSupabasePoliza } from './supabase-polizas';
import { mapSupabaseCfdi } from './supabase-cfdi';
import {
  mapSupabaseFixedAsset,
  mapSupabaseThirdParty
} from './supabase-fiscal-assets-helpers';

export { batchImportAccountsWithClient, type BatchImportAccountRow };

export const supabaseBackupRestore = {
  async batchImportAccounts(
    companyId: string,
    rows: BatchImportAccountRow[]
  ): Promise<{ importedCount: number; updatedCount: number }> {
    if (!supabase) throw new Error('Supabase no disponible');
    return batchImportAccountsWithClient(supabase, companyId, rows);
  },

  async exportCompanyBackup(companyId: string): Promise<ExtendedBackupBundle> {
    const client = supabase;
    if (!client) throw new Error('Supabase no disponible');

    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const company = companies.find((c) => c.id === companyId);
    if (!company) throw new Error(`Empresa no encontrada: ${companyId}`);

    const [
      rawAccounts, rawCfdis, rawPolizas,
      rawThirdParties, rawFixedAssets,
      rawPeriodLocks, rawTaxParams, rawBankLines, optionalTables
    ] = await Promise.all([
      fetchAllRows((from, to) => client.from('accounts').select('*').eq('company_id', companyId).order('id').range(from, to)),
      fetchAllRows((from, to) => client.from('cfdi_documents').select('*').eq('company_id', companyId).order('id').range(from, to)),
      fetchAllRows((from, to) => client.from('polizas').select('*, poliza_movements(*)').eq('company_id', companyId).order('id').range(from, to)),
      fetchAllRows((from, to) => client.from('third_parties').select('*').eq('company_id', companyId).order('id').range(from, to)),
      fetchAllRows((from, to) => client.from('fixed_assets').select('*').eq('company_id', companyId).order('id').range(from, to)),
      fetchAllRows((from, to) => client.from('period_locks').select('*').eq('company_id', companyId).order('ejercicio').order('periodo').range(from, to)),
      fetchAllRows((from, to) => client.from('tax_parameters').select('*').eq('company_id', companyId).order('ejercicio').order('periodo').range(from, to)),
      fetchAllRows((from, to) => client.from('bank_statement_lines').select('*').eq('company_id', companyId).order('id').range(from, to)),
      exportOptionalBackupTables(client, companyId)
    ]);

    const accounts: Account[] = rawAccounts.map((r) => mapSupabaseAccount(r as Record<string, unknown>));
    const cfdis = rawCfdis.map((r) => mapSupabaseCfdi(r as Record<string, unknown>));
    const polizas: Poliza[] = rawPolizas.map((r) =>
      mapSupabasePoliza(r as Record<string, unknown>, (r as Record<string, unknown>).poliza_movements)
    );
    const thirdParties = (rawThirdParties as Array<Record<string, unknown>>).map((r) =>
      mapSupabaseThirdParty(r)
    );
    const fixedAssets: FixedAssetRecord[] = (rawFixedAssets as Array<Record<string, unknown>>).map((r) =>
      mapSupabaseFixedAsset(r)
    );

    const periodLocks: PeriodLock[] = (rawPeriodLocks as Array<Record<string, unknown>>).map((r) => ({
      companyId: String(r.company_id),
      ejercicio: Number(r.ejercicio),
      periodo: Number(r.periodo),
      isLocked: Boolean(r.is_locked),
      lockedAt: r.locked_at ? String(r.locked_at) : null,
      notes: r.notes ? String(r.notes) : ''
    }));

    const taxParameters: TaxParametersRecord[] = (rawTaxParams as Array<Record<string, unknown>>).map((r) => ({
      companyId: String(r.company_id),
      ejercicio: Number(r.ejercicio),
      periodo: Number(r.periodo ?? 0),
      coeficienteUtilidad: Number(r.coeficiente_utilidad ?? 0),
      perdidasFiscalesPendientes: Number(r.perdidas_fiscales_pendientes ?? 0),
      pagosProvisionalesAnteriores: Number(r.pagos_provisionales_anteriores ?? 0),
      saldoFavorIvaAnterior: Number(r.saldo_favor_iva_anterior ?? 0),
      tipoCambioDofCierre: Number(r.tipo_cambio_dof_cierre ?? 0),
      ptuPagadaEjercicio: Number(r.ptu_pagada_ejercicio ?? 0)
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
      bankStatementLines,
      accountingRules: optionalTables.accountingRules,
      annualTaxSnapshots: optionalTables.annualTaxSnapshots,
      inventoryPeriods: optionalTables.inventoryPeriods,
      bankStatementMatches: optionalTables.bankStatementMatches,
      payrollPeriodSettings: optionalTables.payrollPeriodSettings,
      polizaCfdis: optionalTables.polizaCfdis,
      bankReconciliationClosures: optionalTables.bankReconciliationClosures,
      deliverableBranding: optionalTables.deliverableBranding
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
    const organizationId = comp.organizationId ?? null;

    const enrichedBundle: CompanyBackupBundle = {
      ...bundle,
      company: {
        ...comp,
        userId,
        organizationId
      }
    };

    const { error: rpcErr } = await client.rpc('restore_company_backup_atomic', {
      p_payload: enrichedBundle
    });

    if (rpcErr) {
      const msg = rpcErr.message || '';
      const isMissingRpc =
        rpcErr.code === 'PGRST202' ||
        rpcErr.code === '42883' ||
        msg.toLowerCase().includes('could not find the function') ||
        msg.toLowerCase().includes('does not exist');
      if (!isMissingRpc) {
        throw new Error(msg);
      }

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
        user_id: userId,
        organization_id: organizationId
      });

      if (compErr) throw new Error(compErr.message);

      await clearCompanyChildTables(client, comp.id);
      await restoreBackupChildTables(
        client,
        comp.id,
        bundle,
        this.batchImportAccounts.bind(this)
      );
    }

    logCompanyAuditEvent({
      companyId: comp.id,
      action: 'COMPANY_UPDATE',
      entityType: 'company',
      entityId: comp.id,
      metadata: { event: 'BACKUP_RESTORE_ATOMIC', accounts: bundle.accounts?.length ?? 0, polizas: bundle.polizas?.length ?? 0 }
    });

    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const restored = companies.find((c) => c.id === comp.id);
    if (!restored) throw new Error('No se pudo encontrar la empresa restaurada.');
    return restored;
  }
};
