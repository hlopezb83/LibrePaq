import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse } from '../_shared/admin-edge-auth.ts';

export type SatVerifyAction = 'VERIFY_BATCH' | 'CHECK_69B';

export interface VerifyBatchItemInput {
  cfdiId: string;
  uuid: string;
  emisorRfc: string;
  receptorRfc: string;
  total: number;
}

export interface VerifyBatchPayload {
  action?: 'VERIFY_BATCH';
  companyId: string;
  items: VerifyBatchItemInput[];
}

export interface Check69BPayload {
  action: 'CHECK_69B';
  companyId: string;
  rfcs: string[];
}

export type SatStatusVerifyPayload = VerifyBatchPayload | Check69BPayload;

export type Sat69BSituacion = 'PRESUNTO' | 'DEFINITIVO' | 'DESVIRTUADO' | 'SENTENCIA_FAVORABLE';
export type ThirdParty69BStatus = 'LIMPIO' | 'PRESUNTO_EFOS' | 'DEFINITIVO_EFOS' | 'DESVIRTUADO';

const SAT_CONSULTA_URL = 'https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc';
const SAT_CONSULTA_ACTION = 'http://tempuri.org/IConsultaCFDIService/Consulta';
const MAX_VERIFY_BATCH_ITEMS = 50;
export const MAX_CHECK_69B_RFCS = 500;
const SAT_REQUEST_TIMEOUT_MS = 7000;
const SAT_BATCH_CONCURRENCY = 5;

function sanitizeCdata(value: string): string {
  return String(value ?? '').replace(/]]>/g, ']]]]><![CDATA[>');
}

