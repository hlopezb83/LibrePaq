import { supabase } from '../supabase';
import { chunkArray } from '../../shared/array-utils';
import type { parseCfdiXmlString } from '../../shared/cfdi-xml';
import {
  normalizeForeignNoCfdiRecord,
  type ForeignNoCfdiPayload
} from '../../shared/cfdi-xml-foreign';
import { extractCfdiFechaPago } from '../../shared/xml-utils';
import {
  buildRelatedCfdiOverridesFromRows,
  type RelatedCfdiDbRowLike
} from '../../shared/engine/auto-poliza-related';
import type { CfdiDocument, CfdiRelatedDoc, CfdiTaxBreakdown } from '../../shared/types';

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

type ParsedCfdiXml = ReturnType<typeof parseCfdiXmlString>;

export type PolizaSummaryLookup = Map<string, { tipo?: string; folio?: number }>;

/** Consulta por lotes los folios/tipos de póliza asociados a una lista de CFDIs. */
export async function fetchCfdiPolizaLookup(
  rows: Array<Record<string, unknown>>
): Promise<PolizaSummaryLookup> {
  const lookup: PolizaSummaryLookup = new Map();
  if (!supabase || rows.length === 0) return lookup;

  const polizaIds = Array.from(
    new Set(
      rows
        .map((r) => (r.poliza_id ? String(r.poliza_id) : ''))
        .filter((id) => id.length > 0)
    )
  );
  if (polizaIds.length === 0) return lookup;

  for (const chunk of chunkArray(polizaIds, 150)) {
    const { data, error } = await supabase
      .from('polizas')
      .select('id, tipo, folio')
      .in('id', chunk);
    if (error) {
      console.warn('[Supabase] No se pudieron resolver folios de póliza para CFDIs:', error.message);
      continue;
    }
    for (const p of (data || []) as Array<{ id: string; tipo?: string; folio?: number }>) {
      lookup.set(p.id, { tipo: p.tipo, folio: p.folio });
    }
  }
  return lookup;
}

/**
 * Mapea una fila cruda de `cfdi_documents` a un objeto de dominio `CfdiDocument`,
 * resolviendo `polizaFolio` desde join embebido o lookup separado.
 */
export function mapSupabaseCfdi(
  row: Record<string, unknown>,
  polizaLookup?: PolizaSummaryLookup
): CfdiDocument {
  const rowPolizaId = row.poliza_id ? String(row.poliza_id) : null;
  const polizasJoin =
    (row.polizas as { tipo?: string; folio?: number } | null | undefined) ||
    (rowPolizaId ? polizaLookup?.get(rowPolizaId) : undefined);
  const polizaFolio = polizasJoin
    ? `${polizasJoin.tipo || ''}-${polizasJoin.folio || ''}`
    : row.poliza_folio
      ? String(row.poliza_folio)
      : null;

  return {
    id: String(row.id),
    companyId: String(row.company_id),
    uuid: String(row.uuid),
    fecha: typeof row.fecha === 'string' ? row.fecha.split('T')[0]! : String(row.fecha),
    fechaPago:
      (typeof row.fecha_pago === 'string' && row.fecha_pago
        ? row.fecha_pago.slice(0, 10)
        : extractCfdiFechaPago(row.xml_raw, row.tipo_comprobante)) ?? null,
    tipoComprobante: (row.tipo_comprobante as 'I' | 'E' | 'P' | 'N') || 'I',
    direction: (row.direction as 'EMITIDO' | 'RECIBIDO') || 'EMITIDO',
    serie: String(row.serie || ''),
    folio: String(row.folio || ''),
    emisorRfc: String(row.emisor_rfc || ''),
    emisorNombre: String(row.emisor_nombre || ''),
    receptorRfc: String(row.receptor_rfc || ''),
    receptorNombre: String(row.receptor_nombre || ''),
    conceptoPrincipal: String(row.concepto_principal || ''),
    claveProdServ: String(row.clave_prod_serv || '01010101'),
    moneda: (row.moneda as 'MXN' | 'USD') || 'MXN',
    tipoCambio: Number(row.tipo_cambio || 1),
    subtotal: Number(row.subtotal || 0),
    descuento: Number(row.descuento || 0),
    ivaTrasladado: Number(row.iva_trasladado || 0),
    isrRetenido: Number(row.isr_retenido || 0),
    ivaRetenido: Number(row.iva_retenido || 0),
    total: Number(row.total || 0),
    metodoPago: (row.metodo_pago as 'PUE' | 'PPD') || 'PUE',
    formaPago: String(row.forma_pago || '03'),
    usoCfdi: String(row.uso_cfdi || 'G03'),
    uuidRelacionado: row.uuid_relacionado ? String(row.uuid_relacionado) : null,
    statusSat: (row.status_sat as 'VIGENTE' | 'CANCELADO') || 'VIGENTE',
    validacionEfos: row.validacion_efos ? String(row.validacion_efos) : null,
    esCancelable: row.es_cancelable ? String(row.es_cancelable) : null,
    estatusCancelacion: row.estatus_cancelacion ? String(row.estatus_cancelacion) : null,
    polizaId: row.poliza_id ? String(row.poliza_id) : null,
    polizaFolio,
    deductiblePct:
      row.deductible_pct !== undefined && row.deductible_pct !== null
        ? Number(row.deductible_pct)
        : undefined,
    isForeignNoCfdi: Boolean(row.is_foreign_no_cfdi ?? false),
    taxBreakdown: parseJsonField<CfdiTaxBreakdown>(row.tax_breakdown),
    relatedDocs: parseJsonField<CfdiRelatedDoc[]>(row.related_docs),
    xmlRaw: row.xml_raw ? String(row.xml_raw) : ''
  };
}

