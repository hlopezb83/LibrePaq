import { getRequiredSupabase, supabase } from '../supabase';
import {
  buildAnnualMonthlyBalancesFromMovements,
  computeAnnualFixedAssetFiscalDeduction,
  computeAnnualProvisionalPayments
} from '../../shared/engine/annual-tax-balances.helper';
import {
  computeAnnualTaxSummary,
  resolveAnnualInpcPair
} from '../../shared/engine/annual-tax.engine';
import type { JoinedPolizaMovementInput } from '../../shared/engine/financial-reports.engine';
import { fromCents, toCents } from '../../shared/engine/invariants-and-math';
import type {
  AnnualTaxInputs,
  AnnualTaxSummaryResponse,
  SaveAnnualTaxInputsPayload
} from '../../shared/types/annual-tax.types';
import type { FixedAssetCategory, FixedAssetRecord } from '../../shared/types/fiscal.types';
import { mapSupabaseCfdi } from './supabase-cfdi-mappers';
import { mapSupabaseAccount, mapSupabaseCompany } from './supabase-mappers';
import { fetchAllRows } from './supabase-pagination';

function mapSnapshot(row: Record<string, unknown> | null, companyId: string, ejercicio: number): AnnualTaxInputs {
  const defaults = resolveAnnualInpcPair(ejercicio);
  if (!row) {
    return {
      companyId,
      ejercicio,
      inpcCierreAnterior: defaults.inpcCierreAnterior,
      inpcCierreActual: defaults.inpcCierreActual,
      cucaInicial: 0,
      aportacionesCapital: 0,
      reduccionesCapital: 0,
      cufinInicial: 0,
      dividendosPagados: 0,
      ptuPagadaAnterior: 0,
      noDeduciblesManual: 0,
      deduccionesPersonales: 0
    };
  }
  return {
    companyId: String(row.company_id ?? companyId),
    ejercicio: Number(row.ejercicio ?? ejercicio),
    inpcCierreAnterior: Number(row.inpc_cierre_anterior ?? defaults.inpcCierreAnterior),
    inpcCierreActual: Number(row.inpc_cierre_actual ?? defaults.inpcCierreActual),
    cucaInicial: Number(row.cuca_inicial ?? 0),
    aportacionesCapital: Number(row.aportaciones_capital ?? 0),
    reduccionesCapital: Number(row.reducciones_capital ?? 0),
    cufinInicial: Number(row.cufin_inicial ?? 0),
    dividendosPagados: Number(row.dividendos_pagados ?? 0),
    ptuPagadaAnterior: Number(row.ptu_pagada_anterior ?? 0),
    noDeduciblesManual: Number(row.no_deducibles_manual ?? 0),
    deduccionesPersonales: Number(row.deducciones_personales ?? 0),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mapAsset(row: Record<string, unknown>): FixedAssetRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    codigo: String(row.codigo ?? ''),
    nombre: String(row.nombre ?? ''),
    categoria: (row.categoria as FixedAssetCategory) || 'MOBILIARIO_10',
    fechaAdquisicion: String(row.fecha_adquisicion ?? ''),
    cfdiUuid: row.cfdi_uuid ? String(row.cfdi_uuid) : null,
    montoOriginalInversion: Number(row.monto_original_inversion ?? 0),
    tasaAnualPct: Number(row.tasa_anual_pct ?? 10),
    mesesDepreciadosPrevios: Number(row.meses_depreciados_previos ?? 0),
    inpcAdquisicion: Number(row.inpc_adquisicion ?? 138),
    inpcMedioPeriodo: Number(row.inpc_medio_periodo ?? 138),
    cuentaActivoCode: String(row.cuenta_activo_code ?? '156-01-001'),
    cuentaDepAcumCode: String(row.cuenta_dep_acum_code ?? '171-01-001'),
    cuentaGastoDepCode: String(row.cuenta_gasto_dep_code ?? '601-01-006'),
    estatus: (row.estatus as FixedAssetRecord['estatus']) || 'ACTIVO',
    createdAt: String(row.created_at ?? '')
  };
}

const CFDI_ANNUAL_PROJECTION =
  'id, company_id, uuid, fecha, tipo_comprobante, direction, serie, folio, emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre, concepto_principal, clave_prod_serv, moneda, tipo_cambio, subtotal, descuento, iva_trasladado, isr_retenido, iva_retenido, total, metodo_pago, forma_pago, uso_cfdi, uuid_relacionado, status_sat, poliza_id, tax_breakdown, related_docs';

