import {
  getCurrentFiscalPeriod,
  getLastDateForPeriod,
  getTodayLocalIso,
  parseCalendarDate
} from '../date-utils';
import type { Account, AccountWithBalance } from '../types/core.types';
import type {
  CostOfSalesComputation,
  CostOfSalesPolizaMovementDraft,
  CostOfSalesPolizaPlan,
  InventoryMethod
} from '../types/cost-of-sales.types';
import type { JoinedPolizaMovementInput } from './financial-reports.engine';

export type CostPolizaMovementInput = JoinedPolizaMovementInput & {
  poliza_id?: string;
};
import {
  AccountingInvariantError,
  assertAccountingInvariant,
  fromCents,
  toCents,
  validateDoubleEntryMovements
} from './invariants-and-math';

export interface ComputeCostOfSalesInput {
  initialInventory: number;
  purchasesPeriod: number;
  finalInventory: number;
}

export interface BuildCostOfSalesPolizaInput {
  companyId: string;
  year: number;
  period: number;
  fecha?: string;
  costOfSales: number;
  accounts: readonly Account[];
  method?: InventoryMethod;
  initialInventory?: number;
  purchasesPeriod?: number;
  finalInventory?: number;
}

/**
 * Calcula el Costo de lo Vendido del periodo (Art. 39 LISR / método analítico):
 * Costo de Ventas = max(0, Inventario Inicial + Compras Netas - Inventario Final) en centavos exactos.
 */
export function computeCostOfSales(input: ComputeCostOfSalesInput): CostOfSalesComputation {
  const initialCents = Math.max(0, toCents(input.initialInventory));
  const purchasesCents = toCents(input.purchasesPeriod);
  const finalCents = Math.max(0, toCents(input.finalInventory));
  const availableCents = Math.max(0, initialCents + purchasesCents);
  const costCents = Math.max(0, initialCents + purchasesCents - finalCents);

  return {
    initialInventory: fromCents(initialCents),
    purchasesPeriod: fromCents(purchasesCents),
    availableMerchandise: fromCents(availableCents),
    finalInventory: fromCents(finalCents),
    costOfSales: fromCents(costCents)
  };
}

export function isPurchaseCostAccount(account: Pick<Account, 'isAffectable' | 'code' | 'satGroupCode' | 'type'>): boolean {
  if (!account.isAffectable) return false;
  const sat = account.satGroupCode ?? '';
  return (
    account.code.startsWith('501') ||
    account.code.startsWith('502') ||
    sat.startsWith('501') ||
    sat.startsWith('502') ||
    account.type === 'COSTOS'
  );
}

/**
 * Suma compras netas del periodo (cargos - abonos) desde la balanza de cuentas 501/502/COSTOS.
 */
export function computePurchasesFromTrialBalanceAccounts(
  trialBalance: readonly AccountWithBalance[]
): number {
  let netCents = 0;
  for (const acc of trialBalance) {
    if (!isPurchaseCostAccount(acc)) continue;
    netCents += toCents(acc.periodCharges) - toCents(acc.periodCredits);
  }
  return fromCents(Math.max(0, netCents));
}

export function isInventoryAssetAccount(
  account: Pick<Account, 'isAffectable' | 'code' | 'satGroupCode'>
): boolean {
  if (!account.isAffectable) return false;
  const sat = account.satGroupCode ?? '';
  return account.code.startsWith('115') || sat.startsWith('115');
}

/**
 * Suma compras netas del periodo (cargos - abonos) desde movimientos de póliza del periodo,
 * excluyendo la póliza de Costo de Ventas vinculada para evitar doble conteo circular.
 */
export function computePurchasesFromMovements(
  accounts: readonly Account[],
  movs: readonly CostPolizaMovementInput[],
  excludedPolizaId?: string | null
): number {
  const purchaseAccIds = new Set(accounts.filter(isPurchaseCostAccount).map((a) => a.id));
  let netCents = 0;
  for (const mov of movs) {
    if (excludedPolizaId && mov.poliza_id === excludedPolizaId) continue;
    if (!purchaseAccIds.has(mov.account_id)) continue;
    netCents += toCents(mov.cargo) - toCents(mov.abono);
  }
  return fromCents(Math.max(0, netCents));
}

