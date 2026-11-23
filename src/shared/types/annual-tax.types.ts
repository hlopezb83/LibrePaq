import type { Company } from './core.types';

export interface AnnualTaxInputs {
  companyId: string;
  ejercicio: number;
  inpcCierreAnterior: number;
  inpcCierreActual: number;
  cucaInicial: number;
  aportacionesCapital: number;
  reduccionesCapital: number;
  cufinInicial: number;
  dividendosPagados: number;
  ptuPagadaAnterior: number;
  noDeduciblesManual: number;
  updatedAt?: string;
}

export type SaveAnnualTaxInputsPayload = Omit<AnnualTaxInputs, 'updatedAt'>;

export interface AnnualInflationMonthlyRow {
  periodo: number;
  mesNombre: string;
  creditosCierre: number;
  deudasCierre: number;
}

export interface AnnualInflationResult {
  promedioCreditos: number;
  promedioDeudas: number;
  diferenciaPromedios: number;
  tipo: 'ACUMULABLE' | 'DEDUCIBLE' | 'NEUTRO';
  inpcCierreAnterior: number;
  inpcCierreActual: number;
  factorAjuste: number;
  ajusteAcumulable: number;
  ajusteDeducible: number;
  monthlyRows: AnnualInflationMonthlyRow[];
}

export interface AnnualFiscalReconciliation {
  utilidadContable: number;
  ingresosFiscalesNoContables: number;
  deduccionesContablesNoFiscales: number;
  deduccionesFiscalesNoContables: number;
  isrContableProvisionado: number;
  depreciacionContable: number;
  depreciacionFiscalInversiones: number;
  noDeduciblesManual: number;
  ptuPagadaEjercicio: number;
  utilidadFiscalAntesPtu: number;
  utilidadFiscal: number;
  perdidasFiscalesPendientes: number;
  perdidasFiscalesActualizadas: number;
  perdidasFiscalesAplicadas: number;
  resultadoFiscal: number;
}

export type AnnualTaxRegimeType =
  | 'PM_GENERAL'
  | 'PM_RESICO'
  | 'PF_ART152'
  | 'PF_RESICO';

export interface AnnualTaxDetermination {
  regimenClave: string;
  tipoRegimenAnual: AnnualTaxRegimeType;
  ingresosNominales: number;
  tasaAplicablePct: number;
  isrAnualCausado: number;
  pagosProvisionalesEfectuados: number;
  isrRetenidoAcreditable: number;
  isrAnualCargoFavor: number;
  isrACargo: number;
  isrAFavor: number;
  ptuBase: number;
  ptuPorPagar10Pct: number;
  nuevoCoeficienteUtilidad: number;
  factorActualizacionInpc: number;
  cucaActualizada: number;
  cucaFinal: number;
  cufinActualizada: number;
  ufinDelEjercicio: number;
  cufinFinal: number;
}

export interface AnnualTaxSummaryResponse {
  company: Company;
  ejercicio: number;
  inputs: AnnualTaxInputs;
  inflation: AnnualInflationResult;
  reconciliation: AnnualFiscalReconciliation;
  determination: AnnualTaxDetermination;
}