export const supabaseAnnualTax = {
  async getAnnualTaxSummary(companyId: string, ejercicio?: number): Promise<AnnualTaxSummaryResponse> {
    if (!supabase) throw new Error('Supabase no disponible');
    const sb = getRequiredSupabase();
    const { data: cRow } = await sb.from('companies').select('*').eq('id', companyId).maybeSingle();
    if (!cRow) throw new Error(`Empresa no encontrada: ${companyId}`);
    const company = mapSupabaseCompany(cRow as Record<string, unknown>);
    const targetYear = ejercicio && ejercicio > 2000 ? ejercicio : company.currentYear;

    const [rawAccounts, movs, snapRes, taxRes, assetsRes, rawCfdis] = await Promise.all([
      fetchAllRows(async (from, to) =>
        sb
          .from('accounts')
          .select('*')
          .eq('company_id', company.id)
          .order('code', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
      ),
      fetchAllRows(async (from, to) =>
        sb.from('poliza_movements')
          .select('account_id, cargo, abono, polizas!inner(company_id, ejercicio, periodo)')
          .eq('polizas.company_id', company.id)
          .lte('polizas.ejercicio', targetYear)
          .order('id', { ascending: true })
          .range(from, to)
      ),
      sb.from('annual_tax_snapshots').select('*').eq('company_id', company.id).eq('ejercicio', targetYear).maybeSingle(),
      sb.from('tax_parameters').select('*').eq('company_id', company.id).eq('ejercicio', targetYear).order('periodo', { ascending: false }),
      sb.from('fixed_assets').select('*').eq('company_id', company.id),
      fetchAllRows(async (from, to) =>
        sb
          .from('cfdi_documents')
          .select(CFDI_ANNUAL_PROJECTION)
          .eq('company_id', company.id)
          .order('fecha', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)
      )
    ]);

    const accounts = rawAccounts.map((r) => mapSupabaseAccount(r as Record<string, unknown>));
    const joinedMovs = movs as unknown as JoinedPolizaMovementInput[];
    const { trialBalance, monthlyBalancesByPeriod } = buildAnnualMonthlyBalancesFromMovements(
      accounts,
      joinedMovs,
      targetYear
    );
    const cfdis = rawCfdis.map((r) => mapSupabaseCfdi(r as Record<string, unknown>));
    const assets = (assetsRes.data || []).map((a) => mapAsset(a as Record<string, unknown>));
    const fixedAssetsFiscalDeduction = computeAnnualFixedAssetFiscalDeduction(assets, targetYear);
    const inputs = mapSnapshot((snapRes.data as Record<string, unknown> | null) ?? null, company.id, targetYear);
    const taxRows = (taxRes.data ?? []) as Array<Record<string, unknown>>;
    const taxRow = taxRows[0] ?? null;
    const paymentsProvisioned = computeAnnualProvisionalPayments({
      accounts,
      movs: joinedMovs,
      ejercicio: targetYear,
      taxParameterRows: taxRows.map((r) => ({
        periodo: Number(r.periodo ?? 0),
        pagosProvisionalesAnteriores: Number(r.pagos_provisionales_anteriores ?? 0)
      }))
    });
    const isrFavorAcc = trialBalance.find((a) => a.code === '113-02-001' || a.satGroupCode === '113.02');

    return computeAnnualTaxSummary({
      company,
      ejercicio: targetYear,
      trialBalance,
      monthlyBalancesByPeriod,
      fixedAssetsFiscalDeduction,
      paymentsProvisioned,
      perdidasFiscalesPendientes: Number(taxRow?.perdidas_fiscales_pendientes ?? 0),
      isrRetenidoAcreditable: Math.max(0, isrFavorAcc?.finalBalance ?? 0),
      inputs,
      cfdis
    });
  },

  async saveAnnualTaxInputs(companyId: string, payload: SaveAnnualTaxInputsPayload): Promise<AnnualTaxSummaryResponse> {
    if (!supabase) throw new Error('Supabase no disponible');
    const sb = getRequiredSupabase();
    const clean = (v: number) => fromCents(Math.max(0, toCents(v)));
    const id = `ats_${companyId}_${payload.ejercicio}`;
    const defaults = resolveAnnualInpcPair(payload.ejercicio);
    const baseRow = {
      id,
      company_id: companyId,
      ejercicio: payload.ejercicio,
      inpc_cierre_anterior: Number(payload.inpcCierreAnterior) > 0 ? Number(payload.inpcCierreAnterior) : defaults.inpcCierreAnterior,
      inpc_cierre_actual: Number(payload.inpcCierreActual) > 0 ? Number(payload.inpcCierreActual) : defaults.inpcCierreActual,
      cuca_inicial: clean(payload.cucaInicial),
      aportaciones_capital: clean(payload.aportacionesCapital),
      reducciones_capital: clean(payload.reduccionesCapital),
      cufin_inicial: clean(payload.cufinInicial),
      dividendos_pagados: clean(payload.dividendosPagados),
      ptu_pagada_anterior: clean(payload.ptuPagadaAnterior),
      no_deducibles_manual: clean(payload.noDeduciblesManual),
      updated_at: new Date().toISOString()
    };
    const withPersonal =
      payload.deduccionesPersonales !== undefined
        ? { ...baseRow, deducciones_personales: clean(payload.deduccionesPersonales) }
        : baseRow;
    let { error } = await sb.from('annual_tax_snapshots').upsert(withPersonal, { onConflict: 'company_id,ejercicio' });
    if (error && /deducciones_personales/i.test(error.message)) {
      ({ error } = await sb.from('annual_tax_snapshots').upsert(baseRow, { onConflict: 'company_id,ejercicio' }));
    }
    if (error) throw new Error(error.message);
    return this.getAnnualTaxSummary(companyId, payload.ejercicio);
  }
};
