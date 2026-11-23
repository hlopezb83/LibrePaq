import { describe, expect, test } from 'bun:test';
import { parseCfdiXmlString } from '../src/shared/cfdi-xml';
import {
  computeCashBasisFiscalSummary,
  computeCxcCxpAging,
  computeFiscalWorkpaperFromTrialBalance
} from '../src/shared/accounting-engine';
import { computeDiotReportData } from '../src/shared/engine/diot.engine';
import type { CfdiDocument, Company, TaxParametersRecord } from '../src/shared/types';

const companyResico: Company = {
  id: 'comp-ronda3-b1',
  name: 'DESPACHO FISCAL PRUEBA SA',
  rfc: 'LORA880515AA1',
  regimenFiscal: '626 - Régimen Simplificado de Confianza',
  codigoPostal: '06700',
  maskFormat: 'XXX-XX-XXX',
  currentYear: 2026,
  currentPeriod: 10,
  createdAt: '2026-01-01'
};

const taxParams: TaxParametersRecord = {
  companyId: companyResico.id,
  ejercicio: 2026,
  coeficienteUtilidad: 0.2,
  perdidasFiscalesPendientes: 0,
  pagosProvisionalesAnteriores: 0,
  saldoFavorIvaAnterior: 0,
  tipoCambioDofCierre: 20.0
};

function makeCfdi(overrides: Partial<CfdiDocument> & Pick<CfdiDocument, 'id' | 'uuid'>): CfdiDocument {
  return {
    companyId: companyResico.id,
    fecha: '2026-10-10',
    tipoComprobante: 'I',
    direction: 'EMITIDO',
    serie: 'A',
    folio: '1',
    emisorRfc: companyResico.rfc,
    emisorNombre: companyResico.name,
    receptorRfc: 'CLI010101AA1',
    receptorNombre: 'CLIENTE DEMO SA',
    conceptoPrincipal: 'Servicios profesionales',
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
    polizaId: null,
    xmlRaw: '',
    ...overrides
  };
}

