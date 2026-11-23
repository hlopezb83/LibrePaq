import { db, mapCompanyRow, type CompanyDbRow } from '../connection';
import { seedAccountsForCompanyOnDb } from '../seed-data';
import { assertAccountingInvariant } from '../../shared/accounting-engine';
import type { Company } from '../../shared/types';
import { createPolizaTransaction } from './polizas.repo';
import { saveFielCredentialsForCompany } from './fiel-credentials.repo';

export function getCompanies(
  userId?: string | null,
  userEmail?: string | null,
  fullName?: string | null
): Company[] {
  if (userId) {
    const userRows = db
      .query('SELECT * FROM companies WHERE user_id = ? ORDER BY created_at ASC')
      .all(userId) as CompanyDbRow[];

    // Si el usuario es nuevo y aún no tiene empresas en su workspace, auto-crear su empresa inicial limpia
    if (userRows.length === 0) {
      const displayName = fullName || (userEmail ? userEmail.split('@')[0] : 'Mi Despacho');
      const cleanCompany = createCompanyRecord({
        name: `Despacho Contable - ${displayName}`,
        rfc: 'XAXX010101000',
        regimenFiscal: '601 - General de Ley Personas Morales',
        codigoPostal: '06000',
        userId
      });
      return [cleanCompany];
    }
    return userRows.map(mapCompanyRow);
  }

  const demoRows = db
    .query('SELECT * FROM companies WHERE user_id IS NULL OR user_id = "demo" ORDER BY created_at ASC')
    .all() as CompanyDbRow[];
  return demoRows.map(mapCompanyRow);
}

export function companyExistsById(companyId: string): boolean {
  const row = db
    .query('SELECT id FROM companies WHERE id = ?')
    .get(companyId) as { id: string } | null;
  return Boolean(row);
}

export function getCompanyById(companyId: string, userId?: string | null): Company | null {
  const row = db
    .query('SELECT * FROM companies WHERE id = ?')
    .get(companyId) as CompanyDbRow | null;
  if (!row) {
    return null;
  }
  // Aislamiento Multi-Tenant estricto: empresas privadas exigen coincidencia de userId
  if (row.user_id && row.user_id !== 'demo') {
    if (!userId || row.user_id !== userId) {
      return null;
    }
  }
  return mapCompanyRow(row);
}

