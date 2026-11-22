import { describe, expect, it } from 'bun:test';
import {
  checkRfc69BStatus,
  INITIAL_EFOS_DATABASE,
  parseSat69BCsv
} from '../sat-69b';

describe('SAT Anexo 69-B Blacklist Engine', () => {
  it('loads base initial EFOS database with known presuntos and definitivos', () => {
    expect(INITIAL_EFOS_DATABASE.length).toBeGreaterThan(0);
    const item = INITIAL_EFOS_DATABASE.find((i) => i.rfc === 'EFO120101AB1');
    expect(item).toBeDefined();
    expect(item?.situacion).toBe('DEFINITIVO');
    expect(item?.status).toBe('DEFINITIVO_EFOS');
  });

  it('checks RFC status against base database', () => {
    const resDef = checkRfc69BStatus('EFO120101AB1');
    expect(resDef.isEfos).toBe(true);
    expect(resDef.status).toBe('DEFINITIVO_EFOS');
    expect(resDef.record?.nombre).toContain('COMERCIALIZADORA');

    const resClean = checkRfc69BStatus('XAXX010101000');
    expect(resClean.isEfos).toBe(false);
    expect(resClean.status).toBe('LIMPIO');

    const resForeign = checkRfc69BStatus('XEXX010101000');
    expect(resForeign.isEfos).toBe(false);
    expect(resForeign.status).toBe('LIMPIO');
  });

  it('parses official SAT CSV format with comma delimiters and headers', () => {
    const csvContent = `
"No","RFC","Nombre del Contribuyente","Situación del contribuyente","Número y fecha de oficio global de presunción","Publicación página SAT presuntos","Publicación DOF presuntos"
"1","FAS150820AB1","FACTURAS APOCRIFAS DEL SURESTE SA DE CV","Definitivo","500-05-2023-01","15/01/2023","20/01/2023"
"2","SOP180312XX3","SIMULACIONES OPERATIVAS DEL PACIFICO SA","Presunto","500-05-2024-02","10/02/2024","14/02/2024"
"3","DES120509890","DESVIRTUADOS COMERCIALES SA DE CV","Desvirtuado","500-05-2022-03","05/05/2022","10/05/2022"
"4","FAV110101345","FAVORABLES LEGALES SC","Sentencia Favorable","500-05-2021-04","01/01/2021","05/01/2021"
    `.trim();

    const result = parseSat69BCsv(csvContent);
    expect(result.total).toBe(4);
    expect(result.definitivos).toBe(1);
    expect(result.presuntos).toBe(1);
    expect(result.desvirtuados).toBe(1);
    expect(result.favorables).toBe(1);

    const rfc1 = result.records.get('FAS150820AB1');
    expect(rfc1).toBeDefined();
    expect(rfc1?.situacion).toBe('DEFINITIVO');
    expect(rfc1?.status).toBe('DEFINITIVO_EFOS');
    expect(rfc1?.nombre).toBe('FACTURAS APOCRIFAS DEL SURESTE SA DE CV');

    const rfc2 = result.records.get('SOP180312XX3');
    expect(rfc2?.situacion).toBe('PRESUNTO');
    expect(rfc2?.status).toBe('PRESUNTO_EFOS');

    const rfc3 = result.records.get('DES120509890');
    expect(rfc3?.situacion).toBe('DESVIRTUADO');
    expect(rfc3?.status).toBe('DESVIRTUADO');

    const rfc4 = result.records.get('FAV110101345');
    expect(rfc4?.situacion).toBe('FAVORABLE');
    expect(rfc4?.status).toBe('LIMPIO');
  });

  it('handles semicolon delimited CSV with unquoted fields', () => {
    const csvContent = `
1;ABC010101AB1;CONSULTORES FANTASMA SA;Definitivo;500-05;01/01;02/01
2;XYZ991231ZZ9;SERVICIOS SOSPECHOSOS SA;Presunto;500-05;03/01;04/01
    `.trim();

    const result = parseSat69BCsv(csvContent);
    expect(result.total).toBe(2);
    expect(result.records.get('ABC010101AB1')?.status).toBe('DEFINITIVO_EFOS');
    expect(result.records.get('XYZ991231ZZ9')?.status).toBe('PRESUNTO_EFOS');
  });

  it('ignores malformed rows and safely parses empty text', () => {
    const emptyResult = parseSat69BCsv('');
    expect(emptyResult.total).toBe(0);

    const malformedResult = parseSat69BCsv('random text without commas\nfoo bar baz');
    expect(malformedResult.total).toBe(0);
  });
});
