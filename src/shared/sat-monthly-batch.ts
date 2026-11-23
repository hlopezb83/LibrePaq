import { buildCfdi40Xml } from './cfdi-xml';
import {
  TEMPLATES_RECIBIDOS,
  TEMPLATES_EMITIDOS,
  type MonthlyTemplate
} from './sat-monthly-templates';
import type { Company } from './types';

export interface BatchGenerationOptions {
  company: Company | { id: string; rfc: string; name: string };
  tipoSolicitud: 'RECIBIDOS' | 'EMITIDOS' | 'AMBOS';
  fechaInicial: string;
  fechaFinal: string;
}

/**
 * Genera un UUID v4 determinista a partir de una semilla fija (RFC + fecha + folio),
 * garantizando idempotencia estricta en las descargas y cargas masivas del SAT.
 */
export function generateDeterministicUuid(seed: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  let h3 = 0x12345678;
  let h4 = 0x9abcdef0;
  for (let i = 0; i < seed.length; i += 1) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 3812015801);
    h4 = Math.imul(h4 ^ ch, 2718281829);
  }
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const hex = (toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4)).slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`.toUpperCase();
}

function calculateTargetDate(fechaInicial: string, fechaFinal: string, dayOffset: number): string {
  const start = new Date(`${fechaInicial}T00:00:00`);
  const end = new Date(`${fechaFinal}T23:59:59`);
  const year = start.getFullYear();
  const month = start.getMonth();

  const maxDayInMonth = new Date(year, month + 1, 0).getDate();
  const targetDay = Math.min(Math.max(1, dayOffset), maxDayInMonth);
  const candidate = new Date(year, month, targetDay);

  if (candidate < start) return fechaInicial;
  if (candidate > end) return fechaFinal;
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

function buildXmlFromTemplate(
  t: MonthlyTemplate,
  fecha: string,
  isRecibido: boolean,
  company: { rfc: string; name: string }
): string {
  const counterpartyRfc = isRecibido ? t.emisorRfc : (t.receptorRfc ?? 'XAXX010101000');
  const seed = `${company.rfc}_${fecha}_${t.serie}_${counterpartyRfc}_${t.dayOffset}`;
  const uuid = generateDeterministicUuid(seed);
  const folio = String(1000 + ((t.dayOffset * 43 + (isRecibido ? 100 : 500)) % 8999));
  const total = Number((t.subtotal + t.iva - t.isrRet - t.ivaRet).toFixed(2));

  return buildCfdi40Xml({
    uuid,
    serie: t.serie,
    folio,
    fecha,
    tipoComprobante: t.tipoComprobante,
    emisorRfc: isRecibido ? t.emisorRfc : company.rfc,
    emisorNombre: isRecibido ? t.emisorNombre : company.name,
    receptorRfc: isRecibido ? company.rfc : counterpartyRfc,
    receptorNombre: isRecibido ? company.name : (t.receptorNombre ?? 'CLIENTE GENERAL PUBLICO'),
    conceptoPrincipal: `${t.concepto} (DESCARGA SAT SOAP v1.5)`,
    claveProdServ: t.claveProdServ,
    subtotal: t.subtotal,
    descuento: 0,
    ivaTrasladado: t.iva,
    isrRetenido: t.isrRet,
    ivaRetenido: t.ivaRet,
    total,
    moneda: 'MXN',
    tipoCambio: 1,
    metodoPago: t.metodoPago,
    formaPago: t.formaPago,
    usoCfdi: t.usoCfdi,
    uuidRelacionado: null
  });
}

export function generateMonthlyCfdiBatchXmls(options: BatchGenerationOptions): string[] {
  const { company, tipoSolicitud, fechaInicial, fechaFinal } = options;
  const xmls: string[] = [];

  const includeRecibidos = tipoSolicitud === 'RECIBIDOS' || tipoSolicitud === 'AMBOS';
  const includeEmitidos = tipoSolicitud === 'EMITIDOS' || tipoSolicitud === 'AMBOS';

  if (includeRecibidos) {
    for (const t of TEMPLATES_RECIBIDOS) {
      const fecha = calculateTargetDate(fechaInicial, fechaFinal, t.dayOffset);
      xmls.push(buildXmlFromTemplate(t, fecha, true, company));
    }
  }

  if (includeEmitidos) {
    for (const t of TEMPLATES_EMITIDOS) {
      const fecha = calculateTargetDate(fechaInicial, fechaFinal, t.dayOffset);
      xmls.push(buildXmlFromTemplate(t, fecha, false, company));
    }
  }

  return xmls;
}
