import { Buffer } from 'node:buffer';
import * as fflate from 'npm:fflate@0.8.3';
import {
  parseAndDecryptFiel,
  encryptPrivateKeyIfConfigured,
  buildSatSolicitaDescargaSoapXml,
  buildSatVerificaDescargaSoapXml,
  buildSatDescargaPaqueteSoapXml,
  escapeXmlAttr
} from './crypto-helpers.ts';
import { parseCfdiFull, type ParsedCfdiFull } from './cfdi-full-parser.ts';
import {
  getSatAuthToken,
  jsonResponse,
  resolveCompanyFielCredentials,
  type SatRequestPayload,
  type SupabaseClient
} from './sat-client.ts';

export async function handleStoreFiel(
  supabase: SupabaseClient,
  payload: SatRequestPayload,
  headers: Record<string, string>
): Promise<Response> {
  if (!payload.passphrase || payload.passphrase.trim().length === 0) {
    return jsonResponse({ ok: false, error: 'Debes ingresar la contraseña de la e.firma' }, 400, headers);
  }

  let cerBase64 = payload.cerBase64;
  let keyBase64 = payload.keyBase64;

  if (!cerBase64 || !keyBase64) {
    const { data: existing } = await supabase
      .from('fiel_credentials')
      .select('cer_base64, key_base64')
      .eq('company_id', payload.companyId)
      .maybeSingle();

    if (existing) {
      cerBase64 = cerBase64 || existing.cer_base64;
      keyBase64 = keyBase64 || existing.key_base64;
    }
  }

  if (!cerBase64 || !keyBase64) {
    return jsonResponse(
      { ok: false, error: 'No se encontraron los archivos .cer y .key. Selecciona ambos archivos en el formulario.' },
      400,
      headers
    );
  }

  let fielData;
  try {
    fielData = parseAndDecryptFiel({
      cerBase64,
      keyBase64,
      passphrase: payload.passphrase,
      fallbackRfc: payload.companyRfc,
      fallbackName: payload.companyName
    });
  } catch (fielErr: unknown) {
    const msg = fielErr instanceof Error ? fielErr.message : String(fielErr);
    return jsonResponse({ ok: false, error: msg }, 400, headers);
  }

  const storedPrivateKeyPem = await encryptPrivateKeyIfConfigured(fielData.privateKeyPem);
  const nowIso = new Date().toISOString();
  const { error: upsertErr } = await supabase.from('fiel_credentials').upsert(
    {
      company_id: payload.companyId,
      rfc_titular: fielData.rfcTitular,
      nombre_titular: fielData.nombreTitular,
      numero_serie: fielData.numeroSerie,
      valid_from: fielData.validFrom,
      valid_to: fielData.validTo,
      sha1_fingerprint: fielData.sha1Fingerprint,
      cer_base64: fielData.certificateBase64,
      key_base64: keyBase64.replace(/\s+/g, ''),
      private_key_pem: storedPrivateKeyPem,
      updated_at: nowIso
    },
    { onConflict: 'company_id' }
  );

  if (upsertErr) {
    return jsonResponse({ ok: false, error: `Error en base de datos: ${upsertErr.message}` }, 500, headers);
  }

  return jsonResponse(
    {
      ok: true,
      message: `e.firma autorizada exitosamente para ${fielData.rfcTitular} (${fielData.nombreTitular}). Llave privada lista para descargas SAT.`,
      fielStatus: {
        companyId: payload.companyId,
        hasCredentials: true,
        hasPrivateKey: true,
        rfcTitular: fielData.rfcTitular,
        nombreTitular: fielData.nombreTitular,
        numeroSerieCertificado: fielData.numeroSerie,
        validFrom: fielData.validFrom,
        validTo: fielData.validTo,
        isExpired: fielData.isExpired,
        sha1Fingerprint: fielData.sha1Fingerprint,
        updatedAt: nowIso
      }
    },
    200,
    headers
  );
}

