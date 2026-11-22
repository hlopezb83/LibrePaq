import { describe, expect, test } from 'bun:test';
import {
  base64ToUint8Array,
  computeDerSha1,
  parseSatCertificate
} from '../src/shared/sat-certificate-parser';
import { generateTestFielCredentials } from '../src/server/sat-soap';

describe('SAT X.509 Certificate Parser (.cer DER)', () => {
  test('parses test envelope correctly', async () => {
    const creds = generateTestFielCredentials(
      'ESH2311092R7',
      'ELOGISTIX SHIPPING',
      'FielPassword2026'
    );
    const parsed = await parseSatCertificate(creds.cerBase64, 'ESH2311092R7', 'ELOGISTIX SHIPPING');

    expect(parsed.rfcTitular).toBe('ESH2311092R7');
    expect(parsed.nombreTitular).toBe('ELOGISTIX SHIPPING');
    expect(parsed.numeroSerie).toBe('30001000000500003416');
    expect(parsed.isExpired).toBe(false);
  });

  test('computes deterministic SHA-1 fingerprint for bytes', async () => {
    const sample = new Uint8Array([1, 2, 3, 4, 5]);
    const sha1 = await computeDerSha1(sample);
    expect(sha1.length).toBe(40);
  });

  test('base64ToUint8Array handles padded and clean base64', () => {
    const b64 = 'SGVsbG8gU0FU';
    const bytes = base64ToUint8Array(b64);
    const decoded = new TextDecoder().decode(bytes);
    expect(decoded).toBe('Hello SAT');
  });

  test('rejects non-DER and non-JSON buffers', async () => {
    const invalidBytes = new Uint8Array([0x00, 0x01, 0x02]);
    await expect(parseSatCertificate(invalidBytes)).rejects.toThrow(/formato X.509/i);
  });
});
