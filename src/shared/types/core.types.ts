export type AccountType =
  | 'ACTIVO'
  | 'PASIVO'
  | 'CAPITAL'
  | 'INGRESOS'
  | 'COSTOS'
  | 'GASTOS';

export type AccountNature = 'DEUDORA' | 'ACREEDORA';

export type PolizaType = 'INGRESO' | 'EGRESO' | 'DIARIO';

export interface Company {
  id: string;
  name: string;
  rfc: string;
  regimenFiscal: string;
  codigoPostal: string;
  maskFormat: string;
  currentYear: number;
  currentPeriod: number;
  createdAt: string;
  userId?: string | null;
}

export interface Account {
  id: string;
  companyId: string;
  code: string;
  name: string;
  parentCode: string | null;
  type: AccountType;
  nature: AccountNature;
  level: number;
  isAffectable: boolean;
  satGroupCode: string;
  currency: 'MXN' | 'USD';
  initialBalance: number;
}

export interface AccountWithBalance extends Account {
  initialBalanceComputed: number;
  periodCharges: number;
  periodCredits: number;
  finalBalance: number;
}

export interface PolizaMovement {
  id: string;
  polizaId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  referencia: string;
  concepto: string;
  cargo: number;
  abono: number;
  cfdiUuid: string | null;
  rfcContraparte?: string | null;
  cfdiTotal?: number | null;
  cfdiMoneda?: string | null;
  cfdiTipoCambio?: number | null;
}

export interface Poliza {
  id: string;
  companyId: string;
  tipo: PolizaType;
  folio: number;
  fecha: string;
  ejercicio: number;
  periodo: number;
  concepto: string;
  cfdiUuid: string | null;
  origin: 'MANUAL' | 'ADD_AUTO';
  totalCargos: number;
  totalAbonos: number;
  isBalanced: boolean;
  createdAt: string;
  movements: PolizaMovement[];
}

export type CfdiTipo = 'I' | 'E' | 'P' | 'N' | 'T';

export interface CfdiTaxBreakdown {
  base16: number;
  iva16: number;
  base8: number;
  iva8: number;
  base0: number;
  baseExento: number;
  ieps: number;
  objetoImp?: string;
}

export interface CfdiRelatedDoc {
  idDocumento: string;
  numParcialidad: number;
  impSaldoAnt: number;
  impPagado: number;
  impSaldoInsoluto: number;
  monedaDr?: string;
  equivalenciaDr?: number;
  pagoMoneda?: string;
  pagoTipoCambio?: number;
}

export interface CfdiDocument {
  id: string;
  companyId: string;
  uuid: string;
  fecha: string;
  tipoComprobante: CfdiTipo;
  direction: 'EMITIDO' | 'RECIBIDO';
  serie: string;
  folio: string;
  emisorRfc: string;
  emisorNombre: string;
  receptorRfc: string;
  receptorNombre: string;
  conceptoPrincipal: string;
  claveProdServ: string;
  moneda: string;
  tipoCambio: number;
  subtotal: number;
  descuento: number;
  ivaTrasladado: number;
  isrRetenido: number;
  ivaRetenido: number;
  total: number;
  metodoPago: 'PUE' | 'PPD';
  formaPago: string;
  usoCfdi: string;
  uuidRelacionado?: string | null;
  statusSat: 'VIGENTE' | 'CANCELADO';
  polizaId: string | null;
  polizaFolio?: string | null;
  xmlRaw: string;
  taxBreakdown?: CfdiTaxBreakdown | null;
  relatedDocs?: CfdiRelatedDoc[] | null;
}

export interface DashboardSummary {
  company: Company;
  kpis: {
    ingresosPeriodo: number;
    egresosPeriodo: number;
    utilidadNeta: number;
    efectivoBancos: number;
    cuentasPorCobrar: number;
    cuentasPorPagar: number;
    ivaPorPagarNeto: number;
    totalPolizasPeriodo: number;
    cfdisPendientesContabilizar: number;
    cfdisTotalesPeriodo: number;
  };
  monthlyTrend: Array<{
    periodo: number;
    mesNombre: string;
    ingresos: number;
    egresos: number;
    utilidad: number;
  }>;
  recentPolizas: Poliza[];
  pendingCfdis: CfdiDocument[];
}

export interface DashboardTrialBalanceSummary {
  isBalanced: boolean;
  totalCargos: number;
  totalAbonos: number;
  difference: number;
}

export interface FinancialStatementsResponse {
  company: Company;
  ejercicio: number;
  periodo: number;
  trialBalance: AccountWithBalance[];
  totals: {
    initialDeudor: number;
    initialAcreedor: number;
    totalCargos: number;
    totalAbonos: number;
    finalDeudor: number;
    finalAcreedor: number;
  };
  incomeStatement: {
    ingresos: AccountWithBalance[];
    totalIngresos: number;
    costos: AccountWithBalance[];
    totalCostos: number;
    utilidadBruta: number;
    gastos: AccountWithBalance[];
    totalGastos: number;
    isrEjercicio?: AccountWithBalance[];
    totalIsr?: number;
    utilidadNeta: number;
  };
  balanceSheet: {
    activos: AccountWithBalance[];
    totalActivo: number;
    pasivos: AccountWithBalance[];
    totalPasivo: number;
    capital: AccountWithBalance[];
    totalCapitalBase: number;
    utilidadEjercicio: number;
    totalPasivoMasCapital: number;
    isBalanced: boolean;
  };
}

export interface AccountLedgerEntry {
  movementId: string;
  polizaId: string;
  fecha: string;
  periodo: number;
  tipoPoliza: PolizaType;
  folioPoliza: number;
  accountCode: string;
  accountName: string;
  referencia: string;
  concepto: string;
  cfdiUuid: string | null;
  cargo: number;
  abono: number;
  runningBalance: number;
}

export interface AccountLedgerResponse {
  account: Account;
  ejercicio: number;
  periodo: number;
  initialBalance: number;
  totalCharges: number;
  totalCredits: number;
  finalBalance: number;
  entries: AccountLedgerEntry[];
}