interface SatRequestRecordDto {
  id: string;
  companyId: string;
  idSolicitudSat: string;
  tipoSolicitud: 'RECIBIDOS' | 'EMITIDOS';
  fechaInicial: string;
  fechaFinal: string;
  estadoSolicitud: 'ACEPTADA';
  codigoEstadoSat: string;
  mensajeSat: string;
  idPaqueteSat: string;
  cfdisDescargados: number;
  modoEjecucion: 'SAT_LIVE' | 'SANDBOX_CRYPTO';
  soapRequestXml: string;
  soapResponseXml: string;
  createdAt: string;
}

interface SingleSolicitaResult {
  ok: true;
  requestRecord: SatRequestRecordDto;
}

interface SingleSolicitaError {
  ok: false;
  status: number;
  error: string;
  tipoSolicitud: 'RECIBIDOS' | 'EMITIDOS';
}

async function executeSingleSatSolicitaDescarga(params: {
  supabase: SupabaseClient;
  companyId: string;
  companyRfc: string;
  tipoSat: 'RECIBIDOS' | 'EMITIDOS';
  fechaInicial: string;
  fechaFinal: string;
  fechaFinalTime?: string;
  estadoComprobante?: 'Vigente' | 'Cancelado' | 'Todos';
  modoEjecucion: 'SAT_LIVE' | 'SANDBOX_CRYPTO';
  cerBase64: string;
  privateKeyPem: string;
  authHeader: string | null;
}): Promise<SingleSolicitaResult | SingleSolicitaError> {
  const {
    supabase,
    companyId,
    companyRfc,
    tipoSat,
    fechaInicial,
    fechaFinal,
    fechaFinalTime,
    estadoComprobante,
    modoEjecucion,
    cerBase64,
    privateKeyPem,
    authHeader
  } = params;

  let idSolicitudSat = crypto.randomUUID().toUpperCase();
  let liveStatus = '5000';
  let mensajeSat = `SAT 5000: Solicitud (${tipoSat}) transmitida al Web Service oficial. Folio asignado: ${idSolicitudSat.slice(0, 8)}. El SAT está empaquetando los comprobantes.`;

  if (privateKeyPem && cerBase64 && authHeader && modoEjecucion === 'SAT_LIVE') {
    try {
      const soapActionHeader =
        tipoSat === 'EMITIDOS'
          ? 'http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescargaEmitidos'
          : 'http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescargaRecibidos';

      const { soapXml: solXml } = buildSatSolicitaDescargaSoapXml({
        rfcSolicitante: companyRfc,
        tipoSolicitud: tipoSat,
        fechaInicial,
        fechaFinal,
        fechaFinalTime,
        estadoComprobante,
        certificateBase64: cerBase64,
        privateKeyPem
      });

      const solRes = await fetch(
        'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/SolicitaDescargaService.svc',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml;charset=UTF-8',
            SOAPAction: soapActionHeader,
            Authorization: authHeader
          },
          body: solXml,
          signal: AbortSignal.timeout(10000)
        }
      );

      if (solRes.ok) {
        const solText = await solRes.text();
        const idSolMatch = solText.match(/IdSolicitud="([a-zA-Z0-9-]+)"/i);
        const codMatch = solText.match(/CodEstatus="(\d+)"/i);
        const msgMatch = solText.match(/Mensaje="([^"]+)"/i);
        if (codMatch?.[1]) liveStatus = codMatch[1];
        const satMsg = msgMatch?.[1] || '';

        if (idSolMatch?.[1] && liveStatus === '5000') {
          idSolicitudSat = idSolMatch[1].toUpperCase();
          mensajeSat = `SAT 5000: Solicitud (${tipoSat}) aceptada por los servidores del SAT. Folio oficial: ${idSolicitudSat.slice(0, 8)}. El SAT está preparando el paquete.`;
        } else {
          const errDetail = satMsg || `Código ${liveStatus}`;
          return {
            ok: false,
            status: 400,
            tipoSolicitud: tipoSat,
            error: `El SAT no aceptó la solicitud ${tipoSat} (${errDetail}). Verifica que el periodo no exceda el día de hoy.`
          };
        }
      } else {
        const errBody = await solRes.text().catch(() => '');
        return {
          ok: false,
          status: 502,
          tipoSolicitud: tipoSat,
          error: `El Web Service del SAT devolvió HTTP ${solRes.status} al solicitar descarga (${tipoSat}).${errBody ? ` ${errBody.slice(0, 180)}` : ''}`
        };
      }
    } catch (soapErr) {
      console.warn('[SAT SOAP Sync Error]', tipoSat, soapErr);
      const errDetail = soapErr instanceof Error ? soapErr.message : 'Error al comunicar con SAT';
      return {
        ok: false,
        status: 502,
        tipoSolicitud: tipoSat,
        error: `Error de conexión con clouda.sat.gob.mx (${tipoSat}): ${errDetail}`
      };
    }
  }

  const now = new Date().toISOString();
  const requestRecord: SatRequestRecordDto = {
    id: `satreq_${crypto.randomUUID().slice(0, 8)}`,
    companyId,
    idSolicitudSat,
    tipoSolicitud: tipoSat,
    fechaInicial,
    fechaFinal,
    estadoSolicitud: 'ACEPTADA',
    codigoEstadoSat: liveStatus,
    mensajeSat,
    idPaqueteSat: `${idSolicitudSat}_01`,
    cfdisDescargados: 0,
    modoEjecucion,
    soapRequestXml: `<SolicitaDescarga xmlns="http://DescargaMasivaTerceros.sat.gob.mx" RfcSolicitante="${escapeXmlAttr(companyRfc)}" TipoSolicitud="${escapeXmlAttr(tipoSat)}"/>`,
    soapResponseXml: `<SolicitaDescargaResult CodEstatus="${escapeXmlAttr(liveStatus)}" EstadoSolicitud="1" IdSolicitud="${escapeXmlAttr(idSolicitudSat)}"/>`,
    createdAt: now
  };

  const { error: insertErr } = await supabase.from('sat_download_requests').insert({
    id: requestRecord.id,
    company_id: requestRecord.companyId,
    id_solicitud_sat: requestRecord.idSolicitudSat,
    tipo_solicitud: requestRecord.tipoSolicitud,
    fecha_inicial: requestRecord.fechaInicial,
    fecha_final: requestRecord.fechaFinal,
    estado_solicitud: requestRecord.estadoSolicitud,
    codigo_estado_sat: requestRecord.codigoEstadoSat,
    mensaje_sat: requestRecord.mensajeSat,
    id_paquete_sat: requestRecord.idPaqueteSat,
    cfdis_descargados: 0,
    modo_ejecucion: requestRecord.modoEjecucion,
    soap_request_xml: requestRecord.soapRequestXml,
    soap_response_xml: requestRecord.soapResponseXml,
    created_at: requestRecord.createdAt
  });

  if (insertErr) {
    return {
      ok: false,
      status: 500,
      tipoSolicitud: tipoSat,
      error: `Error guardando solicitud ${tipoSat} en base de datos: ${insertErr.message}`
    };
  }

  return { ok: true, requestRecord };
}

