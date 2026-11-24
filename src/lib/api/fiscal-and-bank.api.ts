import type {
  BankReconciliationResponse,
  CfdiDocument,
  CxcCxpAgingResponse,
  DiotReportResponse,
  Efos69BStatus,
  FielCredentialStatus,
  FiscalWorkpaperResponse,
  FixedAssetCategory,
  FixedAssetsResponse,
  PeriodLock,
  Poliza,
  SatBatchVerifyResult,
  SatDownloadRequestRecord,
  TaxParametersRecord,
  ThirdPartyRecord
} from '../../shared/types';
import { buildPeriodQuery, fetchWithTimeout, handleResponse } from './api-helpers';

export const fiscalAndBankApi = {
  getDiotReport: (companyId: string, year?: number, period?: number) =>
    fetchWithTimeout(`/api/diot?${buildPeriodQuery(companyId, year, period)}`).then((r) =>
      handleResponse<DiotReportResponse>(r)
    ),

  getBankReconciliation: (
    companyId: string,
    accountId: string,
    year?: number,
    period?: number
  ) =>
    fetchWithTimeout(
      `/api/bank-reconciliation?${buildPeriodQuery(
        companyId,
        year,
        period
      )}&accountId=${encodeURIComponent(accountId)}`
    ).then((r) => handleResponse<BankReconciliationResponse>(r)),

  addBankStatementLines: (payload: {
    companyId: string;
    accountId: string;
    lines: Array<{
      fecha: string;
      referencia: string;
      descripcion: string;
      cargoBanco: number;
      abonoBanco: number;
    }>;
  }) =>
    fetchWithTimeout('/api/bank-reconciliation/lines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => handleResponse<BankReconciliationResponse>(r)),

  autoMatchBankReconciliation: (
    companyId: string,
    accountId: string,
    year?: number,
    period?: number
  ) =>
    fetchWithTimeout('/api/bank-reconciliation/auto-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, accountId, year, period })
    }).then((r) =>
      handleResponse<{ matchedCount: number; reconciliation: BankReconciliationResponse }>(r)
    ),

  createPolizaFromBankLine: (
    lineId: string,
    options?: {
      counterAccountCode?: string;
      desglosarIva?: boolean;
    }
  ) =>
    fetchWithTimeout(`/api/bank-reconciliation/${encodeURIComponent(lineId)}/create-poliza`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {})
    }).then((r) =>
      handleResponse<{ createdPolizaId: string; reconciliation: BankReconciliationResponse }>(r)
    ),

  unmatchBankLine: (lineId: string) =>
    fetchWithTimeout(`/api/bank-reconciliation/${encodeURIComponent(lineId)}/unmatch`, {
      method: 'POST'
    }).then((r) =>
      handleResponse<{ unmatched: boolean; reconciliation: BankReconciliationResponse }>(r)
    ),

  getFielStatus: (companyId: string) =>
    fetchWithTimeout(`/api/sat/fiel?companyId=${encodeURIComponent(companyId)}`).then((r) =>
      handleResponse<FielCredentialStatus>(r)
    ),

  saveFielCredentials: (payload: {
    companyId: string;
    cerBase64?: string;
    keyBase64?: string;
    passphrase: string;
  }) =>
    fetchWithTimeout('/api/sat/fiel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => handleResponse<FielCredentialStatus>(r)),

  generateTestFiel: (companyId: string, passphrase: string) =>
    fetchWithTimeout('/api/sat/fiel/generate-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, passphrase })
    }).then((r) =>
      handleResponse<{
        status: FielCredentialStatus;
        generatedFiles: { cerBase64: string; keyBase64: string; passphrase: string };
      }>(r)
    ),

  getSatDownloadRequests: (companyId: string) =>
    fetchWithTimeout(`/api/sat/requests?companyId=${encodeURIComponent(companyId)}`).then((r) =>
      handleResponse<SatDownloadRequestRecord[]>(r)
    ),

  executeSatSoapDownload: (payload: {
    companyId: string;
    tipoSolicitud: 'EMITIDOS' | 'RECIBIDOS';
    fechaInicial: string;
    fechaFinal: string;
    modoEjecucion?: 'SAT_LIVE' | 'SANDBOX_CRYPTO';
  }) =>
    fetchWithTimeout('/api/sat/soap-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) =>
      handleResponse<{
        requestRecord: SatDownloadRequestRecord;
        downloadedCfdis: CfdiDocument[];
      }>(r)
    ),

  verifyPendingSatRequests: (companyId: string) =>
    fetchWithTimeout('/api/sat/verify-pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId })
    }).then((r) =>
      handleResponse<{
        ok: boolean;
        updatedCount: number;
        downloadedCount: number;
        rejectedCount?: number;
        pendingCount?: number;
        message: string;
        details?: string;
      }>(r)
    ),

  getPeriodLock: (companyId: string, year?: number, period?: number) =>
    fetchWithTimeout(`/api/period-locks?${buildPeriodQuery(companyId, year, period)}`).then((r) =>
      handleResponse<PeriodLock>(r)
    ),

  setPeriodLock: (payload: {
    companyId: string;
    ejercicio: number;
    periodo: number;
    isLocked: boolean;
    notes?: string;
  }) =>
    fetchWithTimeout('/api/period-locks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => handleResponse<PeriodLock>(r)),

  getThirdParties: (companyId: string) =>
    fetchWithTimeout(`/api/third-parties?companyId=${encodeURIComponent(companyId)}`).then((r) =>
      handleResponse<ThirdPartyRecord[]>(r)
    ),

  saveThirdParty: (payload: {
    companyId: string;
    rfc: string;
    nombre: string;
    rol: 'PROVEEDOR' | 'CLIENTE' | 'AMBOS';
    cuentaOperacionCode: string;
    cuentaContrapartidaCode: string;
    tipoTerceroDiot: '04' | '05' | '15';
    tipoOperacionDiot: '03' | '06' | '85';
    tasaIvaDefault: 16 | 8 | 0;
    estatus69B: Efos69BStatus;
    idFiscal?: string | null;
    pais?: string | null;
    jurisdiccionFiscal?: string | null;
  }) =>
    fetchWithTimeout('/api/third-parties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => handleResponse<ThirdPartyRecord>(r)),

  getFixedAssets: (companyId: string) =>
    fetchWithTimeout(`/api/fixed-assets?companyId=${encodeURIComponent(companyId)}`).then((r) =>
      handleResponse<FixedAssetsResponse>(r)
    ),

  createFixedAsset: (payload: {
    companyId: string;
    codigo: string;
    nombre: string;
    categoria: FixedAssetCategory;
    fechaAdquisicion: string;
    cfdiUuid?: string | null;
    montoOriginalInversion: number;
    tasaAnualPct: number;
    mesesDepreciadosPrevios?: number;
    inpcAdquisicion?: number;
    inpcMedioPeriodo?: number;
    cuentaActivoCode?: string;
    cuentaDepAcumCode?: string;
    cuentaGastoDepCode?: string;
  }) =>
    fetchWithTimeout('/api/fixed-assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => handleResponse<FixedAssetsResponse>(r)),

  deleteFixedAsset: (assetId: string) =>
    fetchWithTimeout(`/api/fixed-assets/${encodeURIComponent(assetId)}`, {
      method: 'DELETE'
    }).then((r) => handleResponse<{ deleted: boolean }>(r)),

  generateDepreciationPoliza: (companyId: string) =>
    fetchWithTimeout('/api/fixed-assets/depreciation-poliza', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId })
    }).then((r) => handleResponse<Poliza>(r)),

  getFiscalWorkpaper: (companyId: string, year?: number, period?: number) =>
    fetchWithTimeout(`/api/fiscal-workpaper?${buildPeriodQuery(companyId, year, period)}`).then((r) =>
      handleResponse<FiscalWorkpaperResponse>(r)
    ),

  getTaxParameters: (companyId: string, year?: number, period?: number) =>
    fetchWithTimeout(
      `/api/fiscal-workpaper/parameters?companyId=${encodeURIComponent(companyId)}${
        year !== undefined ? `&year=${year}` : ''
      }${period !== undefined ? `&period=${period}` : ''}`
    ).then((r) => handleResponse<TaxParametersRecord>(r)),

  saveTaxParameters: (payload: {
    companyId: string;
    ejercicio: number;
    periodo?: number;
    coeficienteUtilidad?: number;
    perdidasFiscalesPendientes?: number;
    pagosProvisionalesAnteriores?: number;
    saldoFavorIvaAnterior?: number;
    tipoCambioDofCierre?: number;
    ptuPagadaEjercicio?: number;
  }) =>
    fetchWithTimeout('/api/fiscal-workpaper/parameters', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => handleResponse<TaxParametersRecord>(r)),

  generateTaxProvisionPoliza: (companyId: string, year?: number, period?: number) =>
    fetchWithTimeout('/api/fiscal-workpaper/provision-poliza', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, year, period })
    }).then((r) => handleResponse<Poliza>(r)),

  generateExchangePoliza: (companyId: string, year?: number, period?: number) =>
    fetchWithTimeout('/api/fiscal-workpaper/exchange-poliza', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, year, period })
    }).then((r) => handleResponse<Poliza>(r)),

  getCxcCxpAging: (companyId: string, asOfIso?: string) =>
    fetchWithTimeout(
      `/api/companies/${encodeURIComponent(companyId)}/cxc-cxp${asOfIso ? `?asOf=${encodeURIComponent(asOfIso)}` : ''}`
    ).then((r) => handleResponse<CxcCxpAgingResponse>(r)),

  verifyCfdisSatBatch: (companyId: string, cfdiIds: string[]) =>
    fetchWithTimeout(
      `/api/companies/${encodeURIComponent(companyId)}/cfdis/verify-sat-batch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cfdiIds })
      }
    ).then((r) => handleResponse<SatBatchVerifyResult>(r))
};
