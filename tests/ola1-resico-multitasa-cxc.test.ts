import { describe, expect, test } from 'bun:test';
import { parseCfdiXmlString } from '../src/shared/cfdi-xml';
import {
  computeCashBasisFiscalSummary,
  computeCxcCxpAging,
  computeFiscalWorkpaperFromTrialBalance
} from '../src/shared/accounting-engine';
import { computeDiotReportData } from '../src/shared/engine/diot.engine';
import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  TaxParametersRecord,
  ThirdPartyRecord
} from '../src/shared/types';

const baseResicoPfCompany: Company = {
  id: 'comp-resico-pf',
  name: 'ANA MARIA LOPEZ RUIZ',
  rfc: 'LORA880515AA1',
  regimenFiscal: '626 - Régimen Simplificado de Confianza',
  codigoPostal: '06700',
  maskFormat: 'XXX-XX-XXX',
  currentYear: 2026,
  currentPeriod: 10,
  createdAt: '2026-01-01'
};

const baseParams: TaxParametersRecord = {
  companyId: 'comp-resico-pf',
  ejercicio: 2026,
  coeficienteUtilidad: 0,
  perdidasFiscalesPendientes: 0,
  pagosProvisionalesAnteriores: 0,
  saldoFavorIvaAnterior: 0,
  tipoCambioDofCierre: 20.0
};

function makeCfdi(overrides: Partial<CfdiDocument> & Pick<CfdiDocument, 'id' | 'uuid'>): CfdiDocument {
  return {
    companyId: baseResicoPfCompany.id,
    fecha: '2026-10-10',
    tipoComprobante: 'I',
    direction: 'EMITIDO',
    serie: 'A',
    folio: '1',
    emisorRfc: baseResicoPfCompany.rfc,
    emisorNombre: baseResicoPfCompany.name,
    receptorRfc: 'CLI010101AA1',
    receptorNombre: 'CLIENTE DEMO SA',
    conceptoPrincipal: 'Servicios profesionales',
    claveProdServ: '80101500',
    moneda: 'MXN',
    tipoCambio: 1,
    subtotal: 10000,
    descuento: 0,
    ivaTrasladado: 1600,
    isrRetenido: 0,
    ivaRetenido: 0,
    total: 11600,
    metodoPago: 'PUE',
    formaPago: '03',
    usoCfdi: 'G03',
    statusSat: 'VIGENTE',
    polizaId: null,
    xmlRaw: '',
    ...overrides
  };
}

