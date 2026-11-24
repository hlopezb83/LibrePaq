import { describe, expect, test } from 'bun:test';
import { generateKeyPairSync } from 'node:crypto';
import { strFromU8, unzipSync } from 'fflate';
import { buildDiot54BatchLine, computeDiotReportData } from '../src/shared/engine/diot.engine';
import { buildSatAnexo24Xml } from '../src/shared/sat-anexo24';
import { buildAnexo24SolicitudAttrs } from '../src/shared/sat-anexo24-auxiliaries';
import { buildSatAnexo24Zip } from '../src/shared/sat-anexo24-zip';
import { parseCfdiXmlString } from '../src/shared/cfdi-xml';
import { computeCfdiTotals } from '../src/views/cfdi/filterCfdis';
import { parseCfdiFull } from '../supabase/functions/sat-soap-sync/cfdi-full-parser';
import { buildSatSolicitaDescargaSoapXml } from '../supabase/functions/sat-soap-sync/crypto-helpers';
import { api } from '../src/server/api';
import {
  createCompanyRecord,
  createPolizaTransaction,
  deleteCompanyRecord,
  getAccounts,
  initDatabase
} from '../src/server/db';
import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  Poliza,
  ThirdPartyRecord
} from '../src/shared/types';

const company: Company = {
  id: 'comp_r5_ola1',
  name: 'EMPRESA RONDA 5 SA DE CV',
  rfc: ' erp260101ab1 ',
  regimenFiscal: '601 - General de Ley Personas Morales',
  codigoPostal: '06700',
  maskFormat: 'XXX-XX-XXX',
  currentYear: 2026,
  currentPeriod: 10,
  createdAt: '2026-01-01'
};

function makeCfdi(overrides: Partial<CfdiDocument> & Pick<CfdiDocument, 'id' | 'uuid'>): CfdiDocument {
  return {
    companyId: company.id,
    fecha: '2026-10-15',
    tipoComprobante: 'I',
    direction: 'RECIBIDO',
    serie: '',
    folio: '',
    emisorRfc: 'PRO990101AA1',
    emisorNombre: 'PROVEEDOR DEMO SA',
    receptorRfc: 'ERP260101AB1',
    receptorNombre: company.name,
    conceptoPrincipal: 'Servicios generales',
    claveProdServ: '80101500',
    moneda: 'MXN',
    tipoCambio: 1,
    subtotal: 1000,
    descuento: 0,
    ivaTrasladado: 160,
    isrRetenido: 0,
    ivaRetenido: 0,
    total: 1160,
    metodoPago: 'PUE',
    formaPago: '03',
    usoCfdi: 'G03',
    statusSat: 'VIGENTE',
    polizaId: 'pol_1',
    xmlRaw: '',
    ...overrides
  };
}

