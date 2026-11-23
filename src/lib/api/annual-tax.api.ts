import type {
  AnnualTaxSummaryResponse,
  SaveAnnualTaxInputsPayload
} from '../../shared/types/annual-tax.types';
import { fetchWithTimeout, getAuthHeaders, handleResponse } from './api-helpers';

export const annualTaxApi = {
  getAnnualTaxSummary: (companyId: string, ejercicio?: number) => {
    const q = ejercicio ? `?year=${encodeURIComponent(String(ejercicio))}` : '';
    return fetchWithTimeout(
      `/api/companies/${encodeURIComponent(companyId)}/annual-tax${q}`,
      { headers: getAuthHeaders() }
    ).then((r) => handleResponse<AnnualTaxSummaryResponse>(r));
  },

  saveAnnualTaxInputs: (companyId: string, payload: SaveAnnualTaxInputsPayload) =>
    fetchWithTimeout(`/api/companies/${encodeURIComponent(companyId)}/annual-tax`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    }).then((r) => handleResponse<AnnualTaxSummaryResponse>(r))
};