describe('Ola 1 Bloque 1A — Multi-tasa, Flujo RESICO, Prorrateo IVA, CxC/CxP y DIOT', () => {
  test('1. XML Parser extracts multi-rate taxBreakdown (16%, 8%, 0%, Exento via ObjetoImp 01/03, IEPS)', () => {
    const multiRateXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-12T10:00:00" TipoDeComprobante="I" SubTotal="2550.00" Total="2856.00" Moneda="MXN" MetodoPago="PUE">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Proveedor Multi" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Cliente Demo" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="50111500" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto 16 y IEPS" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02"/>
    <cfdi:Concepto ClaveProdServ="50111500" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto Frontera 8%" ValorUnitario="500.00" Importe="500.00" ObjetoImp="02"/>
    <cfdi:Concepto ClaveProdServ="50111500" Cantidad="1" ClaveUnidad="H87" Descripcion="Alimento Tasa 0%" ValorUnitario="300.00" Importe="300.00" ObjetoImp="02"/>
    <cfdi:Concepto ClaveProdServ="85121600" Cantidad="1" ClaveUnidad="E48" Descripcion="Servicio Médico ObjetoImp 01" ValorUnitario="200.00" Importe="200.00" ObjetoImp="01"/>
    <cfdi:Concepto ClaveProdServ="85121600" Cantidad="1" ClaveUnidad="E48" Descripcion="Operación ObjetoImp 03" ValorUnitario="150.00" Importe="150.00" ObjetoImp="03"/>
    <cfdi:Concepto ClaveProdServ="50202200" Cantidad="1" ClaveUnidad="H87" Descripcion="Bebida IEPS" ValorUnitario="400.00" Importe="400.00" ObjetoImp="02"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="306.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
      <cfdi:Traslado Base="500.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.080000" Importe="40.00"/>
      <cfdi:Traslado Base="300.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.000000" Importe="0.00"/>
      <cfdi:Traslado Base="400.00" Impuesto="003" TipoFactor="Tasa" TasaOCuota="0.265000" Importe="106.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital UUID="11111111-AAAA-4111-8111-111111111111" FechaTimbrado="2026-10-12T10:05:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsed = parseCfdiXmlString(multiRateXml);
    expect(parsed.ivaTrasladado).toBe(200); // Solo IVA 002 (160 + 40), excluye IEPS 003
    expect(parsed.taxBreakdown).toEqual({
      base16: 1000,
      iva16: 160,
      base8: 500,
      iva8: 40,
      base0: 300,
      baseExento: 350,
      ieps: 106,
      objetoImp: '02'
    });
  });

  test('2. XML Parser extracts full relatedDocs and multi-rate Totales from Pago 2.0 (Tipo P)', () => {
    const pago20Xml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-20T15:00:00" TipoDeComprobante="P" SubTotal="0" Total="0" Moneda="XXX">
  <cfdi:Emisor Rfc="LORA880515AA1" Nombre="ANA MARIA LOPEZ" RegimenFiscal="626"/>
  <cfdi:Receptor Rfc="CLI010101AA1" Nombre="CLIENTE PM SA" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Totales TotalTrasladosBaseIVA16="10000.00" TotalTrasladosImpuestoIVA16="1600.00" TotalTrasladosBaseIVA8="5000.00" TotalTrasladosImpuestoIVA8="400.00" TotalRetencionesISR="187.50" MontoTotalPagos="16812.50"/>
      <pago20:Pago FechaPago="2026-10-20T14:55:00" FormaDePagoP="03" MonedaP="MXN" Monto="16812.50">
        <pago20:DoctoRelacionado IdDocumento="AAAAAAAA-1111-4111-8111-111111111111" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="23200.00" ImpPagado="11475.00" ImpSaldoInsoluto="11725.00" ObjetoImpDR="02"/>
        <pago20:DoctoRelacionado IdDocumento="BBBBBBBB-2222-4222-8222-222222222222" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="2" ImpSaldoAnt="5337.50" ImpPagado="5337.50" ImpSaldoInsoluto="0.00" ObjetoImpDR="02"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital UUID="99999999-9999-4999-8999-999999999999" FechaTimbrado="2026-10-20T15:01:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsed = parseCfdiXmlString(pago20Xml);
    expect(parsed.tipoComprobante).toBe('P');
    expect(parsed.isrRetenido).toBe(187.5);
    expect(parsed.relatedDocs).toHaveLength(2);
    expect(parsed.relatedDocs![0]).toEqual({
      idDocumento: 'AAAAAAAA-1111-4111-8111-111111111111',
      numParcialidad: 1,
      impSaldoAnt: 23200,
      impPagado: 11475,
      impSaldoInsoluto: 11725,
      monedaDr: 'MXN',
      equivalenciaDr: 1,
      fechaPago: '2026-10-20'
    });
    expect(parsed.taxBreakdown).toEqual({
      base16: 10000,
      iva16: 1600,
      base8: 5000,
      iva8: 400,
      base0: 0,
      baseExento: 0,
      ieps: 0
    });
  });

  test('3. Cash-basis RESICO PF excludes unpaid PPD, includes PUE + Tipo P - Credit Notes, and credits 1.25% ISR retention', () => {
    const cfdis: CfdiDocument[] = [
      // PUE cobrado: +20,000, ret 1.25% = 250
      makeCfdi({ id: 'c1', uuid: 'U1', metodoPago: 'PUE', subtotal: 20000, ivaTrasladado: 3200, isrRetenido: 250, total: 22950 }),
      // PPD emitido sin cobrar en este mes: debe EXCLUIRSE de flujo RESICO!
      makeCfdi({ id: 'c2', uuid: 'U2', metodoPago: 'PPD', subtotal: 50000, ivaTrasladado: 8000, isrRetenido: 625, total: 57375 }),
      // Pago 2.0 (REP) cobrando 10,000 + IVA 1,600 - ret 125
      makeCfdi({
        id: 'c3',
        uuid: 'U3',
        tipoComprobante: 'P',
        metodoPago: 'PUE',
        subtotal: 10000,
        ivaTrasladado: 1600,
        isrRetenido: 125,
        total: 11475,
        relatedDocs: [{ idDocumento: 'U2', numParcialidad: 1, impSaldoAnt: 57375, impPagado: 11475, impSaldoInsoluto: 45900 }]
      }),
      // Nota de Crédito emitida: -2,000
      makeCfdi({ id: 'c4', uuid: 'U4', tipoComprobante: 'E', metodoPago: 'PUE', subtotal: 2000, ivaTrasladado: 320, isrRetenido: 0, total: 2320 })
    ];

    // Balanza contable artificial devengada ($70,000) para verificar prioridad de flujo ($28,000)
    const tb: AccountWithBalance[] = [
      {
        id: 'acc_ing',
        companyId: baseResicoPfCompany.id,
        code: '401-01-001',
        name: 'Ingresos devengados',
        parentCode: null,
        type: 'INGRESOS',
        nature: 'ACREEDORA',
        level: 3,
        isAffectable: true,
        satGroupCode: '401.01',
        currency: 'MXN',
        initialBalance: 0,
        initialBalanceComputed: 0,
        periodCharges: 0,
        periodCredits: 70000,
        finalBalance: 70000
      }
    ];

    const wp = computeFiscalWorkpaperFromTrialBalance({
      company: baseResicoPfCompany,
      ejercicio: 2026,
      periodo: 10,
      parameters: baseParams,
      trialBalance: tb,
      cfdis
    });

    // Ingresos flujo = 20,000 + 10,000 - 2,000 = 28,000 (excluye PPD 50,000)
    expect(wp.isrProvisional.ingresosPeriodo).toBe(28000);
    // Tasa RESICO PF para $28,000 (bracket <= $50,000): 1.10% -> ISR = 308
    expect(wp.isrProvisional.tasaIsrPct).toBe(1.1);
    expect(wp.isrProvisional.isrCausado).toBe(308);
    // Retención 1.25% = 250 + 125 = 375 -> ISR neto = max(0, 308 - 375) = 0
    expect(wp.isrProvisional.isrRetenidoPeriodo).toBe(375);
    expect(wp.isrProvisional.isrNetoAPagar).toBe(0);
    expect(wp.cashBasisSummary).toEqual({
      isCashBasisRegime: true,
      baseContableDevengada: 70000,
      ingresosCobradosFlujo: 28000,
      deduccionesPagadasFlujo: 0,
      retencionResico125: 375,
      pueIngresos: 20000,
      repIngresos: 10000,
      creditNotesRestados: 2000
    });
  });

  test('4. RESICO threshold alert (Semáforo) handles 3.5M PF and 35M PM across OK, WARNING_80, CRITICAL_95, EXCEEDED', () => {
    const pfWarning = computeCashBasisFiscalSummary({
      company: baseResicoPfCompany,
      ejercicio: 2026,
      periodo: 10,
      cfdis: [makeCfdi({ id: 'w1', uuid: 'W1', subtotal: 2_850_000, ivaTrasladado: 456000, total: 3_306_000 })]
    });
    expect(pfWarning.resicoThresholdAlert.thresholdMxn).toBe(3_500_000);
    expect(pfWarning.resicoThresholdAlert.status).toBe('WARNING_80');

    const pfCritical = computeCashBasisFiscalSummary({
      company: baseResicoPfCompany,
      ejercicio: 2026,
      periodo: 10,
      cfdis: [makeCfdi({ id: 'c1', uuid: 'C1', subtotal: 3_360_000, ivaTrasladado: 0, total: 3_360_000 })]
    });
    expect(pfCritical.resicoThresholdAlert.status).toBe('CRITICAL_95');

    const pfExceeded = computeCashBasisFiscalSummary({
      company: baseResicoPfCompany,
      ejercicio: 2026,
      periodo: 10,
      cfdis: [makeCfdi({ id: 'e1', uuid: 'E1', subtotal: 3_550_000, ivaTrasladado: 0, total: 3_550_000 })]
    });
    expect(pfExceeded.resicoThresholdAlert.status).toBe('EXCEEDED');

    const pmCompany: Company = { ...baseResicoPfCompany, id: 'comp-pm', rfc: 'IDN2201019K2' };
    const pmExceeded = computeCashBasisFiscalSummary({
      company: pmCompany,
      ejercicio: 2026,
      periodo: 10,
      cfdis: [makeCfdi({ id: 'm1', uuid: 'M1', emisorRfc: pmCompany.rfc, subtotal: 35_100_000, ivaTrasladado: 0, total: 35_100_000 })]
    });
    expect(pmExceeded.resicoThresholdAlert.thresholdMxn).toBe(35_000_000);
    expect(pmExceeded.resicoThresholdAlert.status).toBe('EXCEEDED');
  });

  test('5. Art. 5 LIVA Proration Factor apportions creditable IVA when mixed taxable and exempt sales exist', () => {
    const pfActEmp: Company = {
      ...baseResicoPfCompany,
      regimenFiscal: '612 - Personas Físicas con Actividades Empresariales y Profesionales'
    };
    const cfdis: CfdiDocument[] = [
      // Emitidos: $80,000 gravados (16%+8%+0%) y $20,000 exentos -> factor = 0.80
      makeCfdi({
        id: 'em-mix',
        uuid: 'EM-MIX',
        direction: 'EMITIDO',
        subtotal: 100000,
        ivaTrasladado: 9600,
        total: 109600,
        taxBreakdown: {
          base16: 50000,
          iva16: 8000,
          base8: 20000,
          iva8: 1600,
          base0: 10000,
          baseExento: 20000,
          ieps: 0
        }
      }),
      // Recibido pagado PUE: $100,000 + $16,000 IVA + $500 IEPS
      makeCfdi({
        id: 'rec-gasto',
        uuid: 'REC-GASTO',
        direction: 'RECIBIDO',
        emisorRfc: 'PRO880101AA1',
        receptorRfc: pfActEmp.rfc,
        subtotal: 100000,
        ivaTrasladado: 16000,
        total: 116500,
        taxBreakdown: {
          base16: 100000,
          iva16: 16000,
          base8: 0,
          iva8: 0,
          base0: 0,
          baseExento: 0,
          ieps: 500
        }
      })
    ];

    const wp = computeFiscalWorkpaperFromTrialBalance({
      company: pfActEmp,
      ejercicio: 2026,
      periodo: 10,
      parameters: baseParams,
      trialBalance: [],
      cfdis
    });

    expect(wp.ivaBreakdown).toEqual({
      base16: 50000,
      base8: 20000,
      base0: 10000,
      baseExento: 20000,
      iepsAcreditable: 500,
      prorationFactor: 0.8,
      ivaAcreditableSinProrrateo: 16000,
      ivaAcreditableProrrateado: 12800
    });
    expect(wp.ivaDefinitivo.ivaTrasladadoCobrado).toBe(9600);
    expect(wp.ivaDefinitivo.ivaAcreditablePagado).toBe(12800);
    expect(wp.ivaDefinitivo.saldoFavorIvaRemanente).toBe(3200);
  });

  test('6. CxC/CxP Aging PPD computes partial payments (Tipo P & E), FX conversion, and exact CDMX calendar days', () => {
    const cfdis: CfdiDocument[] = [
      // CxC 1 (15 días -> 0_30), parcialidad de $5,000 sobre $11,600
      makeCfdi({ id: 'ppd-1', uuid: 'UUID-PPD-1', fecha: '2026-10-16', metodoPago: 'PPD', total: 11600 }),
      makeCfdi({
        id: 'rep-1',
        uuid: 'UUID-REP-1',
        fecha: '2026-10-25',
        tipoComprobante: 'P',
        total: 5000,
        relatedDocs: [{ idDocumento: 'UUID-PPD-1', numParcialidad: 1, impSaldoAnt: 11600, impPagado: 5000, impSaldoInsoluto: 6600 }]
      }),
      // CxC 2 en USD (45 días -> 31_60), $1,000 USD * TC 20 = $20,000 MXN, Nota Crédito $200 USD * TC 20 = $4,000 MXN -> saldo $16,000
      makeCfdi({ id: 'ppd-usd', uuid: 'UUID-PPD-USD', fecha: '2026-09-16', metodoPago: 'PPD', moneda: 'USD', tipoCambio: 20, total: 1000 }),
      makeCfdi({ id: 'nc-usd', uuid: 'UUID-NC-USD', fecha: '2026-09-20', tipoComprobante: 'E', moneda: 'USD', tipoCambio: 20, total: 200, uuidRelacionado: 'UUID-PPD-USD' }),
      // CxC 3 ya pagada 100% -> NO debe aparecer en saldos insolutos
      makeCfdi({ id: 'ppd-paid', uuid: 'UUID-PPD-PAID', fecha: '2026-08-01', metodoPago: 'PPD', total: 2000 }),
      makeCfdi({ id: 'rep-paid', uuid: 'UUID-REP-PAID', fecha: '2026-08-15', tipoComprobante: 'P', total: 2000, uuidRelacionado: 'UUID-PPD-PAID' }),
      // CxP (RECIBIDO, 100 días -> 90_PLUS)
      makeCfdi({
        id: 'cxp-1',
        uuid: 'UUID-CXP-1',
        fecha: '2026-07-23',
        direction: 'RECIBIDO',
        emisorRfc: 'PRO010101AA1',
        emisorNombre: 'PROVEEDOR ANTIGUO',
        receptorRfc: baseResicoPfCompany.rfc,
        metodoPago: 'PPD',
        total: 15000
      })
    ];

    const aging = computeCxcCxpAging({
      companyId: baseResicoPfCompany.id,
      cfdis,
      asOfIso: '2026-10-31'
    });

    expect(aging.asOfDate).toBe('2026-10-31');
    expect(aging.cxcItems).toHaveLength(2);
    expect(aging.cxpItems).toHaveLength(1);
    expect(aging.cxcTotal).toBe(22600);
    expect(aging.cxcBuckets).toEqual({
      '0_30': 6600,
      '31_60': 16000,
      '61_90': 0,
      '90_PLUS': 0
    });
    expect(aging.cxpTotal).toBe(15000);
    expect(aging.cxpBuckets['90_PLUS']).toBe(15000);
    expect(aging.cxcItems.find((i) => i.uuid === 'UUID-PPD-1')?.daysPast).toBe(15);
    expect(aging.cxcItems.find((i) => i.uuid === 'UUID-PPD-USD')?.saldoInsolutoMxn).toBe(16000);
  });

  test('7. DIOT prioritizes ThirdPartyRecord classifications, maps 8%/0%/Exento/IEPS bases, and sanitizes "|" in nombre', () => {
    const thirdParties: ThirdPartyRecord[] = [
      {
        id: 'tp-1',
        companyId: baseResicoPfCompany.id,
        rfc: 'EXT990101XX1',
        nombre: 'AWS|CLOUD|CORP',
        rol: 'PROVEEDOR',
        cuentaOperacionCode: '601-01-001',
        cuentaContrapartidaCode: '201-01-001',
        tipoTerceroDiot: '05',
        tipoOperacionDiot: '03',
        tasaIvaDefault: 8,
        estatus69B: 'LIMPIO',
        updatedAt: '2026-10-01'
      }
    ];

    const cfdis: CfdiDocument[] = [
      makeCfdi({
        id: 'diot-1',
        uuid: 'DIOT-1',
        direction: 'RECIBIDO',
        emisorRfc: 'EXT990101XX1',
        emisorNombre: 'AWS|CLOUD|CORP',
        receptorRfc: baseResicoPfCompany.rfc,
        conceptoPrincipal: 'Compra de licencia genérica',
        polizaId: 'pol-1',
        subtotal: 2000,
        ivaTrasladado: 240,
        total: 2340,
        taxBreakdown: {
          base16: 1000,
          iva16: 160,
          base8: 1000,
          iva8: 80,
          base0: 500,
          baseExento: 250,
          ieps: 100
        }
      })
    ];

    const diot = computeDiotReportData({
      company: baseResicoPfCompany,
      ejercicio: 2026,
      periodo: 10,
      cfdis,
      polizaIdsInPeriod: new Set(['pol-1']),
      trialBalance: [],
      thirdParties
    });

    expect(diot.rows).toHaveLength(1);
    const row = diot.rows[0]!;
    expect(row.tipoTercero).toBe('05');
    expect(row.tipoOperacion).toBe('03');
    expect(row.actosPagados16).toBe(1000);
    expect(row.actosPagados8).toBe(1000);
    expect(row.actosPagados0).toBe(500);
    expect(row.actosExentos).toBe(250);
    expect(row.iepsPagado).toBe(100);

    const cols = row.batchLine.split('|');
    expect(cols).toHaveLength(54);
    expect(cols[0]).toBe('05');
    expect(cols[1]).toBe('03');
    expect(cols[4]).toBe('AWS CLOUD CORP');
    expect(cols[7]).toBe('1000'); // Base 8% Región Fronteriza
    expect(cols[11]).toBe('1000'); // Base 16%
    expect(cols[17]).toBe('80'); // IVA acreditable 8%
    expect(cols[21]).toBe('160'); // IVA acreditable 16%
    expect(cols[49]).toBe('250'); // Actos exentos (campo 50)
    expect(cols[50]).toBe('500'); // Actos pagados 0% (campo 51)
    expect(cols[53]).toBe('01');
  });
});
