export interface IsnStateRate {
  code: string;
  name: string;
  ratePct: number;
  notes?: string;
}

export type PayrollAmarreStatus = 'CUADRADO' | 'DIFERENCIA' | 'SIN_NOMINA';

export interface PayrollPeriodSummary {
  ejercicio: number;
  periodo: number;
  nominaCount: number;
  totalPercepciones: number;
  totalSubsidioEmpleo: number;
  isrRetenidoCfdis: number;
  imssObreroEstimado: number;
  totalNetoPagado: number;
  isrRetenidoLibros: number;
  diferenciaIsrAmarre: number;
  amarreStatus: PayrollAmarreStatus;
  cuentaIsrCode: string;
}

export interface SuaAndIsnInputs {
  ejercicio: number;
  periodo: number;
  stateCode: string;
  tasaIsnPct?: number;
  baseGravableNomina: number;
  imssPatronal: number;
  rcv: number;
  infonavit: number;
  referencia?: string;
  concepto?: string;
}

export interface SuaAndIsnMovement {
  accountId: string;
  accountCode: string;
  accountName: string;
  referencia: string;
  concepto: string;
  cargo: number;
  abono: number;
}

export interface SuaAndIsnProvisionResult {
  stateCode: string;
  stateName: string;
  tasaIsnPct: number;
  baseGravableNomina: number;
  isnEstatal: number;
  imssPatronal: number;
  rcv: number;
  infonavit: number;
  totalSuaPatronal: number;
  totalProvision: number;
  totalCargos: number;
  totalAbonos: number;
  isBalanced: boolean;
  polizaTipo: 'DIARIO';
  polizaConcept: string;
  polizaMovements: SuaAndIsnMovement[];
}
