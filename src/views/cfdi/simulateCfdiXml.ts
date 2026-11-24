import { buildCfdi40Xml } from '../../shared/cfdi-xml';
import type { Company } from '../../shared/types';

export interface SimulatedCfdiPayload {
  companyId: string;
  tipoComprobante: 'I' | 'P' | 'N';
  direction: 'EMITIDO' | 'RECIBIDO';
  counterpartyRfc: string;
  counterpartyName: string;
  conceptoPrincipal: string;
  subtotal: number;
  isrRetenido: number;
  ivaRetenido: number;
  metodoPago: 'PUE' | 'PPD';
  fecha: string;
}

export function buildSimulatedCfdiXml(
  payload: SimulatedCfdiPayload,
  activeCompany?: Company | null
): string {
  const isEmitido = payload.direction === 'EMITIDO';
  const emisorRfc = isEmitido ? activeCompany?.rfc || 'XAXX010101000' : payload.counterpartyRfc;
  const emisorNombre = isEmitido ? activeCompany?.name || 'Mi Empresa' : payload.counterpartyName;
  const receptorRfc = isEmitido ? payload.counterpartyRfc : activeCompany?.rfc || 'XAXX010101000';
  const receptorNombre = isEmitido ? payload.counterpartyName : activeCompany?.name || 'Mi Empresa';

  const ivaTrasladado = payload.tipoComprobante === 'I' ? payload.subtotal * 0.16 : 0;

  return buildCfdi40Xml({
    uuid: crypto.randomUUID(),
    serie: payload.tipoComprobante === 'I' ? 'FAC' : payload.tipoComprobante === 'P' ? 'REP' : 'NOM',
    folio: String(Math.floor(1000 + Math.random() * 9000)),
    fecha: payload.fecha,
    emisorRfc,
    emisorNombre,
    receptorRfc,
    receptorNombre,
    tipoComprobante: payload.tipoComprobante,
    subtotal: payload.subtotal,
    descuento: 0,
    ivaTrasladado,
    isrRetenido: payload.isrRetenido,
    ivaRetenido: payload.ivaRetenido,
    total: payload.subtotal + ivaTrasladado - payload.isrRetenido - payload.ivaRetenido,
    moneda: 'MXN',
    tipoCambio: 1,
    formaPago: '03',
    metodoPago: payload.metodoPago,
    usoCfdi: 'G03',
    claveProdServ: '81111508',
    conceptoPrincipal: payload.conceptoPrincipal
  });
}