/**
 * Suma entradas a Almacén (cargos en cuentas 115-*) para método de Inventarios Perpetuos,
 * excluyendo la póliza de Costo de Ventas vinculada.
 */
export function computeInventoryInputsFromMovements(
  accounts: readonly Account[],
  movs: readonly CostPolizaMovementInput[],
  excludedPolizaId?: string | null
): number {
  const invAccIds = new Set(accounts.filter(isInventoryAssetAccount).map((a) => a.id));
  let inputCents = 0;
  for (const mov of movs) {
    if (excludedPolizaId && mov.poliza_id === excludedPolizaId) continue;
    if (!invAccIds.has(mov.account_id)) continue;
    inputCents += Math.max(0, toCents(mov.cargo));
  }
  return fromCents(Math.max(0, inputCents));
}

function resolveCostOfSalesAccount(accounts: readonly Account[]): Account {
  const affectable = accounts.filter((a) => a.isAffectable);
  assertAccountingInvariant(
    affectable.length > 0,
    'EMPTY_CATALOG',
    'El catálogo de cuentas no tiene cuentas afectables.'
  );

  const match =
    affectable.find((a) => a.code === '501-01-001') ??
    affectable.find((a) => a.code.startsWith('501-')) ??
    affectable.find((a) => (a.satGroupCode ?? '').startsWith('501')) ??
    affectable.find((a) => a.type === 'COSTOS');

  assertAccountingInvariant(
    match !== undefined,
    'COST_ACCOUNT_NOT_FOUND',
    'No se encontró cuenta afectable de Costo de Ventas (501-01-001 o tipo COSTOS).'
  );
  return match;
}

function resolveInventoryOrPurchasesAccount(
  accounts: readonly Account[],
  costAcc: Account
): Account {
  const affectable = accounts.filter((a) => a.isAffectable);
  const match =
    affectable.find((a) => a.code === '115-01-001') ??
    affectable.find((a) => a.code.startsWith('115-') || (a.satGroupCode ?? '').startsWith('115')) ??
    affectable.find((a) => a.code.startsWith('502-') || (a.satGroupCode ?? '').startsWith('502')) ??
    affectable.find((a) => a.id !== costAcc.id && (a.code.startsWith('501') || (a.satGroupCode ?? '').startsWith('501')));

  if (!match) {
    throw new AccountingInvariantError(
      'INVENTORY_ACCOUNT_NOT_FOUND',
      'No se encontró cuenta de Inventarios (115-*) o Compras (502-* / 501-*) distinta a Costo de Ventas.'
    );
  }
  return match;
}

function resolveCdmxPolizaDate(year: number, period: number, explicitFecha?: string): string {
  if (explicitFecha && explicitFecha.trim().length > 0) {
    return parseCalendarDate(explicitFecha, year, period).isoDate;
  }
  const current = getCurrentFiscalPeriod();
  if (current.year === year && current.period === period) {
    return getTodayLocalIso();
  }
  return getLastDateForPeriod(year, period);
}

/**
 * Construye el borrador de Póliza de Diario de Costo de Ventas cuadrada (Debe = Haber)
 * cargando a Costo de Ventas (501-01-001 / COSTOS) y abonando a Inventarios (115-01-001 / fallback 501).
 */
