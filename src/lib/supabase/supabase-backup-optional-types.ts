import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompanyBackupBundle } from '../../shared/types';
import type { AccountingRuleRecord } from '../../shared/types/accounting-rules.types';
import type { AnnualTaxInputs } from '../../shared/types/annual-tax.types';
import type { BankN1MatchRecord } from '../../shared/types/bank-n1.types';
import type { InventoryPeriodRecord } from '../../shared/types/cost-of-sales.types';
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

export interface BackupBankReconciliationClosure {
  id: string;
  companyId: string;
  accountId: string;
  ejercicio: number;
  periodo: number;
  saldoBancoCierre: number;
  updatedAt?: string;
}

export interface BackupDeliverableBranding {
  id: string;
  scopeKey: string;
  companyId?: string | null;
  organizationId?: string | null;
  firmName: string;
  preparerName: string;
  auditorName: string;
  auditorCedula: string;
  legalRepName: string;
  legalRepTitle: string;
  issuanceCity: string;
  logoDataUrl?: string | null;
  notesText: string;
  updatedAt?: string;
}

export type ExtendedBackupBundle = CompanyBackupBundle & {
  payrollPeriodSettings?: BackupPayrollPeriodSetting[];
  polizaCfdis?: BackupPolizaCfdi[];
  bankReconciliationClosures?: BackupBankReconciliationClosure[];
  deliverableBranding?: BackupDeliverableBranding[];
};

export type UpsertRow = Record<string, unknown>;

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

export async function fetchOptionalTableRows(
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

export async function upsertOptionalChunks(
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

export interface ExportedOptionalBackupTables {
  accountingRules: AccountingRuleRecord[];
  annualTaxSnapshots: AnnualTaxInputs[];
  inventoryPeriods: InventoryPeriodRecord[];
  bankStatementMatches: BankN1MatchRecord[];
  payrollPeriodSettings: BackupPayrollPeriodSetting[];
  polizaCfdis: BackupPolizaCfdi[];
  bankReconciliationClosures: BackupBankReconciliationClosure[];
  deliverableBranding: BackupDeliverableBranding[];
}
