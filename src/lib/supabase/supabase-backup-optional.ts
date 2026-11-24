import type { SupabaseClient } from '@supabase/supabase-js';
import { computeCostOfSales } from '../../shared/engine/cost-of-sales.engine';
import type { AccountingRuleDirection, AccountingRuleRecord } from '../../shared/types/accounting-rules.types';
import type { AnnualTaxInputs } from '../../shared/types/annual-tax.types';
import type { BankN1MatchRecord } from '../../shared/types/bank-n1.types';
import type { InventoryMethod, InventoryPeriodRecord } from '../../shared/types/cost-of-sales.types';
import {
  fetchOptionalTableRows,
  isMissingTableError,
  upsertOptionalChunks,
  type BackupBankReconciliationClosure,
  type BackupDeliverableBranding,
  type BackupPayrollPeriodSetting,
  type BackupPolizaCfdi,
  type ExportedOptionalBackupTables,
  type ExtendedBackupBundle
} from './supabase-backup-optional-types';

export {
  isMissingTableError,
  type BackupBankReconciliationClosure,
  type BackupDeliverableBranding,
  type BackupPayrollPeriodSetting,
  type BackupPolizaCfdi,
  type ExtendedBackupBundle
};

export async function clearOptionalBackupTables(client: SupabaseClient, companyId: string): Promise<void> {
  // Orden FK: bank_statement_matches referencia bank_statement_lines
  const optionalTables = [
    'bank_statement_matches',
    'bank_reconciliation_closures',
    'despacho_deliverable_branding',
    'poliza_cfdis',
    'payroll_period_settings',
    'accounting_rules',
    'annual_tax_snapshots',
    'inventory_periods'
  ];
  for (const table of optionalTables) {
    const { error } = await client.from(table).delete().eq('company_id', companyId);
    if (error && !isMissingTableError(error)) {
      throw new Error(`[Clear ${table}] ${error.message}`);
    }
  }
}