/** Construye el sobre SOAP 1.1 para ConsultaCFDIService.svc escapando `&` dentro de CDATA. */
export function buildConsultaCfdiSoapEnvelope(item: {
  emisorRfc: string;
  receptorRfc: string;
  total: number;
  uuid: string;
}): string {
  const re = sanitizeCdata(String(item.emisorRfc || '').trim().toUpperCase());
  const rr = sanitizeCdata(String(item.receptorRfc || '').trim().toUpperCase());
  const uuid = sanitizeCdata(String(item.uuid || '').trim().toUpperCase());
  const totalNum = Number(item.total);
  const tt = Number.isFinite(totalNum) ? totalNum.toFixed(6) : '0.000000';
  const expresion = `?re=${re}&rr=${rr}&tt=${tt}&id=${uuid}`;

  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:Consulta>
      <tem:expresionImpresa><![CDATA[${expresion}]]></tem:expresionImpresa>
    </tem:Consulta>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function extractXmlTagValue(xml: string, tagName: string): string | null {
  const nilPattern = new RegExp(`<(?:\\w+:)?${tagName}\\b[^>]*\\bi:nil=["']true["'][^>]*\\/?>`, 'i');
  if (nilPattern.test(xml)) return null;
  const match = xml.match(
    new RegExp(`<(?:\\w+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`, 'i')
  );
  const val = match?.[1]?.trim();
  return val || null;
}

interface ExistingCfdiRow {
  id: string;
  uuid: string;
  status_sat: string | null;
  poliza_id: string | null;
}

export interface VerifyBatchItemResult {
  cfdiId: string;
  uuid: string;
  ok: boolean;
  estado: 'Vigente' | 'Cancelado' | string | null;
  statusSat: 'VIGENTE' | 'CANCELADO' | string | null;
  previousStatusSat: string | null;
  estatusCancelacion: string | null;
  codigoEstatus: string | null;
  esCancelable: string | null;
  validacionEfos: string | null;
  polizaId: string | null;
  cancelledWithPoliza: boolean;
  updated: boolean;
  error?: string;
}

async function verifySingleCfdiItem(params: {
  supabase: SupabaseClient;
  companyId: string;
  item: VerifyBatchItemInput;
  existing: ExistingCfdiRow | undefined;
}): Promise<VerifyBatchItemResult> {
  const { supabase, companyId, item, existing } = params;
  const cfdiId = String(item.cfdiId || '').trim();
  const uuid = String(item.uuid || '').trim().toUpperCase();

  if (!cfdiId || !uuid || !item.emisorRfc || !item.receptorRfc) {
    return {
      cfdiId,
      uuid,
      ok: false,
      estado: null,
      statusSat: existing?.status_sat ?? null,
      previousStatusSat: existing?.status_sat ?? null,
      estatusCancelacion: null,
      codigoEstatus: null,
      esCancelable: null,
      validacionEfos: null,
      polizaId: existing?.poliza_id ?? null,
      cancelledWithPoliza: false,
      updated: false,
      error: 'Ítem incompleto: se requieren cfdiId, uuid, emisorRfc y receptorRfc'
    };
  }

  if (!existing) {
    return {
      cfdiId,
      uuid,
      ok: false,
      estado: null,
      statusSat: null,
      previousStatusSat: null,
      estatusCancelacion: null,
      codigoEstatus: null,
      esCancelable: null,
      validacionEfos: null,
      polizaId: null,
      cancelledWithPoliza: false,
      updated: false,
      error: 'CFDI no encontrado para esta empresa'
    };
  }

  const soapBody = buildConsultaCfdiSoapEnvelope(item);
  let xmlText = '';

  try {
    const res = await fetch(SAT_CONSULTA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        SOAPAction: SAT_CONSULTA_ACTION
      },
      body: soapBody,
      signal: AbortSignal.timeout(SAT_REQUEST_TIMEOUT_MS)
    });

    if (!res.ok) {
      return {
        cfdiId,
        uuid,
        ok: false,
        estado: null,
        statusSat: existing.status_sat ?? 'VIGENTE',
        previousStatusSat: existing.status_sat ?? null,
        estatusCancelacion: null,
        codigoEstatus: `HTTP_${res.status}`,
        esCancelable: null,
        validacionEfos: null,
        polizaId: existing.poliza_id ?? null,
        cancelledWithPoliza: false,
        updated: false,
        error: `El servicio del SAT devolvió HTTP ${res.status}. Estado local conservado sin cambios.`
      };
    }

    xmlText = await res.text();
  } catch (netErr: unknown) {
    const errMsg = netErr instanceof Error ? netErr.message : 'Timeout o error de red con el SAT';
    return {
      cfdiId,
      uuid,
      ok: false,
      estado: null,
      statusSat: existing.status_sat ?? 'VIGENTE',
      previousStatusSat: existing.status_sat ?? null,
      estatusCancelacion: null,
      codigoEstatus: 'N - Error de comunicación o timeout con el SAT',
      esCancelable: null,
      validacionEfos: null,
      polizaId: existing.poliza_id ?? null,
      cancelledWithPoliza: false,
      updated: false,
      error: `Error/timeout de red consultando al SAT (${errMsg}). Estado local conservado sin cambios.`
    };
  }

  const estadoRaw = extractXmlTagValue(xmlText, 'Estado');
  const estatusCancelacion = extractXmlTagValue(xmlText, 'EstatusCancelacion');
  const codigoEstatus = extractXmlTagValue(xmlText, 'CodigoEstatus');
  const esCancelable = extractXmlTagValue(xmlText, 'EsCancelable');
  const validacionEfos = extractXmlTagValue(xmlText, 'ValidacionEFOS');

  const isVigente = Boolean(estadoRaw && /^vigente$/i.test(estadoRaw));
  const isCancelado = Boolean(estadoRaw && /^cancelado$/i.test(estadoRaw));

  if (!isVigente && !isCancelado) {
    return {
      cfdiId,
      uuid,
      ok: false,
      estado: estadoRaw,
      statusSat: existing.status_sat ?? 'VIGENTE',
      previousStatusSat: existing.status_sat ?? null,
      estatusCancelacion,
      codigoEstatus,
      esCancelable,
      validacionEfos,
      polizaId: existing.poliza_id ?? null,
      cancelledWithPoliza: false,
      updated: false,
      error: estadoRaw
        ? `SAT respondió estado no concluyente ('${estadoRaw}'). Estado local conservado sin cambios.`
        : 'Respuesta SOAP del SAT sin etiqueta <a:Estado> válida. Estado local conservado sin cambios.'
    };
  }

  const newStatusSat: 'VIGENTE' | 'CANCELADO' = isCancelado ? 'CANCELADO' : 'VIGENTE';
  const { error: updErr } = await supabase
    .from('cfdi_documents')
    .update({ status_sat: newStatusSat })
    .eq('id', cfdiId)
    .eq('company_id', companyId);

  if (updErr) {
    return {
      cfdiId,
      uuid,
      ok: false,
      estado: isCancelado ? 'Cancelado' : 'Vigente',
      statusSat: existing.status_sat ?? null,
      previousStatusSat: existing.status_sat ?? null,
      estatusCancelacion,
      codigoEstatus,
      esCancelable,
      validacionEfos,
      polizaId: existing.poliza_id ?? null,
      cancelledWithPoliza: newStatusSat === 'CANCELADO' && Boolean(existing.poliza_id),
      updated: false,
      error: `Error al actualizar cfdi_documents: ${updErr.message}`
    };
  }

  const polizaId = existing.poliza_id ?? null;
  const cancelledWithPoliza = newStatusSat === 'CANCELADO' && Boolean(polizaId);

  return {
    cfdiId,
    uuid,
    ok: true,
    estado: isCancelado ? 'Cancelado' : 'Vigente',
    statusSat: newStatusSat,
    previousStatusSat: existing.status_sat ?? null,
    estatusCancelacion,
    codigoEstatus,
    esCancelable,
    validacionEfos,
    polizaId,
    cancelledWithPoliza,
    updated: true
  };
}