describe('Ronda 5 Ola 1 — DIOT 54 campos SAT 2025/2026', () => {
  test('mapea exactamente FN 8%, FS 8%, 16% nacional, IVA 16%/8% separado, importaciones y devoluciones sin colisiones', () => {
    const norteLine = buildDiot54BatchLine({
      rfc: 'PRO990101AA1',
      nombre: 'PROV NORTE',
      tipoTercero: '04',
      tipoOperacion: '85',
      regionFronteriza: 'NORTE',
      actosPagados8: 2000,
      ivaAcreditable8: 160,
      actosPagados16: 10000,
      ivaAcreditable16: 1600,
      ivaNoAcreditable16: 45,
      ivaNoAcreditable8: 15,
      importacionesTangibles16: 3000,
      importacionesIntangibles16: 1500,
      devolucionesMxn: 700,
      actosExentos: 300,
      actosPagados0: 500,
      ivaRetenido: 1067
    }).split('|');

    expect(norteLine).toHaveLength(54);
    expect(norteLine[7]).toBe('2000');   // Campo 8: FN 8%
    expect(norteLine[8]).toBe('');       // Campo 9: Devoluciones 8% FN (no mezcla IVA no acreditable)
    expect(norteLine[9]).toBe('');       // Campo 10: FS 8% vacío
    expect(norteLine[11]).toBe('10000'); // Campo 12: 16% nacional
    expect(norteLine[12]).toBe('700');   // Campo 13: Devoluciones 16%
    expect(norteLine[13]).toBe('3000');  // Campo 14: Importaciones tangibles 16%
    expect(norteLine[15]).toBe('1500');  // Campo 16: Importaciones intangibles 16%
    expect(norteLine[17]).toBe('160');   // Campo 18: IVA acreditable 8% FN
    expect(norteLine[19]).toBe('');      // Campo 20: IVA acreditable 8% FS vacío
    expect(norteLine[21]).toBe('1600');  // Campo 22: IVA acreditable 16% (no sobrescrito por intangibles)
    expect(norteLine[27]).toBe('15');    // Campo 28: IVA no acreditable 8% FN
    expect(norteLine[28]).toBe('');      // Campo 29: Requisitos FN vacío
    expect(norteLine[35]).toBe('45');    // Campo 36: IVA no acreditable 16% nacional
    expect(norteLine[46]).toBe('');      // Campo 47: Exclusivo IVA no acreditable importaciones intangibles
    expect(norteLine[47]).toBe('1067');  // Campo 48: IVA retenido
    expect(norteLine[48]).toBe('');      // Campo 49: Importaciones exentas (no devoluciones)
    expect(norteLine[49]).toBe('300');   // Campo 50: Actos exentos
    expect(norteLine[50]).toBe('500');   // Campo 51: Actos 0%
    expect(norteLine[53]).toBe('01');    // Campo 54: Manifestación efectos

    const surLine = buildDiot54BatchLine({
      rfc: 'SUR990101AA1',
      nombre: 'PROV SUR',
      tipoTercero: '04',
      tipoOperacion: '03',
      regionFronteriza: 'SUR',
      actosPagados8: 4000,
      ivaAcreditable8: 320,
      ivaNoAcreditable8: 25,
      actosPagados16: 0,
      ivaAcreditable16: 0,
      ivaRetenido: 0
    }).split('|');

    expect(surLine[7]).toBe('');
    expect(surLine[9]).toBe('4000');  // Campo 10: FS 8%
    expect(surLine[10]).toBe('');     // Campo 11: Devoluciones 8% FS vacío
    expect(surLine[17]).toBe('');
    expect(surLine[19]).toBe('320');  // Campo 20: IVA acreditable 8% FS
    expect(surLine[29]).toBe('');     // Campo 30: FN no acreditable vacío
    expect(surLine[31]).toBe('25');   // Campo 32: IVA no acreditable 8% FS
  });

  test('excluye NC PPD o ligada a PPD sin pago, infiere 8% sin taxBreakdown, separa IVA 16/8 y lee datos 05', () => {
    const thirdParties: Array<ThirdPartyRecord & { pais?: string; nacionalidad?: string; idFiscal?: string }> = [
      {
        id: 'tp_ext',
        companyId: company.id,
        rfc: 'XEXX010101000',
        nombre: 'AWS INC',
        rol: 'PROVEEDOR',
        cuentaOperacionCode: '601-01-001',
        cuentaContrapartidaCode: '201-01-001',
        tipoTerceroDiot: '05',
        tipoOperacionDiot: '85',
        tasaIvaDefault: 16,
        estatus69B: 'LIMPIO',
        updatedAt: '2026-10-01',
        pais: 'USA',
        nacionalidad: 'ESTADOUNIDENSE',
        idFiscal: 'US-99-123456'
      },
      {
        id: 'tp_fn',
        companyId: company.id,
        rfc: 'FRON800101AA1',
        nombre: 'PROVEEDOR MIXTO',
        rol: 'PROVEEDOR',
        cuentaOperacionCode: '601-01-001',
        cuentaContrapartidaCode: '201-01-001',
        tipoTerceroDiot: '04',
        tipoOperacionDiot: '85',
        tasaIvaDefault: 8,
        estatus69B: 'LIMPIO',
        updatedAt: '2026-10-01'
      }
    ];

    const cfdis: CfdiDocument[] = [
      // Factura PPD sin pago en el periodo
      makeCfdi({ id: 'inv_ppd', uuid: 'PPD-UNPAID-1', metodoPago: 'PPD', subtotal: 5000, ivaTrasladado: 800, total: 5800 }),
      // NC ligada a la PPD no pagada -> debe excluirse
      makeCfdi({ id: 'nc_ppd_rel', uuid: 'NC-REL-UNPAID', tipoComprobante: 'E', metodoPago: 'PUE', uuidRelacionado: 'PPD-UNPAID-1', subtotal: 500, ivaTrasladado: 80, total: 580 }),
      // NC con MetodoPago PPD -> debe excluirse
      makeCfdi({ id: 'nc_ppd_meth', uuid: 'NC-METH-PPD', tipoComprobante: 'E', metodoPago: 'PPD', subtotal: 400, ivaTrasladado: 64, total: 464 }),
      // Factura PUE sin taxBreakdown con tasa 8% inferida por cociente 80/1000 = 0.08
      makeCfdi({ id: 'pue_8', uuid: 'PUE-8', emisorRfc: 'FRON800101AA1', emisorNombre: 'PROVEEDOR MIXTO', subtotal: 1000, ivaTrasladado: 80, total: 1080, taxBreakdown: null }),
      // Factura PUE del mismo proveedor al 16% -> IVA 16% y 8% deben ir en columnas separadas
      makeCfdi({ id: 'pue_16', uuid: 'PUE-16', emisorRfc: 'FRON800101AA1', emisorNombre: 'PROVEEDOR MIXTO', subtotal: 2000, ivaTrasladado: 320, total: 2320, taxBreakdown: null }),
      // Proveedor extranjero '05' con metadatos fiscales opcionales
      makeCfdi({ id: 'ext_1', uuid: 'EXT-05', emisorRfc: 'XEXX010101000', emisorNombre: 'AWS INC', conceptoPrincipal: 'Servicio exento', subtotal: 3000, ivaTrasladado: 0, total: 3000 })
    ];

    const diot = computeDiotReportData({
      company,
      ejercicio: 2026,
      periodo: 10,
      cfdis,
      polizaIdsInPeriod: new Set(['pol_1']),
      trialBalance: [],
      thirdParties
    });

    const mixedRow = diot.rows.find((r) => r.rfc === 'FRON800101AA1')!;
    expect(mixedRow).toBeDefined();
    expect(mixedRow.actosPagados8).toBe(1000);
    expect(mixedRow.actosPagados16).toBe(2000);
    const mixedCols = mixedRow.batchLine.split('|');
    expect(mixedCols[7]).toBe('1000');   // 8% base
    expect(mixedCols[11]).toBe('2000');  // 16% base
    expect(mixedCols[17]).toBe('80');    // IVA 8% en campo 18
    expect(mixedCols[21]).toBe('320');   // IVA 16% en campo 22
    expect(mixedCols[46]).toBe('');      // No mezclado en campo 47

    // Ninguna NC de PRO990101AA1 debió incluirse
    expect(diot.rows.find((r) => r.rfc === 'PRO990101AA1')).toBeUndefined();

    const extRow = diot.rows.find((r) => r.rfc === 'XEXX010101000')!;
    const extCols = extRow.batchLine.split('|');
    expect(extCols[3]).toBe('US-99-123456');
    expect(extCols[5]).toBe('USA');
    expect(extCols[6]).toBe('');
    expect(extCols[49]).toBe('3000');
  });
});

