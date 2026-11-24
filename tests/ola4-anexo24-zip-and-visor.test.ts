import { describe, expect, test } from 'bun:test';
import { strFromU8, unzipSync } from 'fflate';
import { parseCfdiPreview } from '../src/shared/cfdi-preview-parser';
import { buildSatAnexo24Xml } from '../src/shared/sat-anexo24';
import { buildSatAnexo24Zip } from '../src/shared/sat-anexo24-zip';
import type { AccountWithBalance, CfdiDocument, Company, Poliza } from '../src/shared/types';

const mockCompany: Company = {
  id: 'comp_ola4b',
  name: 'EMPRESA PRUEBA OLA 4B S.A. DE C.V.',
  rfc: 'EPO260101AB9',
  regimenFiscal: '601 - General de Ley Personas Morales',
  codigoPostal: '64000',
  maskFormat: 'XXX-XX-XXX',
  currentYear: 2026,
  currentPeriod: 10,
  createdAt: '2026-01-01'
};

const mockAccounts: AccountWithBalance[] = [
  {
    id: 'acc_102',
    companyId: 'comp_ola4b',
    code: '102-01-001',
    name: 'BBVA Cuenta Operativa',
    parentCode: null,
    type: 'ACTIVO',
    nature: 'DEUDORA',
    level: 2,
    isAffectable: true,
    satGroupCode: '102.01',
    currency: 'MXN',
    initialBalance: 100000,
    initialBalanceComputed: 100000,
    periodCharges: 25000,
    periodCredits: 12000,
    finalBalance: 113000
  },
  {
    id: 'acc_601',
    companyId: 'comp_ola4b',
    code: '601-01-003',
    name: 'Honorarios y Servicios',
    parentCode: null,
    type: 'GASTOS',
    nature: 'DEUDORA',
    level: 2,
    isAffectable: true,
    satGroupCode: '601.32',
    currency: 'MXN',
    initialBalance: 0,
    initialBalanceComputed: 0,
    periodCharges: 12000,
    periodCredits: 0,
    finalBalance: 12000
  }
];

const mockPolizas: Poliza[] = [
  {
    id: 'pol_spei',
    companyId: 'comp_ola4b',
    tipo: 'EGRESO',
    folio: 15,
    fecha: '2026-10-20',
    ejercicio: 2026,
    periodo: 10,
    concepto: 'Pago proveedor SPEI RFC PRO990101AA1',
    cfdiUuid: '11111111-2222-4333-8444-555555555555',
    origin: 'MANUAL',
    totalCargos: 23200,
    totalAbonos: 23200,
    isBalanced: true,
    createdAt: '2026-10-20',
    movements: [
      {
        id: 'mov_bank_spei',
        polizaId: 'pol_spei',
        accountId: 'acc_102',
        accountCode: '102-01-001',
        accountName: 'BBVA Cuenta Operativa',
        referencia: 'SPEI-778899',
        concepto: 'Transferencia SPEI proveedor',
        cargo: 0,
        abono: 23200,
        cfdiUuid: '11111111-2222-4333-8444-555555555555',
        rfcContraparte: 'PRO990101AA1'
      },
      {
        id: 'mov_gasto',
        polizaId: 'pol_spei',
        accountId: 'acc_601',
        accountCode: '601-01-003',
        accountName: 'Honorarios y Servicios',
        referencia: 'FAC-100',
        concepto: 'Gasto de consultoría',
        cargo: 23200,
        abono: 0,
        cfdiUuid: null
      }
    ]
  },
  {
    id: 'pol_otro',
    companyId: 'comp_ola4b',
    tipo: 'INGRESO',
    folio: 16,
    fecha: '2026-10-22',
    ejercicio: 2026,
    periodo: 10,
    concepto: 'Cobro en efectivo & caja',
    cfdiUuid: null,
    origin: 'MANUAL',
    totalCargos: 5800,
    totalAbonos: 5800,
    isBalanced: true,
    createdAt: '2026-10-22',
    movements: [
      {
        id: 'mov_bank_efec',
        polizaId: 'pol_otro',
        accountId: 'acc_102',
        accountCode: '102-01-001',
        accountName: 'BBVA Cuenta Operativa',
        referencia: 'EFECTIVO & CAJA',
        concepto: 'Depósito efectivo & caja',
        cargo: 5800,
        abono: 0,
        cfdiUuid: null
      }
    ]
  },
  {
    id: 'pol_chq',
    companyId: 'comp_ola4b',
    tipo: 'EGRESO',
    folio: 17,
    fecha: '2026-10-25',
    ejercicio: 2026,
    periodo: 10,
    concepto: 'Pago con cheque nominativo',
    cfdiUuid: null,
    origin: 'MANUAL',
    totalCargos: 4000,
    totalAbonos: 4000,
    isBalanced: true,
    createdAt: '2026-10-25',
    movements: [
      {
        id: 'mov_bank_chq',
        polizaId: 'pol_chq',
        accountId: 'acc_102',
        accountCode: '102-01-001',
        accountName: 'BBVA Cuenta Operativa',
        referencia: 'CHQ-00412',
        concepto: 'Cheque pago renta',
        cargo: 0,
        abono: 4000,
        cfdiUuid: null
      }
    ]
  }
];

