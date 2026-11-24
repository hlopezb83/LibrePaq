import { supabase } from '../supabase';
import { chunkArray } from '../../shared/array-utils';
import type { parseCfdiXmlString } from '../../shared/cfdi-xml';
import { extractCfdiFechaPago } from '../../shared/xml-utils';
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
    polizaId: row.poliza_id ? String(row.poliza_id) : null,
    polizaFolio,
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
  let relatedOriginalTipoCambioByUuid: Record<string, number> | undefined;
  let relatedOriginalTipoCambio: number | undefined;
  let relatedIsPpd: boolean | undefined;
  let relatedPpdIsrRetenido = 0;
  let relatedPpdIvaRetenido = 0;
  let relatedPpdTotal = 0;
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
    .select('uuid, moneda, tipo_cambio, metodo_pago, isr_retenido, iva_retenido, total')
    .eq('company_id', cfdi.companyId)
    .in('uuid', lookupKeys);
  const tcMap: Record<string, number> = {};
  for (const r of (relRows ?? []) as Array<{
    uuid?: string; moneda?: string; tipo_cambio?: number;
    metodo_pago?: string; isr_retenido?: number; iva_retenido?: number; total?: number;
  }>) {
    const key = String(r.uuid ?? '').trim().toUpperCase();
    const cur = String(r.moneda ?? 'MXN').toUpperCase();
    const tc = Number(r.tipo_cambio ?? 0);
    if (key && cur !== 'MXN' && tc > 0) {
      tcMap[key] = tc;
      if (relatedOriginalTipoCambio === undefined) relatedOriginalTipoCambio = tc;
    }
    if (String(r.metodo_pago ?? '').toUpperCase() === 'PPD') {
      relatedIsPpd = true;
      if (cfdi.tipoComprobante === 'P') {
        relatedPpdIsrRetenido += Number(r.isr_retenido ?? 0);
        relatedPpdIvaRetenido += Number(r.iva_retenido ?? 0);
        relatedPpdTotal += Number(r.total ?? 0);
      }
    }
  }
  if (Object.keys(tcMap).length > 0) relatedOriginalTipoCambioByUuid = tcMap;
  return {
    ...(relatedOriginalTipoCambio !== undefined ? { relatedOriginalTipoCambio } : {}),
    ...(relatedOriginalTipoCambioByUuid ? { relatedOriginalTipoCambioByUuid } : {}),
    ...(relatedIsPpd !== undefined ? { relatedIsPpd } : {}),
    ...(relatedPpdIsrRetenido > 0 ? { relatedPpdIsrRetenido } : {}),
    ...(relatedPpdIvaRetenido > 0 ? { relatedPpdIvaRetenido } : {}),
    ...(relatedPpdTotal > 0 ? { relatedPpdTotal } : {})
  };
}
