export type InventoryMethod = 'ANALITICO' | 'PERPETUO';

export interface CostOfSalesComputation {
  initialInventory: number;
  purchasesPeriod: number;
  availableMerchandise: number;
  finalInventory: number;
  costOfSales: number;
}

export interface InventoryPeriodRecord {
  id: string;
  companyId: string;
  ejercicio: number;
  periodo: number;
  initialInventory: number;
  purchasesFromBalance: number;
  purchasesOverride: number | null;
  effectivePurchases: number;
  finalInventory: number;
  costOfSales: number;
  method: InventoryMethod;
  polizaId: string | null;
  updatedAt?: string;
}

export interface SaveInventoryPeriodPayload {
  ejercicio: number;
  periodo: number;
  initialInventory: number;
  purchasesOverride?: number | null;
  finalInventory: number;
  method: InventoryMethod;
  polizaId?: string | null;
}

export interface CostOfSalesPolizaMovementDraft {
  accountId: string;
  accountCode: string;
  accountName: string;
  referencia: string;
  concepto: string;
  cargo: number;
  abono: number;
}

export interface CostOfSalesPolizaPlan {
  companyId: string;
  tipo: 'DIARIO';
  fecha: string;
  concepto: string;
  origin: 'MANUAL';
  movements: CostOfSalesPolizaMovementDraft[];
  totalCargo: number;
  totalAbono: number;
}
