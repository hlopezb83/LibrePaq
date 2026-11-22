import { describe, expect, it } from 'bun:test';
import { generateMonthlyCfdiBatchXmls, generateDeterministicUuid } from '../src/shared/sat-monthly-batch';
import { parseCfdiXmlString } from '../src/shared/cfdi-xml';

describe('generateMonthlyCfdiBatchXmls & Idempotency', () => {
  const company = {
    id: 'comp_demo',
    rfc: 'TNN180920K71',
    name: 'TRANSPORTES DEL NORTE Y NORESTE SA DE CV'
  };

  it('generates 11 received expense invoices for full month when RECIBIDOS', () => {
    const xmls = generateMonthlyCfdiBatchXmls({
      company,
      tipoSolicitud: 'RECIBIDOS',
      fechaInicial: '2026-10-01',
      fechaFinal: '2026-10-31'
    });

    expect(xmls.length).toBe(11);
    for (const xml of xmls) {
      const parsed = parseCfdiXmlString(xml);
      expect(parsed).not.toBeNull();
      expect(parsed?.receptorRfc).toBe('TNN180920K71');
      expect(parsed?.fecha.startsWith('2026-10')).toBe(true);
      expect(parsed?.total).toBeGreaterThan(0);
    }
  });

  it('generates 6 issued customer invoices when EMITIDOS', () => {
    const xmls = generateMonthlyCfdiBatchXmls({
      company,
      tipoSolicitud: 'EMITIDOS',
      fechaInicial: '2026-10-01',
      fechaFinal: '2026-10-31'
    });

    expect(xmls.length).toBe(6);
    for (const xml of xmls) {
      const parsed = parseCfdiXmlString(xml);
      expect(parsed).not.toBeNull();
      expect(parsed?.emisorRfc).toBe('TNN180920K71');
      expect(parsed?.fecha.startsWith('2026-10')).toBe(true);
      expect(parsed?.total).toBeGreaterThan(0);
    }
  });

  it('generates full monthly ledger (17 invoices) when AMBOS', () => {
    const xmls = generateMonthlyCfdiBatchXmls({
      company,
      tipoSolicitud: 'AMBOS',
      fechaInicial: '2026-10-01',
      fechaFinal: '2026-10-31'
    });

    expect(xmls.length).toBe(17);
  });

  it('strictly preserves idempotency: calling batch generation repeatedly yields identical UUIDs and XMLs', () => {
    const run1 = generateMonthlyCfdiBatchXmls({
      company,
      tipoSolicitud: 'AMBOS',
      fechaInicial: '2026-10-01',
      fechaFinal: '2026-10-31'
    });
    const run2 = generateMonthlyCfdiBatchXmls({
      company,
      tipoSolicitud: 'AMBOS',
      fechaInicial: '2026-10-01',
      fechaFinal: '2026-10-31'
    });

    expect(run1).toEqual(run2);

    const uuids1 = run1.map((xml) => parseCfdiXmlString(xml)?.uuid);
    const uuids2 = run2.map((xml) => parseCfdiXmlString(xml)?.uuid);
    expect(uuids1).toEqual(uuids2);
  });

  it('produces valid RFC 4122 v4 formatted UUIDs deterministically', () => {
    const uuid1 = generateDeterministicUuid('SEED_ALPHA');
    const uuid2 = generateDeterministicUuid('SEED_ALPHA');
    const uuid3 = generateDeterministicUuid('SEED_BETA');

    expect(uuid1).toBe(uuid2);
    expect(uuid1).not.toBe(uuid3);
    expect(uuid1).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/);
  });
});
