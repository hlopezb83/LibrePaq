import { describe, expect, test } from 'bun:test';
import { strFromU8, unzipSync } from 'fflate';
import { computeDiotReportData, generateDiotTxt } from '../src/shared/engine/diot.engine';
import {
  buildSatAnexo24Xml,
  isValidSatNumOrden,
  isValidSatNumTramite
} from '../src/shared/sat-anexo24';
import { buildSatAnexo24Zip } from '../src/shared/sat-anexo24-zip';
import {
  checkRfc69BStatus,
  getLoaded69BDatabase,
  merge69BCloudMatches,
  reset69BDatabaseCache,
  save69BDatabase,
  type Sat69BRecord
} from '../src/shared/sat-69b';
import { computeCfdiTotals, filterCfdis } from '../src/views/cfdi/filterCfdis';
import { parseCfdiFull } from '../supabase/functions/sat-soap-sync/cfdi-full-parser';
import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  Poliza,
  ThirdPartyRecord
} from '../src/shared/types';

const mockCompany: Company = {
  id: 'comp_ola2',
  name: 'COMERCIALIZADORA OLA 2 SA DE CV',
  rfc: 'COL260101AB1',
  regimenFiscal: '601 - General de Ley Personas Morales',
  codigoPostal: '06700',
  maskFormat: 'XXX-XX-XXX',
  currentYear: 2026,
  currentPeriod: 10,
  createdAt: '2026-01-01'
};