export function buildCostOfSalesPolizaPlan(
  input: BuildCostOfSalesPolizaInput
): CostOfSalesPolizaPlan {
  const costCents = toCents(input.costOfSales);
  const useAnalyticalAdjustment =
    input.method === 'ANALITICO' &&
    input.initialInventory !== undefined &&
    input.finalInventory !== undefined;
  const initialCents = Math.max(0, toCents(input.initialInventory ?? 0));
  const finalCents = Math.max(0, toCents(input.finalInventory ?? 0));
  const purchasesCents = Math.max(0, toCents(input.purchasesPeriod ?? 0));

  if (useAnalyticalAdjustment) {
    assertAccountingInvariant(
      costCents > 0 || initialCents > 0 || finalCents > 0 || purchasesCents > 0,
      'ZERO_POLIZA_TOTAL',
      'El Costo de Ventas o los inventarios del periodo deben ser mayores a $0.00 para generar la póliza.'
    );
  } else {
    assertAccountingInvariant(
      costCents > 0,
      'ZERO_POLIZA_TOTAL',
      'El Costo de Ventas debe ser mayor a $0.00 para generar la póliza.'
    );
  }

  const costAcc = resolveCostOfSalesAccount(input.accounts);
  const invAcc = resolveInventoryOrPurchasesAccount(input.accounts, costAcc);
  const amount = fromCents(costCents);
  const periodLabel = `P${String(input.period).padStart(2, '0')}/${input.year}`;
  const referencia = `CV-${input.year}-${String(input.period).padStart(2, '0')}`;
  const resolvedFecha = resolveCdmxPolizaDate(input.year, input.period, input.fecha);

  let movements: CostOfSalesPolizaMovementDraft[];

  if (useAnalyticalAdjustment) {
    assertAccountingInvariant(
      initialCents > 0 || finalCents > 0,
      'ZERO_ANALYTICAL_ADJUSTMENT',
      'En método Analítico con Inventario Inicial $0.00 e Inventario Final $0.00, las compras en 501 ya reflejan el Costo de Ventas.'
    );
    movements = [];
    if (initialCents > 0) {
      const initAmt = fromCents(initialCents);
      movements.push(
        {
          accountId: costAcc.id,
          accountCode: costAcc.code,
          accountName: costAcc.name,
          referencia,
          concepto: `Traspaso de Inventario Inicial a Costo de Ventas ${periodLabel}`,
          cargo: initAmt,
          abono: 0
        },
        {
          accountId: invAcc.id,
          accountCode: invAcc.code,
          accountName: invAcc.name,
          referencia,
          concepto: `Cancelación de Inventario Inicial ${periodLabel}`,
          cargo: 0,
          abono: initAmt
        }
      );
    }
    if (finalCents > 0) {
      const finAmt = fromCents(finalCents);
      movements.push(
        {
          accountId: invAcc.id,
          accountCode: invAcc.code,
          accountName: invAcc.name,
          referencia,
          concepto: `Reconocimiento de Inventario Final ${periodLabel}`,
          cargo: finAmt,
          abono: 0
        },
        {
          accountId: costAcc.id,
          accountCode: costAcc.code,
          accountName: costAcc.name,
          referencia,
          concepto: `Deducción de Inventario Final al Costo de Ventas ${periodLabel}`,
          cargo: 0,
          abono: finAmt
        }
      );
    }
  } else {
    movements = [
      {
        accountId: costAcc.id,
        accountCode: costAcc.code,
        accountName: costAcc.name,
        referencia,
        concepto: `Costo de ventas del periodo ${periodLabel}`,
        cargo: amount,
        abono: 0
      },
      {
        accountId: invAcc.id,
        accountCode: invAcc.code,
        accountName: invAcc.name,
        referencia,
        concepto: `Descarga de almacén / inventario ${periodLabel}`,
        cargo: 0,
        abono: amount
      }
    ];
  }

  const accById = new Map(input.accounts.map((a) => [a.id, a]));
  const { totalCargo, totalAbono } = validateDoubleEntryMovements(movements, accById);

  return {
    companyId: input.companyId,
    tipo: 'DIARIO',
    fecha: resolvedFecha,
    concepto: `Costo de Ventas del Periodo ${periodLabel} (LISR)`,
    origin: 'MANUAL',
    movements,
    totalCargo,
    totalAbono
  };
}
