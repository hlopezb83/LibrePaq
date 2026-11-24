import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { extractCfdiFechaPago } from '../shared/xml-utils';
import type {
  Account,
  AccountNature,
  AccountType,
  CfdiDocument,
  CfdiRelatedDoc,
  CfdiTaxBreakdown,
  Company,
  Efos69BStatus,
  FixedAssetCategory,
  FixedAssetRecord,
  PolizaType,
  ThirdPartyRecord
} from '../shared/types';

import { ensureBaseTables } from './db-ddl';

export const dataDir = join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

// NASA Power of 10 - Regla 6: Instancia SQLite encapsulada
export const db = new Database(join(dataDir, 'libre-contpaq.sqlite'), { create: true });
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
ensureBaseTables(db);

export interface CompanyDbRow {
  id: string;
  name: string;
  rfc: string;
  regimen_fiscal: string;
  codigo_postal: string;
  mask_format: string;
  current_year: number;
  current_period: number;
  created_at: string;
  user_id?: string | null;
}

export interface AccountDbRow {
  id: string;
  company_id: string;
  code: string;
  name: string;
  parent_code: string | null;
  type: AccountType;
  nature: AccountNature;
  level: number;
  is_affectable: number;
  sat_group_code: string;
  currency: 'MXN' | 'USD';
  initial_balance: number;
}

export interface PolizaDbRow {
  id: string;
  company_id: string;
  tipo: PolizaType;
  folio: number;
  fecha: string;
  ejercicio: number;
  periodo: number;
  concepto: string;
  cfdi_uuid: string | null;
  origin: 'MANUAL' | 'ADD_AUTO';
  created_at: string;
}

export interface PolizaMovementDbRow {
  id: string;
  poliza_id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  referencia: string;
  concepto: string;
  cargo: number;
  abono: number;
  cfdi_uuid: string | null;
}

export interface CfdiDbRow {
  id: string;
  company_id: string;
  uuid: string;
  fecha: string;
  tipo_comprobante: 'I' | 'E' | 'P' | 'N';
  direction: 'EMITIDO' | 'RECIBIDO';
  serie: string;
  folio: string;
  emisor_rfc: string;
  emisor_nombre: string;
  receptor_rfc: string;
  receptor_nombre: string;
  concepto_principal: string;
  clave_prod_serv: string;
  moneda: string;
  tipo_cambio: number;
  subtotal: number;
  descuento: number;
  iva_trasladado: number;
  isr_retenido: number;
  iva_retenido: number;
  total: number;
  metodo_pago: 'PUE' | 'PPD';
  forma_pago: string;
  uso_cfdi: string;
  uuid_relacionado: string | null;
  status_sat: 'VIGENTE' | 'CANCELADO';
  poliza_id: string | null;
  poliza_folio?: string | null;
  tax_breakdown?: string | null;
  related_docs?: string | null;
  xml_raw: string;
}

export interface BankLineDbRow {
  id: string;
  company_id: string;
  account_id: string;
  fecha: string;
  ejercicio: number;
  periodo: number;
  referencia: string;
  descripcion: string;
  cargo_banco: number;
  abono_banco: number;
  matched_movement_id: string | null;
  matched_poliza_folio?: string | null;
}

export interface PeriodLockDbRow {
  company_id: string;
  ejercicio: number;
  periodo: number;
  is_locked: number;
  locked_at: string | null;
  notes: string;
}

export interface ThirdPartyDbRow {
  id: string;
  company_id: string;
  rfc: string;
  nombre: string;
  rol: 'PROVEEDOR' | 'CLIENTE' | 'AMBOS';
  cuenta_operacion_code: string;
  cuenta_contrapartida_code: string;
  tipo_tercero_diot: '04' | '05' | '15';
  tipo_operacion_diot: '03' | '06' | '85';
  tasa_iva_default: 16 | 8 | 0;
  estatus_69b: Efos69BStatus;
  id_fiscal?: string | null;
  pais?: string | null;
  jurisdiccion_fiscal?: string | null;
  updated_at: string;
}

export interface FixedAssetDbRow {
  id: string;
  company_id: string;
  codigo: string;
  nombre: string;
  categoria: FixedAssetCategory;
  fecha_adquisicion: string;
  cfdi_uuid: string | null;
  monto_original_inversion: number;
  tasa_anual_pct: number;
  meses_depreciados_previos: number;
  inpc_adquisicion: number;
  inpc_medio_periodo: number;
  cuenta_activo_code: string;
  cuenta_dep_acum_code: string;
  cuenta_gasto_dep_code: string;
  estatus: 'ACTIVO' | 'BAJA';
  created_at: string;
}

