import type {
  AccountLedgerResponse,
  AccountWithBalance,
  Company,
  CompanyBackupBundle,
  DashboardSummary
} from '../../shared/types';
import { buildPeriodQuery, fetchWithTimeout, getAuthHeaders, handleResponse } from './api-helpers';

export const companiesAndAccountsApi = {
  getCompanies: () =>
    fetchWithTimeout('/api/companies', {
      headers: getAuthHeaders()
    }).then((r) => handleResponse<Company[]>(r)),

  createCompany: (payload: {
    name: string;
    rfc: string;
    regimenFiscal: string;
    codigoPostal: string;
    currentYear?: number;
    currentPeriod?: number;
    catalogPreset?: 'SAT_STANDARD' | 'RESICO_SIMPLIFIED' | 'CUSTOM';
    initialBankName?: string;
    initialBankAccount?: string;
    initialBankBalance?: number;
    createOpeningEntry?: boolean;
    fielCerBase64?: string;
    fielKeyBase64?: string;
    fielPassword?: string;
  }) =>
    fetchWithTimeout('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    }).then((r) => handleResponse<Company>(r)),

  updateCompany: (
    companyId: string,
    payload: {
      name: string;
      rfc: string;
      regimenFiscal: string;
      codigoPostal: string;
    }
  ) =>
    fetchWithTimeout(`/api/companies/${encodeURIComponent(companyId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    }).then((r) => handleResponse<Company>(r)),

  deleteCompany: (companyId: string) =>
    fetchWithTimeout(`/api/companies/${encodeURIComponent(companyId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    }).then((r) => handleResponse<{ deleted: boolean }>(r)),

  updateCompanyPeriod: (companyId: string, currentYear: number, currentPeriod: number) =>
    fetchWithTimeout(`/api/companies/${encodeURIComponent(companyId)}/period`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ currentYear, currentPeriod })
    }).then((r) => handleResponse<Company>(r)),

  getDashboard: (companyId: string, year?: number, period?: number) =>
    fetchWithTimeout(`/api/dashboard?${buildPeriodQuery(companyId, year, period)}`).then((r) =>
      handleResponse<DashboardSummary>(r)
    ),

  getAccounts: (companyId: string, year?: number, period?: number) =>
    fetchWithTimeout(`/api/accounts?${buildPeriodQuery(companyId, year, period)}`).then((r) =>
      handleResponse<AccountWithBalance[]>(r)
    ),

  getAccountLedger: (companyId: string, accountId: string, year?: number, period?: number) =>
    fetchWithTimeout(
      `/api/accounts/${encodeURIComponent(accountId)}/ledger?${buildPeriodQuery(
        companyId,
        year,
        period
      )}`
    ).then((r) => handleResponse<AccountLedgerResponse>(r)),

  createAccount: (payload: {
    companyId: string;
    code: string;
    name: string;
    parentCode: string | null;
    type: string;
    nature: string;
    level: number;
    isAffectable: boolean;
    satGroupCode: string;
    initialBalance: number;
  }) =>
    fetchWithTimeout('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => handleResponse<{ id: string; code: string; name: string }>(r)),

  updateAccount: (
    accountId: string,
    payload: {
      name: string;
      satGroupCode: string;
      type: string;
      nature: string;
      initialBalance: number;
    }
  ) =>
    fetchWithTimeout(`/api/accounts/${encodeURIComponent(accountId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => handleResponse<{ updated: boolean }>(r)),

  deleteAccount: (accountId: string) =>
    fetchWithTimeout(`/api/accounts/${encodeURIComponent(accountId)}`, {
      method: 'DELETE'
    }).then((r) => handleResponse<{ deleted: boolean }>(r)),

  batchImportAccounts: (
    companyId: string,
    rows: Array<{
      code: string;
      name: string;
      parentCode?: string | null;
      type?: string;
      nature?: string;
      satGroupCode?: string;
      isAffectable?: boolean;
      initialBalance?: number;
    }>
  ) =>
    fetchWithTimeout('/api/accounts/batch-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, rows })
    }).then((r) => handleResponse<{ importedCount: number; updatedCount: number }>(r)),

  exportCompanyBackup: (companyId: string) =>
    fetchWithTimeout(`/api/companies/${encodeURIComponent(companyId)}/backup`).then((r) =>
      handleResponse<CompanyBackupBundle>(r)
    ),

  restoreCompanyBackup: (bundle: CompanyBackupBundle) =>
    fetchWithTimeout('/api/companies/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bundle)
    }).then((r) => handleResponse<Company>(r))
};
