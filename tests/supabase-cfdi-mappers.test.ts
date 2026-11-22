import { describe, expect, it } from 'bun:test';
import { mapSupabaseCfdi, type PolizaSummaryLookup } from '../src/lib/supabase/supabase-cfdi-mappers';

describe('mapSupabaseCfdi', () => {
  const baseRow = {
    id: 'cfdi_1',
    company_id: 'comp_1',
    uuid: 'AAAA-BBBB-CCCC-DDDD',
    fecha: '2026-11-12T10:00:00Z',
    tipo_comprobante: 'I',
    direction: 'EMITIDO',
    serie: 'A',
    folio: '101',
    emisor_rfc: 'TNN2105148K9',
    emisor_nombre: 'Tecnologías Nube del Norte',
    receptor_rfc: 'XAXX010101000',
    receptor_nombre: 'Cliente Demo',
    concepto_principal: 'Servicios SaaS',
    clave_prod_serv: '81112100',
    moneda: 'MXN',
    tipo_cambio: 1,
    subtotal: 10000,
    descuento: 0,
    iva_trasladado: 1600,
    isr_retenido: 0,
    iva_retenido: 0,
    total: 11600,
    metodo_pago: 'PUE',
    forma_pago: '03',
    uso_cfdi: 'G03',
    uuid_relacionado: null,
    status_sat: 'VIGENTE',
    poliza_id: 'pol_99'
  };

  it('resolves polizaFolio from separate polizaLookup map without PostgREST FK joins', () => {
    const lookup: PolizaSummaryLookup = new Map([
      ['pol_99', { tipo: 'INGRESO', folio: 14 }]
    ]);

    const mapped = mapSupabaseCfdi(baseRow, lookup);
    expect(mapped.polizaId).toBe('pol_99');
    expect(mapped.polizaFolio).toBe('INGRESO-14');
    expect(mapped.fecha).toBe('2026-11-12');
  });

  it('falls back to poliza_folio or null when polizaLookup has no matching id', () => {
    const emptyLookup: PolizaSummaryLookup = new Map();
    expect(mapSupabaseCfdi(baseRow, emptyLookup).polizaFolio).toBeNull();
    expect(mapSupabaseCfdi({ ...baseRow, poliza_folio: 'DIARIO-2' }, emptyLookup).polizaFolio).toBe(
      'DIARIO-2'
    );
  });
});
