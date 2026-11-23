export type CxcCxpAgingBucket = '0_30' | '31_60' | '61_90' | '90_PLUS';

export interface CxcCxpDocumentRow {
  cfdiId: string;
  uuid: string;
  direction: 'EMITIDO' | 'RECIBIDO';
  rfc: string;
  nombre: string;
  serieFolio: string;
  fecha: string;
  moneda: string;
  tipoCambio: number;
  totalOriginalMxn: number;
  totalPagadoMxn: number;
  saldoInsolutoMxn: number;
  daysPast: number;
  bucket: CxcCxpAgingBucket;
  parcialidades: Array<{
    paymentUuid: string;
    fechaPago: string;
    numParcialidad: number;
    impPagadoMxn: number;
  }>;
}

export interface CxcCxpAgingResponse {
  companyId: string;
  asOfDate: string;
  cxcTotal: number;
  cxpTotal: number;
  cxcBuckets: Record<CxcCxpAgingBucket, number>;
  cxpBuckets: Record<CxcCxpAgingBucket, number>;
  cxcItems: CxcCxpDocumentRow[];
  cxpItems: CxcCxpDocumentRow[];
}

export interface SatBatchVerifyResult {
  checkedCount: number;
  updatedCount: number;
  cancelledWithPolizaCount: number;
  items: Array<{
    cfdiId: string;
    uuid: string;
    statusSat: 'VIGENTE' | 'CANCELADO';
    hadPoliza: boolean;
    cancelledWithPoliza: boolean;
    validacionEfos: string;
  }>;
}
