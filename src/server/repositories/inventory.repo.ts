import { db } from '../connection';
import {
  computeCostOfSales,
  computeInventoryInputsFromMovements,
  computePurchasesFromMovements,
  computePurchasesFromTrialBalanceAccounts,
  type CostPolizaMovementInput
} from '../../shared/engine/cost-of-sales.engine';
import { assertAccountingInvariant, fromCents, toCents } from '../../shared/engine/invariants-and-math';
import type {
  InventoryMethod,
  InventoryPeriodRecord,
  SaveInventoryPeriodPayload
} from '../../shared/types/cost-of-sales.types';
import { getAccounts } from './accounts.repo';
import { ensureAnnualAndInventoryTables } from './annual-tax.repo';
import { getCompanyById } from './companies.repo';
import { assertPeriodOpen } from './period-locks.repo';
import { computeTrialBalance } from './trial-balance.repo';

interface InventoryPeriodDbRow {
  id: string;
  company_id: string;
  ejercicio: number;
  periodo: number;
  initial_inventory: number;
  purchases_override: number | null;
  final_inventory: number;
  method: string;
  poliza_id: string | null;
  updated_at: string;
}

function normalizeYear(ejercicio: number | undefined, fallback: number): number {
  if (ejercicio !== undefined && Number.isFinite(ejercicio) && ejercicio >= 2000 && ejercicio <= 2100) {
    return Math.round(ejercicio);
  }
  return fallback;
}

function normalizePeriod(periodo: number | undefined, fallback: number): number {
  if (periodo !== undefined && Number.isFinite(periodo) && periodo >= 1 && periodo <= 13) {
    return Math.round(periodo);
  }
  return fallback;
}

/**
 * Calcula las compras netas del periodo sumando los movimientos netos
 * de las cuentas 501 / 502 / COSTOS en la balanza de comprobación.
 */
export function computePurchasesFromTrialBalance(
  companyId: string,
  ejercicio: number,
  periodo: number
): number {
  const trialBalance = computeTrialBalance(companyId, ejercicio, periodo);
  return computePurchasesFromTrialBalanceAccounts(trialBalance);
}

