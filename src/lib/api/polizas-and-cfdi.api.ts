import type {
  CfdiDocument,
  FinancialStatementsResponse,
  Poliza,
  PolizaType,
  SatCfdiStatusCheckResult
} from '../../shared/types';
import { buildPeriodQuery, fetchWithTimeout, handleResponse } from './api-helpers';

export const polizasAndCfdiApi = {
  getPolizas: (companyId: string, year?: number, period?: number) =>
    fetchWithTimeout(`/api/polizas?${buildPeriodQuery(companyId, year, period)}`).then((r) =>
      handleResponse<Poliza[]>(r)
    ),

  createPoliza: (payload: {
    companyId: string;
    tipo: PolizaType;
    fecha: string;
    concepto: string;
    cfdiUuid?: string | null;
    origin?: 'MANUAL' | 'ADD_AUTO';
    movements: Array<{
      accountId: string;
      referencia?: string;
      concepto?: string;
      cargo: number;
      abono: number;
    }>;
  }) =>
    fetchWithTimeout('/api/polizas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => handleResponse<Poliza>(r)),

  updatePoliza: (
    polizaId: string,
    payload: {
      tipo: PolizaType;
      fecha: string;
      concepto: string;
      cfdiUuid?: string | null;
      movements: Array<{
        accountId: string;
        referencia?: string;
        concepto?: string;
        cargo: number;
        abono: number;
      }>;
    }
  ) =>
    fetchWithTimeout(`/api/polizas/${encodeURIComponent(polizaId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => handleResponse<{ updated: boolean }>(r)),

  deletePoliza: (polizaId: string) =>
    fetchWithTimeout(`/api/polizas/${encodeURIComponent(polizaId)}`, {
      method: 'DELETE'
    }).then((r) => handleResponse<{ deleted: boolean }>(r)),

  closeYearPoliza: (companyId: string) =>
    fetchWithTimeout('/api/polizas/close-year', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId })
    }).then((r) =>
      handleResponse<{ closed: boolean; polizaId: string; utilidadTraspasada: number }>(r)
    ),

  getCfdis: (companyId: string) =>
    fetchWithTimeout(`/api/cfdis?companyId=${encodeURIComponent(companyId)}`).then((r) =>
      handleResponse<CfdiDocument[]>(r)
    ),

  uploadCfdi: (payload: {
    companyId: string;
    xmlRaw?: string;
    tipoComprobante?: 'I' | 'E' | 'P' | 'N';
    direction?: 'EMITIDO' | 'RECIBIDO';
    counterpartyRfc?: string;
    counterpartyName?: string;
    conceptoPrincipal?: string;
    subtotal?: number;
    isrRetenido?: number;
    ivaRetenido?: number;
    metodoPago?: 'PUE' | 'PPD';
    uuidRelacionado?: string | null;
    fecha?: string;
  }) =>
    fetchWithTimeout('/api/cfdis/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => handleResponse<CfdiDocument>(r)),

  batchUploadCfdiXmls: (companyId: string, xmlList: string[]) =>
    fetchWithTimeout('/api/cfdis/batch-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, xmlList })
    }).then((r) =>
      handleResponse<{ uploaded: CfdiDocument[]; skippedDuplicates: number }>(r)
    ),

  autoPolizaFromCfdi: (
    cfdiId: string,
    options?: {
      operationAccountCode?: string;
      counterAccountCode?: string;
    }
  ) =>
    fetchWithTimeout(`/api/cfdis/${encodeURIComponent(cfdiId)}/auto-poliza`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {})
    }).then((r) => handleResponse<Poliza>(r)),

  batchAutoPolizaFromCfdis: (
    cfdiIds: string[],
    options?: {
      operationAccountCode?: string;
      counterAccountCode?: string;
    },
    _onProgress?: (current: number, total: number) => void
  ) =>
    fetchWithTimeout('/api/cfdis/batch-auto-poliza', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cfdiIds, ...options })
    }).then((r) => handleResponse<{ createdPolizas: Poliza[]; count: number }>(r)),

  deleteCfdi: (cfdiId: string) =>
    fetchWithTimeout(`/api/cfdis/${encodeURIComponent(cfdiId)}`, {
      method: 'DELETE'
    }).then((r) => handleResponse<{ deleted: boolean }>(r)),

  getCfdiXml: (cfdiId: string) =>
    fetchWithTimeout(`/api/cfdis/${encodeURIComponent(cfdiId)}/xml`).then((r) =>
      handleResponse<{ xmlRaw: string }>(r).then((res) => res.xmlRaw)
    ),

  getReports: (companyId: string, year?: number, period?: number) =>
    fetchWithTimeout(`/api/reports?${buildPeriodQuery(companyId, year, period)}`).then((r) =>
      handleResponse<FinancialStatementsResponse>(r)
    ),

  getSatXml: (companyId: string, type: 'catalogo' | 'balanza' | 'polizas', year?: number, period?: number) =>
    fetchWithTimeout(
      `/api/sat-xml?${buildPeriodQuery(companyId, year, period)}&type=${encodeURIComponent(type)}`
    ).then((r) => handleResponse<{ filename: string; type: string; xml: string }>(r)),

  verifyCfdiSatStatus: (cfdiId: string) =>
    fetchWithTimeout(`/api/cfdis/${encodeURIComponent(cfdiId)}/verify-sat`, {
      method: 'POST'
    }).then((r) => handleResponse<SatCfdiStatusCheckResult>(r))
};