describe('Ronda 5 Ola 1 — Anexo 24 XSD v1.3 y Bóveda ADD', () => {
  test('XC.xml usa namespace AuxiliarCtas, solo cuentas afectables con >=1 DetalleAux, XF omite MetPagoAux si falta y no inyecta folios falsos', () => {
    const attrsMissingAf = buildAnexo24SolicitudAttrs({ tipoSolicitud: 'AF' });
    expect(attrsMissingAf.reqSolicitudAttr).toBe('');
    expect(attrsMissingAf.missingRequiredAttr).toBe(true);

    const attrsMissingDe = buildAnexo24SolicitudAttrs({ tipoSolicitud: 'DE' });
    expect(attrsMissingDe.reqSolicitudAttr).toBe('');
    expect(attrsMissingDe.missingRequiredAttr).toBe(true);

    const accounts: AccountWithBalance[] = [
      {
        id: 'acc_mayor',
        companyId: company.id,
        code: '102-00-000',
        name: 'Bancos (Mayor)',
        parentCode: null,
        type: 'ACTIVO',
        nature: 'DEUDORA',
        level: 1,
        isAffectable: false,
        satGroupCode: '102',
        currency: 'MXN',
        initialBalance: 1000,
        initialBalanceComputed: 1000,
        periodCharges: 500,
        periodCredits: 0,
        finalBalance: 1500
      },
      {
        id: 'acc_sin_movs',
        companyId: company.id,
        code: '102-01-002',
        name: 'Santander Sin Movimientos',
        parentCode: '102-00-000',
        type: 'ACTIVO',
        nature: 'DEUDORA',
        level: 2,
        isAffectable: true,
        satGroupCode: '102.01',
        currency: 'MXN',
        initialBalance: 5000,
        initialBalanceComputed: 5000,
        periodCharges: 0,
        periodCredits: 0,
        finalBalance: 5000
      },
      {
        id: 'acc_con_movs',
        companyId: company.id,
        code: '102-01-001',
        name: 'BBVA',
        parentCode: '102-00-000',
        type: 'ACTIVO',
        nature: 'DEUDORA',
        level: 2,
        isAffectable: true,
        satGroupCode: '102.01',
        currency: 'MXN',
        initialBalance: 1000,
        initialBalanceComputed: 1000,
        periodCharges: 500,
        periodCredits: 0,
        finalBalance: 1500
      }
    ];

    const polizas: Poliza[] = [
      {
        id: 'pol_p13',
        companyId: company.id,
        tipo: 'DIARIO',
        folio: 7,
        fecha: '2026-12-31',
        ejercicio: 2026,
        periodo: 13,
        concepto: 'Ajuste cierre',
        cfdiUuid: '11111111-2222-4333-8444-555555555555',
        origin: 'MANUAL',
        totalCargos: 500,
        totalAbonos: 500,
        isBalanced: true,
        createdAt: '2026-12-31',
        movements: [
          {
            id: 'm1',
            polizaId: 'pol_p13',
            accountId: 'acc_con_movs',
            accountCode: '102-01-001',
            accountName: 'BBVA',
            referencia: 'AJ-1',
            concepto: 'Ajuste',
            cargo: 500,
            abono: 0,
            cfdiUuid: '11111111-2222-4333-8444-555555555555'
          }
        ]
      }
    ];

    const xc = buildSatAnexo24Xml(company, 2026, 13, 'auxiliar_cuentas', accounts, polizas, {
      tipoSolicitud: 'AF'
    });
    expect(xc.filename).toBe('ERP260101AB1202612XC.xml');
    expect(xc.xml).toContain('http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/AuxiliarCtas');
    expect(xc.xml).toContain('AuxiliarCtas_1_3.xsd');
    expect(xc.xml).toContain('Mes="12"');
    expect(xc.xml).not.toContain('ABC1234567/01');
    expect(xc.xml).toContain('NumCta="102-01-001"');
    expect(xc.xml).not.toContain('NumCta="102-00-000"');
    expect(xc.xml).not.toContain('NumCta="102-01-002"');
    expect(xc.xml).not.toMatch(/<AuxiliarCtas:Cuenta[^>]*\/>/);

    const xfNoMet = buildSatAnexo24Xml(company, 2026, 13, 'auxiliar_folios', accounts, polizas, {
      tipoSolicitud: 'DE'
    });
    expect(xfNoMet.filename).toBe('ERP260101AB1202612XF.xml');
    expect(xfNoMet.xml).not.toContain('DE000000000001');
    expect(xfNoMet.xml).not.toContain('MetPagoAux="03"');

    const cfdiLookup = new Map([
      ['11111111-2222-4333-8444-555555555555', { total: 500, rfcContraparte: 'CLI010101AA1', formaPago: '04' }]
    ]);
    const xfWithMet = buildSatAnexo24Xml(company, 2026, 10, 'auxiliar_folios', accounts, polizas, {
      tipoSolicitud: 'AF',
      numOrden: 'XYZ7654321/02',
      cfdiLookup
    });
    expect(xfWithMet.xml).toContain('MetPagoAux="04"');

    const zip = buildSatAnexo24Zip({ company, year: 2026, period: 13, type: 'auxiliar_cuentas', xmlResult: xc });
    expect(zip.zipFilename).toBe('ERP260101AB1202612XC.zip');
    expect(strFromU8(unzipSync(zip.zipBytes)[xc.filename]!)).toBe(xc.xml);
  });

  test('computeCfdiTotals excluye tipo P y convierte montos FX por tipoCambio', () => {
    const docs: CfdiDocument[] = [
      makeCfdi({ id: '1', uuid: 'U1', tipoComprobante: 'I', moneda: 'USD', tipoCambio: 20, subtotal: 100, ivaTrasladado: 16, total: 116 }),
      makeCfdi({ id: '2', uuid: 'U2', tipoComprobante: 'P', moneda: 'MXN', tipoCambio: 1, subtotal: 2000, ivaTrasladado: 320, total: 2320 }),
      makeCfdi({ id: '3', uuid: 'U3', tipoComprobante: 'E', moneda: 'MXN', tipoCambio: 1, subtotal: 500, ivaTrasladado: 80, total: 580 })
    ];
    const totals = computeCfdiTotals(docs);
    expect(totals.subtotal).toBe(1500);
    expect(totals.iva).toBe(240);
    expect(totals.total).toBe(1740);
  });
});

