import { supabase, getRequiredSupabase } from '../supabase';
import { parseCfdiXmlString } from '../../shared/cfdi-xml';
import { buildAutoPolizaPlan } from '../../shared/accounting-engine';
import { parseCalendarDate } from '../../shared/date-utils';
import type { CfdiDocument, Poliza } from '../../shared/types';
import { mapSupabasePoliza, assertSupabasePeriodOpen } from './supabase-polizas';
import { fetchCompanyAccountsFromDb } from './supabase-mappers';
import { fetchAllRows } from './supabase-pagination';

export function mapSupabaseCfdi(row: Record<string, unknown>): CfdiDocument {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    uuid: String(row.uuid),
    fecha: typeof row.fecha === 'string' ? row.fecha.split('T')[0]! : String(row.fecha),
    tipoComprobante: (row.tipo_comprobante as 'I' | 'E' | 'P' | 'N') || 'I',
    direction: (row.direction as 'EMITIDO' | 'RECIBIDO') || 'EMITIDO',
    serie: String(row.serie || ''),
    folio: String(row.folio || ''),
    emisorRfc: String(row.emisor_rfc || ''), emisorNombre: String(row.emisor_nombre || ''),
    receptorRfc: String(row.receptor_rfc || ''), receptorNombre: String(row.receptor_nombre || ''),
    conceptoPrincipal: String(row.concepto_principal || ''), claveProdServ: String(row.clave_prod_serv || '01010101'),
    moneda: (row.moneda as 'MXN' | 'USD') || 'MXN', tipoCambio: Number(row.tipo_cambio || 1),
    subtotal: Number(row.subtotal || 0), descuento: Number(row.descuento || 0),
    ivaTrasladado: Number(row.iva_trasladado || 0), isrRetenido: Number(row.isr_retenido || 0),
    ivaRetenido: Number(row.iva_retenido || 0), total: Number(row.total || 0),
    metodoPago: (row.metodo_pago as 'PUE' | 'PPD') || 'PUE',
    formaPago: String(row.forma_pago || '03'),
    usoCfdi: String(row.uso_cfdi || 'G03'),
    uuidRelacionado: row.uuid_relacionado ? String(row.uuid_relacionado) : null,
    statusSat: (row.status_sat as 'VIGENTE' | 'CANCELADO') || 'VIGENTE',
    polizaId: row.poliza_id ? String(row.poliza_id) : null,
    polizaFolio: row.polizas ? `${(row.polizas as { tipo?: string }).tipo || ''}-${(row.polizas as { folio?: number }).folio || ''}` : (row.poliza_folio ? String(row.poliza_folio) : null),
    xmlRaw: row.xml_raw ? String(row.xml_raw) : ''
  };
}

