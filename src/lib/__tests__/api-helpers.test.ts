import { describe, expect, test } from 'bun:test';
import { buildPeriodQuery, handleResponse } from '../api/api-helpers';

describe('api-helpers — Network & Query String Helpers', () => {
  test('buildPeriodQuery formats search params correctly', () => {
    const q1 = buildPeriodQuery('comp_1');
    expect(q1).toBe('companyId=comp_1');

    const q2 = buildPeriodQuery('comp_1', 2026, 10);
    expect(q2).toBe('companyId=comp_1&year=2026&period=10');
  });

  test('handleResponse returns parsed JSON for 200 OK responses', async () => {
    const fakeResponse = new Response(JSON.stringify({ ok: true, data: [1, 2, 3] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

    const parsed = await handleResponse<{ ok: boolean; data: number[] }>(fakeResponse);
    expect(parsed.ok).toBe(true);
    expect(parsed.data).toEqual([1, 2, 3]);
  });

  test('handleResponse throws error message from response JSON on 400 Bad Request', async () => {
    const fakeResponse = new Response(
      JSON.stringify({ error: 'Póliza descuadrada por $0.05' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    expect(handleResponse(fakeResponse)).rejects.toThrow('Póliza descuadrada por $0.05');
  });

  test('handleResponse falls back to HTTP status when body has no error field', async () => {
    const fakeResponse = new Response('Server Error', {
      status: 502
    });

    expect(handleResponse(fakeResponse)).rejects.toThrow('Error HTTP 502');
  });
});