describe('Ronda 3 Bloque 1 — XML Pagos 2.0/Exento, CxC FX, DIOT, USD PPD y Flujo NC PPD', () => {
  test('[BUG-07] parsePago20Complement preserva MonedaP/TipoCambioP con Totales MXN y CxC liquida $1,000 MXN por factura USD', () => {
    const repUsdWithTotalesXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-20T12:00:00" TipoDeComprobante="P" SubTotal="0" Total="0" Moneda="XXX">
  <cfdi:Emisor Rfc="${companyResico.rfc}" Nombre="${companyResico.name}" RegimenFiscal="626"/>
  <cfdi:Receptor Rfc="CLI010101AA1" Nombre="CLIENTE USD" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Totales MontoTotalPagos="2000.00"/>
      <pago20:Pago FechaPago="2026-10-20T12:00:00" FormaDePagoP="03" MonedaP="USD" TipoCambioP="20.00" Monto="100.00">
        <pago20:DoctoRelacionado IdDocumento="USD-INV-1" MonedaDR="USD" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="100.00" ImpPagado="50.00" ImpSaldoInsoluto="50.00" ObjetoImpDR="02"/>
        <pago20:DoctoRelacionado IdDocumento="USD-INV-2" MonedaDR="USD" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="100.00" ImpPagado="50.00" ImpSaldoInsoluto="50.00" ObjetoImpDR="02"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital UUID="REP-USD-TOT-1" FechaTimbrado="2026-10-20T12:05:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsedRep = parseCfdiXmlString(repUsdWithTotalesXml);
    expect(parsedRep.moneda).toBe('MXN');
    expect(parsedRep.total).toBe(2000);
    expect(parsedRep.relatedDocs).toHaveLength(2);
    expect(parsedRep.relatedDocs![0]?.pagoMoneda).toBe('USD');
    expect(parsedRep.relatedDocs![0]?.pagoTipoCambio).toBe(20);
    expect(parsedRep.relatedDocs![1]?.pagoMoneda).toBe('USD');
    expect(parsedRep.relatedDocs![1]?.pagoTipoCambio).toBe(20);

    const inv1 = makeCfdi({ id: 'i1', uuid: 'USD-INV-1', fecha: '2026-10-01', moneda: 'USD', tipoCambio: 20, metodoPago: 'PPD', total: 100 });
    const inv2 = makeCfdi({ id: 'i2', uuid: 'USD-INV-2', fecha: '2026-10-01', moneda: 'USD', tipoCambio: 20, metodoPago: 'PPD', total: 100 });
    const repDoc = makeCfdi({
      id: 'r1',
      uuid: parsedRep.uuid,
      fecha: parsedRep.fecha,
      tipoComprobante: 'P',
      moneda: parsedRep.moneda,
      tipoCambio: parsedRep.tipoCambio,
      total: parsedRep.total,
      relatedDocs: parsedRep.relatedDocs
    });

    const aging = computeCxcCxpAging({
      companyId: companyResico.id,
      cfdis: [inv1, inv2, repDoc],
      asOfIso: '2026-10-31'
    });

    expect(aging.cxcItems).toHaveLength(2);
    expect(aging.cxcItems[0]?.totalPagadoMxn).toBe(1000);
    expect(aging.cxcItems[0]?.saldoInsolutoMxn).toBe(1000);
    expect(aging.cxcItems[1]?.totalPagadoMxn).toBe(1000);
    expect(aging.cxcItems[1]?.saldoInsolutoMxn).toBe(1000);
    expect(aging.cxcTotal).toBe(2000);
  });

  test('[BUG-07] parsePago20Complement sin Totales normaliza múltiples Pago USD+MXN a MXN y conserva moneda cuando todos son USD', () => {
    const mixedPagosXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-21T12:00:00" TipoDeComprobante="P" SubTotal="0" Total="0" Moneda="XXX">
  <cfdi:Emisor Rfc="${companyResico.rfc}" Nombre="${companyResico.name}" RegimenFiscal="626"/>
  <cfdi:Receptor Rfc="CLI010101AA1" Nombre="CLIENTE MIXTO" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="CP01"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/></cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Pago FechaPago="2026-10-21T12:00:00" FormaDePagoP="03" MonedaP="USD" TipoCambioP="20.00" Monto="50.00">
        <pago20:DoctoRelacionado IdDocumento="DOC-USD-1" MonedaDR="USD" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="50.00" ImpPagado="50.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="02"/>
      </pago20:Pago>
      <pago20:Pago FechaPago="2026-10-21T12:00:00" FormaDePagoP="03" MonedaP="MXN" Monto="1000.00">
        <pago20:DoctoRelacionado IdDocumento="DOC-MXN-1" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="1000.00" ImpPagado="1000.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="02"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital UUID="REP-MIX-NO-TOT" FechaTimbrado="2026-10-21T12:05:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsedMixed = parseCfdiXmlString(mixedPagosXml);
    expect(parsedMixed.moneda).toBe('MXN');
    expect(parsedMixed.tipoCambio).toBe(1);
    expect(parsedMixed.total).toBe(2000);
    expect(parsedMixed.relatedDocs![0]?.pagoMoneda).toBe('USD');
    expect(parsedMixed.relatedDocs![0]?.pagoTipoCambio).toBe(20);
    expect(parsedMixed.relatedDocs![1]?.pagoMoneda).toBeUndefined();

    const pureUsdNoTotXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-21T12:00:00" TipoDeComprobante="P" SubTotal="0" Total="0" Moneda="XXX">
  <cfdi:Emisor Rfc="${companyResico.rfc}" Nombre="${companyResico.name}" RegimenFiscal="626"/>
  <cfdi:Receptor Rfc="CLI010101AA1" Nombre="CLIENTE USD" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="CP01"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/></cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Pago FechaPago="2026-10-21T12:00:00" FormaDePagoP="03" MonedaP="USD" TipoCambioP="20.00" Monto="100.00">
        <pago20:DoctoRelacionado IdDocumento="DOC-USD-2" MonedaDR="USD" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="100.00" ImpPagado="100.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="02"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital UUID="REP-USD-NO-TOT" FechaTimbrado="2026-10-21T12:05:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsedUsd = parseCfdiXmlString(pureUsdNoTotXml);
    expect(parsedUsd.moneda).toBe('USD');
    expect(parsedUsd.tipoCambio).toBe(20);
    expect(parsedUsd.total).toBe(100);
  });

  test('[BUG-50] resolveDrPaidMxn no multiplica ImpPagado por TipoCambioP cuando MonedaDR="MXN" en un REP USD', () => {
    const invMxn = makeCfdi({
      id: 'inv-mxn-1',
      uuid: 'INV-MXN-50',
      fecha: '2026-10-05',
      moneda: 'MXN',
      tipoCambio: 1,
      metodoPago: 'PPD',
      total: 5000
    });
    const repUsdPayingMxn = makeCfdi({
      id: 'rep-usd-50',
      uuid: 'REP-USD-50',
      fecha: '2026-10-20',
      tipoComprobante: 'P',
      moneda: 'USD',
      tipoCambio: 20,
      total: 100,
      relatedDocs: [
        {
          idDocumento: 'INV-MXN-50',
          numParcialidad: 1,
          impSaldoAnt: 5000,
          impPagado: 2000,
          impSaldoInsoluto: 3000,
          monedaDr: 'MXN',
          equivalenciaDr: 20,
          pagoMoneda: 'USD',
          pagoTipoCambio: 20
        }
      ]
    });

    const aging = computeCxcCxpAging({
      companyId: companyResico.id,
      cfdis: [invMxn, repUsdPayingMxn],
      asOfIso: '2026-10-31'
    });

    expect(aging.cxcItems).toHaveLength(1);
    expect(aging.cxcItems[0]?.totalPagadoMxn).toBe(2000);
    expect(aging.cxcItems[0]?.saldoInsolutoMxn).toBe(3000);
  });

  test('[BUG-31] extractCfdiTaxBreakdown acumula baseExento de <Concepto> con TipoFactor="Exento" aun cuando rootTraslados.length > 0', () => {
    const mixedExentoXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-12T10:00:00" TipoDeComprobante="I" SubTotal="1700.00" Total="1860.00" Moneda="MXN" MetodoPago="PUE">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Emisor Mixto" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="50111500" Cantidad="1" ClaveUnidad="H87" Descripcion="Gravado 16%" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos><cfdi:Traslados><cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/></cfdi:Traslados></cfdi:Impuestos>
    </cfdi:Concepto>
    <cfdi:Concepto ClaveProdServ="85121600" Cantidad="1" ClaveUnidad="E48" Descripcion="Exento explícito SAT" ValorUnitario="500.00" Importe="500.00" ObjetoImp="02">
      <cfdi:Impuestos><cfdi:Traslados><cfdi:Traslado Base="500.00" Impuesto="002" TipoFactor="Exento"/></cfdi:Traslados></cfdi:Impuestos>
    </cfdi:Concepto>
    <cfdi:Concepto ClaveProdServ="85121600" Cantidad="1" ClaveUnidad="E48" Descripcion="No objeto 01" ValorUnitario="200.00" Importe="200.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital UUID="EXENTO-CONCEPTO-31" FechaTimbrado="2026-10-12T10:05:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsed = parseCfdiXmlString(mixedExentoXml);
    expect(parsed.ivaTrasladado).toBe(160);
    expect(parsed.taxBreakdown).toEqual({
      base16: 1000,
      iva16: 160,
      base8: 0,
      iva8: 0,
      base0: 0,
      baseExento: 700,
      ieps: 0,
      objetoImp: '02'
    });
  });

  test('[BUG-25] DIOT excluye CFDIs de Nómina (N) e incluye actosPagados8 en totals.actosPagados16', () => {
    const cfdis: CfdiDocument[] = [
      makeCfdi({
        id: 'nom-1',
        uuid: 'NOM-1',
        direction: 'RECIBIDO',
        tipoComprobante: 'N',
        emisorRfc: 'PAT010101AA1',
        emisorNombre: 'PATRON SA',
        polizaId: 'pol-nom',
        subtotal: 15000,
        ivaTrasladado: 0,
        total: 14000
      }),
      makeCfdi({
        id: 'prov-16',
        uuid: 'PROV-16',
        direction: 'RECIBIDO',
        emisorRfc: 'PRO160101AA1',
        emisorNombre: 'PROVEEDOR 16 SA',
        polizaId: 'pol-16',
        subtotal: 2000,
        ivaTrasladado: 320,
        total: 2320,
        taxBreakdown: { base16: 2000, iva16: 320, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 0 }
      }),
      makeCfdi({
        id: 'prov-8',
        uuid: 'PROV-8',
        direction: 'RECIBIDO',
        emisorRfc: 'PRO080101AA1',
        emisorNombre: 'PROVEEDOR FRONTERA 8 SA',
        polizaId: 'pol-8',
        subtotal: 1000,
        ivaTrasladado: 80,
        total: 1080,
        taxBreakdown: { base16: 0, iva16: 0, base8: 1000, iva8: 80, base0: 0, baseExento: 0, ieps: 0 }
      })
    ];

    const diot = computeDiotReportData({
      company: companyResico,
      ejercicio: 2026,
      periodo: 10,
      cfdis,
      polizaIdsInPeriod: new Set(['pol-nom', 'pol-16', 'pol-8']),
      trialBalance: []
    });

    expect(diot.rows.some((r) => r.rfc === 'PAT010101AA1')).toBe(false);
    expect(diot.rows).toHaveLength(2);
    expect(diot.totals.actosPagados16).toBe(3000);
    expect(diot.totals.ivaAcreditable16).toBe(400);
  });

  test('[BUG-26] Fluctuación cambiaria USD PPD usa saldo insoluto real al corte del periodo via relatedDocs y uuidRelacionado', () => {
    const cfdis: CfdiDocument[] = [
      // Factura USD PPD #1: $1,000 USD a TC 19.00
      makeCfdi({ id: 'usd-1', uuid: 'USD-PPD-1', fecha: '2026-10-05', metodoPago: 'PPD', moneda: 'USD', tipoCambio: 19.0, subtotal: 1000, ivaTrasladado: 0, total: 1000 }),
      // Factura USD PPD #2: $500 USD a TC 19.00 (2do doc en relatedDocs del REP de Oct)
      makeCfdi({ id: 'usd-2', uuid: 'USD-PPD-2', fecha: '2026-10-06', metodoPago: 'PPD', moneda: 'USD', tipoCambio: 19.0, subtotal: 500, ivaTrasladado: 0, total: 500 }),
      // Factura USD PPD #3 futura (Diciembre): debe ignorarse en Octubre
      makeCfdi({ id: 'usd-3', uuid: 'USD-PPD-3', fecha: '2026-12-01', metodoPago: 'PPD', moneda: 'USD', tipoCambio: 21.0, subtotal: 800, ivaTrasladado: 0, total: 800 }),
      // REP de Octubre: paga $400 USD de USD-PPD-1 (saldo insoluto 600) y liquida 100% USD-PPD-2
      makeCfdi({
        id: 'rep-oct',
        uuid: 'REP-OCT',
        fecha: '2026-10-20',
        tipoComprobante: 'P',
        moneda: 'MXN',
        tipoCambio: 1,
        total: 18000,
        uuidRelacionado: 'USD-PPD-1',
        relatedDocs: [
          { idDocumento: 'USD-PPD-1', numParcialidad: 1, impSaldoAnt: 1000, impPagado: 400, impSaldoInsoluto: 600, monedaDr: 'USD', pagoMoneda: 'USD', pagoTipoCambio: 20 },
          { idDocumento: 'USD-PPD-2', numParcialidad: 1, impSaldoAnt: 500, impPagado: 500, impSaldoInsoluto: 0, monedaDr: 'USD', pagoMoneda: 'USD', pagoTipoCambio: 20 }
        ]
      }),
      // REP de Noviembre: liquida los $600 USD restantes de USD-PPD-1 (NO debe afectar Octubre!)
      makeCfdi({
        id: 'rep-nov',
        uuid: 'REP-NOV',
        fecha: '2026-11-10',
        tipoComprobante: 'P',
        moneda: 'MXN',
        tipoCambio: 1,
        total: 12000,
        uuidRelacionado: 'USD-PPD-1',
        relatedDocs: [
          { idDocumento: 'USD-PPD-1', numParcialidad: 2, impSaldoAnt: 600, impPagado: 600, impSaldoInsoluto: 0, monedaDr: 'USD', pagoMoneda: 'USD', pagoTipoCambio: 20 }
        ]
      })
    ];

    const wpOct = computeFiscalWorkpaperFromTrialBalance({
      company: companyResico,
      ejercicio: 2026,
      periodo: 10,
      parameters: taxParams,
      trialBalance: [],
      cfdis
    });

    expect(wpOct.fluctuacionCambiaria.cfdisUsdCount).toBe(1);
    expect(wpOct.fluctuacionCambiaria.saldoMonedaExtranjeraUsd).toBe(600);
    expect(wpOct.fluctuacionCambiaria.valuacionLibrosMxn).toBe(11400);
    expect(wpOct.fluctuacionCambiaria.valuacionCierreDofMxn).toBe(12000);
    expect(wpOct.fluctuacionCambiaria.diferenciaCambiariaMxn).toBe(600);

    const wpNov = computeFiscalWorkpaperFromTrialBalance({
      company: companyResico,
      ejercicio: 2026,
      periodo: 11,
      parameters: taxParams,
      trialBalance: [],
      cfdis
    });

    expect(wpNov.fluctuacionCambiaria.cfdisUsdCount).toBe(0);
    expect(wpNov.fluctuacionCambiaria.saldoMonedaExtranjeraUsd).toBe(0);
  });

  test('[BUG-27] cash-basis-fiscal excluye Notas de Crédito PPD o relacionadas a facturas PPD', () => {
    const cfdis: CfdiDocument[] = [
      makeCfdi({ id: 'pue-1', uuid: 'PUE-1', metodoPago: 'PUE', subtotal: 20000, ivaTrasladado: 3200, total: 23200 }),
      makeCfdi({ id: 'ppd-1', uuid: 'PPD-1', metodoPago: 'PPD', subtotal: 50000, ivaTrasladado: 8000, total: 58000 }),
      // NC con MetodoPago PUE pero relacionada via uuidRelacionado a PPD-1 -> debe EXCLUIRSE
      makeCfdi({ id: 'nc-ppd-rel', uuid: 'NC-1', tipoComprobante: 'E', metodoPago: 'PUE', uuidRelacionado: 'PPD-1', subtotal: 10000, ivaTrasladado: 1600, total: 11600 }),
      // NC con MetodoPago PPD -> debe EXCLUIRSE
      makeCfdi({ id: 'nc-ppd-met', uuid: 'NC-2', tipoComprobante: 'E', metodoPago: 'PPD', subtotal: 5000, ivaTrasladado: 800, total: 5800 }),
      // NC con MetodoPago PUE relacionada via relatedDocs a PPD-1 -> debe EXCLUIRSE
      makeCfdi({
        id: 'nc-ppd-dr',
        uuid: 'NC-3',
        tipoComprobante: 'E',
        metodoPago: 'PUE',
        subtotal: 3000,
        ivaTrasladado: 480,
        total: 3480,
        relatedDocs: [{ idDocumento: 'PPD-1', numParcialidad: 1, impSaldoAnt: 58000, impPagado: 3480, impSaldoInsoluto: 54520 }]
      }),
      // NC legítima sobre operación PUE -> SÍ debe restarse
      makeCfdi({ id: 'nc-pue', uuid: 'NC-4', tipoComprobante: 'E', metodoPago: 'PUE', uuidRelacionado: 'PUE-1', subtotal: 2000, ivaTrasladado: 320, total: 2320 })
    ];

    const summary = computeCashBasisFiscalSummary({
      company: companyResico,
      ejercicio: 2026,
      periodo: 10,
      cfdis
    });

    expect(summary.ingresosPeriodo).toBe(18000);
    expect(summary.cashBasisSummary.creditNotesRestados).toBe(2000);
    expect(summary.ivaTrasladadoCobradoPeriodo).toBe(2880);
  });
});