export const supabaseCfdi = {
  async getCfdis(companyId: string, opts?: { includeXml?: boolean }): Promise<CfdiDocument[]> {
    if (!supabase) return [];
    try {
      const projection = opts?.includeXml
        ? '*, polizas(tipo, folio)'
        : 'id, company_id, uuid, fecha, tipo_comprobante, direction, serie, folio, emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre, concepto_principal, clave_prod_serv, moneda, tipo_cambio, subtotal, descuento, iva_trasladado, isr_retenido, iva_retenido, total, metodo_pago, forma_pago, uso_cfdi, uuid_relacionado, status_sat, poliza_id, polizas(tipo, folio)';

      const data = await fetchAllRows(async (from, to) => {
        return getRequiredSupabase()
          .from('cfdi_documents')
          .select(projection)
          .eq('company_id', companyId)
          .order('fecha', { ascending: false })
          .range(from, to);
      });
      return (data as unknown as Array<Record<string, unknown>>).map(mapSupabaseCfdi);
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
    const parsed = xmlString ? parseCfdiXmlString(xmlString) : null;
    const id = `cfdi_${Date.now().toString(36)}`;

    const { data, error } = await supabase
      .from('cfdi_documents')
      .insert({
        id,
        company_id: payload.companyId,
        uuid: parsed?.uuid || `TEST-${Date.now()}`,
        fecha: parsed?.fecha || payload.fecha || new Date().toISOString().split('T')[0],
        tipo_comprobante: parsed?.tipoComprobante || payload.tipoComprobante || 'I',
        direction: payload.direction || 'EMITIDO',
        serie: parsed?.serie || '',
        folio: parsed?.folio || '',
        emisor_rfc: parsed?.emisorRfc || 'XAXX010101000',
        emisor_nombre: parsed?.emisorNombre || 'Empresa Emisora',
        receptor_rfc: parsed?.receptorRfc || payload.counterpartyRfc || 'XAXX010101000',
        receptor_nombre: parsed?.receptorNombre || payload.counterpartyName || 'Cliente General',
        concepto_principal: parsed?.conceptoPrincipal || payload.conceptoPrincipal || 'Factura general',
        clave_prod_serv: parsed?.claveProdServ || '01010101',
        moneda: parsed?.moneda || 'MXN',
        tipo_cambio: parsed?.tipoCambio || 1,
        subtotal: parsed?.subtotal || payload.subtotal || 0,
        descuento: parsed?.descuento || 0,
        iva_trasladado: parsed?.ivaTrasladado || 0,
        isr_retenido: parsed?.isrRetenido || payload.isrRetenido || 0,
        iva_retenido: parsed?.ivaRetenido || payload.ivaRetenido || 0,
        total: parsed?.total || (payload.subtotal || 0) * 1.16,
        metodo_pago: parsed?.metodoPago || payload.metodoPago || 'PUE',
        forma_pago: parsed?.formaPago || '03',
        uso_cfdi: parsed?.usoCfdi || 'G03',
        status_sat: 'VIGENTE',
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
        const parsed = parseCfdiXmlString(xmlRaw);
        if (parsed?.uuid) parsedItems.push({ parsed, xmlRaw });
      } catch {
        // Skip invalid XML strings
      }
    }
    if (parsedItems.length === 0) return { uploaded: [], skippedDuplicates: 0 };

    const uuids = Array.from(new Set(parsedItems.map((p) => p.parsed.uuid)));
    const { data: existingRows } = await supabase
      .from('cfdi_documents')
      .select('uuid')
      .eq('company_id', companyId)
      .in('uuid', uuids);

    const existingSet = new Set((existingRows || []).map((r: { uuid: string }) => r.uuid));
    const toInsert = [];

    for (const item of parsedItems) {
      const { parsed, xmlRaw } = item;
      if (existingSet.has(parsed.uuid)) {
        skippedDuplicates += 1;
        continue;
      }
      existingSet.add(parsed.uuid);
      const direction = (companyRfc && parsed.emisorRfc.toUpperCase() === companyRfc) ? 'EMITIDO' : 'RECIBIDO';
      const id = `cfdi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      toInsert.push({
        id, company_id: companyId, uuid: parsed.uuid, fecha: parsed.fecha,
        tipo_comprobante: parsed.tipoComprobante, direction,
        serie: parsed.serie || '', folio: parsed.folio || '',
        emisor_rfc: parsed.emisorRfc || 'XAXX010101000',
        emisor_nombre: parsed.emisorNombre || 'Empresa Emisora',
        receptor_rfc: parsed.receptorRfc || 'XAXX010101000',
        receptor_nombre: parsed.receptorNombre || 'Cliente General',
        concepto_principal: parsed.conceptoPrincipal || 'Factura general',
        clave_prod_serv: parsed.claveProdServ || '01010101',
        moneda: parsed.moneda || 'MXN', tipo_cambio: parsed.tipoCambio || 1,
        subtotal: parsed.subtotal || 0, descuento: parsed.descuento || 0,
        iva_trasladado: parsed.ivaTrasladado || 0, isr_retenido: parsed.isrRetenido || 0,
        iva_retenido: parsed.ivaRetenido || 0,
        total: parsed.total || (parsed.subtotal || 0) * 1.16,
        metodo_pago: parsed.metodoPago || 'PUE', forma_pago: parsed.formaPago || '03',
        uso_cfdi: parsed.usoCfdi || 'G03', uuid_relacionado: parsed.uuidRelacionado || null,
        status_sat: 'VIGENTE', xml_raw: xmlRaw
      });
    }

    if (toInsert.length > 0) {
      const { data: insertedRows, error } = await supabase
        .from('cfdi_documents')
        .insert(toInsert)
        .select();
      if (!error && insertedRows) {
        uploaded.push(...insertedRows.map(mapSupabaseCfdi));
      }
    }

    return { uploaded, skippedDuplicates };
  },

  async autoPolizaFromCfdi(
    cfdiId: string,
    options?: {
      operationAccountCode?: string;
      counterAccountCode?: string;
    }
  ): Promise<Poliza> {
    if (!supabase) throw new Error('Supabase no disponible');

    const { data: cfdiRow, error: cfdiErr } = await supabase
      .from('cfdi_documents')
      .select('*')
      .eq('id', cfdiId)
      .single();

    if (cfdiErr || !cfdiRow) throw new Error('CFDI no encontrado en el ADD');
    const cfdi = mapSupabaseCfdi(cfdiRow);
    if (cfdi.polizaId) throw new Error('Este CFDI ya tiene una póliza contable asociada');
    if (cfdi.tipoComprobante === 'T') {
      throw new Error('Los comprobantes de Traslado (T) no generan póliza contable');
    }
    if (cfdi.statusSat === 'CANCELADO') {
      throw new Error('No se pueden contabilizar comprobantes cancelados ante el SAT');
    }

    const counterpartRfc = cfdi.direction === 'EMITIDO' ? cfdi.receptorRfc : cfdi.emisorRfc;
    const { data: tpRow } = await supabase
      .from('third_parties')
      .select('cuenta_operacion_code, cuenta_contrapartida_code')
      .eq('company_id', cfdi.companyId)
      .eq('rfc', counterpartRfc)
      .maybeSingle();

    const mergedOptions = {
      ...options,
      operationAccountCode: options?.operationAccountCode || tpRow?.cuenta_operacion_code,
      counterAccountCode: options?.counterAccountCode || tpRow?.cuenta_contrapartida_code
    };
    const accounts = await fetchCompanyAccountsFromDb(cfdi.companyId);
    const plan = buildAutoPolizaPlan(cfdi, accounts, mergedOptions);

    const { year, month: period } = parseCalendarDate(cfdi.fecha);
    await assertSupabasePeriodOpen(cfdi.companyId, year, period);
    const polizaId = `pol_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const { data: maxRows } = await supabase
      .from('polizas')
      .select('folio')
      .eq('company_id', cfdi.companyId)
      .eq('tipo', plan.polizaType)
      .eq('ejercicio', year)
      .eq('periodo', period)
      .order('folio', { ascending: false })
      .limit(1);

    const nextFolio = (maxRows?.[0]?.folio || 0) + 1;
    const now = new Date().toISOString();

    const polizaData = {
      id: polizaId, company_id: cfdi.companyId, tipo: plan.polizaType, folio: nextFolio,
      fecha: cfdi.fecha, ejercicio: year, periodo: period, concepto: plan.polizaConcept,
      cfdi_uuid: cfdi.uuid, origin: 'ADD_AUTO' as const, created_at: now
    };
    const { error: polErr } = await supabase.from('polizas').insert(polizaData);
    if (polErr) throw new Error(polErr.message);

    const movementsToInsert = plan.movements.map((m, idx) => ({
      id: `mov_${polizaId}_${idx + 1}`,
      poliza_id: polizaId,
      account_id: m.accountId,
      account_code: m.accountCode,
      account_name: m.accountName,
      referencia: m.referencia || '',
      concepto: m.concepto || plan.polizaConcept,
      cargo: Number(m.cargo || 0),
      abono: Number(m.abono || 0),
      cfdi_uuid: cfdi.uuid
    }));

    if (movementsToInsert.length > 0) {
      const { error: movErr } = await supabase.from('poliza_movements').insert(movementsToInsert);
      if (movErr) {
        await supabase.from('polizas').delete().eq('id', polizaId);
        throw new Error(movErr.message);
      }
    }

    await supabase.from('cfdi_documents').update({ poliza_id: polizaId }).eq('id', cfdiId);

    return mapSupabasePoliza(polizaData, movementsToInsert);
  },

  async batchAutoPolizaFromCfdis(
    cfdiIds: string[],
    options?: {
      operationAccountCode?: string;
      counterAccountCode?: string;
    },
    onProgress?: (current: number, total: number) => void
  ): Promise<{ createdPolizas: Poliza[]; count: number }> {
    const createdPolizas: Poliza[] = [];
    for (let i = 0; i < cfdiIds.length; i++) {
      const id = cfdiIds[i]!;
      try {
        const pol = await this.autoPolizaFromCfdi(id, options);
        createdPolizas.push(pol);
      } catch (e) {
        console.warn(`[Supabase AutoPoliza] Error al contabilizar CFDI ${id}:`, e);
      }
      onProgress?.(i + 1, cfdiIds.length);
    }
    return { createdPolizas, count: createdPolizas.length };
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
