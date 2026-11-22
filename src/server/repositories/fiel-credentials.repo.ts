import { db, mapCompanyRow, type CompanyDbRow } from '../connection';
import { assertAccountingInvariant } from '../../shared/accounting-engine';
import {
  generateTestFielCredentials,
  parseAndValidateFielCredentials
} from '../sat-soap';
import type { Company, FielCredentialStatus } from '../../shared/types';

function findCompany(companyId: string): Company | null {
  const row = db.query('SELECT * FROM companies WHERE id = ?').get(companyId) as CompanyDbRow | null;
  return row ? mapCompanyRow(row) : null;
}

export interface FielDbRow {
  company_id: string;
  rfc_titular: string;
  nombre_titular: string;
  numero_serie: string;
  valid_from: string;
  valid_to: string;
  sha1_fingerprint: string;
  cer_base64: string;
  key_base64: string;
  private_key_pem: string;
  updated_at: string;
}

export function getFielCredentialStatus(companyId: string): FielCredentialStatus {
  const row = db
    .query('SELECT * FROM fiel_credentials WHERE company_id = ?')
    .get(companyId) as FielDbRow | null;

  if (!row) {
    return {
      companyId,
      hasCredentials: false,
      rfcTitular: null,
      nombreTitular: null,
      numeroSerieCertificado: null,
      validFrom: null,
      validTo: null,
      isExpired: false,
      sha1Fingerprint: null,
      certificateBase64: null,
      updatedAt: null
    };
  }

  return {
    companyId,
    hasCredentials: true,
    rfcTitular: row.rfc_titular,
    nombreTitular: row.nombre_titular,
    numeroSerieCertificado: row.numero_serie,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    isExpired: new Date(row.valid_to).getTime() < Date.now(),
    sha1Fingerprint: row.sha1_fingerprint,
    certificateBase64: row.cer_base64,
    updatedAt: row.updated_at
  };
}

export function saveFielCredentialsForCompany(
  companyId: string,
  input: { cerBase64: string; keyBase64: string; passphrase: string }
): FielCredentialStatus {
  const company = findCompany(companyId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const parsed = parseAndValidateFielCredentials({
    cerBase64: input.cerBase64,
    keyBase64: input.keyBase64,
    passphrase: input.passphrase,
    fallbackRfc: company.rfc,
    fallbackNombre: company.name
  });

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO fiel_credentials (
      company_id, rfc_titular, nombre_titular, numero_serie, valid_from, valid_to,
      sha1_fingerprint, cer_base64, key_base64, private_key_pem, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id) DO UPDATE SET
      rfc_titular = excluded.rfc_titular,
      nombre_titular = excluded.nombre_titular,
      numero_serie = excluded.numero_serie,
      valid_from = excluded.valid_from,
      valid_to = excluded.valid_to,
      sha1_fingerprint = excluded.sha1_fingerprint,
      cer_base64 = excluded.cer_base64,
      key_base64 = excluded.key_base64,
      private_key_pem = excluded.private_key_pem,
      updated_at = excluded.updated_at
  `).run(
    company.id,
    parsed.rfcTitular,
    parsed.nombreTitular,
    parsed.numeroSerieCertificado,
    parsed.validFrom,
    parsed.validTo,
    parsed.sha1Fingerprint,
    parsed.certificateBase64,
    input.keyBase64,
    parsed.privateKeyPem,
    now
  );

  return getFielCredentialStatus(company.id);
}

export function generateAndInstallTestFielForCompany(
  companyId: string,
  passphrase: string
): {
  status: FielCredentialStatus;
  generatedFiles: { cerBase64: string; keyBase64: string; passphrase: string };
} {
  const company = findCompany(companyId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const generated = generateTestFielCredentials(company.rfc, company.name, passphrase);
  const status = saveFielCredentialsForCompany(company.id, {
    cerBase64: generated.cerBase64,
    keyBase64: generated.keyBase64,
    passphrase
  });

  return {
    status,
    generatedFiles: {
      cerBase64: generated.cerBase64,
      keyBase64: generated.keyBase64,
      passphrase
    }
  };
}
