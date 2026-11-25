import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BusinessSegment,
  CfdiDocument,
  CompanyBackupBundle,
  CustomInpcEntry,
  FiscalLossCarryforward,
  FixedAssetRecord,
  Poliza,
  PolizaTemplate,
  PolizaTemplateMovement,
  PolizaType,
  ThirdPartyRecord
} from '../../shared/types';
import {
  fetchOptionalTableRows,
  isMissingTableError,
  upsertOptionalChunks
} from './supabase-backup-optional-types';

export interface Ronda11BackupTables {
  businessSegments: BusinessSegment[];
  polizaTemplates: PolizaTemplate[];
  customInpcEntries: CustomInpcEntry[];
  fiscalLossCarryforwards: FiscalLossCarryforward[];
}

export async function clearRonda11BackupTables(
  client: SupabaseClient,
  companyId: string
): Promise<void> {
  const tables = [
    'poliza_templates',
    'business_segments',
    'custom_inpc_entries',
    'fiscal_loss_carryforwards'
  ];
  for (const table of tables) {
    const { error } = await client.from(table).delete().eq('company_id', companyId);
    if (error && !isMissingTableError(error)) {
      throw new Error(`[Clear ${table}] ${error.message}`);
    }
  }
}

export async function exportRonda11BackupTables(
  client: SupabaseClient,
  companyId: string
): Promise<Ronda11BackupTables> {
  const [rawSegments, rawTemplates, rawInpc, rawLosses] = await Promise.all([
    fetchOptionalTableRows(client, 'business_segments', companyId, ['code']),
    fetchOptionalTableRows(client, 'poliza_templates', companyId, ['name']),
    fetchOptionalTableRows(client, 'custom_inpc_entries', companyId, ['year', 'month']),
    fetchOptionalTableRows(client, 'fiscal_loss_carryforwards', companyId, ['loss_year'])
  ]);

  const businessSegments: BusinessSegment[] = rawSegments.map((r) => ({
    id: String(r.id),
    companyId: String(r.company_id ?? companyId),
    code: String(r.code ?? ''),
    name: String(r.name ?? ''),
    parentId: r.parent_id ? String(r.parent_id) : null,
    isActive: r.is_active !== false,
    createdAt: r.created_at ? String(r.created_at) : undefined,
    updatedAt: r.updated_at ? String(r.updated_at) : undefined
  }));

  const polizaTemplates: PolizaTemplate[] = rawTemplates.map((r) => ({
    id: String(r.id),
    companyId: String(r.company_id ?? companyId),
    name: String(r.name ?? ''),
    tipo: (r.tipo === 'INGRESO' || r.tipo === 'EGRESO' ? r.tipo : 'DIARIO') as PolizaType,
    conceptoDefault: String(r.concepto_default ?? ''),
    movementsJson: Array.isArray(r.movements_json)
      ? (r.movements_json as PolizaTemplateMovement[])
      : [],
    isActive: r.is_active !== false,
    createdAt: r.created_at ? String(r.created_at) : undefined,
    updatedAt: r.updated_at ? String(r.updated_at) : undefined
  }));

  const customInpcEntries: CustomInpcEntry[] = rawInpc.map((r) => ({
    companyId: String(r.company_id ?? companyId),
    year: Number(r.year),
    month: Number(r.month),
    inpcValue: Number(r.inpc_value ?? 0),
    source: r.source ? String(r.source) : 'MANUAL',
    updatedAt: r.updated_at ? String(r.updated_at) : undefined
  }));

  const fiscalLossCarryforwards: FiscalLossCarryforward[] = rawLosses.map((r) => ({
    id: String(r.id),
    companyId: String(r.company_id ?? companyId),
    lossYear: Number(r.loss_year),
    originalAmount: Number(r.original_amount ?? 0),
    appliedAmount: Number(r.applied_amount ?? 0),
    remainingAmount: Number(r.remaining_amount ?? 0),
    inpcFirstUpdateMonth:
      r.inpc_first_update_month != null ? Number(r.inpc_first_update_month) : null,
    inpcLastApplied: r.inpc_last_applied != null ? Number(r.inpc_last_applied) : null,
    notes: r.notes ? String(r.notes) : '',
    updatedAt: r.updated_at ? String(r.updated_at) : undefined
  }));

  return { businessSegments, polizaTemplates, customInpcEntries, fiscalLossCarryforwards };
}