export function getInventoryPeriodRepo(
  companyId: string,
  ejercicio?: number,
  periodo?: number,
  userId?: string | null
): InventoryPeriodRecord {
  ensureAnnualAndInventoryTables(db);
  const company = getCompanyById(companyId, userId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const targetYear = normalizeYear(ejercicio, company.currentYear);
  const targetPeriod = normalizePeriod(periodo, company.currentPeriod);

  const row = db
    .query('SELECT * FROM inventory_periods WHERE company_id = ? AND ejercicio = ? AND periodo = ?')
    .get(company.id, targetYear, targetPeriod) as InventoryPeriodDbRow | null;

  let prevFinalInventory = 0;
  if (!row) {
    let prevRow: { final_inventory: number } | null = null;
    if (targetPeriod === 1) {
      prevRow =
        (db
          .query('SELECT final_inventory FROM inventory_periods WHERE company_id = ? AND ejercicio = ? AND periodo = 13')
          .get(company.id, targetYear - 1) as { final_inventory: number } | null) ??
        (db
          .query('SELECT final_inventory FROM inventory_periods WHERE company_id = ? AND ejercicio = ? AND periodo = 12')
          .get(company.id, targetYear - 1) as { final_inventory: number } | null);
    } else {
      prevRow = db
        .query('SELECT final_inventory FROM inventory_periods WHERE company_id = ? AND ejercicio = ? AND periodo = ?')
        .get(company.id, targetYear, targetPeriod - 1) as { final_inventory: number } | null;
    }
    prevFinalInventory = prevRow ? fromCents(Math.max(0, toCents(prevRow.final_inventory))) : 0;
  }

  const initialInventory = row
    ? fromCents(Math.max(0, toCents(row.initial_inventory)))
    : prevFinalInventory;
  const method: InventoryMethod = row?.method === 'PERPETUO' ? 'PERPETUO' : 'ANALITICO';
  const linkedPolizaId = row?.poliza_id ?? null;

  const accounts = getAccounts(company.id);
  const movRows = db
    .query(`
      SELECT m.poliza_id, m.account_id, m.cargo, m.abono
      FROM poliza_movements m
      INNER JOIN polizas p ON p.id = m.poliza_id
      WHERE p.company_id = ? AND p.ejercicio = ? AND p.periodo = ?
    `)
    .all(company.id, targetYear, targetPeriod) as CostPolizaMovementInput[];

  const purchasesFromBalance =
    method === 'PERPETUO'
      ? computeInventoryInputsFromMovements(accounts, movRows, linkedPolizaId)
      : computePurchasesFromMovements(accounts, movRows, linkedPolizaId);
  const purchasesOverride =
    row && row.purchases_override !== null && row.purchases_override !== undefined
      ? fromCents(Math.max(0, toCents(row.purchases_override)))
      : null;
  const effectivePurchases = purchasesOverride !== null ? purchasesOverride : purchasesFromBalance;
  const finalInventory = row ? fromCents(Math.max(0, toCents(row.final_inventory))) : 0;

  const computation = computeCostOfSales({
    initialInventory,
    purchasesPeriod: effectivePurchases,
    finalInventory
  });

  return {
    id: row?.id ?? `inv_${company.id}_${targetYear}_${targetPeriod}`,
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
    polizaId: row?.poliza_id ?? null,
    updatedAt: row?.updated_at
  };
}

export function saveInventoryPeriodRepo(
  companyId: string,
  payload: SaveInventoryPeriodPayload,
  userId?: string | null
): InventoryPeriodRecord {
  ensureAnnualAndInventoryTables(db);
  const company = getCompanyById(companyId, userId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const targetYear = normalizeYear(payload.ejercicio, company.currentYear);
  const targetPeriod = normalizePeriod(payload.periodo, company.currentPeriod);
  assertAccountingInvariant(
    targetPeriod >= 1 && targetPeriod <= 13,
    'INVALID_PERIOD',
    'El periodo debe estar entre 1 y 13.'
  );
  assertPeriodOpen(company.id, targetYear, targetPeriod);

  const existing = db
    .query('SELECT poliza_id FROM inventory_periods WHERE company_id = ? AND ejercicio = ? AND periodo = ?')
    .get(company.id, targetYear, targetPeriod) as { poliza_id: string | null } | null;

  const method: InventoryMethod = payload.method === 'PERPETUO' ? 'PERPETUO' : 'ANALITICO';
  const initialInventory = fromCents(Math.max(0, toCents(payload.initialInventory)));
  const finalInventory = fromCents(Math.max(0, toCents(payload.finalInventory)));
  const purchasesOverride =
    payload.purchasesOverride !== undefined &&
    payload.purchasesOverride !== null &&
    Number.isFinite(Number(payload.purchasesOverride))
      ? fromCents(Math.max(0, toCents(payload.purchasesOverride)))
      : null;
  const polizaId =
    payload.polizaId !== undefined ? payload.polizaId : (existing?.poliza_id ?? null);
  const now = new Date().toISOString();
  const id = `inv_${company.id}_${targetYear}_${targetPeriod}`;

  db.prepare(`
    INSERT INTO inventory_periods (
      id, company_id, ejercicio, periodo, initial_inventory,
      purchases_override, final_inventory, method, poliza_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id, ejercicio, periodo) DO UPDATE SET
      initial_inventory = excluded.initial_inventory,
      purchases_override = excluded.purchases_override,
      final_inventory = excluded.final_inventory,
      method = excluded.method,
      poliza_id = excluded.poliza_id,
      updated_at = excluded.updated_at
  `).run(
    id,
    company.id,
    targetYear,
    targetPeriod,
    initialInventory,
    purchasesOverride,
    finalInventory,
    method,
    polizaId,
    now
  );

  return getInventoryPeriodRepo(company.id, targetYear, targetPeriod, userId);
}
