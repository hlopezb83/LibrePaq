import type { AccountNature, AccountType, Company } from './core.types';

export interface CashFlowLineItem {
  code: string;
  label: string;
  amount: number;
  satReference?: string;
}

export interface CashFlowStatementData {
  utilidadNeta: number;
  ajustesPartidasVirtuales: CashFlowLineItem[];
  totalPartidasVirtuales: number;
  cambiosCapitalTrabajo: CashFlowLineItem[];
  totalCambiosCapitalTrabajo: number;
  actividadesOperacion: CashFlowLineItem[];
  flujoNetoOperacion: number;
  actividadesInversion: CashFlowLineItem[];
  flujoNetoInversion: number;
  actividadesFinanciamiento: CashFlowLineItem[];
  flujoNetoFinanciamiento: number;
  variacionNetaEfectivo: number;
  efectivoInicial: number;
  efectivoFinal: number;
  diferenciaReconciliacion: number;
  isReconciled: boolean;
}

export type EquityChangeColumn =
  | 'capitalSocial'
  | 'reservaLegal'
  | 'resultadosAcumulados'
  | 'resultadoEjercicio'
  | 'total';

export interface EquityChangesRow {
  id: string;
  concepto: string;
  rowType: 'OPENING' | 'MOVEMENT' | 'CLOSING';
  capitalSocial: number;
  reservaLegal: number;
  resultadosAcumulados: number;
  resultadoEjercicio: number;
  total: number;
}

export interface EquityChangesStatementData {
  columns: ReadonlyArray<{ key: EquityChangeColumn; label: string; satRef: string }>;
  rows: EquityChangesRow[];
  saldoInicialTotal: number;
  movimientoNetoTotal: number;
  saldoFinalTotal: number;
  isBalanced: boolean;
}

export interface ComparativeAccountRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  nature: AccountNature;
  level: number;
  satGroupCode: string;
  currentBalance: number;
  previousBalance: number;
  varianceAmount: number;
  variancePct: number | null;
}

export interface ExtendedFinancialStatementsResponse {
  company: Company;
  ejercicio: number;
  periodo: number;
  hasPreviousComparative: boolean;
  previousEjercicioLabel: string;
  cashFlow: CashFlowStatementData;
  equityChanges: EquityChangesStatementData;
  comparative: ComparativeAccountRow[];
}