export async function exportOptionalBackupTables(
  client: SupabaseClient,
  companyId: string
): Promise<ExportedOptionalBackupTables> {
  const [rawRules, rawSnapshots, rawInventory, rawMatches, rawPayroll, rawPolizaCfdis, rawClosures, rawBranding] =
    await Promise.all([
      fetchOptionalTableRows(client, 'accounting_rules', companyId),
      fetchOptionalTableRows(client, 'annual_tax_snapshots', companyId),
      fetchOptionalTableRows(client, 'inventory_periods', companyId),
      fetchOptionalTableRows(client, 'bank_statement_matches', companyId),
      fetchOptionalTableRows(client, 'payroll_period_settings', companyId, ['ejercicio', 'periodo']),
      fetchOptionalTableRows(client, 'poliza_cfdis', companyId),
      fetchOptionalTableRows(client, 'bank_reconciliation_closures', companyId, ['ejercicio', 'periodo']),
      fetchOptionalTableRows(client, 'despacho_deliverable_branding', companyId)
    ]);

  const accountingRules: AccountingRuleRecord[] = rawRules.map((r) => ({
    id: String(r.id),
    companyId: String(r.company_id ?? companyId),
    name: String(r.name ?? ''),
    matchRfc: r.match_rfc ? String(r.match_rfc) : null,
    matchClaveProdServ: r.match_clave_prod_serv ? String(r.match_clave_prod_serv) : null,
    matchUsoCfdi: r.match_uso_cfdi ? String(r.match_uso_cfdi) : null,
    direction: (r.direction === 'EMITIDO' ? 'EMITIDO' : 'RECIBIDO') as AccountingRuleDirection,
    operationAccountCode: String(r.operation_account_code ?? ''),
    counterAccountCode: r.counter_account_code ? String(r.counter_account_code) : null,
    deductiblePct: Number(r.deductible_pct ?? 100),
    priority: Number(r.priority ?? 10),
    autoLearned: Boolean(r.auto_learned),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString())
  }));

  const annualTaxSnapshots: AnnualTaxInputs[] = rawSnapshots.map((r) => ({
    companyId: String(r.company_id ?? companyId),
    ejercicio: Number(r.ejercicio),
    inpcCierreAnterior: Number(r.inpc_cierre_anterior ?? 139.38),
    inpcCierreActual: Number(r.inpc_cierre_actual ?? 145.4),
    cucaInicial: Number(r.cuca_inicial ?? 0),
    aportacionesCapital: Number(r.aportaciones_capital ?? 0),
    reduccionesCapital: Number(r.reducciones_capital ?? 0),
    cufinInicial: Number(r.cufin_inicial ?? 0),
    dividendosPagados: Number(r.dividendos_pagados ?? 0),
    ptuPagadaAnterior: Number(r.ptu_pagada_anterior ?? 0),
    noDeduciblesManual: Number(r.no_deducibles_manual ?? 0),
    deduccionesPersonales: Number(r.deducciones_personales ?? 0),
    updatedAt: r.updated_at ? String(r.updated_at) : undefined
  }));

  const inventoryPeriods: InventoryPeriodRecord[] = rawInventory.map((r) => {
    const initialInventory = Number(r.initial_inventory ?? 0);
    const purchasesOverride =
      r.purchases_override !== null && r.purchases_override !== undefined
        ? Number(r.purchases_override)
        : null;
    const finalInventory = Number(r.final_inventory ?? 0);
    const effectivePurchases = purchasesOverride ?? 0;
    const computed = computeCostOfSales({ initialInventory, purchasesPeriod: effectivePurchases, finalInventory });
    const method: InventoryMethod = r.method === 'PERPETUO' ? 'PERPETUO' : 'ANALITICO';
    return {
      id: String(r.id),
      companyId: String(r.company_id ?? companyId),
      ejercicio: Number(r.ejercicio),
      periodo: Number(r.periodo),
      initialInventory: computed.initialInventory,
      purchasesFromBalance: 0,
      purchasesOverride,
      effectivePurchases: computed.purchasesPeriod,
      finalInventory: computed.finalInventory,
      costOfSales: computed.costOfSales,
      method,
      polizaId: r.poliza_id ? String(r.poliza_id) : null,
      updatedAt: r.updated_at ? String(r.updated_at) : undefined
    };
  });

  const bankStatementMatches: BankN1MatchRecord[] = rawMatches.map((r) => ({
    id: String(r.id),
    companyId: String(r.company_id ?? companyId),
    bankLineId: String(r.bank_line_id),
    movementId: String(r.movement_id),
    polizaId: String(r.poliza_id ?? ''),
    matchedAmount: Number(r.matched_amount ?? 0),
    createdAt: String(r.created_at ?? new Date().toISOString())
  }));

  const payrollPeriodSettings: BackupPayrollPeriodSetting[] = rawPayroll.map((r) => ({
    companyId: String(r.company_id ?? companyId),
    ejercicio: Number(r.ejercicio),
    periodo: Number(r.periodo),
    stateCode: String(r.state_code ?? 'CMX'),
    isnRate: Number(r.isn_rate ?? 4.0),
    imssPatronal: Number(r.imss_patronal ?? 0),
    rcv: Number(r.rcv ?? 0),
    infonavit: Number(r.infonavit ?? 0),
    updatedAt: r.updated_at ? String(r.updated_at) : undefined
  }));

  const polizaCfdis: BackupPolizaCfdi[] = rawPolizaCfdis.map((r) => ({
    id: String(r.id),
    companyId: String(r.company_id ?? companyId),
    polizaId: String(r.poliza_id),
    cfdiUuid: String(r.cfdi_uuid),
    createdAt: r.created_at ? String(r.created_at) : undefined
  }));

  const bankReconciliationClosures: BackupBankReconciliationClosure[] = rawClosures.map((r) => ({
    id: String(r.id),
    companyId: String(r.company_id ?? companyId),
    accountId: String(r.account_id),
    ejercicio: Number(r.ejercicio),
    periodo: Number(r.periodo),
    saldoBancoCierre: Number(r.saldo_banco_cierre ?? 0),
    updatedAt: r.updated_at ? String(r.updated_at) : undefined
  }));

  const deliverableBranding: BackupDeliverableBranding[] = rawBranding.map((r) => ({
    id: String(r.id),
    scopeKey: String(r.scope_key ?? `comp_${companyId}`),
    companyId: r.company_id ? String(r.company_id) : companyId,
    organizationId: r.organization_id ? String(r.organization_id) : null,
    firmName: String(r.firm_name ?? ''),
    preparerName: String(r.preparer_name ?? 'Auxiliar Contable'),
    auditorName: String(r.auditor_name ?? ''),
    auditorCedula: String(r.auditor_cedula ?? ''),
    legalRepName: String(r.legal_rep_name ?? ''),
    legalRepTitle: String(r.legal_rep_title ?? 'Representante Legal'),
    issuanceCity: String(r.issuance_city ?? 'Ciudad de México'),
    logoDataUrl: r.logo_data_url ? String(r.logo_data_url) : null,
    notesText: String(r.notes_text ?? ''),
    updatedAt: r.updated_at ? String(r.updated_at) : undefined
  }));

  return {
    accountingRules,
    annualTaxSnapshots,
    inventoryPeriods,
    bankStatementMatches,
    payrollPeriodSettings,
    polizaCfdis,
    bankReconciliationClosures,
    deliverableBranding
  };
}

