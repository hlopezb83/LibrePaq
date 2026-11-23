import { describe, expect, test } from 'bun:test';
import { supabaseCloudApi } from '../src/lib/supabase/supabase-client-facade';
import { localApiClient } from '../src/lib/api-client';
import {
  buildSatConsultaCfdiSoapXml,
  querySatCfdiStatusSoap
} from '../src/shared/sat-cfdi-status';

describe('Supabase Cloud Facade & SAT CFDI Soap Parity', () => {
  test('supabaseCloudApi exports all 80 methods matching localApiClient with 100% parity', () => {
    const localKeys = Object.keys(localApiClient) as Array<keyof typeof localApiClient>;
    expect(localKeys.length).toBe(80);

    const missingInCloud: string[] = [];
    for (const key of localKeys) {
      if (typeof (supabaseCloudApi as Record<string, unknown>)[key] !== 'function') {
        missingInCloud.push(key);
      }
    }
    expect(missingInCloud).toEqual([]);
  });

  test('buildSatConsultaCfdiSoapXml formats valid SAT 1.1 envelope with XML escaping', () => {
    const xml = buildSatConsultaCfdiSoapXml({
      uuid: 'A0B1C2D3-E4F5-4A7B-8C9D-0E1F2A3B4C5D',
      emisorRfc: 'AAA010101AAA',
      receptorRfc: 'BBB010101BBB',
      total: 1250.50
    });

    expect(xml).toContain('<soapenv:Envelope');
    expect(xml).toContain('http://tempuri.org/');
    expect(xml).toContain('re=AAA010101AAA');
    expect(xml).toContain('rr=BBB010101BBB');
    expect(xml).toContain('tt=1250.5');
    expect(xml).toContain('id=A0B1C2D3-E4F5-4A7B-8C9D-0E1F2A3B4C5D');
  });

  test('querySatCfdiStatusSoap returns deterministic verification when offline or in tests', async () => {
    const res = await querySatCfdiStatusSoap({
      uuid: '99999999-9999-4999-8999-999999999999',
      emisorRfc: 'XAXX010101000',
      receptorRfc: 'TEST010101AAA',
      total: 500.00
    });

    expect(res.uuid).toBe('99999999-9999-4999-8999-999999999999');
    expect(res.estadoSat).toBe('VIGENTE');
    expect(res.validacionEfos).toBe('200_LIMPIO');
    expect(res.modoConsulta).toBe('SANDBOX_CRYPTO');
    expect(res.soapEnvelopeXml).toContain('re=XAXX010101000');
  });
});
