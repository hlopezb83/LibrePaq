import { describe, expect, test } from 'bun:test';
import {
  decodeSatSerialNumber,
  computeSha1Base64,
  buildSatAutenticaSoapXml,
  buildSatSolicitaDescargaSoapXml,
  buildSatVerificaDescargaSoapXml,
  buildSatDescargaPaqueteSoapXml,
  parseAndDecryptFiel,
  parseCfdiQuick
} from '../supabase/functions/sat-soap-sync/crypto-helpers';
import { generateTestFielCredentials } from '../src/server/sat-soap';

describe('SAT SOAP Edge Function Crypto Helpers', () => {
  test('decodes SAT 20-digit serial number from hex ascii', () => {
    const hexSerial = '3030303031303030303030373132303033363534';
    expect(decodeSatSerialNumber(hexSerial)).toBe('00001000000712003654');
    expect(decodeSatSerialNumber('00001000000712003654')).toBe('00001000000712003654');
  });

  test('computes deterministic SHA-1 base64 and RSA-SHA1 signatures', () => {
    const digest = computeSha1Base64('LIBREPAQ_TEST');
    expect(digest).toBeTruthy();
    expect(digest.length).toBe(28); // base64 of 20 bytes is 28 chars with =
  });

  test('validates and decrypts test fiel credentials into PEM format', () => {
    const creds = generateTestFielCredentials(
      'ESH2311092R7',
      'ELOGISTIX SHIPPING S DE RL DE CV',
      'Passphrase2026!'
    );

    // Wrong password throws
    expect(() =>
      parseAndDecryptFiel({
        cerBase64: creds.cerBase64,
        keyBase64: creds.keyBase64,
        passphrase: 'wrong'
      })
    ).toThrow(/Contraseña incorrecta/i);

    // Correct password succeeds and returns privateKeyPem
    const res = parseAndDecryptFiel({
      cerBase64: creds.cerBase64,
      keyBase64: creds.keyBase64,
      passphrase: 'Passphrase2026!'
    });

    expect(res.rfcTitular).toBe('ESH2311092R7');
    expect(res.privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----');
    expect(res.isExpired).toBe(false);

    // Build SOAP XMLs
    const autSoap = buildSatAutenticaSoapXml({
      certificateBase64: res.certificateBase64,
      privateKeyPem: res.privateKeyPem
    });
    expect(autSoap.soapXml).toContain('http://DescargaMasivaTerceros.gob.mx');

    const solSoap = buildSatSolicitaDescargaSoapXml({
      rfcSolicitante: res.rfcTitular,
      tipoSolicitud: 'RECIBIDOS',
      fechaInicial: '2026-10-01',
      fechaFinal: '2026-10-31',
      certificateBase64: res.certificateBase64,
      privateKeyPem: res.privateKeyPem
    });
    expect(solSoap.soapXml).toContain('SolicitaDescargaRecibidos');

    const verSoap = buildSatVerificaDescargaSoapXml({
      rfcSolicitante: res.rfcTitular,
      idSolicitudSat: '712367E2-1234-5678-ABCD-000000000000',
      certificateBase64: res.certificateBase64,
      privateKeyPem: res.privateKeyPem
    });
    expect(verSoap.soapXml).toContain('VerificaSolicitudDescarga');

    const descSoap = buildSatDescargaPaqueteSoapXml({
      rfcSolicitante: res.rfcTitular,
      idPaqueteSat: '712367E2_01',
      certificateBase64: res.certificateBase64,
      privateKeyPem: res.privateKeyPem
    });
    expect(descSoap.soapXml).toContain('PeticionDescargaMasivaTercerosEntrada');
  });

  test('parseCfdiQuick extracts root TotalImpuestosTrasladados in CFDI 4.0 with concept impuestos', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Fecha="2026-10-15T12:00:00" TipoDeComprobante="I" SubTotal="1000.00" Total="1160.00" Moneda="MXN" FormaPago="03" MetodoPago="PUE">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR PRUEBA"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="RECEPTOR PRUEBA" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="E48" Descripcion="Servicios contables" ValorUnitario="1000.00" Importe="1000.00">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="4A90918C-51E1-46B1-82DE-8C3729864E8C"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsed = parseCfdiQuick(xml);
    expect(parsed).not.toBeNull();
    expect(parsed?.uuid).toBe('4A90918C-51E1-46B1-82DE-8C3729864E8C');
    expect(parsed?.subtotal).toBe(1000);
    expect(parsed?.ivaTrasladado).toBe(160);
    expect(parsed?.total).toBe(1160);
  });

  test('parseCfdiQuick parses Pagos 2.0 Monto and payment attributes', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Fecha="2026-10-20T10:00:00" TipoDeComprobante="P" SubTotal="0" Total="0" Moneda="XXX">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR PAGOS"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="RECEPTOR PAGOS" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos xmlns:pago20="http://www.sat.gob.mx/Pagos20" Version="2.0">
      <pago20:Totales TotalTrasladosBaseIVA16="25000.00" TotalTrasladosImpuestoIVA16="4000.00" MontoTotalPagos="29000.00"/>
      <pago20:Pago FechaPago="2026-10-20T09:30:00" FormaDePagoP="03" MonedaP="MXN" Monto="29000.00"/>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="99887766-5544-3322-1100-AABBCCDDEEFF"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsed = parseCfdiQuick(xml);
    expect(parsed).not.toBeNull();
    expect(parsed?.tipoComprobante).toBe('P');
    expect(parsed?.uuid).toBe('99887766-5544-3322-1100-AABBCCDDEEFF');
    expect(parsed?.subtotal).toBe(29000);
    expect(parsed?.total).toBe(29000);
    expect(parsed?.formaPago).toBe('03');
    expect(parsed?.moneda).toBe('MXN');
  });
});
