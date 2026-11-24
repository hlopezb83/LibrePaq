import type { SupabaseClient } from '@supabase/supabase-js';
import { computeCostOfSales } from '../../shared/engine/cost-of-sales.engine';
import type { CompanyBackupBundle } from '../../shared/types';
import type { AccountingRuleDirection, AccountingRuleRecord } from '../../shared/types/accounting-rules.types';
import type { AnnualTaxInputs } from '../../shared/types/annual-tax.types';
import type { BankN1MatchRecord } from '../../shared/types/bank-n1.types';
import type { InventoryMethod, InventoryPeriodRecord } from '../../shared/types/cost-of-sales.types';
import { chunkArray } from './supabase-pagination';

export interface BackupPayrollPeriodSetting {
  companyId: string;
  ejercicio: number;
  periodo: number;
  stateCode: string;
  isnRate: number;
  imssPatronal: number;
  rcv: number;
  infonavit: number;
  updatedAt?: string;
}

export interface BackupPolizaCfdi {
  id: string;
  companyId: string;
  polizaId: string;
  cfdiUuid: string;
  createdAt?: string;
}

export type ExtendedBackupBundle = CompanyBackupBundle & {
  payrollPeriodSettings?: BackupPayrollPeriodSetting[];
  polizaCfdis?: BackupPolizaCfdi[];
};

type UpsertRow = Record<string, unknown>;

export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

async function fetchOptionalTableRows(
  client: SupabaseClient,
  table: string,
  companyId: string,
  orderColumns: readonly string[] = ['id']
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let query = client.from(table).select('*').eq('company_id', companyId);
    for (const col of orderColumns) {
      query = query.order(col);
    }
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      if (isMissingTableError(error)) return [];
      throw new Error(`[Export ${table}] ${error.message}`);
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as Array<Record<string, unknown>>));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function upsertOptionalChunks(
  client: SupabaseClient,
  table: string,
  rows: UpsertRow[],
  onConflict: string
): Promise<void> {
  for (const chunk of chunkArray(rows, 100)) {
    const { error } = await client.from(table).upsert(chunk, { onConflict });
    if (error) {
      if (isMissingTableError(error)) return;
      throw new Error(`[Restore ${table}] Error: ${error.message}`);
    }
  }
}

export async function clearOptionalBackupTables(client: SupabaseClient, companyId: string): Promise<void> {
  // Orden FK: bank_statement_matches referencia bank_statement_lines
  const optionalTables = [
    'bank_statement_matches',
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
): Promise<{
  accountingRules: AccountingRuleRecord[];
  annualTaxSnapshots: AnnualTaxInputs[];
  inventoryPeriods: InventoryPeriodRecord[];
  bankStatementMatches: BankN1MatchRecord[];
  payrollPeriodSettings: BackupPayrollPeriodSetting[];
  polizaCfdis: BackupPolizaCfdi[];
}> {
  const [rawRules, rawSnapshots, rawInventory, rawMatches, rawPayroll, rawPolizaCfdis] = await Promise.all([
    fetchOptionalTableRows(client, 'accounting_rules', companyId),
    fetchOptionalTableRows(client, 'annual_tax_snapshots', companyId),
    fetchOptionalTableRows(client, 'inventory_periods', companyId),
    fetchOptionalTableRows(client, 'bank_statement_matches', companyId),
    fetchOptionalTableRows(client, 'payroll_period_settings', companyId, ['ejercicio', 'periodo']),
    fetchOptionalTableRows(client, 'poliza_cfdis', companyId)
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

  return {
    accountingRules,
    annualTaxSnapshots,
    inventoryPeriods,
    bankStatementMatches,
    payrollPeriodSettings,
    polizaCfdis
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
}
