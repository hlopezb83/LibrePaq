import type {
  BankReconciliationResponse,
  FixedAssetCategory,
  FixedAssetRecord,
  FixedAssetsResponse
} from '../../shared/types';
import { fetchWithTimeout, handleResponse } from './api-helpers';

export interface UpdateFixedAssetApiPayload {
  codigo?: string;
  nombre?: string;
  categoria?: FixedAssetCategory;
  fechaAdquisicion?: string;
  montoOriginalInversion?: number;
  tasaAnualPct?: number;
  mesesDepreciadosPrevios?: number;
  inpcAdquisicion?: number;
  inpcMedioPeriodo?: number;
  estatus?: FixedAssetRecord['estatus'];
}

export const fiscalAndBankExtraApi = {
  manualMatchBankLine: (lineId: string, movementId: string) =>
    fetchWithTimeout(`/api/bank-reconciliation/${encodeURIComponent(lineId)}/manual-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movementId })
    }).then((r) =>
      handleResponse<{ matched: boolean; reconciliation: BankReconciliationResponse }>(r)
    ),

  deleteBankStatementLine: (lineId: string) =>
    fetchWithTimeout(`/api/bank-reconciliation/${encodeURIComponent(lineId)}`, {
      method: 'DELETE'
    }).then((r) =>
      handleResponse<{ deleted: boolean; reconciliation: BankReconciliationResponse }>(r)
    ),

  saveBankClosureBalance: (
    companyId: string,
    accountId: string,
    ejercicio: number,
    periodo: number,
    saldoBancoCierre: number
  ) =>
    fetchWithTimeout('/api/bank-reconciliation/closure-balance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, accountId, ejercicio, periodo, saldoBancoCierre })
    }).then((r) => handleResponse<void>(r)),

  updateFixedAsset: (
    assetId: string,
    payload: UpdateFixedAssetApiPayload,
    targetYear?: number,
    targetPeriod?: number
  ) =>
    fetchWithTimeout(`/api/fixed-assets/${encodeURIComponent(assetId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, year: targetYear, period: targetPeriod })
    }).then((r) => handleResponse<FixedAssetsResponse>(r))
};
