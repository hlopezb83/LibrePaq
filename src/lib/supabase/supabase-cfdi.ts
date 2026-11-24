import { supabase, getRequiredSupabase } from '../supabase';
import { parseCfdiXmlString } from '../../shared/cfdi-xml';
import { parseCalendarDate, getTodayLocalIso } from '../../shared/date-utils';
import type { CfdiDocument, Poliza } from '../../shared/types';
import { assertSupabasePeriodOpen } from './supabase-polizas';
import { chunkArray, fetchAllRows } from './supabase-pagination';
import {
  buildParsedCfdiInsertRow,
  fetchCfdiPolizaLookup,
  mapSupabaseCfdi
} from './supabase-cfdi-mappers';
import { runSupabaseAutoPolizaFromCfdi, type AutoPolizaClientOptions } from './supabase-cfdi-poliza';

export { mapSupabaseCfdi };

export const supabaseCfdi = {
  async getCfdis(companyId: string, opts?: { includeXml?: boolean }): Promise<CfdiDocument[]> {
    if (!supabase) return [];
    try {
      const projection = opts?.includeXml
        ? '*'
        : 'id, company_id, uuid, fecha, tipo_comprobante, direction, serie, folio, emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre, concepto_principal, clave_prod_serv, moneda, tipo_cambio, subtotal, descuento, iva_trasladado, isr_retenido, iva_retenido, total, metodo_pago, forma_pago, uso_cfdi, uuid_relacionado, status_sat, poliza_id, tax_breakdown, related_docs';

      const data = await fetchAllRows(async (from, to) => {
        return getRequiredSupabase()
          .from('cfdi_documents')
          .select(projection)
          .eq('company_id', companyId)
          .order('fecha', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to);
      });
      const rows = data as unknown as Array<Record<string, unknown>>;
      if (opts?.includeXml !== false) {
        const nominaIds = rows
          .filter((r) => r.tipo_comprobante === 'N' && !r.xml_raw && r.id)
          .map((r) => String(r.id));
        if (nominaIds.length > 0) {
          const xmlById = new Map<string, string>();
          for (const idChunk of chunkArray(nominaIds, 100)) {
            const { data: xmlRows } = await getRequiredSupabase()
              .from('cfdi_documents')
              .select('id, xml_raw')
              .in('id', idChunk);
            for (const xr of (xmlRows || []) as Array<{ id: string; xml_raw?: string | null }>) {
              if (xr.xml_raw) xmlById.set(String(xr.id), xr.xml_raw);
            }
          }
          for (const r of rows) {
            const hydratedXml = xmlById.get(String(r.id));
            if (hydratedXml) r.xml_raw = hydratedXml;
          }
        }
      }
      const polizaLookup = await fetchCfdiPolizaLookup(rows);
      return rows.map((r) => mapSupabaseCfdi(r, polizaLookup));
    } catch (error) {
      console.error('[Supabase] Error al consultar CFDIs:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  },

  async getCfdiXml(cfdiId: string): Promise<string> {
    if (!supabase) return '';
    const { data, error } = await supabase
      .from('cfdi_documents')
      .select('xml_raw')
      .eq('id', cfdiId)
      .maybeSingle();
    if (error || !data) throw new Error('XML no encontrado');
    return (data as { xml_raw?: string }).xml_raw || '';
  },

  async uploadCfdi(payload: {
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
  }): Promise<CfdiDocument> {
    if (!supabase) throw new Error('Supabase no disponible');
    const xmlString = payload.xmlRaw || '';
    const parsed = xmlString ? parseCfdiXmlString(xmlString, { requireStamp: true }) : null;
    const uuid = (parsed?.uuid || crypto.randomUUID()).toUpperCase();

    const { data: existingDup, error: dupErr } = await supabase
      .from('cfdi_documents')
      .select('id')
      .eq('company_id', payload.companyId)
      .eq('uuid', uuid)
      .maybeSingle();
    if (dupErr) throw new Error(dupErr.message);
    if (existingDup) {
      throw new Error(`DUPLICATE_CFDI: El comprobante con UUID ${uuid} ya existe en la Bóveda ADD.`);
    }

    const id = `cfdi_${crypto.randomUUID().slice(0, 12)}`;

    const { data: comp } = await supabase
      .from('companies')
      .select('rfc')
      .eq('id', payload.companyId)
      .maybeSingle();
    const companyRfc = (comp?.rfc || '').toUpperCase();
    const direction: 'EMITIDO' | 'RECIBIDO' =
      parsed && companyRfc
        ? parsed.emisorRfc.toUpperCase() === companyRfc
          ? 'EMITIDO'
          : 'RECIBIDO'
        : payload.direction || 'EMITIDO';
    const simSub = payload.subtotal || 0;
    const simIva = Math.round(simSub * 16) / 100;
    const simTotal = Math.max(
      0,
      Math.round((simSub + simIva - (payload.isrRetenido || 0) - (payload.ivaRetenido || 0)) * 100) / 100
    );

    const { data, error } = await supabase
      .from('cfdi_documents')
      .insert({
        id,
        company_id: payload.companyId,
        uuid,
        fecha: parsed?.fecha || payload.fecha || getTodayLocalIso(),
        tipo_comprobante: parsed?.tipoComprobante || payload.tipoComprobante || 'I',
        direction,
        serie: parsed?.serie || '',
        folio: parsed?.folio || '',
        emisor_rfc: parsed?.emisorRfc || (direction === 'EMITIDO' ? companyRfc || 'XAXX010101000' : payload.counterpartyRfc || 'XAXX010101000'),
        emisor_nombre: parsed?.emisorNombre || 'Empresa Emisora',
        receptor_rfc: parsed?.receptorRfc || (direction === 'RECIBIDO' ? companyRfc || 'XAXX010101000' : payload.counterpartyRfc || 'XAXX010101000'),
        receptor_nombre: parsed?.receptorNombre || payload.counterpartyName || 'Cliente General',
        concepto_principal: parsed?.conceptoPrincipal || payload.conceptoPrincipal || 'Factura general',
        clave_prod_serv: parsed?.claveProdServ || '01010101',
        moneda: parsed?.moneda || 'MXN',
        tipo_cambio: parsed?.tipoCambio || 1,
        subtotal: parsed?.subtotal ?? simSub,
        descuento: parsed?.descuento || 0,
        iva_trasladado: parsed?.ivaTrasladado ?? simIva,
        isr_retenido: parsed?.isrRetenido ?? (payload.isrRetenido || 0),
        iva_retenido: parsed?.ivaRetenido ?? (payload.ivaRetenido || 0),
        total: parsed?.total ?? simTotal,
        metodo_pago: parsed?.metodoPago || payload.metodoPago || 'PUE',
        forma_pago: parsed?.formaPago || '03',
        uso_cfdi: parsed?.usoCfdi || 'G03',
        uuid_relacionado: parsed?.uuidRelacionado || payload.uuidRelacionado || null,
        status_sat: 'VIGENTE',
        tax_breakdown: parsed?.taxBreakdown ?? null,
        related_docs: parsed?.relatedDocs ?? null,
        xml_raw: xmlString
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapSupabaseCfdi(data);
  },

  async batchUploadCfdiXmls(
    companyId: string,
    xmlList: string[]
  ): Promise<{ uploaded: CfdiDocument[]; skippedDuplicates: number }> {
    if (!supabase) return { uploaded: [], skippedDuplicates: 0 };
    const uploaded: CfdiDocument[] = [];
    let skippedDuplicates = 0;

    const { data: comp } = await supabase
      .from('companies')
      .select('rfc')
      .eq('id', companyId)
      .maybeSingle();
    const companyRfc = (comp?.rfc || '').toUpperCase();

    const parsedItems: { parsed: ReturnType<typeof parseCfdiXmlString>; xmlRaw: string }[] = [];
    for (const xmlRaw of xmlList) {
      try {
        const parsed = parseCfdiXmlString(xmlRaw, { requireStamp: true });
        if (parsed?.uuid) parsedItems.push({ parsed, xmlRaw });
      } catch {
        // Skip invalid XML strings
      }
    }
    if (parsedItems.length === 0) return { uploaded: [], skippedDuplicates: 0 };

    const uuids = Array.from(new Set(parsedItems.map((p) => p.parsed.uuid)));
    const existingSet = new Set<string>();
    for (const uuidChunk of chunkArray(uuids, 150)) {
      const { data: existingRows, error: exErr } = await supabase
        .from('cfdi_documents')
        .select('uuid')
        .eq('company_id', companyId)
        .in('uuid', uuidChunk);
      if (exErr) throw new Error(exErr.message);
      for (const r of (existingRows || []) as Array<{ uuid: string }>) {
        existingSet.add(r.uuid);
      }
    }
    const toInsert = [];

    for (const item of parsedItems) {
      const { parsed, xmlRaw } = item;
      if (existingSet.has(parsed.uuid)) {
        skippedDuplicates += 1;
        continue;
      }
      existingSet.add(parsed.uuid);
      const direction = (companyRfc && parsed.emisorRfc.toUpperCase() === companyRfc) ? 'EMITIDO' : 'RECIBIDO';
      const id = `cfdi_${crypto.randomUUID().slice(0, 12)}`;
      toInsert.push(buildParsedCfdiInsertRow(id, companyId, parsed, direction, xmlRaw));
    }

    for (const insertChunk of chunkArray(toInsert, 100)) {
      const { data: insertedRows, error } = await supabase
        .from('cfdi_documents')
        .insert(insertChunk)
        .select();
      if (error) throw new Error(error.message);
      if (insertedRows) {
        uploaded.push(...insertedRows.map((r) => mapSupabaseCfdi(r)));
      }
    }

    return { uploaded, skippedDuplicates };
  },

  async autoPolizaFromCfdi(
    cfdiId: string,
    options?: AutoPolizaClientOptions
  ): Promise<Poliza> {
    return runSupabaseAutoPolizaFromCfdi(cfdiId, options);
  },

  async batchAutoPolizaFromCfdis(
    cfdiIds: string[],
    options?: AutoPolizaClientOptions,
    onProgress?: (current: number, total: number) => void
  ): Promise<{
    createdPolizas: Poliza[];
    count: number;
    failedCount: number;
    errors: Array<{ cfdiId: string; uuid?: string; error: string }>;
  }> {
    const createdPolizas: Poliza[] = [];
    const errors: Array<{ cfdiId: string; uuid?: string; error: string }> = [];
    const uuidById = new Map<string, string>();

    if (supabase && cfdiIds.length > 0) {
      for (const idChunk of chunkArray(cfdiIds, 100)) {
        const { data: metaRows } = await supabase
          .from('cfdi_documents')
          .select('id, uuid')
          .in('id', idChunk);
        for (const r of (metaRows || []) as Array<{ id: string; uuid?: string | null }>) {
          if (r.uuid) uuidById.set(String(r.id), String(r.uuid));
        }
      }
    }

    for (let i = 0; i < cfdiIds.length; i++) {
      const id = cfdiIds[i]!;
      try {
        const pol = await this.autoPolizaFromCfdi(id, options);
        createdPolizas.push(pol);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ cfdiId: id, uuid: uuidById.get(id), error: msg });
        console.warn(`[Supabase AutoPoliza] Error al contabilizar CFDI ${id} (${uuidById.get(id) ?? 'sin UUID'}):`, msg);
      }
      onProgress?.(i + 1, cfdiIds.length);
    }
    return {
      createdPolizas,
      count: createdPolizas.length,
      failedCount: errors.length,
      errors
    };
  },

  async deleteCfdi(cfdiId: string): Promise<{ deleted: boolean }> {
    if (!supabase) return { deleted: false };
    const { data: cfdiRow } = await supabase
      .from('cfdi_documents')
      .select('company_id, fecha, poliza_id')
      .eq('id', cfdiId)
      .maybeSingle();

    if (cfdiRow) {
      if (cfdiRow.poliza_id) {
        throw new Error('No se puede eliminar un CFDI asociado a una póliza contable activa');
      }
      const { year, month: period } = parseCalendarDate(String(cfdiRow.fecha));
      await assertSupabasePeriodOpen(String(cfdiRow.company_id), year, period);
    }

    const { error } = await supabase.from('cfdi_documents').delete().eq('id', cfdiId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  }
};
