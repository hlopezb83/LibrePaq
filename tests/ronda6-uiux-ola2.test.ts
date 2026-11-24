import { describe, expect, test } from 'bun:test';
import { parseCfdiPreview } from '../src/shared/cfdi-preview-parser';
import { INITIAL_EFOS_DATABASE } from '../src/shared/sat-69b';
import type { CfdiDocument, ThirdPartyRecord } from '../src/shared/types';
import {
  computeEfosDashboardSummary,
  resolveLedgerAccountId
} from '../src/views/dashboard/dashboardHelpers';
import {
  getSatDownloadDisabledReason,
  translateSatErrorCode
} from '../src/views/cfdi/sat-soap/satErrorTranslator';
import { buildSimulatedCfdiXml } from '../src/views/cfdi/simulateCfdiXml';
import { computeCfdiTotals } from '../src/views/cfdi/filterCfdis';

function makeBaseCfdi(overrides: Partial<CfdiDocument> = {}): CfdiDocument {
  return {
    id: 'cfdi_1',
    companyId: 'comp_1',
    uuid: '11111111-2222-4333-8444-555555555555',
    serie: 'FAC',
    folio: '100',
    fecha: '2026-10-15',
    emisorRfc: 'AAA010101AAA',
    emisorNombre: 'Empresa Emisora SA de CV',
    receptorRfc: 'BBB020202BBB',
    receptorNombre: 'Empresa Receptora SA de CV',
    direction: 'RECIBIDO',
    tipoComprobante: 'I',
    subtotal: 1000,
    descuento: 0,
    ivaTrasladado: 160,
    isrRetenido: 0,
    ivaRetenido: 0,
    total: 1160,
    moneda: 'MXN',
    tipoCambio: 1,
    formaPago: '03',
    metodoPago: 'PUE',
    usoCfdi: 'G03',
    claveProdServ: '81111508',
    conceptoPrincipal: 'Servicios de consultoría',
    polizaId: null,
    statusSat: 'VIGENTE',
    xmlRaw: '',
    ...overrides
  };
}

