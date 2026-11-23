import type {
  Account,
  AccountWithBalance,
  CfdiDocument,
  Company,
  Poliza
} from './core.types';

export interface DiotSupplierRow {
  rfc: string;
  nombre: string;
  tipoTercero: '04' | '05';
  tipoOperacion: '03' | '06' | '85';
  actosPagados16: number;
  actosPagados8?: number;
  actosPagados0?: number;
  actosExentos?: number;
  iepsPagado?: number;
  ivaAcreditable16: number;
  ivaRetenido: number;
  isrRetenido: number;
  totalPagado: number;
  cfdiCount: number;
  batchLine: string;
}

export interface DiotReportResponse {
  company: Company;
  ejercicio: number;
  periodo: number;
  rows: DiotSupplierRow[];
  totals: {
    actosPagados16: number;
    ivaAcreditable16: number;
    ivaRetenido: number;
    isrRetenido: number;
    ivaTrasladadoCobrado: number;
    ivaNetoCargoFavor: number;
  };
  batchTxtContent: string;
  filename: string;
}

export interface BankStatementLine {
  id: string;
  companyId: string;
  accountId: string;
  fecha: string;
  ejercicio: number;
  periodo: number;
  referencia: string;
  descripcion: string;
  cargoBanco: number;
  abonoBanco: number;
  matchedMovementId: string | null;
  matchedPolizaFolio: string | null;
}

export interface BankReconciliationResponse {
  account: AccountWithBalance;
  ejercicio: number;
  periodo: number;
  statementLines: BankStatementLine[];
  bookMovements: Array<{
    movementId: string;
    polizaId: string;
    polizaFolio: string;
    fecha: string;
    referencia: string;
    concepto: string;
    cargoContable: number;
    abonoContable: number;
    isMatched: boolean;
  }>;
  summary: {
    saldoInicialLibros: number;
    saldoFinalLibros: number;
    totalDepositosBanco: number;
    totalRetirosBanco: number;
    movimientosConciliados: number;
    movimientosPendientesBanco: number;
    movimientosPendientesLibros: number;
  };
}

export interface ReconciliationFormulaData {
  cargosBancoNoRegistrados: number;
  depositosBancoNoRegistrados: number;
  cargosContablesEnTransito: number;
  abonosContablesEnTransito: number;
  saldoConciliadoEstimado: number;
}

export interface FielCredentialStatus {
  companyId: string;
  hasCredentials: boolean;
  hasPrivateKey?: boolean;
  rfcTitular: string | null;
  nombreTitular: string | null;
  numeroSerieCertificado: string | null;
  validFrom: string | null;
  validTo: string | null;
  isExpired: boolean;
  sha1Fingerprint: string | null;
  certificateBase64: string | null;
  updatedAt: string | null;
}

export interface SatDownloadRequestRecord {
  id: string;
  companyId: string;
  idSolicitudSat: string;
  tipoSolicitud: 'EMITIDOS' | 'RECIBIDOS';
  fechaInicial: string;
  fechaFinal: string;
  estadoSolicitud: 'ACEPTADA' | 'EN_PROCESO' | 'TERMINADA' | 'ERROR';
  codigoEstadoSat: string;
  mensajeSat: string;
  idPaqueteSat: string | null;
  cfdisDescargados: number;
  modoEjecucion: 'SAT_LIVE' | 'SANDBOX_CRYPTO';
  soapRequestXml: string;
  soapResponseXml: string;
  createdAt: string;
}

export interface SatCfdiStatusCheckResult {
  uuid: string;
  codigoEstatus: string;
  estadoSat: 'VIGENTE' | 'CANCELADO';
  esCancelable: string;
  estatusCancelacion: string;
  validacionEfos: '200_LIMPIO' | '100_PRESUNTO_O_DEFINITIVO_69B' | 'NO_VERIFICADO_TIMEOUT_SAT';
  soapEnvelopeXml: string;
  modoConsulta: 'SAT_LIVE' | 'SANDBOX_CRYPTO' | 'OFFLINE_UNVERIFIED';
}

export interface PeriodLock {
  companyId: string;
  ejercicio: number;
  periodo: number;
  isLocked: boolean;
  lockedAt: string | null;
  notes: string;
}

export type Efos69BStatus = 'LIMPIO' | 'PRESUNTO_EFOS' | 'DEFINITIVO_EFOS' | 'DESVIRTUADO';

export interface ThirdPartyRecord {
  id: string;
  companyId: string;
  rfc: string;
  nombre: string;
  rol: 'PROVEEDOR' | 'CLIENTE' | 'AMBOS';
  cuentaOperacionCode: string;
  cuentaContrapartidaCode: string;
  tipoTerceroDiot: '04' | '05';
  tipoOperacionDiot: '03' | '06' | '85';
  tasaIvaDefault: 16 | 8 | 0;
  estatus69B: Efos69BStatus;
  updatedAt: string;
}