export function buildParsedCfdiInsertRow(
  id: string,
  companyId: string,
  parsed: ParsedCfdiXml,
  direction: 'EMITIDO' | 'RECIBIDO',
  xmlRaw: string
) {
  return {
    id,
    company_id: companyId,
    uuid: parsed.uuid,
    fecha: parsed.fecha,
    fecha_pago: parsed.fechaPago ?? null,
    tipo_comprobante: parsed.tipoComprobante,
    direction,
    serie: parsed.serie || '',
    folio: parsed.folio || '',
    emisor_rfc: parsed.emisorRfc || 'XAXX010101000',
    emisor_nombre: parsed.emisorNombre || 'Empresa Emisora',
    receptor_rfc: parsed.receptorRfc || 'XAXX010101000',
    receptor_nombre: parsed.receptorNombre || 'Cliente General',
    concepto_principal: parsed.conceptoPrincipal || 'Factura general',
    clave_prod_serv: parsed.claveProdServ || '01010101',
    moneda: parsed.moneda || 'MXN',
    tipo_cambio: parsed.tipoCambio ?? 1,
    subtotal: parsed.subtotal ?? 0,
    descuento: parsed.descuento ?? 0,
    iva_trasladado: parsed.ivaTrasladado ?? 0,
    isr_retenido: parsed.isrRetenido ?? 0,
    iva_retenido: parsed.ivaRetenido ?? 0,
    total: parsed.total ?? (parsed.subtotal ?? 0) * 1.16,
    metodo_pago: parsed.metodoPago || 'PUE',
    forma_pago: parsed.formaPago || '03',
    uso_cfdi: parsed.usoCfdi || 'G03',
    uuid_relacionado: parsed.uuidRelacionado || null,
    status_sat: 'VIGENTE',
    tax_breakdown: parsed.taxBreakdown ?? null,
    related_docs: parsed.relatedDocs ?? null,
    xml_raw: xmlRaw
  };
}