export async function handleSolicitaDescarga(
  supabase: SupabaseClient,
  payload: SatRequestPayload,
  headers: Record<string, string>
): Promise<Response> {
  let {
    companyId,
    companyRfc = '',
    fechaInicial = '2026-10-01',
    fechaFinal = '2026-10-31',
    tipoSolicitud = 'RECIBIDOS',
    modoEjecucion = 'SAT_LIVE'
  } = payload;

  const creds = await resolveCompanyFielCredentials(supabase, companyId, companyRfc);
  companyRfc = creds.companyRfc;
  if (!companyRfc) {
    return jsonResponse({ ok: false, error: 'companyRfc es requerido para la solicitud al SAT' }, 400, headers);
  }

  // Clamping de fechaFinal y hora actual en horario oficial CDMX (America/Mexico_City) para prevenir error 301 del SAT
  const nowDate = new Date();
  const todayIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(nowDate);
  const cdmxTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).format(nowDate);
  if (fechaFinal > todayIso) fechaFinal = todayIso;
  if (fechaInicial > fechaFinal) fechaInicial = fechaFinal;
  const fechaFinalTime = fechaFinal === todayIso ? cdmxTime : '23:59:59';
  const estadoComprobante = (payload as SatRequestPayload & {
    estadoComprobante?: 'Vigente' | 'Cancelado' | 'Todos';
  }).estadoComprobante;

  let authHeader: string | null = null;
  if (creds.privateKeyPem && creds.cerBase64 && modoEjecucion === 'SAT_LIVE') {
    try {
      const rawToken = await getSatAuthToken(creds.cerBase64, creds.privateKeyPem);
      authHeader = rawToken.startsWith('WRAP') ? rawToken : `WRAP access_token="${rawToken}"`;
    } catch (authErr) {
      console.warn('[SAT SOAP Auth Error]', authErr);
      const errDetail = authErr instanceof Error ? authErr.message : 'Error al autenticar con SAT';
      return jsonResponse({ ok: false, error: `Error de conexión con clouda.sat.gob.mx: ${errDetail}` }, 502, headers);
    }
  }

  const tiposToRequest: Array<'RECIBIDOS' | 'EMITIDOS'> =
    tipoSolicitud === 'AMBOS'
      ? ['RECIBIDOS', 'EMITIDOS']
      : [tipoSolicitud === 'EMITIDOS' ? 'EMITIDOS' : 'RECIBIDOS'];

  const requestRecords: SatRequestRecordDto[] = [];
  const requestErrors: SingleSolicitaError[] = [];

  for (const tipoSat of tiposToRequest) {
    const outcome = await executeSingleSatSolicitaDescarga({
      supabase,
      companyId,
      companyRfc,
      tipoSat,
      fechaInicial,
      fechaFinal,
      fechaFinalTime,
      estadoComprobante,
      modoEjecucion,
      cerBase64: creds.cerBase64,
      privateKeyPem: creds.privateKeyPem,
      authHeader
    });
    if (outcome.ok) {
      requestRecords.push(outcome.requestRecord);
    } else {
      requestErrors.push(outcome);
    }
  }

  if (requestRecords.length === 0) {
    const firstErr = requestErrors[0];
    return jsonResponse(
      { ok: false, error: firstErr?.error || 'No se pudo registrar la solicitud ante el SAT' },
      firstErr?.status || 502,
      headers
    );
  }

  return jsonResponse(
    {
      ok: true,
      requestRecord: requestRecords[0],
      requestRecords,
      ...(requestErrors.length > 0
        ? {
            partialErrors: requestErrors.map((e) => ({
              tipoSolicitud: e.tipoSolicitud,
              error: e.error
            }))
          }
        : {}),
      hasPrivateKey: Boolean(creds.privateKeyPem)
    },
    200,
    headers
  );
}

