import { getTodayLocalIso } from './date-utils';
import { clampDeductiblePct } from './engine/auto-poliza-deductible';
import { fromCents, toCents } from './engine/invariants-and-math';
import type { CfdiTaxBreakdown } from './types';

export type ForeignNoCfdiMode = 'EXTRANJERO' | 'GASTO_SIN_CFDI';

export interface ForeignNoCfdiPayload {
  companyId: string;
  isForeignNoCfdi: true;
  mode?: ForeignNoCfdiMode;
  direction?: 'EMITIDO' | 'RECIBIDO';
  numFactExt?: string;
  taxId?: string;
  country?: string;
  counterpartyRfc?: string;
  counterpartyName: string;
  conceptoPrincipal: string;
  moneda?: string;
  tipoCambio?: number;
  subtotal: number;
  ivaTrasladado?: number;
  isrRetenido?: number;
  ivaRetenido?: number;
  metodoPago?: 'PUE' | 'PPD';
  formaPago?: string;
  fecha?: string;
  deductiblePct?: number;
  tipoOperacionDiot?: '03' | '06' | '85';
}

export interface NormalizedForeignNoCfdiRecord {
  uuid: string;
  fecha: string;
  tipoComprobante: 'I';
  direction: 'EMITIDO' | 'RECIBIDO';
  serie: string;
  folio: string;
  emisorRfc: string;
  emisorNombre: string;
  receptorRfc: string;
  receptorNombre: string;
  conceptoPrincipal: string;
  claveProdServ: string;
  moneda: string;
  tipoCambio: number;
  subtotal: number;
  descuento: number;
  ivaTrasladado: number;
  isrRetenido: number;
  ivaRetenido: number;
  total: number;
  metodoPago: 'PUE' | 'PPD';
  formaPago: string;
  usoCfdi: string;
  deductiblePct: number;
  isForeignNoCfdi: true;
  mode: ForeignNoCfdiMode;
  taxId: string;
  country: string;
  tipoOperacionDiot: '03' | '06' | '85';
  taxBreakdown: CfdiTaxBreakdown;
  xmlRaw: '';
}

const UUID_V4_LIKE_REGEX = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

export function buildNonSatExternalIdentifier(
  mode: ForeignNoCfdiMode,
  numFactExt?: string,
  fecha?: string
): string {
  const prefix = mode === 'EXTRANJERO' ? 'EXT' : 'NOCFDI';
  const cleanNum = String(numFactExt || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const randomSuffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  const datePart = (fecha || getTodayLocalIso()).replace(/[^0-9]/g, '').slice(0, 8);
  const candidate = cleanNum
    ? `${prefix}-${cleanNum}`.slice(0, 36)
    : `${prefix}-${datePart}-${randomSuffix}`.slice(0, 36);
  return UUID_V4_LIKE_REGEX.test(candidate) ? `${prefix}-${datePart}-${randomSuffix}`.slice(0, 36) : candidate;
}

export function normalizeForeignNoCfdiRecord(
  payload: ForeignNoCfdiPayload,
  company: { rfc?: string | null; name?: string | null },
  fallbackDate?: string
): NormalizedForeignNoCfdiRecord {
  const mode: ForeignNoCfdiMode = payload.mode === 'GASTO_SIN_CFDI' ? 'GASTO_SIN_CFDI' : 'EXTRANJERO';
  const direction: 'EMITIDO' | 'RECIBIDO' = payload.direction === 'EMITIDO' ? 'EMITIDO' : 'RECIBIDO';
  const fecha = String(payload.fecha || '').slice(0, 10) || fallbackDate || getTodayLocalIso();
  const moneda = String(payload.moneda || (mode === 'EXTRANJERO' ? 'USD' : 'MXN')).trim().toUpperCase() || 'MXN';
  const rawTc = Number(payload.tipoCambio ?? 1);
  const tipoCambio = moneda === 'MXN' ? 1 : Number.isFinite(rawTc) && rawTc > 0 ? Number(rawTc.toFixed(4)) : 1;

  const subtotal = fromCents(Math.max(0, toCents(Number(payload.subtotal || 0))));
  const ivaTrasladado = fromCents(Math.max(0, toCents(Number(payload.ivaTrasladado ?? 0))));
  const isrRetenido = fromCents(Math.max(0, toCents(Number(payload.isrRetenido ?? 0))));
  const ivaRetenido = fromCents(Math.max(0, toCents(Number(payload.ivaRetenido ?? 0))));
  const total = fromCents(Math.max(0, toCents(subtotal) + toCents(ivaTrasladado) - toCents(isrRetenido) - toCents(ivaRetenido)));

  const companyRfc = String(company.rfc || 'XAXX010101000').trim().toUpperCase();
  const companyName = String(company.name || 'Mi Empresa').trim();
  const defaultCounterRfc = mode === 'EXTRANJERO' ? 'XEXX010101000' : 'XAXX010101000';
  const cleanCounterRfc = String(payload.counterpartyRfc || defaultCounterRfc).trim().toUpperCase() || defaultCounterRfc;
  const counterName = String(payload.counterpartyName || '').trim() || (mode === 'EXTRANJERO' ? 'Proveedor Extranjero' : 'Gasto Sin CFDI');
  const taxId = String(payload.taxId || '').trim();
  const country = String(payload.country || (mode === 'EXTRANJERO' ? 'USA' : 'MEX')).trim().toUpperCase();
  const numFactExt = String(payload.numFactExt || '').trim();

  const uuid = buildNonSatExternalIdentifier(mode, numFactExt, fecha);
  const defaultDed = mode === 'EXTRANJERO' ? 100 : 0;
  const deductiblePct = clampDeductiblePct(payload.deductiblePct ?? defaultDed);
  const tipoOperacionDiot: '03' | '06' | '85' =
    payload.tipoOperacionDiot === '03' || payload.tipoOperacionDiot === '06' ? payload.tipoOperacionDiot : '85';

  return {
    uuid,
    fecha,
    tipoComprobante: 'I',
    direction,
    serie: mode === 'EXTRANJERO' ? 'EXT' : 'S/CFDI',
    folio: numFactExt || uuid.split('-').slice(-1)[0] || '1',
    emisorRfc: direction === 'EMITIDO' ? companyRfc : cleanCounterRfc,
    emisorNombre: direction === 'EMITIDO' ? companyName : counterName,
    receptorRfc: direction === 'EMITIDO' ? cleanCounterRfc : companyRfc,
    receptorNombre: direction === 'EMITIDO' ? counterName : companyName,
    conceptoPrincipal: String(payload.conceptoPrincipal || '').trim() || (mode === 'EXTRANJERO' ? 'Servicio extranjero sin CFDI' : 'Gasto sin comprobante fiscal'),
    claveProdServ: '81112501',
    moneda,
    tipoCambio,
    subtotal,
    descuento: 0,
    ivaTrasladado,
    isrRetenido,
    ivaRetenido,
    total,
    metodoPago: payload.metodoPago === 'PPD' ? 'PPD' : 'PUE',
    formaPago: String(payload.formaPago || '03'),
    usoCfdi: deductiblePct === 0 ? 'S01' : 'G03',
    deductiblePct,
    isForeignNoCfdi: true,
    mode,
    taxId,
    country,
    tipoOperacionDiot,
    taxBreakdown: {
      base16: ivaTrasladado > 0 ? subtotal : 0,
      iva16: ivaTrasladado,
      base8: 0,
      iva8: 0,
      base0: ivaTrasladado > 0 ? 0 : subtotal,
      baseExento: 0,
      ieps: 0
    },
    xmlRaw: ''
  };
}
