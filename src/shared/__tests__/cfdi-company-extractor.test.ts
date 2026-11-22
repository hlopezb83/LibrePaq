import { describe, expect, it } from 'bun:test';
import { extractCompanyCandidatesFromCfdiXml } from '../cfdi-company-extractor';
import { buildSampleCfdiXmlsForCompany, SANDBOX_DEMO_RFC } from '../../lib/sandbox-demo-seeder';
import { parseCfdiXmlString } from '../cfdi-xml';

describe('CFDI Company Identity Extractor & Sandbox Sample XMLs', () => {
  it('extrae correctamente Emisor y Receptor con Regimen SAT y C.P. desde un CFDI 4.0', () => {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante Version="4.0" LugarExpedicion="64000" SubTotal="1000.00" Total="1160.00" TipoDeComprobante="I">
  <cfdi:Emisor Rfc="CEJ2106158A0" Nombre="COMERCIALIZADORA EJEMPLO SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="GODE561231GR8" Nombre="LAURA GOMEZ MORALES" DomicilioFiscalReceptor="06600" RegimenFiscalReceptor="626" UsoCFDI="G03"/>
</cfdi:Comprobante>`;

    const { primary, candidates } = extractCompanyCandidatesFromCfdiXml(sampleXml);
    expect(candidates.length).toBe(2);
    expect(primary?.role).toBe('EMISOR');
    expect(primary?.rfc).toBe('CEJ2106158A0');
    expect(primary?.personType).toBe('MORAL');
    expect(primary?.codigoPostal).toBe('64000');
    expect(primary?.regimenFiscal.startsWith('601 -')).toBe(true);

    const receptor = candidates[1];
    expect(receptor?.role).toBe('RECEPTOR');
    expect(receptor?.rfc).toBe('GODE561231GR8');
    expect(receptor?.personType).toBe('FISICA');
    expect(receptor?.codigoPostal).toBe('06600');
    expect(receptor?.regimenFiscal.startsWith('626 -')).toBe(true);
  });

  it('omite RFCs genericos XAXX010101000 y selecciona al contribuyente real', () => {
    const publicoGeneralXml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante Version="4.0" LugarExpedicion="44100">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="PUBLICO EN GENERAL" RegimenFiscal="616"/>
  <cfdi:Receptor Rfc="CEJ2106158A0" Nombre="MI CLIENTE REAL SA DE CV" DomicilioFiscalReceptor="03100" RegimenFiscalReceptor="601"/>
</cfdi:Comprobante>`;

    const { primary, candidates } = extractCompanyCandidatesFromCfdiXml(publicoGeneralXml);
    expect(candidates.length).toBe(1);
    expect(primary?.role).toBe('RECEPTOR');
    expect(primary?.rfc).toBe('CEJ2106158A0');
    expect(primary?.codigoPostal).toBe('03100');
  });

  it('genera 3 CFDIs XML 4.0 de muestra validos para el modo Sandbox', () => {
    const xmls = buildSampleCfdiXmlsForCompany(
      SANDBOX_DEMO_RFC,
      '[DEMO] Comercializadora Ejemplo S.A. de C.V.',
      2026,
      10
    );
    expect(xmls.length).toBe(3);

    const parsed0 = parseCfdiXmlString(xmls[0]!);
    expect(parsed0.emisorRfc).toBe(SANDBOX_DEMO_RFC);
    expect(parsed0.subtotal).toBe(45000);
    expect(parsed0.ivaTrasladado).toBe(7200);
    expect(parsed0.total).toBe(52200);
  });
});