function makeCfdi(overrides: Partial<CfdiDocument> & Pick<CfdiDocument, 'id' | 'uuid'>): CfdiDocument {
  return {
    companyId: mockCompany.id,
    fecha: '2026-10-15',
    tipoComprobante: 'I',
    direction: 'RECIBIDO',
    serie: 'A',
    folio: '1',
    emisorRfc: 'PRO990101AA1',
    emisorNombre: 'PROVEEDOR DEMO SA',
    receptorRfc: mockCompany.rfc,
    receptorNombre: mockCompany.name,
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

describe('Ola 2 — P0-1 DIOT 54 campos & Pagos 2.0', () => {
  test('generateDiotTxt y computeDiotReportData emiten exactamente 54 campos delimitados por |', () => {
    const txt = generateDiotTxt([
      {
        rfc: 'PRO990101AA1',
        nombre: 'PROVEEDOR NACIONAL',
        tipoTercero: '04',
        tipoOperacion: '03',
        actosPagados16: 10000,
        actosPagados8: 2000,
        actosPagados0: 500,
        actosExentos: 300,
        ivaAcreditable16: 1760,
        ivaRetenido: 1067
      },
      {
        rfc: 'XEXX010101000',
        nombre: 'SAP SE',
        tipoTercero: '05',
        tipoOperacion: '85',
        idFiscal: 'DE143593636',
        pais: 'DEU',
        nacionalidad: 'ALEMANA',
        actosPagados16: 0,
        actosExentos: 4000,
        ivaAcreditable16: 0,
        ivaRetenido: 0
      },
      {
        rfc: 'XAXX010101000',
        nombre: 'PUBLICO EN GENERAL',
        tipoTercero: '15',
        tipoOperacion: '85',
        actosPagados16: 5000,
        ivaAcreditable16: 800,
        ivaRetenido: 0
      }
    ]);

    const lines = txt.split('\n');
    expect(lines).toHaveLength(3);

    const nacCols = lines[0]!.split('|');
    expect(nacCols).toHaveLength(54);
    expect(nacCols[0]).toBe('04');
    expect(nacCols[1]).toBe('03');
    expect(nacCols[2]).toBe('PRO990101AA1');
    expect(nacCols[7]).toBe('2000'); // Campo 8: Frontera Norte 8%
    expect(nacCols[11]).toBe('10000'); // Campo 12: Actos pagados 16% nacional
    expect(nacCols[21]).toBe('1760'); // Campo 22: IVA acreditable 16%
    expect(nacCols[46]).toBe(''); // Campo 47: Exclusivo IVA no acreditable
    expect(nacCols[47]).toBe('1067'); // Campo 48: IVA retenido
    expect(nacCols[49]).toBe('300'); // Campo 50: Exento
    expect(nacCols[50]).toBe('500'); // Campo 51: 0%
    expect(nacCols[53]).toBe('01'); // Campo 54: Manifestación efectos fiscales

    const extCols = lines[1]!.split('|');
    expect(extCols).toHaveLength(54);
    expect(extCols[0]).toBe('05');
    expect(extCols[2]).toBe('');
    expect(extCols[3]).toBe('DE143593636');
    expect(extCols[4]).toBe('SAP SE');
    expect(extCols[5]).toBe('DEU');
    expect(extCols[6]).toBe('');
    expect(extCols[49]).toBe('4000');
    expect(extCols[53]).toBe('01');

    const globalCols = lines[2]!.split('|');
    expect(globalCols).toHaveLength(54);
    expect(globalCols[0]).toBe('15');
    expect(globalCols[2]).toBe('');
    expect(globalCols[11]).toBe('5000');
    expect(globalCols[21]).toBe('800');
    expect(globalCols[53]).toBe('01');
  });

  test('computeDiotReportData calcula bases e IVA para CFDI tipo P sin taxBreakdown desde relatedDocs y tasa del tercero', () => {
    const thirdParties: ThirdPartyRecord[] = [
      {
        id: 'tp_1',
        companyId: mockCompany.id,
        rfc: 'FRON800101AA1',
        nombre: 'PROVEEDOR FRONTERA 8%',
        rol: 'PROVEEDOR',
        cuentaOperacionCode: '601-01-003',
        cuentaContrapartidaCode: '201-01-099',
        tipoTerceroDiot: '04',
        tipoOperacionDiot: '85',
        tasaIvaDefault: 8,
        estatus69B: 'LIMPIO',
        updatedAt: '2026-10-01'
      }
    ];

    const repPago = makeCfdi({
      id: 'rep_1',
      uuid: 'REP-P20-NO-TB',
      tipoComprobante: 'P',
      emisorRfc: 'FRON800101AA1',
      emisorNombre: 'PROVEEDOR FRONTERA 8%',
      subtotal: 0,
      ivaTrasladado: 0,
      total: 0,
      taxBreakdown: null,
      relatedDocs: [
        {
          idDocumento: 'DOC-1',
          numParcialidad: 1,
          impSaldoAnt: 1080,
          impPagado: 1080,
          impSaldoInsoluto: 0,
          monedaDr: 'MXN'
        }
      ],
      polizaId: 'pol_rep'
    });

    const diot = computeDiotReportData({
      company: mockCompany,
      ejercicio: 2026,
      periodo: 10,
      cfdis: [repPago],
      polizaIdsInPeriod: new Set(['pol_rep']),
      trialBalance: [],
      thirdParties
    });

    expect(diot.rows).toHaveLength(1);
    expect(diot.rows[0]?.actosPagados8).toBe(1000);
    expect(diot.rows[0]?.ivaAcreditable16).toBe(80);
    expect(diot.rows[0]?.totalPagado).toBe(1080);
  });
});

describe('Ola 2 — P0-2 Parser CFDI 4.0 completo (Deno sat-soap-sync)', () => {
  test('decodifica entidades XML, extrae multi-tasa, Pagos 2.0 y Nómina 1.2', () => {
    const cfdi40Xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
  Version="4.0" Serie="F" Folio="102" Fecha="2026-10-18T11:20:00" FormaPago="03" MetodoPago="PPD"
  SubTotal="2500.00" Descuento="0.00" Moneda="MXN" TipoDeComprobante="I" Total="2740.00">
  <cfdi:CfdiRelacionados TipoRelacion="04">
    <cfdi:CfdiRelacionado UUID="11111111-2222-4333-8444-555555555555"/>
  </cfdi:CfdiRelacionados>
  <cfdi:Emisor Rfc="PRO990101AA1" Nombre="TECH &amp; CLOUD &quot;PRO&quot; SA"/>
  <cfdi:Receptor Rfc="COL260101AB1" Nombre="COMERCIALIZADORA OLA 2" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="81112100" Descripcion="Renta &amp; Soporte" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos><cfdi:Traslados><cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/></cfdi:Traslados></cfdi:Impuestos>
    </cfdi:Concepto>
    <cfdi:Concepto ClaveProdServ="81112100" Descripcion="Frontera" Importe="1000.00" ObjetoImp="02"/>
    <cfdi:Concepto ClaveProdServ="85121600" Descripcion="Exento" Importe="500.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="240.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.080000" Importe="80.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital UUID="AAAA1111-BBBB-4CCC-8DDD-EEEE22223333"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsed = parseCfdiFull(cfdi40Xml);
    expect(parsed).not.toBeNull();
    expect(parsed?.emisorNombre).toBe('TECH & CLOUD "PRO" SA');
    expect(parsed?.conceptoPrincipal).toBe('Renta & Soporte + Frontera + Exento');
    expect(parsed?.uuidRelacionado).toBe('11111111-2222-4333-8444-555555555555');
    expect(parsed?.taxBreakdown).toEqual({
      base16: 1000,
      iva16: 160,
      base8: 1000,
      iva8: 80,
      base0: 0,
      baseExento: 500,
      ieps: 0,
      objetoImp: '02'
    });

    const pagoXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-20T12:00:00" TipoDeComprobante="P" SubTotal="0" Total="0" Moneda="XXX">
  <cfdi:Emisor Rfc="PRO990101AA1" Nombre="EMISOR"/>
  <cfdi:Receptor Rfc="COL260101AB1" Nombre="RECEPTOR" UsoCFDI="CP01"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111506" Descripcion="Pago" Importe="0"/></cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Totales TotalTrasladosBaseIVA16="1000.00" TotalTrasladosImpuestoIVA16="160.00" MontoTotalPagos="1160.00"/>
      <pago20:Pago FechaPago="2026-10-20T12:00:00" FormaDePagoP="03" MonedaP="USD" TipoCambioP="20.00" Monto="58.00">
        <pago20:DoctoRelacionado IdDocumento="DOC-USD-99" MonedaDR="USD" EquivalenciaDR="1" NumParcialidad="2" ImpSaldoAnt="100.00" ImpPagado="58.00" ImpSaldoInsoluto="42.00"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital UUID="REP-FULL-1"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsedPago = parseCfdiFull(pagoXml);
    expect(parsedPago?.relatedDocs).toHaveLength(1);
    expect(parsedPago?.relatedDocs?.[0]?.equivalenciaDr).toBe(1);
    expect(parsedPago?.relatedDocs?.[0]?.pagoMoneda).toBe('USD');
    expect(parsedPago?.relatedDocs?.[0]?.pagoTipoCambio).toBe(20);
    expect(parsedPago?.taxBreakdown?.base16).toBe(1000);

    const nominaXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:nomina12="http://www.sat.gob.mx/nomina12" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-15T12:00:00" TipoDeComprobante="N" SubTotal="15000.00" Descuento="2000.00" Total="13000.00" Moneda="MXN">
  <cfdi:Emisor Rfc="COL260101AB1" Nombre="PATRON"/>
  <cfdi:Receptor Rfc="EMP800101AA1" Nombre="EMPLEADO" UsoCFDI="CN01"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111505" Descripcion="Pago de nómina" Importe="15000.00"/></cfdi:Conceptos>
  <cfdi:Complemento>
    <nomina12:Nomina Version="1.2" TotalPercepciones="14000.00" TotalOtrosPagos="1000.00" TotalDeducciones="2000.00">
      <nomina12:Deducciones TotalOtrasDeducciones="500.00" TotalImpuestosRetenidos="1500.00"/>
    </nomina12:Nomina>
    <tfd:TimbreFiscalDigital UUID="NOM-FULL-1"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsedNom = parseCfdiFull(nominaXml);
    expect(parsedNom?.subtotal).toBe(15000);
    expect(parsedNom?.isrRetenido).toBe(1500);
    expect(parsedNom?.descuento).toBe(500);
    expect(parsedNom?.total).toBe(13000);
  });
});

describe('Ola 2 — P0-4 69-B sin truncado + P1 Filtros/Totales ADD', () => {
  test('save69BDatabase retiene > 2,000 registros en memoria y merge69BCloudMatches actualiza checkRfc69BStatus', () => {
    const bulk: Sat69BRecord[] = Array.from({ length: 2500 }, (_, i) => ({
      rfc: `EFO${String(i).padStart(3, '0')}0101AA1`,
      nombre: `EFOS ${i}`,
      situacion: 'DEFINITIVO',
      status: 'DEFINITIVO_EFOS'
    }));
    save69BDatabase(bulk, { cloudSynced: true });
    expect(getLoaded69BDatabase().size).toBe(2500);

    merge69BCloudMatches([
      { rfc: 'CLD900101XX1', nombre: 'CLOUD EFOS', situacion: 'PRESUNTO', estatus69b: 'PRESUNTO_EFOS' }
    ]);
    const check = checkRfc69BStatus('CLD900101XX1');
    expect(check.isEfos).toBe(true);
    expect(check.status).toBe('PRESUNTO_EFOS');
    reset69BDatabaseCache();
  });

  test('filterCfdis separa E de I, filtra Estatus SAT / Forma Pago / Año y computeCfdiTotals excluye CANCELADO/T y resta E', () => {
    const list: CfdiDocument[] = [
      makeCfdi({ id: '1', uuid: 'U1', fecha: '2026-10-05', tipoComprobante: 'I', formaPago: '03', subtotal: 1000, ivaTrasladado: 160, total: 1160 }),
      makeCfdi({ id: '2', uuid: 'U2', fecha: '2026-10-06', tipoComprobante: 'E', formaPago: '03', subtotal: 200, ivaTrasladado: 32, total: 232 }),
      makeCfdi({ id: '3', uuid: 'U3', fecha: '2026-10-07', tipoComprobante: 'I', formaPago: '01', statusSat: 'CANCELADO', polizaId: 'pol_c', subtotal: 5000, ivaTrasladado: 800, total: 5800 }),
      makeCfdi({ id: '4', uuid: 'U4', fecha: '2026-10-08', tipoComprobante: 'T', formaPago: '99', subtotal: 100, ivaTrasladado: 0, total: 100 }),
      makeCfdi({ id: '5', uuid: 'U5', fecha: '2025-12-20', tipoComprobante: 'I', formaPago: '03', subtotal: 900, ivaTrasladado: 144, total: 1044 })
    ];

    const only2026 = filterCfdis(list, 'ALL', 'ALL', '', 'ALL', '2026-10');
    expect(only2026.map((c) => c.id)).toEqual(['1', '2', '3', '4']);

    const onlyI = filterCfdis(list, 'ALL', 'I', '', 'CURRENT', '2026-10');
    expect(onlyI.map((c) => c.id)).toEqual(['1', '3']);

    const onlyE = filterCfdis(list, 'ALL', 'E', '', 'CURRENT', '2026-10');
    expect(onlyE.map((c) => c.id)).toEqual(['2']);

    const cancelConPol = filterCfdis(list, 'ALL', 'ALL', '', 'CURRENT', '2026-10', 'ALL', 'CANCELADO_CON_POLIZA');
    expect(cancelConPol.map((c) => c.id)).toEqual(['3']);

    const cashOnly = filterCfdis(list, 'ALL', 'ALL', '', 'CURRENT', '2026-10', 'ALL', 'ALL', '01');
    expect(cashOnly.map((c) => c.id)).toEqual(['3']);

    const totals = computeCfdiTotals(only2026);
    expect(totals.subtotal).toBe(800); // 1000 - 200 (excluye CANCELADO y T)
    expect(totals.iva).toBe(128);
    expect(totals.total).toBe(928);
  });
});

describe('Ola 2 — P0-3 Anexo 24 v1.3 (BC, NumOrden/NumTramite, XF.xml, XC.xml)', () => {
  const accounts: AccountWithBalance[] = [
    {
      id: 'acc_1',
      companyId: mockCompany.id,
      code: '102-01-001',
      name: 'BBVA',
      parentCode: null,
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 2,
      isAffectable: true,
      satGroupCode: '102.01',
      currency: 'MXN',
      initialBalance: 10000,
      initialBalanceComputed: 10000,
      periodCharges: 1160,
      periodCredits: 0,
      finalBalance: 11160
    }
  ];

  const polizas: Poliza[] = [
    {
      id: 'pol_1',
      companyId: mockCompany.id,
      tipo: 'INGRESO',
      folio: 1,
      fecha: '2026-10-15',
      ejercicio: 2026,
      periodo: 10,
      concepto: 'Cobro cliente',
      cfdiUuid: '11111111-2222-4333-8444-555555555555',
      origin: 'MANUAL',
      totalCargos: 1160,
      totalAbonos: 1160,
      isBalanced: true,
      createdAt: '2026-10-15',
      movements: [
        {
          id: 'm1',
          polizaId: 'pol_1',
          accountId: 'acc_1',
          accountCode: '102-01-001',
          accountName: 'BBVA',
          referencia: 'SPEI-1',
          concepto: 'Cobro factura',
          cargo: 1160,
          abono: 0,
          cfdiUuid: '11111111-2222-4333-8444-555555555555',
          rfcContraparte: 'CLI010101AA1'
        }
      ]
    }
  ];

  test('valida NumOrden/NumTramite y genera BC.xml, PL.xml con folio real, XF.xml y XC.xml + .zip', () => {
    expect(isValidSatNumOrden('XYZ6654321/02')).toBe(true);
    expect(isValidSatNumOrden('XYZ7654321/02')).toBe(false);
    expect(isValidSatNumOrden('INVALIDO')).toBe(false);
    expect(isValidSatNumTramite('DE202600000001')).toBe(true);
    expect(isValidSatNumTramite('123')).toBe(false);

    const bc = buildSatAnexo24Xml(mockCompany, 2026, 10, 'balanza', accounts, [], {
      tipoEnvio: 'C',
      fechaModBal: '2026-11-05'
    });
    expect(bc.filename).toBe('COL260101AB1202610BC.xml');
    expect(bc.xml).toContain('TipoEnvio="C"');
    expect(bc.xml).toContain('FechaModBal="2026-11-05"');

    const pl = buildSatAnexo24Xml(mockCompany, 2026, 10, 'polizas', accounts, polizas, {
      tipoSolicitud: 'DE',
      numTramite: 'DE202600000009'
    });
    expect(pl.xml).toContain('TipoSolicitud="DE"');
    expect(pl.xml).toContain('NumTramite="DE202600000009"');

    const xf = buildSatAnexo24Xml(mockCompany, 2026, 10, 'auxiliar_folios', accounts, polizas, {
      tipoSolicitud: 'AF',
      numOrden: 'XYZ6654321/02'
    });
    expect(xf.filename).toBe('COL260101AB1202610XF.xml');
    expect(xf.xml).toContain('AuxiliarFolios_1_3.xsd');
    expect(xf.xml).toContain('NumOrden="XYZ6654321/02"');
    expect(xf.xml).toContain('<RepAux:ComprNal UUID_CFDI="11111111-2222-4333-8444-555555555555"');

    const xfZip = buildSatAnexo24Zip({
      company: mockCompany,
      year: 2026,
      period: 10,
      type: 'auxiliar_folios',
      xmlResult: xf
    });
    expect(xfZip.zipFilename).toBe('COL260101AB1202610XF.zip');
    expect(strFromU8(unzipSync(xfZip.zipBytes)[xf.filename]!)).toBe(xf.xml);

    const xc = buildSatAnexo24Xml(mockCompany, 2026, 10, 'auxiliar_cuentas', accounts, polizas, {
      tipoSolicitud: 'CO',
      numTramite: 'CO202600000077'
    });
    expect(xc.filename).toBe('COL260101AB1202610XC.xml');
    expect(xc.xml).toContain('AuxiliarCtas_1_3.xsd');
    expect(xc.xml).toContain('NumTramite="CO202600000077"');
    expect(xc.xml).toContain('<AuxiliarCtas:DetalleAux Fecha="2026-10-15" NumUnIdenPol="INGRESO-1"');

    const xcZip = buildSatAnexo24Zip({
      company: mockCompany,
      year: 2026,
      period: 10,
      type: 'auxiliar_cuentas',
      xmlResult: xc
    });
    expect(xcZip.zipFilename).toBe('COL260101AB1202610XC.zip');
    expect(strFromU8(unzipSync(xcZip.zipBytes)[xc.filename]!)).toBe(xc.xml);
  });
});