describe('Ola 4B — Anexo 24 .zip Oficial SAT, Nodos de Pago y Visor Fiel CFDI 4.0', () => {
  test('1. buildSatAnexo24Zip genera CT.zip, BN.zip, BC.zip y PL.zip descomprimibles con fflate.unzipSync', () => {
    const ctXml = buildSatAnexo24Xml(mockCompany, 2026, 10, 'catalogo', mockAccounts);
    const ctZip = buildSatAnexo24Zip({ company: mockCompany, year: 2026, period: 10, type: 'catalogo', xmlResult: ctXml });
    expect(ctZip.zipFilename).toBe('EPO260101AB9202610CT.zip');
    const ctEntries = unzipSync(ctZip.zipBytes);
    expect(Object.keys(ctEntries)).toEqual(['EPO260101AB9202610CT.xml']);
    expect(strFromU8(ctEntries['EPO260101AB9202610CT.xml']!)).toBe(ctXml.xml);

    const bnXml = buildSatAnexo24Xml(mockCompany, 2026, 10, 'balanza', mockAccounts);
    const bnZip = buildSatAnexo24Zip({ company: mockCompany, year: 2026, period: 10, type: 'balanza', xmlResult: bnXml });
    expect(bnZip.zipFilename).toBe('EPO260101AB9202610BN.zip');
    const bnEntries = unzipSync(bnZip.zipBytes);
    expect(Object.keys(bnEntries)).toEqual(['EPO260101AB9202610BN.xml']);
    expect(strFromU8(bnEntries['EPO260101AB9202610BN.xml']!)).toContain('<BCE:Balanza');

    const bcXml = buildSatAnexo24Xml(mockCompany, 2026, 13, 'balanza', mockAccounts, [], {
      tipoEnvio: 'C',
      fechaModBal: '2027-03-10'
    });
    const bcZip = buildSatAnexo24Zip({ company: mockCompany, year: 2026, period: 13, type: 'balanza', xmlResult: bcXml });
    expect(bcZip.zipFilename).toBe('EPO260101AB9202613BC.zip');
    const bcEntries = unzipSync(bcZip.zipBytes);
    expect(Object.keys(bcEntries)).toEqual(['EPO260101AB9202613BC.xml']);

    const plXml = buildSatAnexo24Xml(mockCompany, 2026, 10, 'polizas', mockAccounts, mockPolizas);
    const plZip = buildSatAnexo24Zip({ company: mockCompany, year: 2026, period: 10, type: 'polizas', xmlResult: plXml });
    expect(plZip.zipFilename).toBe('EPO260101AB9202610PL.zip');
    const plEntries = unzipSync(plZip.zipBytes);
    expect(Object.keys(plEntries)).toEqual(['EPO260101AB9202610PL.xml']);
    expect(strFromU8(plEntries['EPO260101AB9202610PL.xml']!)).toBe(plXml.xml);
  });

  test('2. PL.xml incluye nodos de pago <PLZ:Transferencia>, <PLZ:Cheque> y <PLZ:OtrMetodoPago> solo en cuentas bancarias 102.*', () => {
    const plXml = buildSatAnexo24Xml(mockCompany, 2026, 10, 'polizas', mockAccounts, mockPolizas);

    expect(plXml.xml).toContain('<PLZ:Transferencia CtaOri="102-01-001" BancoOriNal="012" CtaDest="SPEI-778899"');
    expect(plXml.xml).toContain('RFC="PRO990101AA1" Monto="23200.00"');

    expect(plXml.xml).toContain('<PLZ:OtrMetodoPago MetPagoPol="01" Fecha="2026-10-22" Benef="Depósito efectivo &amp; caja"');
    expect(plXml.xml).toContain('Monto="5800.00"');

    expect(plXml.xml).toContain('<PLZ:Cheque Num="CHQ-00412" BanEmisNal="012" CtaOri="102-01-001"');
    expect(plXml.xml).toContain('Monto="4000.00"');

    // La partida de gasto 601-01-003 no debe generar nodo de método de pago
    const gastoTxMatch = plXml.xml.match(/<PLZ:Transaccion NumCta="601-01-003"[\s\S]*?<\/PLZ:Transaccion>/);
    expect(gastoTxMatch).not.toBeNull();
    expect(gastoTxMatch?.[0]).not.toContain('PLZ:Transferencia');
    expect(gastoTxMatch?.[0]).not.toContain('PLZ:OtrMetodoPago');
    expect(gastoTxMatch?.[0]).not.toContain('PLZ:Cheque');
  });

  test('3. parseCfdiPreview extrae múltiples conceptos, impuestos reales y TimbreFiscalDigital desde xmlRaw', () => {
    const xmlRaw = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
  Version="4.0" Serie="F" Folio="9021" Fecha="2026-10-18T09:15:30" FormaPago="03" MetodoPago="PUE"
  SubTotal="15000.00" Descuento="500.00" Moneda="MXN" TipoCambio="1" Total="16330.00"
  TipoDeComprobante="I" Exportacion="01" LugarExpedicion="06700" NoCertificado="30001000000500003416">
  <cfdi:Emisor Rfc="PRO990101AA1" Nombre="SERVICIOS CLOUD &amp; DATA SA" RegimenFiscal="626"/>
  <cfdi:Receptor Rfc="EPO260101AB9" Nombre="EMPRESA PRUEBA OLA 4B" DomicilioFiscalReceptor="64000" RegimenFiscalReceptor="601" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="81112100" NoIdentificacion="SRV-01" Cantidad="2" ClaveUnidad="E48" Unidad="Servicio"
      Descripcion="Licencia Anual Cloud" ValorUnitario="5000.00" Importe="10000.00" Descuento="500.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="9500.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="1520.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
    <cfdi:Concepto ClaveProdServ="43232400" NoIdentificacion="SOP-99" Cantidad="5" ClaveUnidad="HUR" Unidad="Hora"
      Descripcion="Soporte Especializado" ValorUnitario="1000.00" Importe="5000.00" ObjetoImp="02"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="2320.00" TotalImpuestosRetenidos="490.00">
    <cfdi:Retenciones>
      <cfdi:Retencion Impuesto="001" Importe="181.25"/>
      <cfdi:Retencion Impuesto="002" Importe="308.75"/>
    </cfdi:Retenciones>
    <cfdi:Traslados>
      <cfdi:Traslado Base="14500.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="2320.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital Version="1.1" UUID="AABBCCDD-1122-4333-8444-556677889900"
      FechaTimbrado="2026-10-18T09:15:35" RfcProvCertif="PAC900101XY9"
      SelloCFD="MIIGQzCCBCugAwIBAgIUMzAwMDEwMDAwMDA1..." NoCertificadoSAT="00001000000509876543"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const cfdi: CfdiDocument = {
      id: 'cfdi_1',
      companyId: 'comp_ola4b',
      uuid: 'AABBCCDD-1122-4333-8444-556677889900',
      fecha: '2026-10-18',
      tipoComprobante: 'I',
      direction: 'RECIBIDO',
      serie: 'F',
      folio: '9021',
      emisorRfc: 'PRO990101AA1',
      emisorNombre: 'SERVICIOS CLOUD & DATA SA',
      receptorRfc: 'EPO260101AB9',
      receptorNombre: 'EMPRESA PRUEBA OLA 4B',
      conceptoPrincipal: 'Licencia Anual Cloud + Soporte Especializado',
      claveProdServ: '81112100',
      moneda: 'MXN',
      tipoCambio: 1,
      subtotal: 15000,
      descuento: 500,
      ivaTrasladado: 2320,
      isrRetenido: 181.25,
      ivaRetenido: 308.75,
      total: 16330,
      metodoPago: 'PUE',
      formaPago: '03',
      usoCfdi: 'G03',
      statusSat: 'VIGENTE',
      polizaId: null,
      xmlRaw
    };

    const preview = parseCfdiPreview(cfdi);
    expect(preview.hasXmlRaw).toBe(true);
    expect(preview.comprobante.lugarExpedicion).toBe('06700');
    expect(preview.comprobante.noCertificado).toBe('30001000000500003416');
    expect(preview.emisor.regimenFiscal).toBe('626');
    expect(preview.emisor.nombre).toBe('SERVICIOS CLOUD & DATA SA');

    expect(preview.conceptos).toHaveLength(2);
    expect(preview.conceptos[0]).toEqual({
      claveProdServ: '81112100',
      noIdentificacion: 'SRV-01',
      cantidad: 2,
      claveUnidad: 'E48',
      unidad: 'Servicio',
      descripcion: 'Licencia Anual Cloud',
      valorUnitario: 5000,
      importe: 10000,
      descuento: 500,
      objetoImp: '02'
    });
    expect(preview.conceptos[1]?.claveProdServ).toBe('43232400');
    expect(preview.conceptos[1]?.cantidad).toBe(5);
    expect(preview.conceptos[1]?.claveUnidad).toBe('HUR');

    // Impuestos a nivel Comprobante sin duplicar el traslado interno del Concepto 1
    expect(preview.impuestos.traslados).toHaveLength(1);
    expect(preview.impuestos.traslados[0]?.importe).toBe(2320);
    expect(preview.impuestos.retenciones).toHaveLength(2);
    expect(preview.impuestos.totalImpuestosRetenidos).toBe(490);

    expect(preview.timbre.fechaTimbrado).toBe('2026-10-18T09:15:35');
    expect(preview.timbre.rfcProvCertif).toBe('PAC900101XY9');
    expect(preview.timbre.noCertificadoSat).toBe('00001000000509876543');
    expect(preview.timbre.selloCfd).toStartWith('MIIGQzCCBCug');
  });

  test('4. parseCfdiPreview provee fallback limpio cuando xmlRaw viene vacío', () => {
    const emptyCfdi: CfdiDocument = {
      id: 'cfdi_empty',
      companyId: 'comp_ola4b',
      uuid: '00000000-1111-4222-8333-444444444444',
      fecha: '2026-10-05',
      tipoComprobante: 'I',
      direction: 'EMITIDO',
      serie: 'A',
      folio: '12',
      emisorRfc: 'EPO260101AB9',
      emisorNombre: 'EMPRESA PRUEBA OLA 4B',
      receptorRfc: 'CLI010101AA2',
      receptorNombre: 'CLIENTE NACIONAL',
      conceptoPrincipal: 'Consultoría Contable Mensual',
      claveProdServ: '84111500',
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
      xmlRaw: ''
    };

    const preview = parseCfdiPreview(emptyCfdi);
    expect(preview.hasXmlRaw).toBe(false);
    expect(preview.conceptos).toHaveLength(1);
    expect(preview.conceptos[0]?.descripcion).toBe('Consultoría Contable Mensual');
    expect(preview.conceptos[0]?.importe).toBe(10000);
    expect(preview.impuestos.traslados).toHaveLength(1);
    expect(preview.timbre.rfcProvCertif).toBe('');
  });
});
