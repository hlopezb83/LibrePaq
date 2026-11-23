import { getRequiredSupabase, supabase } from '../supabase';
import { computeCostOfSales, computePurchasesFromMovements } from '../../shared/engine/cost-of-sales.engine';
import type { JoinedPolizaMovementInput } from '../../shared/engine/financial-reports.engine';
import { fromCents, toCents } from '../../shared/engine/invariants-and-math';
import type { InventoryMethod, InventoryPeriodRecord, SaveInventoryPeriodPayload } from '../../shared/types/cost-of-sales.types';
import { mapSupabaseAccount, mapSupabaseCompany } from './supabase-mappers';
import { fetchAllRows } from './supabase-pagination';

const cleanAmount = (val: unknown): number => fromCents(Math.max(0, toCents(Number(val ?? 0))));

export const supabaseInventory = {
  async getInventoryPeriod(companyId: string, ejercicio?: number, periodo?: number): Promise<InventoryPeriodRecord> {
    if (!supabase) throw new Error('Supabase no disponible');
    const sb = getRequiredSupabase();

    const { data: cRow } = await sb.from('companies').select('*').eq('id', companyId).maybeSingle();
    if (!cRow) throw new Error(`Empresa no encontrada: ${companyId}`);
    const company = mapSupabaseCompany(cRow as Record<string, unknown>);

    const targetYear = ejercicio && ejercicio >= 2000 ? Math.round(ejercicio) : company.currentYear;
    const targetPeriod = periodo && periodo >= 1 && periodo <= 13 ? Math.round(periodo) : company.currentPeriod;
    const prevYear = targetPeriod > 1 ? targetYear : targetYear - 1;
    const prevPeriod = targetPeriod > 1 ? targetPeriod - 1 : 12;

    const [curRes, prevRes, rawAccounts, movs] = await Promise.all([
      sb.from('inventory_periods').select('*').eq('company_id', company.id).eq('ejercicio', targetYear).eq('periodo', targetPeriod).maybeSingle(),
      sb.from('inventory_periods').select('final_inventory').eq('company_id', company.id).eq('ejercicio', prevYear).eq('periodo', prevPeriod).maybeSingle(),
      fetchAllRows(async (from, to) =>
        sb.from('accounts').select('*').eq('company_id', company.id).order('code', { ascending: true }).range(from, to)
      ),
      fetchAllRows(async (from, to) =>
        sb
          .from('poliza_movements')
          .select('account_id, cargo, abono, polizas!inner(company_id, ejercicio, periodo)')
          .eq('polizas.company_id', company.id)
          .eq('polizas.ejercicio', targetYear)
          .eq('polizas.periodo', targetPeriod)
          .order('id', { ascending: true })
          .range(from, to)
      )
    ]);

    const row = curRes.data as Record<string, unknown> | null;
    const prevRow = prevRes.data as Record<string, unknown> | null;
    const accounts = rawAccounts.map((r) => mapSupabaseAccount(r as Record<string, unknown>));
    const purchasesFromBalance = computePurchasesFromMovements(accounts, movs as unknown as JoinedPolizaMovementInput[]);

    const prevFinal = prevRow ? cleanAmount(prevRow.final_inventory) : 0;
    const initialInventory = row ? cleanAmount(row.initial_inventory) : prevFinal;
    const purchasesOverride = row && row.purchases_override !== null && row.purchases_override !== undefined ? cleanAmount(row.purchases_override) : null;
    const effectivePurchases = purchasesOverride !== null ? purchasesOverride : purchasesFromBalance;
    const finalInventory = row ? cleanAmount(row.final_inventory) : 0;
    const method: InventoryMethod = row?.method === 'PERPETUO' ? 'PERPETUO' : 'ANALITICO';
    const computation = computeCostOfSales({ initialInventory, purchasesPeriod: effectivePurchases, finalInventory });

    return {
      id: row ? String(row.id) : `inv_${company.id}_${targetYear}_${targetPeriod}`,
      companyId: company.id,
      ejercicio: targetYear,
      periodo: targetPeriod,
      initialInventory: computation.initialInventory,
      purchasesFromBalance,
      purchasesOverride,
      effectivePurchases: computation.purchasesPeriod,
      finalInventory: computation.finalInventory,
      costOfSales: computation.costOfSales,
      method,
      polizaId: row?.poliza_id ? String(row.poliza_id) : null,
      updatedAt: row?.updated_at ? String(row.updated_at) : undefined
    };
  },

  async saveInventoryPeriod(companyId: string, payload: SaveInventoryPeriodPayload): Promise<InventoryPeriodRecord> {
    if (!supabase) throw new Error('Supabase no disponible');
    const sb = getRequiredSupabase();
    const record: Record<string, unknown> = {
      id: `inv_${companyId}_${payload.ejercicio}_${payload.periodo}`,
      company_id: companyId,
      ejercicio: payload.ejercicio,
      periodo: payload.periodo,
      initial_inventory: cleanAmount(payload.initialInventory),
      purchases_override:
        payload.purchasesOverride !== undefined && payload.purchasesOverride !== null
          ? cleanAmount(payload.purchasesOverride)
          : null,
      final_inventory: cleanAmount(payload.finalInventory),
      method: payload.method === 'PERPETUO' ? 'PERPETUO' : 'ANALITICO',
      updated_at: new Date().toISOString()
    };
    if (payload.polizaId !== undefined) record.poliza_id = payload.polizaId;

    const { error } = await sb.from('inventory_periods').upsert(record, { onConflict: 'company_id,ejercicio,periodo' });
    if (error) throw new Error(error.message);
    return this.getInventoryPeriod(companyId, payload.ejercicio, payload.periodo);
  }
};
