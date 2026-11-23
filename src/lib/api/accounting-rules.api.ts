import type {
  AccountingRuleRecord,
  UpsertAccountingRulePayload
} from '../../shared/types/accounting-rules.types';
import { fetchWithTimeout, getAuthHeaders, handleResponse } from './api-helpers';

export const accountingRulesApi = {
  listAccountingRules: (companyId: string) =>
    fetchWithTimeout(`/api/companies/${encodeURIComponent(companyId)}/accounting-rules`, {
      headers: getAuthHeaders()
    }).then((r) => handleResponse<AccountingRuleRecord[]>(r)),

  upsertAccountingRule: (payload: UpsertAccountingRulePayload) =>
    fetchWithTimeout(
      `/api/companies/${encodeURIComponent(payload.companyId)}/accounting-rules`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload)
      }
    ).then((r) => handleResponse<AccountingRuleRecord>(r)),

  deleteAccountingRule: (companyId: string, ruleId: string) =>
    fetchWithTimeout(
      `/api/companies/${encodeURIComponent(companyId)}/accounting-rules/${encodeURIComponent(ruleId)}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders()
      }
    ).then((r) => handleResponse<{ deleted: boolean }>(r))
};
