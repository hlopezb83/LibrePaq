import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { initDatabase } from '../schema';
import { createCompanyRecord, deleteCompanyRecord } from '../repositories/companies.repo';
import {
  generateAndInstallTestFielForCompany,
  getFielCredentialStatus,
  saveFielCredentialsForCompany
} from '../repositories/fiel-credentials.repo';
import { getSatDownloadRequests } from '../repositories/sat-soap-download.service';
import { generateTestFielCredentials } from '../sat-soap';
import { db } from '../connection';

describe('repositories — SAT e.firma & Sincronización Web Service', () => {
  let testCompanyId = '';

  beforeAll(() => {
    initDatabase();
    const created = createCompanyRecord({
      name: 'SAT FIEL HOLDING SA DE CV',
      rfc: 'SFH2001019K2',
      regimenFiscal: '601',
      codigoPostal: '64000',
      currentYear: 2026,
      currentPeriod: 10
    });
    testCompanyId = created.id;
  });

  afterAll(() => {
    if (testCompanyId) {
      deleteCompanyRecord(testCompanyId);
    }
  });

  test('getFielCredentialStatus returns false when company has no FIEL uploaded', () => {
    const status = getFielCredentialStatus(testCompanyId);
    expect(status.hasCredentials).toBe(false);
    expect(status.rfcTitular).toBeNull();
    expect(status.numeroSerieCertificado).toBeNull();
  });

  test('saveFielCredentialsForCompany validates and stores RSA-2048 e.firma certificate', () => {
    const testFiel = generateTestFielCredentials(
      'SFH2001019K2',
      'SAT FIEL HOLDING SA DE CV',
      'FielTestPassword2026'
    );

    const status = saveFielCredentialsForCompany(testCompanyId, {
      cerBase64: testFiel.cerBase64,
      keyBase64: testFiel.keyBase64,
      passphrase: 'FielTestPassword2026'
    });

    expect(status.hasCredentials).toBe(true);
    expect(status.rfcTitular).toBe('SFH2001019K2');
    expect(status.numeroSerieCertificado).toBeDefined();
    expect(status.sha1Fingerprint).toBeDefined();

    const current = getFielCredentialStatus(testCompanyId);
    expect(current.hasCredentials).toBe(true);
    expect(current.rfcTitular).toBe('SFH2001019K2');
  });

  test('generateAndInstallTestFielForCompany creates sandbox test credentials automatically', () => {
    const result = generateAndInstallTestFielForCompany(testCompanyId, 'OtraClaveSegura');
    expect(result.status.hasCredentials).toBe(true);
    expect(result.status.rfcTitular).toBe('SFH2001019K2');
    expect(result.generatedFiles.cerBase64.length).toBeGreaterThan(50);
  });

  test('getSatDownloadRequests returns array of requests', () => {
    const requests = getSatDownloadRequests(testCompanyId);
    expect(Array.isArray(requests)).toBe(true);
  });

  test('deleting fiel_credentials removes e.firma and resets status to false', () => {
    db.prepare('DELETE FROM fiel_credentials WHERE company_id = ?').run(testCompanyId);
    const status = getFielCredentialStatus(testCompanyId);
    expect(status.hasCredentials).toBe(false);
    expect(status.rfcTitular).toBeNull();
  });
});