describe('Ronda 6 Ola 2 — Tablero Fiscal, ADD, SAT e.firma y Visor CFDI', () => {
  test('resolveLedgerAccountId extrae códigos con prefijo "_" y prioriza coincidencia exacta sobre startsWith', () => {
    const accounts = [
      { id: 'acc_parent', code: '105-00-000' },
      { id: 'acc_child', code: '105-01-001' },
      { id: 'acc_ing_sub', code: '400-01-000' },
      { id: 'acc_ing_root', code: '400-00-000' },
      { id: 'acc_bank_1', code: '102-01-001' },
      { id: 'acc_prov', code: '201-01-001' }
    ];

    expect(resolveLedgerAccountId('comp_demo_400-00-000', accounts)).toBe('acc_ing_root');
    expect(resolveLedgerAccountId('comp_demo_105-01-001', accounts)).toBe('acc_child');
    expect(resolveLedgerAccountId('105-00-000', accounts)).toBe('acc_parent');
    // Fallback por prefijo cuando no existe la cuenta exacta 102-00-000
    expect(resolveLedgerAccountId('comp_demo_102-00-000', accounts)).toBe('acc_bank_1');
    // Código de 3 dígitos con prefijo _
    expect(resolveLedgerAccountId('comp_demo_201', accounts)).toBe('acc_prov');
    // Si no coincide ningún patrón o cuenta, conserva el valor original
    expect(resolveLedgerAccountId('custom_ledger_id', accounts)).toBe('custom_ledger_id');
  });

  test('computeEfosDashboardSummary consolida alertas 69-B de terceros y CFDIs sin duplicar RFCs', () => {
    const efosSampleRfc = INITIAL_EFOS_DATABASE[0]!.rfc;
    const thirdParties: ThirdPartyRecord[] = [
      {
        id: 'tp_1',
        companyId: 'comp_1',
        rfc: efosSampleRfc,
        nombre: 'Proveedor Presunto/Definitivo',
        rol: 'PROVEEDOR',
        cuentaOperacionCode: '601-01-001',
        cuentaContrapartidaCode: '201-01-001',
        tipoTerceroDiot: '04',
        tipoOperacionDiot: '03',
        tasaIvaDefault: 16,
        estatus69B: 'DEFINITIVO_EFOS',
        updatedAt: '2026-10-15T00:00:00Z'
      },
      {
        id: 'tp_2',
        companyId: 'comp_1',
        rfc: 'GARM850612H92',
        nombre: 'Proveedor Limpio',
        rol: 'PROVEEDOR',
        cuentaOperacionCode: '601-01-001',
        cuentaContrapartidaCode: '201-01-001',
        tipoTerceroDiot: '04',
        tipoOperacionDiot: '03',
        tasaIvaDefault: 16,
        estatus69B: 'LIMPIO',
        updatedAt: '2026-10-15T00:00:00Z'
      }
    ];
    const cfdis = [
      makeBaseCfdi({ emisorRfc: efosSampleRfc }),
      makeBaseCfdi({ id: 'cfdi_2', emisorRfc: 'GARM850612H92' })
    ];

    const summary = computeEfosDashboardSummary(thirdParties, cfdis);
    expect(summary.efosCount).toBe(1);
    expect(summary.definitivosCount).toBe(1);
    expect(summary.presuntosCount).toBe(0);
    expect(summary.totalThirdParties).toBe(2);
  });

  test('parseCfdiPreview no fabrica datos SAT ficticios cuando falta xmlRaw', () => {
    const cfdi = makeBaseCfdi({ xmlRaw: '' });
    const preview = parseCfdiPreview(cfdi);

    expect(preview.hasXmlRaw).toBe(false);
    expect(preview.comprobante.lugarExpedicion).toBe('');
    expect(preview.emisor.regimenFiscal).toBe('');
    expect(preview.receptor.domicilioFiscalReceptor).toBe('');
    expect(preview.receptor.regimenFiscalReceptor).toBe('');
    expect(preview.timbre.rfcProvCertif).toBe('');
    expect(preview.timbre.noCertificadoSat).toBe('');
    expect(preview.timbre.fechaTimbrado).toBe('');
  });

  test('parseCfdiPreview extrae Complemento de Pagos 2.0 (Tipo P) y traslados con Base/TipoFactor', () => {
    const repXml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Serie="REP" Folio="45" Fecha="2026-10-20T10:15:00" SubTotal="0" Moneda="XXX" Total="0" TipoDeComprobante="P" Exportacion="01" LugarExpedicion="44100">
  <cfdi:Emisor Rfc="EMIS010101AAA" Nombre="Emisor SA" RegimenFiscal="601" />
  <cfdi:Receptor Rfc="RECP020202BBB" Nombre="Receptor SA" DomicilioFiscalReceptor="44100" RegimenFiscalReceptor="601" UsoCFDI="CP01" />
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01" />
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Totales MontoTotalPagos="11600.00" />
      <pago20:Pago FechaPago="2026-10-20T09:00:00" FormaDePagoP="03" MonedaP="MXN" TipoCambioP="1" Monto="11600.00" NumOperacion="OP-991">
        <pago20:DoctoRelacionado IdDocumento="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" Serie="FAC" Folio="12" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="11600.00" ImpPagado="11600.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="02" />
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital Version="1.1" UUID="11111111-2222-4333-8444-555555555555" FechaTimbrado="2026-10-20T10:15:05" RfcProvCertif="PAC000101AAA" NoCertificadoSAT="00001000000700000001" SelloCFD="SELLO_CFD" SelloSAT="SELLO_SAT" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const cfdi = makeBaseCfdi({
      tipoComprobante: 'P',
      subtotal: 0,
      ivaTrasladado: 0,
      total: 0,
      xmlRaw: repXml
    });
    const preview = parseCfdiPreview(cfdi);

    expect(preview.hasXmlRaw).toBe(true);
    expect(preview.comprobante.lugarExpedicion).toBe('44100');
    expect(preview.timbre.rfcProvCertif).toBe('PAC000101AAA');
    expect(preview.pagos).toBeDefined();
    expect(preview.pagos?.length).toBe(1);
    expect(preview.pagos?.[0]?.monto).toBe(11600);
    expect(preview.pagos?.[0]?.numOperacion).toBe('OP-991');
    expect(preview.pagos?.[0]?.doctosRelacionados[0]?.idDocumento).toBe(
      'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE'
    );
    expect(preview.pagos?.[0]?.doctosRelacionados[0]?.impPagado).toBe(11600);
  });

  test('parseCfdiPreview extrae Complemento de Nómina 1.2 (Tipo N)', () => {
    const nominaXml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:nomina12="http://www.sat.gob.mx/nomina12" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Serie="NOM" Folio="88" Fecha="2026-10-15T18:00:00" SubTotal="15000" Descuento="2100" Moneda="MXN" Total="12900" TipoDeComprobante="N" Exportacion="01" LugarExpedicion="06600">
  <cfdi:Emisor Rfc="EMP010101AAA" Nombre="Empresa Patron SA" RegimenFiscal="601" />
  <cfdi:Receptor Rfc="PERJ900101XXX" Nombre="JUAN PEREZ" DomicilioFiscalReceptor="06600" RegimenFiscalReceptor="605" UsoCFDI="CN01" />
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111505" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago de nómina" ValorUnitario="15000" Importe="15000" Descuento="2100" ObjetoImp="01" />
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <nomina12:Nomina Version="1.2" TipoNomina="O" FechaPago="2026-10-15" FechaInicialPago="2026-10-01" FechaFinalPago="2026-10-15" NumDiasPagados="15" TotalPercepciones="15000.00" TotalDeducciones="2100.00" TotalOtrosPagos="0.00">
      <nomina12:Receptor Curp="PERJ900101HDFXYZ01" NumSeguridadSocial="12345678901" NumEmpleado="E-042" Puesto="Contador General" Departamento="Finanzas" SalarioDiarioIntegrado="1045.50" />
    </nomina12:Nomina>
    <tfd:TimbreFiscalDigital Version="1.1" UUID="22222222-3333-4444-8555-666666666666" FechaTimbrado="2026-10-15T18:01:00" RfcProvCertif="PAC000101AAA" NoCertificadoSAT="00001000000700000002" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const cfdi = makeBaseCfdi({
      tipoComprobante: 'N',
      subtotal: 15000,
      descuento: 2100,
      ivaTrasladado: 0,
      total: 12900,
      xmlRaw: nominaXml
    });
    const preview = parseCfdiPreview(cfdi);

    expect(preview.nomina).toBeDefined();
    expect(preview.nomina?.version).toBe('1.2');
    expect(preview.nomina?.tipoNomina).toBe('O');
    expect(preview.nomina?.numDiasPagados).toBe(15);
    expect(preview.nomina?.totalPercepciones).toBe(15000);
    expect(preview.nomina?.totalDeducciones).toBe(2100);
    expect(preview.nomina?.numEmpleado).toBe('E-042');
    expect(preview.nomina?.curp).toBe('PERJ900101HDFXYZ01');
  });

  test('translateSatErrorCode y getSatDownloadDisabledReason traducen códigos oficiales SAT', () => {
    expect(translateSatErrorCode('301').shortLabel).toContain('301');
    expect(translateSatErrorCode('305').title).toContain('vigencia');
    expect(translateSatErrorCode('5001').title).toContain('RFC');
    expect(translateSatErrorCode('5004').shortLabel).toContain('5004');
    expect(translateSatErrorCode('SAT Código 5').code).toBe('5');
    expect(translateSatErrorCode('9999', 'Error personalizado').explanation).toBe('Error personalizado');

    expect(
      getSatDownloadDisabledReason({
        isReadOnlyClient: true,
        hasCredentials: true,
        isDateRangeInvalid: false,
        isPending: false
      })
    ).toContain('solo lectura');

    expect(
      getSatDownloadDisabledReason({
        isReadOnlyClient: false,
        hasCredentials: false,
        isDateRangeInvalid: false,
        isPending: false
      })
    ).toContain('e.firma');
  });

  test('buildSimulatedCfdiXml no agrega IVA 16% automático en Tipo N o P, pero sí en Tipo I', () => {
    const basePayload = {
      companyId: 'comp_1',
      direction: 'RECIBIDO' as const,
      counterpartyRfc: 'LEN200512A19',
      counterpartyName: 'Proveedor Demo',
      conceptoPrincipal: 'Concepto prueba',
      subtotal: 10000,
      isrRetenido: 0,
      ivaRetenido: 0,
      metodoPago: 'PUE' as const,
      fecha: '2026-10-15'
    };

    const xmlI = buildSimulatedCfdiXml({ ...basePayload, tipoComprobante: 'I' });
    expect(xmlI).toContain('Total="11600.00"');

    const xmlN = buildSimulatedCfdiXml({ ...basePayload, tipoComprobante: 'N' });
    expect(xmlN).toContain('Total="10000.00"');
    expect(xmlN).not.toContain('Total="11600.00"');

    const xmlP = buildSimulatedCfdiXml({ ...basePayload, tipoComprobante: 'P' });
    expect(xmlP).toContain('Total="0"');
    expect(xmlP).toContain('TotalTrasladosImpuestoIVA16="0.00"');
    expect(xmlP).toContain('MontoTotalPagos="10000.00"');
  });

  test('computeCfdiTotals excluye Cancelados, Tipo P y Tipo T, y resta Notas de Crédito (E)', () => {
    const totals = computeCfdiTotals([
      makeBaseCfdi({ id: '1', tipoComprobante: 'I', subtotal: 1000, ivaTrasladado: 160, total: 1160 }),
      makeBaseCfdi({ id: '2', tipoComprobante: 'E', subtotal: 200, ivaTrasladado: 32, total: 232 }),
      makeBaseCfdi({ id: '3', tipoComprobante: 'P', subtotal: 500, ivaTrasladado: 0, total: 500 }),
      makeBaseCfdi({ id: '4', tipoComprobante: 'T', subtotal: 300, ivaTrasladado: 0, total: 300 }),
      makeBaseCfdi({ id: '5', statusSat: 'CANCELADO', subtotal: 900, ivaTrasladado: 144, total: 1044 })
    ]);

    expect(totals.subtotal).toBe(800);
    expect(totals.iva).toBe(128);
    expect(totals.total).toBe(928);
  });
});
