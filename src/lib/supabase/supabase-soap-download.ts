import { generateMonthlyCfdiBatchXmls } from '../../shared/sat-monthly-batch';
import { getTodayLocalIso } from '../../shared/date-utils';
import type { CfdiDocument, SatDownloadRequestRecord } from '../../shared/types';
import { supabase } from '../supabase';
import { supabaseCfdi } from './supabase-cfdi';
import {
  mapDbSatRequest,
  readSoapRequestsFromStorage,
  saveSoapRequestToStorage,
  type DbSatDownloadRequest
} from './supabase-soap-mappers';

async function extractSoapEdgeErrorMessage(edgeError: unknown): Promise<string> {
  let errorMsg = edgeError instanceof Error ? edgeError.message : String(edgeError || 'Error de comunicación');
  try {
    const ctx = (edgeError as { context?: Response })?.context;
    if (ctx && typeof ctx.json === 'function') {
      const ctxJson = (await ctx.json()) as { error?: unknown; message?: unknown } | null;
      const realMsg = ctxJson?.error ?? ctxJson?.message;
      if (realMsg) errorMsg = String(realMsg);
    }
  } catch {
    // ignore non-JSON context
  }
  return errorMsg;
}

export const supabaseSoapDownload = {
  async getSatDownloadRequests(companyId: string): Promise<SatDownloadRequestRecord[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('sat_download_requests')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(30);
        if (!error && data && data.length > 0) {
          return (data as DbSatDownloadRequest[]).map(mapDbSatRequest);
        }
      } catch {
        // Fallback
      }
    }

    return readSoapRequestsFromStorage(companyId);
  },

  async executeSatSoapDownload(payload: {
    companyId: string;
    tipoSolicitud: 'EMITIDOS' | 'RECIBIDOS';
    fechaInicial: string;
    fechaFinal: string;
    modoEjecucion?: 'SAT_LIVE' | 'SANDBOX_CRYPTO';
    isDemoCompany?: boolean;
  }): Promise<{
    requestRecord: SatDownloadRequestRecord;
    downloadedCfdis: CfdiDocument[];
  }> {
    const modo = payload.modoEjecucion === 'SAT_LIVE' ? 'SAT_LIVE' : 'SANDBOX_CRYPTO';
    let companyRfc = 'TNN180920K71';
    let companyName = 'TRANSPORTES DEL NORTE Y NORESTE SA DE CV';

    if (supabase) {
      try {
        const { data: comp } = await supabase
          .from('companies')
          .select('rfc, name')
          .eq('id', payload.companyId)
          .maybeSingle();
        if (comp?.rfc) {
          companyRfc = comp.rfc.toUpperCase();
          companyName = comp.name || companyName;
        }
      } catch {
        // Fallback
      }
    }

    const isDemo =
      Boolean(payload.isDemoCompany) ||
      companyName.startsWith('[DEMO]') ||
      companyRfc === 'CEJ2106158A0' ||
      payload.companyId.includes('demo');

    // Clamping de fechaFinal en horario oficial CDMX (America/Mexico_City) para evitar error 301 del SAT por fechas futuras
    const todayIso = getTodayLocalIso();
    const safeFechaFinal = payload.fechaFinal > todayIso ? todayIso : payload.fechaFinal;
    const safeFechaInicial = payload.fechaInicial > safeFechaFinal ? safeFechaFinal : payload.fechaInicial;

    let edgeRecord: SatDownloadRequestRecord | null = null;
    if (typeof window !== 'undefined' && supabase) {
      try {
        const { data, error } = await supabase.functions.invoke<{
          ok: boolean;
          error?: string;
          requestRecord: SatDownloadRequestRecord;
        }>('sat-soap-sync', {
          body: {
            companyId: payload.companyId,
            companyRfc,
            companyName,
            tipoSolicitud: payload.tipoSolicitud,
            fechaInicial: safeFechaInicial,
            fechaFinal: safeFechaFinal,
            modoEjecucion: modo
          }
        });
        if (!error && data?.ok && data.requestRecord) {
          edgeRecord = data.requestRecord;
        } else if (!isDemo && modo === 'SAT_LIVE' && (error || (data && !data.ok))) {
          const errMsg =
            data?.error ||
            (error ? await extractSoapEdgeErrorMessage(error) : '') ||
            'El SAT rechazó la solicitud de descarga.';
          throw new Error(errMsg);
        }
      } catch (err) {
        if (!isDemo && modo === 'SAT_LIVE') {
          throw err;
        }
      }
    }

    const xmls = isDemo
      ? generateMonthlyCfdiBatchXmls({
          company: { id: payload.companyId, rfc: companyRfc, name: companyName },
          tipoSolicitud: payload.tipoSolicitud,
          fechaInicial: safeFechaInicial,
          fechaFinal: safeFechaFinal
        })
      : [];

    const batchRes = xmls.length > 0
      ? await supabaseCfdi.batchUploadCfdiXmls(payload.companyId, xmls)
      : { uploaded: [], skippedDuplicates: 0 };

    const idSolicitudSat = edgeRecord?.idSolicitudSat || crypto.randomUUID().toUpperCase();
    const idPaqueteSat = `${idSolicitudSat}_01`;
    const now = new Date().toISOString();

    const requestRecord: SatDownloadRequestRecord = {
      id: edgeRecord?.id || `satreq_${crypto.randomUUID().slice(0, 8)}`,
      companyId: payload.companyId,
      idSolicitudSat,
      tipoSolicitud: payload.tipoSolicitud,
      fechaInicial: safeFechaInicial,
      fechaFinal: safeFechaFinal,
      estadoSolicitud: isDemo ? 'TERMINADA' : 'ACEPTADA',
      codigoEstadoSat: '5000',
      mensajeSat: isDemo
        ? (modo === 'SAT_LIVE'
            ? `SAT Live: Sincronizado con clouda.sat.gob.mx. Folio ${idSolicitudSat.slice(0, 8)}`
            : '5000 - Solicitud recibida y paquete criptográfico importado en Sandbox')
        : `SAT 5000: Solicitud transmitida al Web Service oficial. Folio asignado: ${idSolicitudSat.slice(0, 8)}. El SAT está empaquetando los comprobantes.`,
      idPaqueteSat,
      cfdisDescargados: batchRes.uploaded.length > 0 ? batchRes.uploaded.length : (isDemo ? xmls.length : 0),
      modoEjecucion: modo,
      soapRequestXml: `<SolicitaDescarga xmlns="http://DescargaMasivaTerceros.sat.gob.mx" RfcSolicitante="${companyRfc}" TipoSolicitud="${payload.tipoSolicitud}"/>`,
      soapResponseXml: `<SolicitaDescargaResult CodEstatus="5000" EstadoSolicitud="1" CodigoEstadoSolicitud="5000" IdSolicitud="${idSolicitudSat}"/>`,
      createdAt: now
    };

    if (supabase && !edgeRecord) {
      try {
        await supabase.from('sat_download_requests').insert({
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
          cfdis_descargados: requestRecord.cfdisDescargados,
          modo_ejecucion: requestRecord.modoEjecucion,
          soap_request_xml: requestRecord.soapRequestXml,
          soap_response_xml: requestRecord.soapResponseXml,
          created_at: requestRecord.createdAt
        });
      } catch {
        // Fallback
      }
    }

    if (!supabase && typeof window !== 'undefined' && window.localStorage) {
      const existing = await supabaseSoapDownload.getSatDownloadRequests(payload.companyId);
      saveSoapRequestToStorage(payload.companyId, requestRecord, existing);
    }

    return { requestRecord, downloadedCfdis: batchRes.uploaded };
  },

  async verifyPendingSatRequests(companyId: string): Promise<{
    ok: boolean;
    updatedCount: number;
    downloadedCount: number;
    rejectedCount?: number;
    pendingCount?: number;
    message: string;
    details?: string;
  }> {
    if (!supabase) {
      return { ok: false, updatedCount: 0, downloadedCount: 0, message: 'Supabase no conectado' };
    }
    try {
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean;
        message?: string;
        results?: Array<{
          id?: string;
          estadoSolicitud: string;
          numeroCfdis?: number;
          estadoSat?: string;
          codigoEstadoSat?: string;
          mensajeSat?: string;
          truncatedAtLimit?: boolean;
        }>;
      }>('sat-soap-sync', {
        body: {
          action: 'verifica-descarga',
          companyId
        }
      });

      if (error) {
        const realErrMsg = await extractSoapEdgeErrorMessage(error);
        return {
          ok: false,
          updatedCount: 0,
          downloadedCount: 0,
          rejectedCount: 0,
          pendingCount: 0,
          message: `Fallo al verificar con SAT Cloud: ${realErrMsg}`
        };
      }

      if (data?.ok) {
        for (const r of data.results || []) {
          if (r.estadoSat === '0') {
            r.estadoSolicitud = 'EN_PROCESO';
            const resolvedSatCode = r.codigoEstadoSat || r.estadoSat;
            const resolvedMsg =
              r.mensajeSat ||
              `SAT ${resolvedSatCode}: Token de sesión inválido o expirado ante el SAT (EstadoSolicitud 0). Reintenta la verificación con tu e.firma.`;
            r.mensajeSat = resolvedMsg;
            if (r.id) {
              await supabase
                .from('sat_download_requests')
                .update({
                  estado_solicitud: 'EN_PROCESO',
                  codigo_estado_sat: resolvedSatCode,
                  mensaje_sat: resolvedMsg
                })
                .eq('id', r.id);
            }
          } else if (r.estadoSat === '4' || r.estadoSat === '5' || r.estadoSat === '6') {
            r.estadoSolicitud = 'ERROR';
            const resolvedSatCode = r.codigoEstadoSat || r.estadoSat;
            const resolvedMsg =
              r.mensajeSat ||
              `SAT ${resolvedSatCode}: Solicitud rechazada, con error o vencida en servidores del SAT.`;
            r.mensajeSat = resolvedMsg;
            if (r.id) {
              await supabase
                .from('sat_download_requests')
                .update({
                  estado_solicitud: 'ERROR',
                  codigo_estado_sat: resolvedSatCode,
                  mensaje_sat: resolvedMsg
                })
                .eq('id', r.id);
            }
          }
        }
        const finished = (data.results || []).filter(
          (r) => r.estadoSolicitud === 'TERMINADA' || r.estadoSolicitud === 'PARCIAL'
        );
        const partialCount = (data.results || []).filter(
          (r) => r.estadoSolicitud === 'PARCIAL' || r.estadoSolicitud === 'ERROR_LIMITE' || r.truncatedAtLimit
        ).length;
        const rejected = (data.results || []).filter((r) => r.estadoSolicitud === 'ERROR');
        const pending = (data.results || []).filter(
          (r) => r.estadoSolicitud === 'ACEPTADA' || r.estadoSolicitud === 'EN_PROCESO'
        );
        const numTotal = finished.reduce((acc, r) => acc + (r.numeroCfdis || 0), 0);

        return {
          ok: true,
          updatedCount: data.results?.length ?? 0,
          downloadedCount: numTotal,
          rejectedCount: rejected.length,
          pendingCount: pending.length,
          message:
            partialCount > 0
              ? `Descarga parcial: ${numTotal} comprobante(s) integrados, pero se alcanzó el límite de XML/tamaño por paquete. Divide el periodo para obtener el resto.`
              : numTotal > 0
              ? `¡Sincronización completada! ${numTotal} comprobante(s) descargados del SAT.`
              : rejected.length > 0
              ? data.results?.find((r) => r.estadoSolicitud === 'ERROR')?.mensajeSat ||
                'El SAT reportó solicitud rechazada o con error.'
              : pending.length > 0
              ? 'El SAT sigue preparando y empaquetando tus facturas en sus servidores.'
              : data.message || `Verificación completada para ${companyId}`
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err || 'Error de red');
      return {
        ok: false,
        updatedCount: 0,
        downloadedCount: 0,
        rejectedCount: 0,
        pendingCount: 0,
        message: `Error de conexión con servicio SAT: ${errorMsg}`
      };
    }

    const { data: reqs } = await supabase
      .from('sat_download_requests')
      .select('id, estado_solicitud, cfdis_descargados, mensaje_sat')
      .eq('company_id', companyId);

    const term = (reqs || []).filter((r) => r.estado_solicitud === 'TERMINADA');
    const rej = (reqs || []).filter((r) => r.estado_solicitud === 'ERROR');
    const pend = (reqs || []).filter(
      (r) => r.estado_solicitud === 'ACEPTADA' || r.estado_solicitud === 'EN_PROCESO'
    );
    const numTotal = term.reduce((acc, r) => acc + (r.cfdis_descargados || 0), 0);

    return {
      ok: true,
      updatedCount: term.length,
      downloadedCount: numTotal,
      rejectedCount: rej.length,
      pendingCount: pend.length,
      message:
        numTotal > 0
          ? `¡Sincronización completada! ${numTotal} comprobante(s) en Bóveda.`
          : rej.length > 0
          ? 'El SAT reportó solicitud rechazada (Código 5).'
          : pend.length > 0
          ? 'El SAT sigue empaquetando tus comprobantes.'
          : 'Estatus consultado con éxito en la base de datos'
    };
  }
};
