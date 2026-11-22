import type { SatDownloadRequestRecord } from '../../shared/types';

const STORAGE_SOAP_KEY = 'librepaq_soap_requests_';

export interface DbSatDownloadRequest {
  id: string;
  company_id: string;
  id_solicitud_sat: string;
  tipo_solicitud: 'EMITIDOS' | 'RECIBIDOS';
  fecha_inicial: string;
  fecha_final: string;
  estado_solicitud: 'ACEPTADA' | 'EN_PROCESO' | 'ERROR' | 'TERMINADA';
  codigo_estado_sat: string;
  mensaje_sat: string;
  id_paquete_sat: string | null;
  cfdis_descargados: number;
  modo_ejecucion: 'SAT_LIVE' | 'SANDBOX_CRYPTO';
  soap_request_xml: string;
  soap_response_xml: string;
  created_at: string;
}

export function mapDbSatRequest(r: DbSatDownloadRequest): SatDownloadRequestRecord {
  return {
    id: r.id,
    companyId: r.company_id,
    idSolicitudSat: r.id_solicitud_sat,
    tipoSolicitud: r.tipo_solicitud,
    fechaInicial: r.fecha_inicial,
    fechaFinal: r.fecha_final,
    estadoSolicitud: r.estado_solicitud,
    codigoEstadoSat: r.codigo_estado_sat,
    mensajeSat: r.mensaje_sat,
    idPaqueteSat: r.id_paquete_sat,
    cfdisDescargados: r.cfdis_descargados,
    modoEjecucion: r.modo_ejecucion,
    soapRequestXml: r.soap_request_xml,
    soapResponseXml: r.soap_response_xml,
    createdAt: r.created_at
  };
}

export function readSoapRequestsFromStorage(companyId: string): SatDownloadRequestRecord[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const stored = window.localStorage.getItem(`${STORAGE_SOAP_KEY}${companyId}`);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as SatDownloadRequestRecord[];
  } catch (err) {
    console.warn('[SAT SOAP] No se pudo parsear respaldo local de solicitudes SOAP:', err);
    return [];
  }
}

export function saveSoapRequestToStorage(
  companyId: string,
  record: SatDownloadRequestRecord,
  existing: SatDownloadRequestRecord[]
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const updated = [record, ...existing].slice(0, 30);
    window.localStorage.setItem(`${STORAGE_SOAP_KEY}${companyId}`, JSON.stringify(updated));
  } catch (err) {
    console.warn('[SAT SOAP] No se pudo guardar historial SOAP en almacenamiento local:', err);
  }
}