export async function restoreRonda11BackupTables(
  client: SupabaseClient,
  companyId: string,
  bundle: CompanyBackupBundle
): Promise<void> {
  if (Array.isArray(bundle.businessSegments) && bundle.businessSegments.length > 0) {
    const rows = bundle.businessSegments.map((bs) => ({
      id: bs.id,
      company_id: companyId,
      code: bs.code,
      name: bs.name,
      parent_id: bs.parentId ?? null,
      is_active: bs.isActive !== false,
      created_at: bs.createdAt || new Date().toISOString(),
      updated_at: bs.updatedAt || new Date().toISOString()
    }));
    await upsertOptionalChunks(client, 'business_segments', rows, 'company_id,code');
  }

  if (Array.isArray(bundle.polizaTemplates) && bundle.polizaTemplates.length > 0) {
    const rows = bundle.polizaTemplates.map((pt) => ({
      id: pt.id,
      company_id: companyId,
      name: pt.name,
      tipo: pt.tipo || 'DIARIO',
      concepto_default: pt.conceptoDefault || '',
      movements_json: Array.isArray(pt.movementsJson) ? pt.movementsJson : [],
      is_active: pt.isActive !== false,
      created_at: pt.createdAt || new Date().toISOString(),
      updated_at: pt.updatedAt || new Date().toISOString()
    }));
    await upsertOptionalChunks(client, 'poliza_templates', rows, 'id');
  }

  if (Array.isArray(bundle.customInpcEntries) && bundle.customInpcEntries.length > 0) {
    const rows = bundle.customInpcEntries.map((ci) => ({
      company_id: companyId,
      year: Number(ci.year),
      month: Number(ci.month),
      inpc_value: Number(ci.inpcValue),
      source: ci.source || 'MANUAL',
      updated_at: ci.updatedAt || new Date().toISOString()
    }));
    await upsertOptionalChunks(client, 'custom_inpc_entries', rows, 'company_id,year,month');
  }

  if (Array.isArray(bundle.fiscalLossCarryforwards) && bundle.fiscalLossCarryforwards.length > 0) {
    const rows = bundle.fiscalLossCarryforwards.map((fl) => ({
      id: fl.id || `flc_${companyId}_${fl.lossYear}`,
      company_id: companyId,
      loss_year: Number(fl.lossYear),
      original_amount: Number(fl.originalAmount ?? 0),
      applied_amount: Number(fl.appliedAmount ?? 0),
      remaining_amount: Number(fl.remainingAmount ?? 0),
      inpc_first_update_month: fl.inpcFirstUpdateMonth ?? null,
      inpc_last_applied: fl.inpcLastApplied ?? null,
      notes: fl.notes || '',
      updated_at: fl.updatedAt || new Date().toISOString()
    }));
    await upsertOptionalChunks(client, 'fiscal_loss_carryforwards', rows, 'company_id,loss_year');
  }
}

export function enrichRonda11SupabaseCfdi(
  cfdi: CfdiDocument,
  raw: Record<string, unknown>
): CfdiDocument {
  return {
    ...cfdi,
    validacionEfos: raw.validacion_efos ? String(raw.validacion_efos) : null,
    esCancelable: raw.es_cancelable ? String(raw.es_cancelable) : null,
    estatusCancelacion: raw.estatus_cancelacion ? String(raw.estatus_cancelacion) : null,
    deductiblePct: Number(raw.deductible_pct ?? cfdi.deductiblePct ?? 100),
    isForeignNoCfdi: Boolean(raw.is_foreign_no_cfdi ?? cfdi.isForeignNoCfdi ?? false)
  };
}

export function enrichRonda11SupabasePoliza(
  poliza: Poliza,
  rawMovements: unknown
): Poliza {
  const movRows = Array.isArray(rawMovements)
    ? (rawMovements as Array<Record<string, unknown>>)
    : [];
  const byId = new Map(movRows.map((m) => [String(m.id ?? ''), m]));
  return {
    ...poliza,
    movements: poliza.movements.map((m) => {
      const r = byId.get(m.id);
      if (!r) return m;
      return {
        ...m,
        paymentMethodSat: r.payment_method_sat ? String(r.payment_method_sat) : null,
        bankCodeOri: r.bank_code_ori ? String(r.bank_code_ori) : null,
        accountOri: r.account_ori ? String(r.account_ori) : null,
        bankCodeDest: r.bank_code_dest ? String(r.bank_code_dest) : null,
        accountDest: r.account_dest ? String(r.account_dest) : null,
        beneficiaryName: r.beneficiary_name ? String(r.beneficiary_name) : null,
        beneficiaryRfc: r.beneficiary_rfc ? String(r.beneficiary_rfc) : null,
        chequeNum: r.cheque_num ? String(r.cheque_num) : null,
        businessSegmentId: r.business_segment_id ? String(r.business_segment_id) : null
      };
    })
  };
}

export function enrichRonda11SupabaseThirdParty(
  tp: ThirdPartyRecord,
  raw: Record<string, unknown>
): ThirdPartyRecord {
  const rawRegion = String(raw.region_fronteriza ?? tp.regionFronteriza ?? 'NORTE').toUpperCase();
  return {
    ...tp,
    regionFronteriza: rawRegion === 'SUR' ? 'SUR' : 'NORTE',
    deductiblePct: Math.round(Number(raw.deductible_pct ?? tp.deductiblePct ?? 100))
  };
}

export function enrichRonda11SupabaseFixedAsset(
  fa: FixedAssetRecord,
  raw: Record<string, unknown>
): FixedAssetRecord {
  return {
    ...fa,
    fechaBaja: raw.fecha_baja ? String(raw.fecha_baja).slice(0, 10) : null,
    precioVenta: raw.precio_venta != null ? Number(raw.precio_venta) : null,
    bajaPolizaId: raw.baja_poliza_id ? String(raw.baja_poliza_id) : null,
    vehicleCapType: raw.vehicle_cap_type ? String(raw.vehicle_cap_type) : null
  };
}