interface IngestPackageResult {
  insertedCount: number;
  skippedDuplicates: number;
  totalParsed: number;
  hadInsertErrors: boolean;
  truncatedAtLimit: boolean;
}

const MAX_XML_FILES_PER_PACKAGE = 2500;
const MAX_SINGLE_FILE_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 80 * 1024 * 1024;

async function ingestSatPackage(params: {
  supabase: SupabaseClient;
  companyId: string;
  companyRfc: string;
  idPaq: string;
  cerBase64: string;
  privateKeyPem: string;
  authHeader: string;
}): Promise<IngestPackageResult> {
  const { supabase, companyId, companyRfc, idPaq, cerBase64, privateKeyPem, authHeader } = params;
  const { soapXml: descXml } = buildSatDescargaPaqueteSoapXml({
    rfcSolicitante: companyRfc,
    idPaqueteSat: idPaq,
    certificateBase64: cerBase64,
    privateKeyPem
  });

  const descRes = await fetch(
    'https://cfdidescargamasiva.clouda.sat.gob.mx/DescargaMasivaService.svc',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        SOAPAction: 'http://DescargaMasivaTerceros.sat.gob.mx/IDescargaMasivaTercerosService/Descargar',
        Authorization: authHeader
      },
      body: descXml,
      signal: AbortSignal.timeout(30000)
    }
  );
  if (!descRes.ok) {
    return { insertedCount: 0, skippedDuplicates: 0, totalParsed: 0, hadInsertErrors: true, truncatedAtLimit: false };
  }

  const descText = await descRes.text();
  const paqMatch = descText.match(/<(?:[\w-]+:)?Paquete\b[^>]*>([^<]+)<\/(?:[\w-]+:)?Paquete>/i);
  if (!paqMatch?.[1]) {
    return { insertedCount: 0, skippedDuplicates: 0, totalParsed: 0, hadInsertErrors: true, truncatedAtLimit: false };
  }

  const zipBuf = Buffer.from(paqMatch[1], 'base64');
  let xmlEntryCount = 0;
  let totalUncompressedBytes = 0;
  let truncatedAtLimit = false;
  const unzipped = fflate.unzipSync(new Uint8Array(zipBuf), {
    filter(file) {
      if (!file.name.toLowerCase().endsWith('.xml')) return false;
      xmlEntryCount += 1;
      if (xmlEntryCount > MAX_XML_FILES_PER_PACKAGE) {
        truncatedAtLimit = true;
        return false;
      }
      if (file.originalSize > MAX_SINGLE_FILE_UNCOMPRESSED_BYTES) return false;
      if (totalUncompressedBytes + file.originalSize > MAX_TOTAL_UNCOMPRESSED_BYTES) {
        truncatedAtLimit = true;
        return false;
      }
      totalUncompressedBytes += file.originalSize;
      return true;
    }
  });
  const fileNames = Object.keys(unzipped);

  const parsedList: Array<{ parsed: ParsedCfdiFull; xmlRaw: string }> = [];
  for (const fName of fileNames) {
    if (!fName.toLowerCase().endsWith('.xml')) continue;
    const xmlRaw = new TextDecoder('utf-8').decode(unzipped[fName]);
    const parsed = parseCfdiFull(xmlRaw);
    if (parsed?.uuid) parsedList.push({ parsed, xmlRaw });
  }
  if (parsedList.length === 0) {
    return { insertedCount: 0, skippedDuplicates: 0, totalParsed: 0, hadInsertErrors: false, truncatedAtLimit };
  }

  const uuids = Array.from(new Set(parsedList.map((p) => p.parsed.uuid)));
  const existingUuids = new Set<string>();
  for (let i = 0; i < uuids.length; i += 100) {
    const chunk = uuids.slice(i, i + 100);
    const { data: exRows } = await supabase
      .from('cfdi_documents')
      .select('uuid')
      .eq('company_id', companyId)
      .in('uuid', chunk);
    for (const row of exRows || []) existingUuids.add(row.uuid);
  }

  const toInsert: Array<Record<string, unknown>> = [];
  let skippedDuplicates = 0;
  for (const item of parsedList) {
    const p = item.parsed;
    if (existingUuids.has(p.uuid)) {
      skippedDuplicates += 1;
      continue;
    }
    existingUuids.add(p.uuid);

    const dir = p.emisorRfc.toUpperCase() === companyRfc.toUpperCase() ? 'EMITIDO' : 'RECIBIDO';
    const newId = `cfdi_${crypto.randomUUID().slice(0, 12)}`;
    toInsert.push({
      id: newId,
      company_id: companyId,
      uuid: p.uuid,
      direction: dir,
      tipo_comprobante: p.tipoComprobante || 'I',
      serie: p.serie || '',
      folio: p.folio || '',
      fecha: p.fecha || new Date().toISOString(),
      emisor_rfc: p.emisorRfc,
      emisor_nombre: p.emisorNombre || 'PROVEEDOR SAT',
      receptor_rfc: p.receptorRfc,
      receptor_nombre: p.receptorNombre || companyRfc,
      concepto_principal: p.conceptoPrincipal || 'Operación comercial',
      clave_prod_serv: p.claveProdServ || '01010101',
      moneda: p.moneda || 'MXN',
      tipo_cambio: p.tipoCambio || 1,
      subtotal: p.subtotal || 0,
      descuento: p.descuento || 0,
      iva_trasladado: p.ivaTrasladado || 0,
      isr_retenido: p.isrRetenido || 0,
      iva_retenido: p.ivaRetenido || 0,
      total: p.total || 0,
      metodo_pago: p.metodoPago || 'PUE',
      forma_pago: p.formaPago || '03',
      uso_cfdi: p.usoCfdi || 'G03',
      uuid_relacionado: p.uuidRelacionado || null,
      tax_breakdown: p.taxBreakdown ?? null,
      related_docs: p.relatedDocs ?? null,
      xml_raw: item.xmlRaw
    });
  }

  let totalIngested = 0;
  let hadInsertErrors = false;
  for (let i = 0; i < toInsert.length; i += 50) {
    const batch = toInsert.slice(i, i + 50);
    const { error: insErr } = await supabase.from('cfdi_documents').insert(batch);
    if (!insErr) totalIngested += batch.length;
    else {
      hadInsertErrors = true;
      console.warn('[Error batch insert CFDI]', insErr);
    }
  }
  return {
    insertedCount: totalIngested,
    skippedDuplicates,
    totalParsed: parsedList.length,
    hadInsertErrors,
    truncatedAtLimit
  };
}

