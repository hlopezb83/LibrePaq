/**
 * LibrePaq Pro — SAT Background Cron Worker
 * Ejecuta la verificación y descarga desatendida de comprobantes desde el Web Service del SAT.
 * Diseñado para correr en GitHub Actions (cron cada 15 min), Supabase o Daemon local.
 */
import { createClient } from '@supabase/supabase-js';
import * as fflate from 'fflate';
import {
  buildSatAutenticaSoapXml,
  buildSatVerificaDescargaSoapXml,
  buildSatDescargaPaqueteSoapXml
} from '../supabase/functions/sat-soap-sync/crypto-helpers';
import { parseCfdiXmlString } from '../src/shared/cfdi-xml';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://utrtmhdoknthuitknfro.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FIEL_ENCRYPTION_KEY = process.env.FIEL_ENCRYPTION_KEY || '';

if (!SERVICE_KEY) {
  console.error('[SAT Worker] Error de seguridad: SUPABASE_SERVICE_ROLE_KEY no está configurada en las variables de entorno.');
}

async function decryptPrivateKeyIfNeeded(rawPem: string): Promise<string> {
  if (!rawPem.startsWith('ENC:v1:')) return rawPem;
  if (!FIEL_ENCRYPTION_KEY) {
    throw new Error('FIEL_ENCRYPTION_KEY es requerida para desencriptar llaves privadas ENC:v1:.');
  }
  const parts = rawPem.split(':');
  const ivB64 = parts[2] || '';
  const ctB64 = parts[3] || '';
  const keyBytes = new TextEncoder().encode(FIEL_ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  const iv = Uint8Array.from(Buffer.from(ivB64, 'base64'));
  const ciphertext = Uint8Array.from(Buffer.from(ctB64, 'base64'));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
  return new TextDecoder().decode(decrypted);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY || 'dummy_key');

interface PendingSatRequest {
  id: string;
  company_id: string;
  id_solicitud_sat: string;
  tipo_solicitud: 'EMITIDOS' | 'RECIBIDOS';
  fecha_inicial: string;
  fecha_final: string;
  estado_solicitud: string;
}

export async function runSatCronWorker(): Promise<{
  processed: number;
  downloadedCfdis: number;
  companiesChecked: number;
}> {
  console.log(`[SAT Worker] Iniciando ciclo de verificación: ${new Date().toISOString()}`);

  const { data: pendingRequests, error } = await supabase
    .from('sat_download_requests')
    .select('id, company_id, id_solicitud_sat, tipo_solicitud, fecha_inicial, fecha_final, estado_solicitud')
    .in('estado_solicitud', ['ACEPTADA', 'EN_PROCESO'])
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('[SAT Worker] Error al consultar solicitudes pendientes:', error.message);
    return { processed: 0, downloadedCfdis: 0, companiesChecked: 0 };
  }

  const allRequestsToProcess: PendingSatRequest[] = [...((pendingRequests as PendingSatRequest[]) || [])];

  // Reconciliación proactiva: Detectar solicitudes marcadas TERMINADA pero huérfanas en cfdi_documents
  try {
    const { data: terminatedRequests } = await supabase
      .from('sat_download_requests')
      .select('id, company_id, id_solicitud_sat, tipo_solicitud, fecha_inicial, fecha_final, estado_solicitud, cfdis_descargados')
      .eq('estado_solicitud', 'TERMINADA')
      .gt('cfdis_descargados', 0)
      .order('created_at', { ascending: false })
      .limit(20);

    if (terminatedRequests && terminatedRequests.length > 0) {
      for (const req of terminatedRequests as Array<PendingSatRequest & { cfdis_descargados: number }>) {
        const { count } = await supabase
          .from('cfdi_documents')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', req.company_id)
          .gte('fecha', req.fecha_inicial)
          .lte('fecha', `${req.fecha_final}T23:59:59`);

        if (count === 0) {
          console.warn(`[SAT Worker] Reconciliando solicitud huérfana ${req.id_solicitud_sat}: marcada TERMINADA pero con 0 CFDIs. Reabriendo para ingesta física.`);
          await supabase
            .from('sat_download_requests')
            .update({
              estado_solicitud: 'EN_PROCESO',
              mensaje_sat: 'SAT 5000: Reabriendo descarga de paquetes para sincronización física en Bóveda ADD...'
            })
            .eq('id', req.id);
          allRequestsToProcess.push(req);
        }
      }
    }
  } catch (reconErr) {
    console.warn('[SAT Worker] Error en reconciliación de solicitudes huérfanas:', reconErr);
  }

  if (allRequestsToProcess.length === 0) {
    console.log('[SAT Worker] No hay solicitudes pendientes ni huérfanas. Todas las empresas al día.');
    return { processed: 0, downloadedCfdis: 0, companiesChecked: 0 };
  }

  console.log(`[SAT Worker] Se procesarán ${allRequestsToProcess.length} solicitudes (pendientes + reconciliadas).`);

  const byCompany = new Map<string, PendingSatRequest[]>();
  for (const req of allRequestsToProcess) {
    const list = byCompany.get(req.company_id) || [];
    list.push(req);
    byCompany.set(req.company_id, list);
  }

  let totalDownloaded = 0;
  let totalProcessed = 0;

  for (const [companyId, requests] of byCompany.entries()) {
    console.log(`\n--- Procesando empresa: ${companyId} (${requests.length} solicitudes) ---`);
    const { data: creds } = await supabase
      .from('fiel_credentials')
      .select('cer_base64, private_key_pem, rfc_titular')
      .eq('company_id', companyId)
      .maybeSingle();

    if (!creds || !creds.private_key_pem || !creds.cer_base64) {
      console.warn(`[SAT Worker] Empresa ${companyId} sin credenciales e.firma completas, omitiendo.`);
      continue;
    }

    const { data: comp } = await supabase
      .from('companies')
      .select('rfc, name')
      .eq('id', companyId)
      .maybeSingle();

    const rfcCandidate = creds.rfc_titular || comp?.rfc;
    if (!rfcCandidate) {
      console.warn(`[SAT Worker] Empresa ${companyId} sin RFC registrado en credenciales ni perfil, omitiendo.`);
      continue;
    }
    const companyRfc = rfcCandidate.trim().toUpperCase();

    let decryptedPrivateKeyPem: string;
    try {
      decryptedPrivateKeyPem = await decryptPrivateKeyIfNeeded(creds.private_key_pem);
    } catch (decErr) {
      console.warn(`[SAT Worker] No se pudo desencriptar private_key_pem para ${companyRfc}:`, decErr);
      continue;
    }

    // Autenticar ante el SAT para obtener WRAP token
    let token = '';
    try {
      const { soapXml: autXml } = buildSatAutenticaSoapXml({
        certificateBase64: creds.cer_base64,
        privateKeyPem: decryptedPrivateKeyPem
      });

      const autRes = await fetch(
        'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/Autenticacion/Autenticacion.svc',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml;charset=UTF-8',
            SOAPAction: 'http://DescargaMasivaTerceros.gob.mx/IAutenticacion/Autentica'
          },
          body: autXml,
          signal: AbortSignal.timeout(12000)
        }
      );

      const autText = await autRes.text();
      const tokenMatch = autText.match(/<AutenticaResult>(.*?)<\/AutenticaResult>/i);
      token = tokenMatch && tokenMatch[1] ? tokenMatch[1] : '';
    } catch (authErr) {
      console.warn(`[SAT Worker] Error autenticando ante el SAT para ${companyRfc}:`, authErr);
      continue;
    }

    if (!token) {
      console.warn(`[SAT Worker] No se obtuvo token SAT para ${companyRfc}.`);
      continue;
    }

    const authHeader = token.startsWith('WRAP') ? token : `WRAP access_token="${token}"`;

    for (const req of requests) {
      totalProcessed++;
      try {
        const { soapXml: verXml } = buildSatVerificaDescargaSoapXml({
          rfcSolicitante: companyRfc,
          idSolicitudSat: req.id_solicitud_sat,
          certificateBase64: creds.cer_base64,
          privateKeyPem: decryptedPrivateKeyPem
        });

        const verRes = await fetch(
          'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/VerificaSolicitudDescargaService.svc',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'text/xml;charset=UTF-8',
              SOAPAction:
                'http://DescargaMasivaTerceros.sat.gob.mx/IVerificaSolicitudDescargaService/VerificaSolicitudDescarga',
              Authorization: authHeader
            },
            body: verXml,
            signal: AbortSignal.timeout(12000)
          }
        );

        if (!verRes.ok) continue;

        const verText = await verRes.text();
        const estadoMatch = verText.match(/EstadoSolicitud="(\d+)"/i);
        const estadoSol = estadoMatch ? estadoMatch[1] : '2';

        if (estadoSol === '1' || estadoSol === '2') {
          console.log(`[SAT Worker] Solicitud ${req.id_solicitud_sat} sigue en proceso en el SAT (Estado ${estadoSol}).`);
          await supabase
            .from('sat_download_requests')
            .update({
              estado_solicitud: 'EN_PROCESO',
              mensaje_sat: `SAT Estado ${estadoSol}: El SAT continúa empaquetando tus comprobantes.`
            })
            .eq('id', req.id);
          continue;
        }

        if (estadoSol === '0' || estadoSol === '4' || estadoSol === '5' || estadoSol === '6') {
          console.warn(`[SAT Worker] Solicitud ${req.id_solicitud_sat} rechazada/vencida en el SAT (Código ${estadoSol}).`);
          await supabase
            .from('sat_download_requests')
            .update({
              estado_solicitud: 'ERROR',
              mensaje_sat: `SAT: Solicitud rechazada, vencida o con error en el SAT (Código ${estadoSol}).`
            })
            .eq('id', req.id);
          continue;
        }

        if (estadoSol === '3') {
          // Solicitud TERMINADA: Descargar todos los paquetes reportados por el SAT
          const packageMatches = Array.from(
            verText.matchAll(/<(?:[A-Za-z_][\w.-]*:)?IdsPaquetes\b[^>]*>([^<]+)<\/(?:[A-Za-z_][\w.-]*:)?IdsPaquetes>/gi)
          );
          const packageIds = packageMatches.length > 0
            ? packageMatches.map((m) => (m[1] ? m[1].trim() : '')).filter(Boolean)
            : [`${req.id_solicitud_sat}_01`];

          console.log(`[SAT Worker] Solicitud ${req.id_solicitud_sat} LISTA. Paquetes reportados: ${packageIds.join(', ')}`);

          const parsedList: Array<{
            doc: Record<string, unknown>;
            uuid: string;
          }> = [];
          let hadDownloadError = false;

          for (const idPaquete of packageIds) {
            console.log(`[SAT Worker] Descargando paquete ${idPaquete}...`);

            const { soapXml: descXml } = buildSatDescargaPaqueteSoapXml({
              rfcSolicitante: companyRfc,
              idPaqueteSat: idPaquete,
              certificateBase64: creds.cer_base64,
              privateKeyPem: decryptedPrivateKeyPem
            });

            const descRes = await fetch(
              'https://cfdidescargamasiva.clouda.sat.gob.mx/DescargaMasivaService.svc',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'text/xml;charset=UTF-8',
                  SOAPAction:
                    'http://DescargaMasivaTerceros.sat.gob.mx/IDescargaMasivaTercerosService/Descargar',
                  Authorization: authHeader
                },
                body: descXml,
                signal: AbortSignal.timeout(30000)
              }
            );

            if (!descRes.ok) {
              hadDownloadError = true;
              console.warn(`[SAT Worker] Falló descarga HTTP de ${idPaquete}: ${descRes.status}`);
              continue;
            }

            const descText = await descRes.text();
            const paqueteMatch = descText.match(
              /<(?:[A-Za-z_][\w.-]*:)?Paquete\b[^>]*>([^<]+)<\/(?:[A-Za-z_][\w.-]*:)?Paquete>/i
            );
            if (!paqueteMatch) {
              hadDownloadError = true;
              console.warn(`[SAT Worker] Paquete ${idPaquete} sin contenido base64 en respuesta SAT.`);
              continue;
            }

            let unzipped: Record<string, Uint8Array>;
            try {
              const zipBytes = Buffer.from(paqueteMatch[1] || '', 'base64');
              // Límite de seguridad: Paquete ZIP no mayor a 100MB ni > 90MB descomprimido / 5,000 archivos
              if (zipBytes.length > 100 * 1024 * 1024) {
                hadDownloadError = true;
                console.warn(`[SAT Worker] Paquete ${idPaquete} excede límite de seguridad (100MB). Omitiendo.`);
                continue;
              }
              let entryCount = 0;
              let totalUncompressedBytes = 0;
              unzipped = fflate.unzipSync(new Uint8Array(zipBytes), {
                filter(file) {
                  entryCount += 1;
                  totalUncompressedBytes += file.originalSize;
                  return (
                    entryCount <= 5000 &&
                    file.originalSize <= 50 * 1024 * 1024 &&
                    totalUncompressedBytes <= 90 * 1024 * 1024
                  );
                }
              });
            } catch (zipErr) {
              hadDownloadError = true;
              console.warn(`[SAT Worker] Error descomprimiendo paquete ZIP ${idPaquete}:`, zipErr);
              continue;
            }

            const fileNames = Object.keys(unzipped);

            for (const fName of fileNames) {
              if (!fName.toLowerCase().endsWith('.xml')) continue;
              try {
                const xmlRaw = new TextDecoder('utf-8').decode(unzipped[fName]);
                const parsed = parseCfdiXmlString(xmlRaw);
                if (!parsed?.uuid) continue;

                const direction =
                  parsed.emisorRfc && parsed.emisorRfc.toUpperCase() === companyRfc
                    ? 'EMITIDO'
                    : 'RECIBIDO';
                const id = `cfdi_${crypto.randomUUID().slice(0, 12)}`;

                parsedList.push({
                  uuid: parsed.uuid,
                  doc: {
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
                    emisor_nombre: parsed.emisorNombre || 'PROVEEDOR NACIONAL',
                    receptor_rfc: parsed.receptorRfc || companyRfc,
                    receptor_nombre: parsed.receptorNombre || (comp?.name || 'EMPRESA CONTABLE'),
                    concepto_principal: parsed.conceptoPrincipal || 'Operación comercial',
                    clave_prod_serv: parsed.claveProdServ || '01010101',
                    moneda: parsed.moneda || 'MXN',
                    tipo_cambio: parsed.tipoCambio || 1,
                    subtotal: parsed.subtotal || 0,
                    descuento: parsed.descuento || 0,
                    iva_trasladado: parsed.ivaTrasladado || 0,
                    isr_retenido: parsed.isrRetenido || 0,
                    iva_retenido: parsed.ivaRetenido || 0,
                    total: parsed.total || 0,
                    metodo_pago: parsed.metodoPago || 'PUE',
                    forma_pago: parsed.formaPago || '03',
                    uso_cfdi: parsed.usoCfdi || 'G03',
                    uuid_relacionado: parsed.uuidRelacionado || null,
                    status_sat: 'VIGENTE',
                    tax_breakdown: parsed.taxBreakdown ?? null,
                    related_docs: parsed.relatedDocs ?? null,
                    xml_raw: xmlRaw
                  }
                });
              } catch (xmlParseErr) {
                console.warn(`[SAT Worker] XML individual inválido en ${fName}, omitiendo:`, xmlParseErr);
              }
            }
          }

          // Verificación y deduplicación intra-lote de UUIDs
          const allUuids = Array.from(new Set(parsedList.map((p) => p.uuid)));
          const existingUuids = new Set<string>();
          for (let i = 0; i < allUuids.length; i += 100) {
            const chunk = allUuids.slice(i, i + 100);
            const { data: exRows } = await supabase
              .from('cfdi_documents')
              .select('uuid')
              .eq('company_id', companyId)
              .in('uuid', chunk);
            if (exRows) {
              for (const row of exRows) existingUuids.add(row.uuid);
            }
          }

          const toInsert: Array<Record<string, unknown>> = [];
          for (const item of parsedList) {
            if (existingUuids.has(item.uuid)) continue;
            existingUuids.add(item.uuid);
            toInsert.push(item.doc);
          }

          let insertedCount = 0;
          let hadInsertError = false;
          for (let i = 0; i < toInsert.length; i += 50) {
            const batch = toInsert.slice(i, i + 50);
            const { error: insErr } = await supabase
              .from('cfdi_documents')
              .upsert(batch, { onConflict: 'company_id,uuid', ignoreDuplicates: true });
            if (!insErr) {
              insertedCount += batch.length;
            } else {
              hadInsertError = true;
              console.warn('[SAT Worker] Error en batch insert CFDI:', insErr.message);
            }
          }

          totalDownloaded += insertedCount;
          console.log(`[SAT Worker] Solicitud ${req.id_solicitud_sat} integrada: +${insertedCount} XMLs.`);

          if (!hadInsertError && !hadDownloadError) {
            await supabase
              .from('sat_download_requests')
              .update({
                estado_solicitud: 'TERMINADA',
                codigo_estado_sat: '5000',
                mensaje_sat: `SAT 5000: ${insertedCount} comprobantes descargados e integrados exitosamente.`,
                cfdis_descargados: insertedCount,
                id_paquete_sat: packageIds.join(',')
              })
              .eq('id', req.id);
          } else {
            await supabase
              .from('sat_download_requests')
              .update({
                estado_solicitud: 'EN_PROCESO',
                mensaje_sat: `SAT 5000: Error parcial al descargar o guardar CFDIs (+${insertedCount} insertados). Se reintentará en el siguiente ciclo.`
              })
              .eq('id', req.id);
          }
        }
      } catch (reqErr) {
        console.warn(`[SAT Worker] Error procesando solicitud ${req.id_solicitud_sat}:`, reqErr);
      }
    }
  }

  console.log(`[SAT Worker] Finalizado. Solicitudes procesadas: ${totalProcessed}, Facturas descargadas: ${totalDownloaded}`);
  return { processed: totalProcessed, downloadedCfdis: totalDownloaded, companiesChecked: byCompany.size };
}

if (import.meta.main) {
  runSatCronWorker()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[SAT Worker Fatal Error]', err);
      process.exit(1);
    });
}