/** Verifica vigencia de hasta 50 CFDIs ante ConsultaCFDIService.svc del SAT y detecta cancelados con póliza. */
export async function handleVerifyBatch(
  supabase: SupabaseClient,
  payload: VerifyBatchPayload,
  headers: Record<string, string>
): Promise<Response> {
  if (!Array.isArray(payload.items)) {
    return jsonResponse({ ok: false, error: 'items debe ser un arreglo' }, 400, headers);
  }
  if (payload.items.length > MAX_VERIFY_BATCH_ITEMS) {
    return jsonResponse(
      {
        ok: false,
        error: `Máximo ${MAX_VERIFY_BATCH_ITEMS} ítems por llamada en VERIFY_BATCH (recibidos: ${payload.items.length})`
      },
      400,
      headers
    );
  }

  if (payload.items.length === 0) {
    return jsonResponse(
      {
        ok: true,
        action: 'VERIFY_BATCH',
        results: [],
        alerts: [],
        summary: {
          total: 0,
          verified: 0,
          vigentes: 0,
          cancelados: 0,
          errors: 0,
          cancelledWithPolizaCount: 0
        }
      },
      200,
      headers
    );
  }

  const cfdiIds = Array.from(
    new Set(payload.items.map((it) => String(it?.cfdiId || '').trim()).filter(Boolean))
  );

  const existingMap = new Map<string, ExistingCfdiRow>();
  if (cfdiIds.length > 0) {
    const { data: rows, error: fetchErr } = await supabase
      .from('cfdi_documents')
      .select('id, uuid, status_sat, poliza_id')
      .eq('company_id', payload.companyId)
      .in('id', cfdiIds);

    if (fetchErr) {
      return jsonResponse(
        { ok: false, error: `Error consultando cfdi_documents: ${fetchErr.message}` },
        500,
        headers
      );
    }

    for (const row of (rows || []) as ExistingCfdiRow[]) {
      existingMap.set(row.id, row);
    }
  }

  const results: VerifyBatchItemResult[] = [];
  for (let i = 0; i < payload.items.length; i += SAT_BATCH_CONCURRENCY) {
    const chunk = payload.items.slice(i, i + SAT_BATCH_CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map((item) =>
        verifySingleCfdiItem({
          supabase,
          companyId: payload.companyId,
          item,
          existing: existingMap.get(String(item?.cfdiId || '').trim())
        })
      )
    );
    results.push(...chunkResults);
  }

  const alerts = results
    .filter((r) => r.cancelledWithPoliza)
    .map((r) => ({
      type: 'CANCELLED_WITH_POLIZA',
      cfdiId: r.cfdiId,
      uuid: r.uuid,
      polizaId: r.polizaId,
      estatusCancelacion: r.estatusCancelacion,
      message: `El CFDI ${r.uuid} aparece CANCELADO ante el SAT pero tiene la póliza contable ${r.polizaId} asociada.`
    }));

  const summary = {
    total: results.length,
    verified: results.filter((r) => r.ok).length,
    vigentes: results.filter((r) => r.ok && r.statusSat === 'VIGENTE').length,
    cancelados: results.filter((r) => r.ok && r.statusSat === 'CANCELADO').length,
    errors: results.filter((r) => !r.ok).length,
    cancelledWithPolizaCount: alerts.length
  };

  return jsonResponse(
    {
      ok: true,
      action: 'VERIFY_BATCH',
      results,
      alerts,
      summary
    },
    200,
    headers
  );
}

function normalizeRfc(raw: string): string {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
}

function mapEfosSituacion(raw: unknown): {
  situacion: Sat69BSituacion;
  estatus69b: ThirdParty69BStatus;
} {
  const upper = String(raw || '').trim().toUpperCase();
  if (upper.includes('DEFINITIV')) {
    return { situacion: 'DEFINITIVO', estatus69b: 'DEFINITIVO_EFOS' };
  }
  if (upper.includes('DESVIRTUAD')) {
    return { situacion: 'DESVIRTUADO', estatus69b: 'DESVIRTUADO' };
  }
  if (upper.includes('SENTENCIA') || upper.includes('FAVORABLE')) {
    return { situacion: 'SENTENCIA_FAVORABLE', estatus69b: 'LIMPIO' };
  }
  return { situacion: 'PRESUNTO', estatus69b: 'PRESUNTO_EFOS' };
}