describe('Ronda 5 Ola 1 — Parsers XML, SOAP & Seguridad IDOR', () => {
  test('cfdi-xml & cfdi-full-parser: requireStamp, serie/folio vacío, múltiples CfdiRelacionado, EquivalenciaDR, ObjetoImp 04 e implocal', () => {
    const unstampedXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Fecha="2026-10-10T10:00:00" TipoDeComprobante="I" SubTotal="100.00" Total="100.00" Moneda="MXN">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="RECEPTOR" UsoCFDI="G03"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="80101500" Descripcion="Item" Importe="100.00" ObjetoImp="04"/></cfdi:Conceptos>
</cfdi:Comprobante>`;

    expect(() => parseCfdiXmlString(unstampedXml, { requireStamp: true })).toThrow('CFDI_NOT_STAMPED');
    const parsedNoStamp = parseCfdiXmlString(unstampedXml);
    expect(parsedNoStamp.serie).toBe('');
    expect(parsedNoStamp.folio).toBe('');
    expect(parsedNoStamp.taxBreakdown?.baseExento).toBe(100);

    const multiRelAndImplocalXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:implocal="http://www.sat.gob.mx/implocal" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-10T10:00:00" TipoDeComprobante="E" SubTotal="1000.00" Total="1140.00" Moneda="MXN">
  <cfdi:CfdiRelacionados TipoRelacion="01">
    <cfdi:CfdiRelacionado UUID="AAAA0000-0000-4000-8000-000000000001"/>
    <cfdi:CfdiRelacionado UUID="AAAA0000-0000-4000-8000-000000000002"/>
  </cfdi:CfdiRelacionados>
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="RECEPTOR" UsoCFDI="G02"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="80101500" Descripcion="NC" Importe="1000.00" ObjetoImp="04"/></cfdi:Conceptos>
  <cfdi:Complemento>
    <implocal:ImpuestosLocales version="1.0" TotaldeRetenciones="20.00" TotaldeTraslados="30.00">
      <implocal:RetencionesLocales ImpLocRetenido="CEDULAR" TasadeRetencion="2.00" Importe="20.00"/>
      <implocal:TrasladosLocales ImpLocTrasladado="ISH" TasadeTraslado="3.00" Importe="30.00"/>
    </implocal:ImpuestosLocales>
    <tfd:TimbreFiscalDigital UUID="BBBB1111-1111-4111-8111-111111111111" FechaTimbrado="2026-10-10T10:05:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const pXml = parseCfdiXmlString(multiRelAndImplocalXml, { requireStamp: true });
    const pFull = parseCfdiFull(multiRelAndImplocalXml)!;
    expect(pXml.uuidsRelacionados).toEqual([
      'AAAA0000-0000-4000-8000-000000000001',
      'AAAA0000-0000-4000-8000-000000000002'
    ]);
    expect(pFull.uuidsRelacionados).toEqual(pXml.uuidsRelacionados);
    expect(pXml.taxBreakdown?.baseExento).toBe(1000);
    expect(pFull.taxBreakdown?.baseExento).toBe(1000);
    expect((pXml.taxBreakdown as { localRetenido?: number })?.localRetenido).toBe(20);
    expect((pXml.taxBreakdown as { localTrasladado?: number })?.localTrasladado).toBe(30);
    expect(pFull.taxBreakdown?.localRetenido).toBe(20);
    expect(pFull.taxBreakdown?.localTrasladado).toBe(30);

    // EquivalenciaDR >= 1: factura EUR pagada con USD en REP multi-moneda (sin Totales ni Monto para ejercitar drImpPagadoSum)
    const pagoEqXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-20T12:00:00" TipoDeComprobante="P" SubTotal="0" Total="0" Moneda="XXX">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="RECEPTOR" UsoCFDI="CP01"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111506" Descripcion="Pago" Importe="0"/></cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Pago FechaPago="2026-10-20T12:00:00" FormaDePagoP="03" MonedaP="USD" TipoCambioP="20.00" Monto="0">
        <pago20:DoctoRelacionado IdDocumento="DOC-EUR-1" MonedaDR="EUR" EquivalenciaDR="2" NumParcialidad="1" ImpSaldoAnt="200.00" ImpPagado="200.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="02"/>
      </pago20:Pago>
      <pago20:Pago FechaPago="2026-10-20T12:00:00" FormaDePagoP="03" MonedaP="MXN" Monto="0"/>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital UUID="REP-EQ-1"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
    // 200 EUR / EquivalenciaDR(2) = 100 USD * TipoCambioP(20) = 2000 MXN
    expect(parseCfdiXmlString(pagoEqXml).total).toBe(2000);
    expect(parseCfdiFull(pagoEqXml)?.total).toBe(2000);

    // Nómina 1.2 descuento fallback TotalDeducciones - TotalImpuestosRetenidos
    const nominaFallbackXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:nomina12="http://www.sat.gob.mx/nomina12" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-15T12:00:00" TipoDeComprobante="N" SubTotal="10000.00" Descuento="2500.00" Total="7500.00" Moneda="MXN">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="PATRON"/>
  <cfdi:Receptor Rfc="EMP800101AA1" Nombre="EMPLEADO" UsoCFDI="CN01"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111505" Descripcion="Nómina" Importe="10000.00"/></cfdi:Conceptos>
  <cfdi:Complemento>
    <nomina12:Nomina Version="1.2" TotalPercepciones="10000.00" TotalDeducciones="2500.00">
      <nomina12:Deducciones TotalImpuestosRetenidos="1500.00"/>
    </nomina12:Nomina>
    <tfd:TimbreFiscalDigital UUID="NOM-FB-1"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
    expect(parseCfdiXmlString(nominaFallbackXml).descuento).toBe(1000);
    expect(parseCfdiFull(nominaFallbackXml)?.descuento).toBe(1000);
  });

  test('SAT SOAP solicita usa hora CDMX cuando fechaFinal === todayIso y permite EstadoComprobante=Todos en EMITIDOS', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const { soapXml: emitidosTodos } = buildSatSolicitaDescargaSoapXml({
      rfcSolicitante: 'ERP260101AB1',
      tipoSolicitud: 'EMITIDOS',
      fechaInicial: '2026-10-01',
      fechaFinal: '2026-10-20',
      fechaFinalTime: '14:22:05',
      estadoComprobante: 'Todos',
      certificateBase64: 'CERT',
      privateKeyPem
    });
    expect(emitidosTodos).toContain('FechaFinal="2026-10-20T14:22:05"');
    expect(emitidosTodos).toContain('EstadoComprobante="Todos"');

    const { soapXml: recibidos } = buildSatSolicitaDescargaSoapXml({
      rfcSolicitante: 'ERP260101AB1',
      tipoSolicitud: 'RECIBIDOS',
      fechaInicial: '2026-10-01',
      fechaFinal: '2026-10-20',
      fechaFinalTime: '14:22:05',
      estadoComprobante: 'Todos',
      certificateBase64: 'CERT',
      privateKeyPem
    });
    expect(recibidos).toContain('EstadoComprobante="Vigente"');
  });

  test('PUT /api/polizas/:id bloquea IDOR aunque el atacante envíe su propio companyId en el body', async () => {
    initDatabase();
    const compA = createCompanyRecord({
      name: 'Empresa Atacante R5',
      rfc: 'ATA010101AA1',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      userId: 'usr_r5_attacker'
    });
    const compB = createCompanyRecord({
      name: 'Empresa Victima R5',
      rfc: 'VIC010101BB1',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      userId: 'usr_r5_victim'
    });

    try {
      const accountsB = getAccounts(compB.id).filter((a) => a.isAffectable);
      expect(accountsB.length).toBeGreaterThanOrEqual(2);
      const polizaB = createPolizaTransaction({
        companyId: compB.id,
        ejercicio: 2026,
        periodo: 10,
        tipo: 'INGRESO',
        fecha: '2026-10-10',
        concepto: 'Póliza B',
        cfdiUuid: null,
        origin: 'MANUAL',
        movements: [
          { accountId: accountsB[0]!.id, cargo: 100, abono: 0, concepto: 'c' },
          { accountId: accountsB[1]!.id, cargo: 0, abono: 100, concepto: 'a' }
        ]
      });

      const res = await api.request(`/api/polizas/${polizaB.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'usr_r5_attacker',
          'x-user-email': 'attacker@demo.local'
        },
        body: JSON.stringify({ companyId: compA.id, concepto: 'IDOR Hack' })
      });

      expect(res.status).toBe(403);
    } finally {
      deleteCompanyRecord(compA.id, 'usr_r5_attacker');
      deleteCompanyRecord(compB.id, 'usr_r5_victim');
    }
  });
});