export async function restoreOptionalBackupTables(
  client: SupabaseClient,
  companyId: string,
  bundle: ExtendedBackupBundle
): Promise<void> {
  if (Array.isArray(bundle.accountingRules) && bundle.accountingRules.length > 0) {
    const rows = bundle.accountingRules.map((r) => ({
      id: r.id,
      company_id: companyId,
      name: r.name || '',
      match_rfc: r.matchRfc ?? null,
      match_clave_prod_serv: r.matchClaveProdServ ?? null,
      match_uso_cfdi: r.matchUsoCfdi ?? null,
      direction: r.direction === 'EMITIDO' ? 'EMITIDO' : 'RECIBIDO',
      operation_account_code: r.operationAccountCode,
      counter_account_code: r.counterAccountCode ?? null,
      deductible_pct: Number(r.deductiblePct ?? 100),
      priority: Number(r.priority ?? 10),
      auto_learned: Boolean(r.autoLearned),
      created_at: r.createdAt || new Date().toISOString(),
      updated_at: r.updatedAt || new Date().toISOString()
    }));
    await upsertOptionalChunks(client, 'accounting_rules', rows, 'id');
  }

  if (Array.isArray(bundle.annualTaxSnapshots) && bundle.annualTaxSnapshots.length > 0) {
    const rows = bundle.annualTaxSnapshots.map((s) => ({
      id: `ats_${companyId}_${s.ejercicio}`,
      company_id: companyId,
      ejercicio: Number(s.ejercicio),
      inpc_cierre_anterior: Number(s.inpcCierreAnterior ?? 139.38),
      inpc_cierre_actual: Number(s.inpcCierreActual ?? 145.4),
      cuca_inicial: Number(s.cucaInicial ?? 0),
      aportaciones_capital: Number(s.aportacionesCapital ?? 0),
      reducciones_capital: Number(s.reduccionesCapital ?? 0),
      cufin_inicial: Number(s.cufinInicial ?? 0),
      dividendos_pagados: Number(s.dividendosPagados ?? 0),
      ptu_pagada_anterior: Number(s.ptuPagadaAnterior ?? 0),
      no_deducibles_manual: Number(s.noDeduciblesManual ?? 0),
      deducciones_personales: Number(s.deduccionesPersonales ?? 0),
      updated_at: s.updatedAt || new Date().toISOString()
    }));
    await upsertOptionalChunks(client, 'annual_tax_snapshots', rows, 'company_id,ejercicio');
  }

  if (Array.isArray(bundle.inventoryPeriods) && bundle.inventoryPeriods.length > 0) {
    const rows = bundle.inventoryPeriods.map((inv) => ({
      id: inv.id || `inv_${companyId}_${inv.ejercicio}_${inv.periodo}`,
      company_id: companyId,
      ejercicio: Number(inv.ejercicio),
      periodo: Number(inv.periodo),
      initial_inventory: Number(inv.initialInventory ?? 0),
      purchases_override: inv.purchasesOverride ?? null,
      final_inventory: Number(inv.finalInventory ?? 0),
      method: inv.method === 'PERPETUO' ? 'PERPETUO' : 'ANALITICO',
      poliza_id: inv.polizaId ?? null,
      updated_at: inv.updatedAt || new Date().toISOString()
    }));
    await upsertOptionalChunks(client, 'inventory_periods', rows, 'company_id,ejercicio,periodo');
  }

  if (Array.isArray(bundle.bankStatementMatches) && bundle.bankStatementMatches.length > 0) {
    const rows = bundle.bankStatementMatches.map((m) => ({
      id: m.id,
      company_id: companyId,
      bank_line_id: m.bankLineId,
      movement_id: m.movementId,
      poliza_id: m.polizaId || '',
      matched_amount: Number(m.matchedAmount ?? 0),
      created_at: m.createdAt || new Date().toISOString()
    }));
    await upsertOptionalChunks(client, 'bank_statement_matches', rows, 'id');
  }

  if (Array.isArray(bundle.payrollPeriodSettings) && bundle.payrollPeriodSettings.length > 0) {
    const rows = bundle.payrollPeriodSettings.map((ps) => ({
      company_id: companyId,
      ejercicio: Number(ps.ejercicio),
      periodo: Number(ps.periodo),
      state_code: ps.stateCode || 'CMX',
      isn_rate: Number(ps.isnRate ?? 4.0),
      imss_patronal: Number(ps.imssPatronal ?? 0),
      rcv: Number(ps.rcv ?? 0),
      infonavit: Number(ps.infonavit ?? 0),
      updated_at: ps.updatedAt || new Date().toISOString()
    }));
    await upsertOptionalChunks(client, 'payroll_period_settings', rows, 'company_id,ejercicio,periodo');
  }

  if (Array.isArray(bundle.polizaCfdis) && bundle.polizaCfdis.length > 0) {
    const polIds = new Set((bundle.polizas || []).map((p) => p.id));
    const rows = bundle.polizaCfdis
      .filter((pc) => pc.polizaId && pc.cfdiUuid && (polIds.size === 0 || polIds.has(pc.polizaId)))
      .map((pc) => ({
        id: pc.id,
        company_id: companyId,
        poliza_id: pc.polizaId,
        cfdi_uuid: pc.cfdiUuid.trim().toUpperCase(),
        created_at: pc.createdAt || new Date().toISOString()
      }));
    if (rows.length > 0) {
      await upsertOptionalChunks(client, 'poliza_cfdis', rows, 'poliza_id,cfdi_uuid');
    }
  }

  if (Array.isArray(bundle.bankReconciliationClosures) && bundle.bankReconciliationClosures.length > 0) {
    const rows = bundle.bankReconciliationClosures.map((c) => ({
      id: c.id || `bclose_${companyId}_${c.accountId}_${c.ejercicio}_${c.periodo}`,
      company_id: companyId,
      account_id: c.accountId,
      ejercicio: Number(c.ejercicio),
      periodo: Number(c.periodo),
      saldo_banco_cierre: Number(c.saldoBancoCierre ?? 0),
      updated_at: c.updatedAt || new Date().toISOString()
    }));
    await upsertOptionalChunks(client, 'bank_reconciliation_closures', rows, 'company_id,account_id,ejercicio,periodo');
  }

  if (Array.isArray(bundle.deliverableBranding) && bundle.deliverableBranding.length > 0) {
    const rows = bundle.deliverableBranding.map((b) => ({
      id: b.id || `brand_${companyId}`,
      scope_key: `comp_${companyId}`,
      company_id: companyId,
      organization_id: b.organizationId ?? null,
      firm_name: b.firmName || '',
      preparer_name: b.preparerName || 'Auxiliar Contable',
      auditor_name: b.auditorName || '',
      auditor_cedula: b.auditorCedula || '',
      legal_rep_name: b.legalRepName || '',
      legal_rep_title: b.legalRepTitle || 'Representante Legal',
      issuance_city: b.issuanceCity || 'Ciudad de México',
      logo_data_url: b.logoDataUrl ?? null,
      notes_text: b.notesText || '',
      updated_at: b.updatedAt || new Date().toISOString()
    }));
    await upsertOptionalChunks(client, 'despacho_deliverable_branding', rows, 'scope_key');
  }
}
