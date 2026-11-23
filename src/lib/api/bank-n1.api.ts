import type { BankReconciliationResponse } from '../../shared/types/fiscal.types';
import type {
  BankN1ApplyItem,
  BankN1ApplyResponse,
  BankN1MatchProposal,
  BankN1ProposeResponse,
  ExtractBankPdfResponse
} from '../../shared/types/bank-n1.types';
import {
  buildPeriodQuery,
  fetchWithTimeout,
  getAuthHeaders,
  handleResponse
} from './api-helpers';

export interface ImportBankPdfLineInput {
  fecha: string;
  referencia: string;
  descripcion: string;
  cargoBanco?: number;
  abonoBanco?: number;
  cargo?: number;
  abono?: number;
}

export const bankN1Api = {
  proposeBankN1Matches: (
    companyId: string,
    accountId: string,
    year?: number,
    period?: number,
    maxGroupSize = 5,
    toleranceCents = 5
  ) =>
    fetchWithTimeout(
      `/api/companies/${encodeURIComponent(companyId)}/bank-reconciliation/n-to-1?${buildPeriodQuery(
        companyId,
        year,
        period
      )}&accountId=${encodeURIComponent(accountId)}&maxGroupSize=${maxGroupSize}&toleranceCents=${toleranceCents}`,
      { headers: getAuthHeaders() }
    ).then((r) => handleResponse<BankN1ProposeResponse>(r)),

  applyBankN1Matches: (
    companyId: string,
    accountId: string,
    proposals: ReadonlyArray<BankN1ApplyItem | BankN1MatchProposal>,
    year?: number,
    period?: number
  ) =>
    fetchWithTimeout(
      `/api/companies/${encodeURIComponent(companyId)}/bank-reconciliation/n-to-1`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ accountId, proposals, year, period })
      }
    ).then((r) => handleResponse<BankN1ApplyResponse>(r)),

  importBankPdfLines: (
    companyId: string,
    accountId: string,
    lines: ReadonlyArray<ImportBankPdfLineInput>
  ) =>
    fetchWithTimeout(
      `/api/companies/${encodeURIComponent(companyId)}/bank-reconciliation/import-pdf-lines`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ accountId, lines })
      }
    ).then((r) => handleResponse<BankReconciliationResponse>(r)),

  extractBankPdfStatement: async (
    companyId: string,
    data: string,
    mimeType = 'application/pdf'
  ): Promise<ExtractBankPdfResponse> => {
    const res = await fetchWithTimeout(
      `/api/companies/${encodeURIComponent(companyId)}/bank-reconciliation/extract-pdf`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ data, mimeType })
      },
      30_000
    );
    const json = (await res.json().catch(() => ({}))) as ExtractBankPdfResponse;
    if (!res.ok) {
      return {
        ok: false,
        code: json.code || 'AI_UNAVAILABLE',
        error: json.error || `Error HTTP ${res.status}`
      };
    }
    return json;
  }
};
