import type {
  InventoryPeriodRecord,
  SaveInventoryPeriodPayload
} from '../../shared/types/cost-of-sales.types';
import { fetchWithTimeout, getAuthHeaders, handleResponse } from './api-helpers';

export const inventoryApi = {
  getInventoryPeriod: (companyId: string, ejercicio?: number, periodo?: number) => {
    const params = new URLSearchParams();
    if (ejercicio) params.set('year', String(ejercicio));
    if (periodo) params.set('period', String(periodo));
    const qs = params.toString();
    const suffix = qs ? `?${qs}` : '';
    return fetchWithTimeout(
      `/api/companies/${encodeURIComponent(companyId)}/inventory-cost${suffix}`,
      { headers: getAuthHeaders() }
    ).then((r) => handleResponse<InventoryPeriodRecord>(r));
  },

  saveInventoryPeriod: (companyId: string, payload: SaveInventoryPeriodPayload) =>
    fetchWithTimeout(`/api/companies/${encodeURIComponent(companyId)}/inventory-cost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    }).then((r) => handleResponse<InventoryPeriodRecord>(r))
};