export async function fetchRelatedCfdiOverrides(
  client: import('@supabase/supabase-js').SupabaseClient,
  cfdi: Pick<CfdiDocument, 'companyId' | 'tipoComprobante' | 'relatedDocs' | 'uuidRelacionado'>
) {
  if (cfdi.tipoComprobante !== 'P' && cfdi.tipoComprobante !== 'E') {
    return {};
  }
  const relUuids = Array.from(
    new Set(
      [...(cfdi.relatedDocs?.map((d) => d.idDocumento) ?? []), ...(cfdi.uuidRelacionado ? [cfdi.uuidRelacionado] : [])]
        .map((u) => u.trim())
        .filter(Boolean)
    )
  );
  if (relUuids.length === 0) return {};
  const lookupKeys = Array.from(new Set(relUuids.flatMap((u) => [u, u.toUpperCase(), u.toLowerCase()])));
  const { data: relRows } = await client
    .from('cfdi_documents')
    .select(
      'uuid, moneda, tipo_cambio, metodo_pago, subtotal, descuento, iva_trasladado, isr_retenido, iva_retenido, total, concepto_principal, clave_prod_serv, emisor_nombre, uso_cfdi, deductible_pct, xml_raw'
    )
    .eq('company_id', cfdi.companyId)
    .in('uuid', lookupKeys);
  return buildRelatedCfdiOverridesFromRows(
    (relRows ?? []) as RelatedCfdiDbRowLike[],
    cfdi.tipoComprobante,
    relUuids.length
  );
}

/** Inserta en Supabase un Comprobante Extranjero o Gasto Sin CFDI sin UUID SAT apócrifo y enlaza proveedor DIOT 05. */
export async function insertForeignNoCfdiWithClient(
  client: import('@supabase/supabase-js').SupabaseClient,
  payload: ForeignNoCfdiPayload,
  company: { rfc?: string | null; name?: string | null }
): Promise<CfdiDocument> {
  const norm = normalizeForeignNoCfdiRecord(payload, company);
  const id = `cfdi_${crypto.randomUUID().slice(0, 12)}`;
  const { data, error } = await client
    .from('cfdi_documents')
    .insert({
      id,
      company_id: payload.companyId,
      uuid: norm.uuid,
      fecha: norm.fecha,
      fecha_pago: null,
      tipo_comprobante: norm.tipoComprobante,
      direction: norm.direction,
      serie: norm.serie,
      folio: norm.folio,
      emisor_rfc: norm.emisorRfc,
      emisor_nombre: norm.emisorNombre,
      receptor_rfc: norm.receptorRfc,
      receptor_nombre: norm.receptorNombre,
      concepto_principal: norm.conceptoPrincipal,
      clave_prod_serv: norm.claveProdServ,
      moneda: norm.moneda,
      tipo_cambio: norm.tipoCambio,
      subtotal: norm.subtotal,
      descuento: 0,
      iva_trasladado: norm.ivaTrasladado,
      isr_retenido: norm.isrRetenido,
      iva_retenido: norm.ivaRetenido,
      total: norm.total,
      metodo_pago: norm.metodoPago,
      forma_pago: norm.formaPago,
      uso_cfdi: norm.usoCfdi,
      uuid_relacionado: null,
      status_sat: 'VIGENTE',
      deductible_pct: norm.deductiblePct,
      is_foreign_no_cfdi: true,
      tax_breakdown: norm.taxBreakdown,
      related_docs: null,
      xml_raw: ''
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (norm.mode === 'EXTRANJERO' && norm.direction === 'RECIBIDO' && norm.emisorNombre) {
    try {
      const { data: existingTp } = await client
        .from('third_parties')
        .select('id')
        .eq('company_id', payload.companyId)
        .eq('rfc', norm.emisorRfc)
        .eq('nombre', norm.emisorNombre)
        .maybeSingle();
      if (!existingTp) {
        await client.from('third_parties').insert({
          id: `tp_${crypto.randomUUID().slice(0, 12)}`,
          company_id: payload.companyId,
          rfc: norm.emisorRfc,
          nombre: norm.emisorNombre,
          rol: 'PROVEEDOR',
          cuenta_operacion_code: '601-01-003',
          cuenta_contrapartida_code: '201-01-099',
          tipo_tercero_diot: '05',
          tipo_operacion_diot: norm.tipoOperacionDiot,
          tasa_iva_default: 0,
          estatus_69b: 'LIMPIO',
          id_fiscal: norm.taxId || null,
          pais: norm.country || null,
          deductible_pct: norm.deductiblePct,
          updated_at: new Date().toISOString()
        });
      }
    } catch {
      // No bloquear el registro si el alta automática de tercero falla por índice
    }
  }
  return mapSupabaseCfdi(data);
}