export type FixedAssetCategory =
  | 'COMPUTO_30'
  | 'TRANSPORTE_25'
  | 'MOBILIARIO_10'
  | 'MAQUINARIA_10'
  | 'EDIFICIOS_5';

export interface FixedAssetRecord {
  id: string;
  companyId: string;
  codigo: string;
  nombre: string;
  categoria: FixedAssetCategory;
  fechaAdquisicion: string;
  cfdiUuid: string | null;
  montoOriginalInversion: number;
  tasaAnualPct: number;
  mesesDepreciadosPrevios: number;
  inpcAdquisicion: number;
  inpcMedioPeriodo: number;
  cuentaActivoCode: string;
  cuentaDepAcumCode: string;
  cuentaGastoDepCode: string;
  estatus: 'ACTIVO' | 'BAJA' | 'TOTALMENTE_DEPRECIADO';
  createdAt: string;
}

export interface FixedAssetWithCalculation extends FixedAssetRecord {
  depreciacionMensualContable: number;
  depreciacionAcumuladaTotal: number;
  valorNetoEnLibros: number;
  factorActualizacionInpc: number;
  depreciacionMensualFiscalActualizada: number;
}

export interface FixedAssetsResponse {
  assets: FixedAssetWithCalculation[];
  totals: {
    totalMoi: number;
    totalDepreciacionMensualContable: number;
    totalDepreciacionMensualFiscal: number;
    totalDepreciacionAcumulada: number;
    totalValorNetoEnLibros: number;
  };
}

export interface TaxParametersRecord {
  companyId: string;
  ejercicio: number;
  coeficienteUtilidad: number;
  perdidasFiscalesPendientes: number;
  pagosProvisionalesAnteriores: number;
  saldoFavorIvaAnterior: number;
  tipoCambioDofCierre: number;
}

export interface FiscalWorkpaperResponse {
  company: Company;
  ejercicio: number;
  periodo: number;
  parameters: TaxParametersRecord;
  isrProvisional: {
    regimenClave: string;
    esResico: boolean;
    ingresosPeriodo: number;
    ingresosAcumuladosEjercicio: number;
    deduccionesAutorizadasPeriodo: number;
    coeficienteUtilidadAplicado: number;
    utilidadFiscalEstimada: number;
    perdidasFiscalesAplicadas: number;
    baseGravableIsr: number;
    tasaIsrPct: number;
    isrCausado: number;
    pagosProvisionalesPrevios: number;
    isrRetenidoPeriodo: number;
    isrNetoAPagar: number;
  };
  ivaDefinitivo: {
    actosGravadosCobrado16: number;
    ivaTrasladadoCobrado: number;
    ivaAcreditablePagado: number;
    ivaRetenidoPorPagar: number;
    ivaRetenidoAcreditable?: number;
    saldoFavorIvaAcreditable: number;
    ivaNetoAPagar: number;
    saldoFavorIvaRemanente: number;
  };
  fluctuacionCambiaria: {
    cfdisUsdCount: number;
    saldoMonedaExtranjeraUsd: number;
    tipoCambioPromedioRegistro: number;
    tipoCambioDofCierre: number;
    valuacionLibrosMxn: number;
    valuacionCierreDofMxn: number;
    diferenciaCambiariaMxn: number;
    tipoDiferencia: 'UTILIDAD_CAMBIARIA' | 'PERDIDA_CAMBIARIA' | 'SIN_CAMBIO';
  };
  resumenLineaCapturaSat: {
    isrProvisionalAPagar: number;
    ivaDefinitivoAPagar: number;
    retencionesIsrPorEnterar: number;
    retencionesIvaPorEnterar: number;
    totalEstimadoDia17: number;
  };
  cashBasisSummary?: {
    isCashBasisRegime: boolean;
    baseContableDevengada: number;
    ingresosCobradosFlujo: number;
    deduccionesPagadasFlujo: number;
    retencionResico125: number;
    pueIngresos: number;
    repIngresos: number;
    creditNotesRestados: number;
  };
  resicoThresholdAlert?: {
    applies: boolean;
    thresholdMxn: number;
    accumulatedRevenueMxn: number;
    utilizationPct: number;
    status: 'OK' | 'WARNING_80' | 'CRITICAL_95' | 'EXCEEDED';
    label: string;
  };
  ivaBreakdown?: {
    base16: number;
    base8: number;
    base0: number;
    baseExento: number;
    iepsAcreditable: number;
    prorationFactor: number;
    ivaAcreditableSinProrrateo: number;
    ivaAcreditableProrrateado: number;
  };
}

export * from './cxc-sat.types';

export interface CompanyBackupBundle {
  version: '2.0';
  exportedAt: string;
  company: Company;
  accounts: Account[];
  cfdis: CfdiDocument[];
  polizas: Poliza[];
  thirdParties: ThirdPartyRecord[];
  fixedAssets: FixedAssetRecord[];
  periodLocks: PeriodLock[];
  taxParameters: TaxParametersRecord[];
  bankStatementLines?: BankStatementLine[];
}
