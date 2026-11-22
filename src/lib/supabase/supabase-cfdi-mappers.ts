import { supabase } from '../supabase';
import { chunkArray } from '../../shared/array-utils';
import type { parseCfdiXmlString } from '../../shared/cfdi-xml';
import type { CfdiDocument } from '../../shared/types';

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
    xml_raw: xmlRaw
  };
}
