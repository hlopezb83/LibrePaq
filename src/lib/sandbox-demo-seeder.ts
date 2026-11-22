import { apiClient } from './api-client';
import { buildCfdi40Xml } from '../shared/cfdi-xml';
import { trackAnalyticsEvent, trackFirstCompanyCreatedConversion } from './analytics';
import type { Company } from '../shared/types';

import {
  SANDBOX_DEMO_RFC,
  SANDBOX_DEMO_NAME,
  CANONICAL_DEMO_COMPANY_ID,
  isSandboxDemoCompany
} from './sandbox-demo-constants';

export {
  SANDBOX_DEMO_RFC,
  SANDBOX_DEMO_NAME,
  CANONICAL_DEMO_COMPANY_ID,
  isSandboxDemoCompany
};

/**
 * Construye 3 archivos XML CFDI 4.0 realistas adaptados al RFC y periodo de la empresa activa
 * (1 factura emitida cobrada, 1 gasto tecnológico pagado y 1 arrendamiento por contabilizar).
 */
export function buildSampleCfdiXmlsForCompany(
  companyRfc: string,
  companyName: string,
  year: number,
  period: number
): string[] {
  const cleanRfc = companyRfc.trim().toUpperCase() || SANDBOX_DEMO_RFC;
  const cleanName = companyName.replace(/^\[DEMO\]\s*/i, '').trim() || 'Empresa Contribuyente';
  const monthStr = String(Math.min(12, Math.max(1, period))).padStart(2, '0');
  const suffix = cleanRfc.slice(0, 4).replace(/[^A-Z0-9]/g, 'X').padEnd(4, '0');

  const uuid1 = `D3M01001-${year}-${monthStr}05-9A11-${suffix}00000101`;
  const uuid2 = `D3M01002-${year}-${monthStr}10-9A11-${suffix}00000202`;
  const uuid3 = `D3M01003-${year}-${monthStr}15-9A11-${suffix}00000303`;

  const xmlIngreso = buildCfdi40Xml({
    uuid: uuid1,
    fecha: `${year}-${monthStr}-05`,
    tipoComprobante: 'I',
    serie: 'FAC',
    folio: '101',
    emisorRfc: cleanRfc,
    emisorNombre: cleanName,
    receptorRfc: 'GIN940315SAT',
    receptorNombre: 'GRUPO INDUSTRIAL DEL NORTE S.A. DE C.V.',
    conceptoPrincipal: 'Servicios Profesionales y Consultoría Empresarial Mensual',
    claveProdServ: '80101500',
    moneda: 'MXN',
    tipoCambio: 1,
    subtotal: 45000,
    descuento: 0,
    ivaTrasladado: 7200,
    isrRetenido: 0,
    ivaRetenido: 0,
    total: 52200,
    metodoPago: 'PUE',
    formaPago: '03',
    usoCfdi: 'G03',
    uuidRelacionado: null
  });

  const xmlGastoCloud = buildCfdi40Xml({
    uuid: uuid2,
    fecha: `${year}-${monthStr}-10`,
    tipoComprobante: 'I',
    serie: 'SER',
    folio: '804',
    emisorRfc: 'SNM1908124L9',
    emisorNombre: 'SERVICIOS EN LA NUBE Y TELECOMUNICACIONES S.A. DE C.V.',
    receptorRfc: cleanRfc,
    receptorNombre: cleanName,
    conceptoPrincipal: 'Infraestructura Cloud, Correo Corporativo y Enlace Dedicado',
    claveProdServ: '81112105',
    moneda: 'MXN',
    tipoCambio: 1,
    subtotal: 12500,
    descuento: 0,
    ivaTrasladado: 2000,
    isrRetenido: 0,
    ivaRetenido: 0,
    total: 14500,
    metodoPago: 'PUE',
    formaPago: '03',
    usoCfdi: 'G03',
    uuidRelacionado: null
  });

  const xmlGastoOficina = buildCfdi40Xml({
    uuid: uuid3,
    fecha: `${year}-${monthStr}-15`,
    tipoComprobante: 'I',
    serie: 'ARR',
    folio: '309',
    emisorRfc: 'IEV1602107M3',
    emisorNombre: 'INMOBILIARIA EJECUTIVA DEL VALLE S.A. DE C.V.',
    receptorRfc: cleanRfc,
    receptorNombre: cleanName,
    conceptoPrincipal: 'Arrendamiento Mensual de Oficinas Corporativas',
    claveProdServ: '80131502',
    moneda: 'MXN',
    tipoCambio: 1,
    subtotal: 18000,
    descuento: 0,
    ivaTrasladado: 2880,
    isrRetenido: 0,
    ivaRetenido: 0,
    total: 20880,
    metodoPago: 'PPD',
    formaPago: '99',
    usoCfdi: 'G03',
    uuidRelacionado: null
  });

  return [xmlIngreso, xmlGastoCloud, xmlGastoOficina];
}

/**
 * Crea en 1 clic una Empresa Ejemplo (Sandbox) dentro del Workspace del usuario con
 * Catálogo SAT, saldo inicial, 3 CFDIs 4.0 y 2 pólizas automáticas listas para explorar.
 */
export async function provisionSandboxDemoCompany(): Promise<Company> {
  try {
    const existingList = await apiClient.getCompanies();
    const existingDemo =
      existingList.find((c) => c.id === CANONICAL_DEMO_COMPANY_ID) ||
      existingList.find((c) => isSandboxDemoCompany(c));

    if (existingDemo) {
      trackAnalyticsEvent('reuse_sandbox_demo_company', { company_id: existingDemo.id });
      return existingDemo;
    }
  } catch {
    // Si falla la consulta inicial, procedemos al aprovisionamiento controlado
  }

  const now = new Date();
  const year = now.getFullYear();
  const period = now.getMonth() + 1;

  const created = await apiClient.createCompany({
    name: SANDBOX_DEMO_NAME,
    rfc: SANDBOX_DEMO_RFC,
    regimenFiscal: '601 - General de Ley Personas Morales',
    codigoPostal: '64000',
    currentYear: year,
    currentPeriod: period,
    catalogPreset: 'SAT_STANDARD',
    initialBankName: 'BBVA México',
    initialBankAccount: '01948271',
    initialBankBalance: 150000,
    createOpeningEntry: true
  });

  const sampleXmls = buildSampleCfdiXmlsForCompany(created.rfc, created.name, year, period);
  const { uploaded } = await apiClient.batchUploadCfdiXmls(created.id, sampleXmls);

  // Contabilizar automáticamente los primeros 2 CFDIs y dejar 1 pendiente en Bóveda ADD para prueba interactiva
  for (const cfdi of uploaded.slice(0, 2)) {
    try {
      await apiClient.autoPolizaFromCfdi(cfdi.id);
    } catch {
      // Si falla una póliza individual, la empresa demo sigue utilizable
    }
  }

  trackAnalyticsEvent('create_sandbox_demo_company', { company_id: created.id });
  trackFirstCompanyCreatedConversion({ isDemo: true, creationFlow: 'sandbox_demo' });

  return created;
}
