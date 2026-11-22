import { describe, expect, it } from 'bun:test';
import {
  extractCompanyFromCsfText,
  extractCompanyFromCsfFile,
  parseUploadedCompanyFile
} from '../sat-csf-extractor';

describe('SAT Constancia de Situación Fiscal (CSF) Extractor', () => {
  it('extracts Persona Moral data with simplified SAT name (CFDI 4.0 compliant)', () => {
    const sampleCsf = `
      SERVICIO DE ADMINISTRACIÓN TRIBUTARIA
      CÉDULA DE IDENTIFICACIÓN FISCAL
      RFC: BBA830831LJ2
      idCIF: 19020394821
      CONSTANCIA DE SITUACIÓN FISCAL
      Lugar y Fecha de Emisión: CIUDAD DE MÉXICO A 15 DE ENERO DE 2026
      
      Datos de Identificación del Contribuyente
      Denominación/Razón Social: TECNOLOGIAS CONTABLES DE MEXICO
      Régimen Capital: SOCIEDAD ANONIMA DE CAPITAL VARIABLE
      Fecha de inicio de operaciones: 12 DE MAYO DE 2018
      Estatus en el padrón: ACTIVO
      
      Datos del Domicilio Registrado
      Código Postal: 06600
      Tipo de Vialidad: AVENIDA
      Nombre de Vialidad: REFORMA
      
      Regímenes:
      Régimen General de Ley Personas Morales
      Fecha de inicio: 12/05/2018
    `;

    const result = extractCompanyFromCsfText(sampleCsf);
    expect(result).not.toBeNull();
    expect(result?.rfc).toBe('BBA830831LJ2');
    expect(result?.personType).toBe('MORAL');
    expect(result?.name).toBe('TECNOLOGIAS CONTABLES DE MEXICO');
    expect(result?.codigoPostal).toBe('06600');
    expect(result?.regimenFiscal).toContain('601');
  });

  it('extracts Persona Física with separate name and apellidos', () => {
    const sampleCsfFisica = `
      CÉDULA DE IDENTIFICACIÓN FISCAL
      Registro Federal de Contribuyentes: LOPH850101XYZ
      
      Datos de Identificación del Contribuyente
      CURP: LOPH850101HDFRXX01
      Nombre (s): HECTOR
      Primer Apellido: LOPEZ
      Segundo Apellido: HERNANDEZ
      Fecha de inicio de operaciones: 01 DE ENERO DE 2020
      
      Datos del Domicilio Registrado
      Código Postal: 64000
      
      Regímenes:
      Régimen Simplificado de Confianza (RESICO)
    `;

    const result = extractCompanyFromCsfText(sampleCsfFisica);
    expect(result).not.toBeNull();
    expect(result?.rfc).toBe('LOPH850101XYZ');
    expect(result?.personType).toBe('FISICA');
    expect(result?.name).toBe('HECTOR LOPEZ HERNANDEZ');
    expect(result?.codigoPostal).toBe('64000');
    expect(result?.regimenFiscal).toContain('626');
  });

  it('safely extracts from mock PDF buffer containing FlateDecode stream', async () => {
    // We create a tiny mock PDF with text inside
    const pdfText = 'BT /F1 12 Tf (Registro Federal de Contribuyentes: BBA830831LJ2) Tj (Denominacion/Razon Social: ASESORES FISCALES DEL BAJIO) Tj (Regimen Capital: S.A. DE C.V.) Tj (Codigo Postal: 37000) Tj (Regimen General de Ley Personas Morales) Tj ET';
    const fakePdf = `%PDF-1.4\n1 0 obj\n<< /Length ${pdfText.length} >>\nstream\n${pdfText}\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;
    
    const buffer = Buffer.from(fakePdf, 'latin1');
    const result = await extractCompanyFromCsfFile(buffer);
    expect(result).not.toBeNull();
    expect(result?.rfc).toBe('BBA830831LJ2');
    expect(result?.name).toBe('ASESORES FISCALES DEL BAJIO');
    expect(result?.codigoPostal).toBe('37000');
    expect(result?.personType).toBe('MORAL');
  });

  it('parseUploadedCompanyFile handles both XML CFDI and CSF PDF Files', async () => {
    // 1. Mock CFDI XML File
    const xmlContent = `<cfdi:Comprobante LugarExpedicion="06600">
      <cfdi:Emisor Rfc="EKU9003173C9" Nombre="ESCUELA KEMPER URGATE" RegimenFiscal="601" />
      <cfdi:Receptor Rfc="XAXX010101000" Nombre="PUBLICO EN GENERAL" />
    </cfdi:Comprobante>`;
    const xmlFile = new File([xmlContent], 'factura_ingreso.xml', { type: 'text/xml' });
    const xmlRes = await parseUploadedCompanyFile(xmlFile);
    expect(xmlRes.source).toBe('CFDI');
    expect(xmlRes.primary?.rfc).toBe('EKU9003173C9');
    expect(xmlRes.primary?.name).toBe('ESCUELA KEMPER URGATE');
    expect(xmlRes.primary?.codigoPostal).toBe('06600');

    // 2. Mock CSF PDF File
    const pdfText = 'BT (Registro Federal de Contribuyentes: TNN2105148K2) Tj (Denominacion/Razon Social: TECNO NUBE DEL NORTE) Tj (Regimen Capital: S.A.P.I. DE C.V.) Tj (Codigo Postal: 64000) Tj (Regimen General de Ley Personas Morales) Tj ET';
    const fakePdf = `%PDF-1.4\n1 0 obj\n<< /Length ${pdfText.length} >>\nstream\n${pdfText}\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;
    const pdfFile = new File([Buffer.from(fakePdf, 'latin1')], 'Constancia_Situacion_Fiscal.pdf', {
      type: 'application/pdf'
    });
    const pdfRes = await parseUploadedCompanyFile(pdfFile);
    expect(pdfRes.source).toBe('CSF');
    expect(pdfRes.primary?.rfc).toBe('TNN2105148K2');
    expect(pdfRes.primary?.name).toBe('TECNO NUBE DEL NORTE');
    expect(pdfRes.primary?.codigoPostal).toBe('64000');
    expect(pdfRes.primary?.personType).toBe('MORAL');
  });
});