/** Consulta RFCs en `public.sat_efos_69b` y sincroniza `third_parties.estatus_69b` de la empresa. */
export async function handleCheck69B(
  supabase: SupabaseClient,
  payload: Check69BPayload,
  headers: Record<string, string>
): Promise<Response> {
  if (!Array.isArray(payload.rfcs)) {
    return jsonResponse({ ok: false, error: 'rfcs debe ser un arreglo' }, 400, headers);
  }

  const normalizedRfcs = Array.from(
    new Set(payload.rfcs.map(normalizeRfc).filter((rfc) => rfc.length > 0))
  );

  if (normalizedRfcs.length > MAX_CHECK_69B_RFCS) {
    return jsonResponse(
      {
        ok: false,
        error: `Máximo ${MAX_CHECK_69B_RFCS} RFCs por llamada en CHECK_69B (recibidos: ${normalizedRfcs.length})`
      },
      400,
      headers
    );
  }

  if (normalizedRfcs.length === 0) {
    return jsonResponse(
      {
        ok: true,
        action: 'CHECK_69B',
        checkedCount: 0,
        foundCount: 0,
        matches: [],
        updatedThirdPartiesCount: 0,
        updatedThirdParties: []
      },
      200,
      headers
    );
  }

  const efosRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < normalizedRfcs.length; i += 200) {
    const chunk = normalizedRfcs.slice(i, i + 200);
    const { data, error } = await supabase
      .from('sat_efos_69b')
      .select('*')
      .in('rfc', chunk);

    if (error) {
      return jsonResponse(
        { ok: false, error: `Error consultando sat_efos_69b: ${error.message}` },
        500,
        headers
      );
    }
    if (data) efosRows.push(...(data as Array<Record<string, unknown>>));
  }

  const matches: Array<{
    rfc: string;
    nombre: string | null;
    situacion: Sat69BSituacion;
    estatus69b: ThirdParty69BStatus;
    fechaOficio: string | null;
    publicacionDof: string | null;
  }> = [];

  const rfcsByThirdPartyStatus = new Map<ThirdParty69BStatus, string[]>();
  const seenMatchRfcs = new Set<string>();

  for (const row of efosRows) {
    const rfc = normalizeRfc(String(row.rfc ?? ''));
    if (!rfc || seenMatchRfcs.has(rfc)) continue;
    seenMatchRfcs.add(rfc);

    const { situacion, estatus69b } = mapEfosSituacion(row.situacion ?? row.estatus ?? row.status);
    matches.push({
      rfc,
      nombre: (row.nombre ?? row.razon_social ?? row.contribuyente ?? null) as string | null,
      situacion,
      estatus69b,
      fechaOficio: (row.fecha_oficio ?? row.numero_oficio ?? null) as string | null,
      publicacionDof: (row.fecha_publicacion ?? row.publicacion_dof ?? row.fecha_publicacion_dof ?? null) as string | null
    });

    const list = rfcsByThirdPartyStatus.get(estatus69b) ?? [];
    list.push(rfc);
    rfcsByThirdPartyStatus.set(estatus69b, list);
  }

  const updatedThirdParties: Array<{ id: string; rfc: string; estatus69b: string }> = [];
  const nowIso = new Date().toISOString();

  for (const [estatus69b, rfcsForStatus] of rfcsByThirdPartyStatus.entries()) {
    const { data: updatedRows, error: updErr } = await supabase
      .from('third_parties')
      .update({ estatus_69b: estatus69b, updated_at: nowIso })
      .eq('company_id', payload.companyId)
      .in('rfc', rfcsForStatus)
      .select('id, rfc, estatus_69b');

    if (updErr) {
      return jsonResponse(
        { ok: false, error: `Error actualizando third_parties: ${updErr.message}` },
        500,
        headers
      );
    }

    for (const row of updatedRows || []) {
      updatedThirdParties.push({
        id: String(row.id),
        rfc: String(row.rfc),
        estatus69b: String(row.estatus_69b)
      });
    }
  }

  return jsonResponse(
    {
      ok: true,
      action: 'CHECK_69B',
      checkedCount: normalizedRfcs.length,
      foundCount: matches.length,
      matches,
      updatedThirdPartiesCount: updatedThirdParties.length,
      updatedThirdParties
    },
    200,
    headers
  );
}