export interface TaxParametersDbRow {
  company_id: string;
  ejercicio: number;
  coeficiente_utilidad: number;
  perdidas_fiscales_pendientes: number;
  pagos_provisionales_anteriores: number;
  saldo_favor_iva_anterior: number;
  tipo_cambio_dof_cierre: number;
}

export function mapCompanyRow(r: CompanyDbRow): Company {
  return {
    id: r.id,
    name: r.name,
    rfc: r.rfc,
    regimenFiscal: r.regimen_fiscal,
    codigoPostal: r.codigo_postal,
    maskFormat: r.mask_format,
    currentYear: Number(r.current_year),
    currentPeriod: Number(r.current_period),
    createdAt: r.created_at,
    userId: r.user_id ?? null
  };
}

export function mapAccountRow(r: AccountDbRow): Account {
  return {
    id: r.id,
    companyId: r.company_id,
    code: r.code,
    name: r.name,
    parentCode: r.parent_code,
    type: r.type,
    nature: r.nature,
    level: Number(r.level),
    isAffectable: Boolean(r.is_affectable),
    satGroupCode: r.sat_group_code,
    currency: r.currency,
    initialBalance: Number(r.initial_balance)
  };
}

function parseJsonField<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function mapCfdiRow(r: CfdiDbRow): CfdiDocument {
  const rawFechaPago = (r as CfdiDbRow & { fecha_pago?: string | null }).fecha_pago;
  return {
    id: r.id,
    companyId: r.company_id,
    uuid: r.uuid,
    fecha: r.fecha,
    fechaPago: (rawFechaPago ? String(rawFechaPago).slice(0, 10) : extractCfdiFechaPago(r.xml_raw, r.tipo_comprobante)) ?? null,
    tipoComprobante: r.tipo_comprobante,
    direction: r.direction,
    serie: r.serie,
    folio: r.folio,
    emisorRfc: r.emisor_rfc,
    emisorNombre: r.emisor_nombre,
    receptorRfc: r.receptor_rfc,
    receptorNombre: r.receptor_nombre,
    conceptoPrincipal: r.concepto_principal,
    claveProdServ: r.clave_prod_serv,
    moneda: r.moneda,
    tipoCambio: Number(r.tipo_cambio),
    subtotal: Number(r.subtotal),
    descuento: Number(r.descuento),
    ivaTrasladado: Number(r.iva_trasladado),
    isrRetenido: Number(r.isr_retenido),
    ivaRetenido: Number(r.iva_retenido),
    total: Number(r.total),
    metodoPago: r.metodo_pago,
    formaPago: r.forma_pago,
    usoCfdi: r.uso_cfdi,
    uuidRelacionado: r.uuid_relacionado || null,
    statusSat: r.status_sat,
    polizaId: r.poliza_id,
    polizaFolio: r.poliza_folio || null,
    taxBreakdown: parseJsonField<CfdiTaxBreakdown>(r.tax_breakdown),
    relatedDocs: parseJsonField<CfdiRelatedDoc[]>(r.related_docs),
    xmlRaw: r.xml_raw
  };
}

export function mapThirdPartyRow(r: ThirdPartyDbRow): ThirdPartyRecord {
  return {
    id: r.id,
    companyId: r.company_id,
    rfc: r.rfc,
    nombre: r.nombre,
    rol: r.rol,
    cuentaOperacionCode: r.cuenta_operacion_code,
    cuentaContrapartidaCode: r.cuenta_contrapartida_code,
    tipoTerceroDiot: r.tipo_tercero_diot,
    tipoOperacionDiot: r.tipo_operacion_diot,
    tasaIvaDefault: Number(r.tasa_iva_default) as 16 | 8 | 0,
    estatus69B: r.estatus_69b,
    idFiscal: r.id_fiscal ?? null,
    pais: r.pais ?? null,
    jurisdiccionFiscal: r.jurisdiccion_fiscal ?? null,
    updatedAt: r.updated_at
  };
}

export function mapFixedAssetRow(r: FixedAssetDbRow): FixedAssetRecord {
  return {
    id: r.id,
    companyId: r.company_id,
    codigo: r.codigo,
    nombre: r.nombre,
    categoria: r.categoria,
    fechaAdquisicion: r.fecha_adquisicion,
    cfdiUuid: r.cfdi_uuid,
    montoOriginalInversion: Number(r.monto_original_inversion),
    tasaAnualPct: Number(r.tasa_anual_pct),
    mesesDepreciadosPrevios: Number(r.meses_depreciados_previos),
    inpcAdquisicion: Number(r.inpc_adquisicion),
    inpcMedioPeriodo: Number(r.inpc_medio_periodo),
    cuentaActivoCode: r.cuenta_activo_code,
    cuentaDepAcumCode: r.cuenta_dep_acum_code,
    cuentaGastoDepCode: r.cuenta_gasto_dep_code,
    estatus: r.estatus,
    createdAt: r.created_at
  };
}
