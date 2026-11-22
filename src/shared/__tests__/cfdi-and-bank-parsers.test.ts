import { describe, expect, test } from 'bun:test';
import {
  buildCfdi40Xml,
  decodeXmlEntities,
  escapeXmlAttr,
  parseCfdiXmlString
} from '../cfdi-xml';
import { parseBankStatementCsv, splitCsvLine } from '../csv-bank-parser';

describe('Power of 10 Fiscal Rules — CFDI 4.0 XML Sanitization & Parser', () => {
  test('escapes and decodes XML entities symmetrically without corrupting attributes', () => {
    const raw = 'COMPAÑÍA "EL ÁGUILA" & ASOCIADOS <NORTE> \'S.A.\'';
    const escaped = escapeXmlAttr(raw);
    expect(escaped).not.toContain('"');
    expect(escaped).not.toContain('<');
    expect(escaped).toContain('&amp;');
    expect(escaped).toContain('&quot;');
    expect(decodeXmlEntities(escaped)).toBe(raw);
  });

  test('round-trips buildCfdi40Xml and parseCfdiXmlString with special characters', () => {
    const xml = buildCfdi40Xml({
      uuid: '12345678-1234-4321-8765-1234567890AB',
      serie: 'FAC',
      folio: '9001',
      fecha: '2026-10-15',
      tipoComprobante: 'I',
      emisorRfc: 'AAA010101AAA',
      emisorNombre: 'PROVEEDOR "ALFA & OMEGA" <MX>',
      receptorRfc: 'SLO2204159A1',
      receptorNombre: 'SOLUCIONES LOGÍSTICAS & CARGA',
      conceptoPrincipal: 'SERVICIO DE NUBE "PRO" & SOPORTE 24/7',
      claveProdServ: '81112100',
      subtotal: 10000,
      descuento: 0,
      ivaTrasladado: 1600,
      isrRetenido: 0,
      ivaRetenido: 0,
      total: 11600,
      moneda: 'MXN',
      tipoCambio: 1,
      metodoPago: 'PUE',
      formaPago: '03',
      usoCfdi: 'G03',
      uuidRelacionado: null
    });

    const parsed = parseCfdiXmlString(xml);
    expect(parsed.uuid).toBe('12345678-1234-4321-8765-1234567890AB');
    expect(parsed.emisorRfc).toBe('AAA010101AAA');
    expect(parsed.receptorRfc).toBe('SLO2204159A1');
    expect(parsed.emisorNombre).toBe('PROVEEDOR "ALFA & OMEGA" <MX>');
    expect(parsed.conceptoPrincipal).toBe('SERVICIO DE NUBE "PRO" & SOPORTE 24/7');
    expect(parsed.subtotal).toBe(10000);
    expect(parsed.ivaTrasladado).toBe(1600);
    expect(parsed.total).toBe(11600);
  });
});

describe('Power of 10 Fiscal Rules — RFC-4180 CSV Bank Statement Parser', () => {
  test('splits CSV lines respecting quoted fields with embedded commas and currency symbols', () => {
    const cells = splitCsvLine('2026-10-18,"PAGO PROVEEDOR, S.A. DE C.V.",SPEI-9912,"$21,576.00"');
    expect(cells).toEqual([
      '2026-10-18',
      'PAGO PROVEEDOR, S.A. DE C.V.',
      'SPEI-9912',
      '$21,576.00'
    ]);
  });

  test('parses multi-line bank statement CSV ignoring header and preserving cargo/abono columns', () => {
    const csv = [
      'Fecha,Referencia,Concepto,Monto',
      '2026-10-05,SPEI-101,"COBRO FACTURA CLIENTE, S.A.","$184,260.00"',
      '2026-10-08,DOM-202,"PAGO CLOUD AWS, INC.",-21576.00'
    ].join('\n');

    const rows = parseBankStatementCsv(csv, '2026-10-15');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      fecha: '2026-10-05',
      referencia: 'SPEI-101',
      descripcion: 'COBRO FACTURA CLIENTE, S.A.',
      cargoBanco: 0,
      abonoBanco: 184260
    });
    expect(rows[1]).toEqual({
      fecha: '2026-10-08',
      referencia: 'DOM-202',
      descripcion: 'PAGO CLOUD AWS, INC.',
      cargoBanco: 21576,
      abonoBanco: 0
    });
  });
});