export function createCompanyRecord(input: {
  name: string;
  rfc: string;
  regimenFiscal: string;
  codigoPostal: string;
  currentYear?: number;
  currentPeriod?: number;
  catalogPreset?: 'SAT_STANDARD' | 'RESICO_SIMPLIFIED' | 'CUSTOM';
  initialBankName?: string;
  initialBankAccount?: string;
  initialBankBalance?: number;
  createOpeningEntry?: boolean;
  fielCerBase64?: string;
  fielKeyBase64?: string;
  fielPassword?: string;
  userId?: string | null;
}): Company {
  const id = `comp_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const year = input.currentYear ?? 2026;
  const period = input.currentPeriod ?? 10;
  const userId = input.userId ?? null;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO companies (id, name, rfc, regimen_fiscal, codigo_postal, mask_format, current_year, current_period, created_at, user_id)
      VALUES (?, ?, ?, ?, ?, 'XXX-XX-XXX', ?, ?, ?, ?)
    `).run(id, input.name, input.rfc, input.regimenFiscal, input.codigoPostal, year, period, now, userId);

    // 1. Inicializar el catálogo contable base (Anexo 24 del SAT)
    seedAccountsForCompanyOnDb(db, id, 0, input.catalogPreset);

    // 2. Personalizar cuenta bancaria principal si se especificó
    if (input.initialBankName) {
      const bankTitle = `${input.initialBankName} Cta ${input.initialBankAccount || 'Principal'}`;
      db.prepare(`
        UPDATE accounts
        SET name = ?
        WHERE company_id = ? AND code = '102-01-001'
      `).run(bankTitle, id);
    }

    // 3. Generar póliza de apertura (Diario #1) si se solicitó saldo inicial
    const bankBalance = Number(input.initialBankBalance ?? 0);
    if (input.createOpeningEntry && bankBalance > 0) {
      const openingDate = `${year}-${String(Math.min(12, period)).padStart(2, '0')}-01`;
      createPolizaTransaction({
        companyId: id,
        ejercicio: year,
        periodo: period,
        tipo: 'DIARIO',
        fecha: openingDate,
        concepto: `Asiento de Apertura - Saldo Inicial en Bancos (${input.initialBankName || 'BBVA'}) y Capital Social`,
        cfdiUuid: null,
        origin: 'MANUAL',
        movements: [
          {
            accountId: `${id}_102-01-001`,
            cargo: bankBalance,
            abono: 0,
            referencia: 'APERTURA',
            concepto: `Apertura cuenta bancaria ${input.initialBankName || 'Bancos Nacionales'}`
          },
          {
            accountId: `${id}_301-01-001`,
            cargo: 0,
            abono: bankBalance,
            referencia: 'APERTURA',
            concepto: 'Aportación de Capital Social Inicial'
          }
        ]
      });
    }
  });

  tx();

  // 4. Si se proporcionó e.firma (.cer + .key), guardar en fiel_credentials
  if (input.fielCerBase64 && input.fielKeyBase64) {
    try {
      saveFielCredentialsForCompany(id, {
        cerBase64: input.fielCerBase64,
        keyBase64: input.fielKeyBase64,
        passphrase: input.fielPassword || ''
      });
    } catch (e) {
      console.warn('Advertencia al guardar e.firma durante onboarding:', e);
    }
  }

  const created = getCompanyById(id, userId);
  assertAccountingInvariant(created !== null, 'COMPANY_CREATE_FAILED', 'No se pudo crear la empresa.');
  return created;
}

export function updateCompanyRecord(
  id: string,
  input: { name: string; rfc: string; regimenFiscal: string; codigoPostal: string },
  userId?: string | null
): Company | null {
  const result = userId
    ? db
        .prepare(`
          UPDATE companies
          SET name = ?, rfc = ?, regimen_fiscal = ?, codigo_postal = ?
          WHERE id = ? AND (user_id = ? OR user_id IS NULL OR user_id = 'demo')
        `)
        .run(input.name, input.rfc, input.regimenFiscal, input.codigoPostal, id, userId)
    : db
        .prepare(`
          UPDATE companies
          SET name = ?, rfc = ?, regimen_fiscal = ?, codigo_postal = ?
          WHERE id = ? AND (user_id IS NULL OR user_id = 'demo')
        `)
        .run(input.name, input.rfc, input.regimenFiscal, input.codigoPostal, id);

  if (result.changes === 0) return null;
  return getCompanyById(id, userId);
}

export function deleteCompanyRecord(id: string, userId?: string | null): boolean {
  if (userId) {
    const result = db
      .prepare('DELETE FROM companies WHERE id = ? AND (user_id = ? OR user_id IS NULL OR user_id = "demo")')
      .run(id, userId);
    return result.changes > 0;
  }
  const result = db
    .prepare('DELETE FROM companies WHERE id = ? AND (user_id IS NULL OR user_id = "demo")')
    .run(id);
  return result.changes > 0;
}

export function updateCompanyPeriodRecord(
  id: string,
  currentYear: number,
  currentPeriod: number,
  userId?: string | null
): Company | null {
  const result = userId
    ? db
        .prepare('UPDATE companies SET current_year = ?, current_period = ? WHERE id = ? AND (user_id = ? OR user_id IS NULL OR user_id = "demo")')
        .run(currentYear, currentPeriod, id, userId)
    : db
        .prepare('UPDATE companies SET current_year = ?, current_period = ? WHERE id = ? AND (user_id IS NULL OR user_id = "demo")')
        .run(currentYear, currentPeriod, id);

  if (result.changes === 0) return null;
  return getCompanyById(id, userId);
}
