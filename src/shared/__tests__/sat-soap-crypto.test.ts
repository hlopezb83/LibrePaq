import { describe, expect, test } from 'bun:test';
import {
  buildSatAutenticaSoapXml,
  buildSatSolicitaDescargaSoapXml,
  generateTestFielCredentials,
  parseAndValidateFielCredentials
} from '../../server/sat-soap';

describe('SAT SOAP Web Service v1.5 — e.firma (.cer & .key) & XML-DSig Cryptography', () => {
  test('generates real RSA-2048 X.509 .cer + encrypted PKCS#8 .key, validates mathematical match and signs SOAP envelopes', () => {
    const creds = generateTestFielCredentials(
      'SLO2204159A1',
      'SOLUCIONES LOGISTICAS DEL NORTE SA DE CV',
      'FielSecreta2026'
    );

    const parsed = parseAndValidateFielCredentials({
      cerBase64: creds.cerBase64,
      keyBase64: creds.keyBase64,
      passphrase: 'FielSecreta2026',
      fallbackRfc: 'SLO2204159A1',
      fallbackNombre: 'SOLUCIONES LOGISTICAS DEL NORTE SA DE CV'
    });
    expect(parsed.rfcTitular).toBe('SLO2204159A1');
    expect(parsed.numeroSerieCertificado.length).toBeGreaterThanOrEqual(8);

    // Rejects wrong password
    expect(() =>
      parseAndValidateFielCredentials({
        cerBase64: creds.cerBase64,
        keyBase64: creds.keyBase64,
        passphrase: 'ClaveIncorrecta',
        fallbackRfc: 'SLO2204159A1',
        fallbackNombre: 'SOLUCIONES LOGISTICAS DEL NORTE SA DE CV'
      })
    ).toThrow(/contraseña de la clave privada/i);

    // Builds WS-Security Autentica SOAP XML with XML-DSig RSA-SHA1 signature
    const autenticaSoap = buildSatAutenticaSoapXml(parsed);
    expect(autenticaSoap.soapXml).toContain('<s:Envelope');
    expect(autenticaSoap.digestValue.length).toBeGreaterThan(0);
    expect(autenticaSoap.signatureValue.length).toBeGreaterThan(0);
    expect(autenticaSoap.soapXml).toContain(creds.cerBase64);

    // Builds SolicitaDescargaRecibidos SOAP v1.5 envelope signed with e.firma
    const solicitaSoap = buildSatSolicitaDescargaSoapXml({
      rfcSolicitante: parsed.rfcTitular,
      tipoSolicitud: 'RECIBIDOS',
      fechaInicial: '2026-10-01',
      fechaFinal: '2026-10-31',
      certificateBase64: parsed.certificateBase64,
      privateKeyPem: parsed.privateKeyPem
    });
    expect(solicitaSoap.soapXml).toContain('SolicitaDescargaRecibidos');
    expect(solicitaSoap.soapXml).toContain('RfcReceptor="SLO2204159A1"');
    expect(solicitaSoap.signatureValue.length).toBeGreaterThan(0);
  });
});