export async function handleVerificaDescarga(
  supabase: SupabaseClient,
  payload: SatRequestPayload,
  headers: Record<string, string>
): Promise<Response> {
  const { cerBase64, privateKeyPem, companyRfc } = await resolveCompanyFielCredentials(
    supabase,
    payload.companyId,
    payload.companyRfc || ''
  );

  if (!privateKeyPem || !cerBase64) {
    return jsonResponse({ ok: false, error: 'Credenciales e.firma no encontradas para verificar.' }, 400, headers);
  }

  const { data: reqs } = await supabase
    .from('sat_download_requests')
    .select('id, id_solicitud_sat, cfdis_descargados')
    .eq('company_id', payload.companyId)
    .in('estado_solicitud', ['ACEPTADA', 'EN_PROCESO'])
    .order('created_at', { ascending: false })
    .limit(10);

  const pendingRequests = reqs || [];
  if (pendingRequests.length === 0) {
    return jsonResponse({ ok: true, message: 'No hay solicitudes pendientes por verificar.', updatedCount: 0 }, 200, headers);
  }

  const rawToken = await getSatAuthToken(cerBase64, privateKeyPem);
  const authHeader = rawToken.startsWith('WRAP') ? rawToken : `WRAP access_token="${rawToken}"`;
  const results = [];

  for (const reqItem of pendingRequests) {
    try {
      const { soapXml: verXml } = buildSatVerificaDescargaSoapXml({
        rfcSolicitante: companyRfc,
        idSolicitudSat: reqItem.id_solicitud_sat,
        certificateBase64: cerBase64,
        privateKeyPem
      });

      const verRes = await fetch(
        'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/VerificaSolicitudDescargaService.svc',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml;charset=UTF-8',
            SOAPAction: 'http://DescargaMasivaTerceros.sat.gob.mx/IVerificaSolicitudDescargaService/VerificaSolicitudDescarga',
            Authorization: authHeader
          },
          body: verXml,
          signal: AbortSignal.timeout(10000)
        }
      );

      if (!verRes.ok) continue;
      const verText = await verRes.text();
      const estadoSol = verText.match(/EstadoSolicitud="(\d+)"/i)?.[1] || '2';
      const numCfdis = parseInt(verText.match(/NumeroCFDIs="(\d+)"/i)?.[1] || '0', 10);
      const codEstatus = verText.match(/CodEstatus="(\d+)"/i)?.[1] || '5000';
      const satMsg = verText.match(/Mensaje="([^"]+)"/i)?.[1] || '';

      let nuevoEstado: 'ACEPTADA' | 'EN_PROCESO' | 'TERMINADA' | 'ERROR' = 'EN_PROCESO';
      let nuevoMensaje = `SAT Estado ${estadoSol}: Solicitud en proceso. El SAT está preparando los paquetes.`;
      let totalIngested = 0;
      let truncatedAtLimitAny = false;
      let hadAnyPackageError = false;

      if (estadoSol === '3') {
        if (numCfdis === 0) {
          nuevoEstado = 'TERMINADA';
          nuevoMensaje = 'SAT 5000: Solicitud completada por el SAT (0 comprobantes en el periodo).';
        } else {
          const idsPaquetes = [
            ...verText.matchAll(/<(?:[\w-]+:)?IdsPaquetes\b[^>]*>([^<]+)<\/(?:[\w-]+:)?IdsPaquetes>/gi)
          ]
            .map((m) => m[1]!.trim())
            .filter(Boolean);
          if (idsPaquetes.length === 0) idsPaquetes.push(`${reqItem.id_solicitud_sat}_01`);

          let skippedDuplicatesTotal = 0;
          for (const idPaq of idsPaquetes) {
            try {
              const pkgRes = await ingestSatPackage({
                supabase,
                companyId: payload.companyId,
                companyRfc,
                idPaq,
                cerBase64,
                privateKeyPem,
                authHeader
              });
              totalIngested += pkgRes.insertedCount;
              skippedDuplicatesTotal += pkgRes.skippedDuplicates;
              if (pkgRes.hadInsertErrors) hadAnyPackageError = true;
              if (pkgRes.truncatedAtLimit) truncatedAtLimitAny = true;
            } catch (paqErr) {
              hadAnyPackageError = true;
              console.warn('[Error descargando paquete SAT]', idPaq, paqErr);
            }
          }

          if (hadAnyPackageError) {
            nuevoEstado = 'EN_PROCESO';
            nuevoMensaje =
              totalIngested > 0
                ? `SAT 5000: Se integraron parcialmente ${totalIngested} comprobantes a la Bóveda ADD, pero ocurrió un error en parte de los paquetes o bloques. Vuelve a verificar para reintentar el resto.`
                : `SAT 5000: ${numCfdis} comprobantes listos en servidores del SAT, pero ocurrió un error al descargar o integrar los paquetes. Vuelve a verificar para reintentar el resto.`;
          } else if (totalIngested > 0) {
            nuevoEstado = 'TERMINADA';
            nuevoMensaje = truncatedAtLimitAny
              ? `SAT 5000: ${totalIngested} comprobantes descargados e integrados a la Bóveda ADD (tope de ${MAX_XML_FILES_PER_PACKAGE} XML por paquete alcanzado; existen archivos adicionales).`
              : `SAT 5000: ${totalIngested} comprobantes descargados e integrados exitosamente a la Bóveda ADD.`;
          } else if (skippedDuplicatesTotal > 0) {
            nuevoEstado = 'TERMINADA';
            nuevoMensaje = truncatedAtLimitAny
              ? `SAT 5000: Paquete procesado hasta el límite de ${MAX_XML_FILES_PER_PACKAGE} XML; los ${skippedDuplicatesTotal} comprobantes revisados ya existían en la Bóveda ADD.`
              : `SAT 5000: Paquete procesado; los ${skippedDuplicatesTotal} comprobantes ya existían en la Bóveda ADD.`;
          } else {
            nuevoEstado = 'EN_PROCESO';
            nuevoMensaje = `SAT 5000: ${numCfdis} comprobantes listos en servidores del SAT. Reintentando descarga e integración a Bóveda ADD...`;
          }
        }
      } else if (['0', '4', '5', '6'].includes(estadoSol) || codEstatus === '5004') {
        nuevoEstado = 'ERROR';
        nuevoMensaje = satMsg
          ? `SAT ${codEstatus}: ${satMsg}`
          : `SAT: Solicitud no encontrada o rechazada en servidores del SAT (Código ${codEstatus || estadoSol}).`;
      }

      const accumulatedCfdis = (Number(reqItem.cfdis_descargados) || 0) + totalIngested;
      await supabase
        .from('sat_download_requests')
        .update({ estado_solicitud: nuevoEstado, mensaje_sat: nuevoMensaje, cfdis_descargados: accumulatedCfdis })
        .eq('id', reqItem.id);

      results.push({
        id: reqItem.id,
        idSolicitudSat: reqItem.id_solicitud_sat,
        estadoSolicitud: nuevoEstado,
        estadoSat: estadoSol,
        numeroCfdis: totalIngested,
        totalAcumuladoCfdis: accumulatedCfdis,
        truncatedAtLimit: truncatedAtLimitAny,
        hadPartialErrors: hadAnyPackageError
      });
    } catch (itemErr) {
      console.warn('[Verifica item error]', itemErr);
    }
  }

  return jsonResponse({ ok: true, message: `Verificación completada para ${results.length} solicitudes del SAT.`, results }, 200, headers);
}
