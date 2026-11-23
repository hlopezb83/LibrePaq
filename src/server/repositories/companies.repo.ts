import { db, mapCompanyRow, type CompanyDbRow } from '../connection';
import { seedAccountsForCompanyOnDb } from '../seed-data';
import { assertAccountingInvariant } from '../../shared/accounting-engine';
import type { Company } from '../../shared/types';
import { createPolizaTransaction } from './polizas.repo';
import { saveFielCredentialsForCompany } from './fiel-credentials.repo';
import { getEffectiveCompanyRoleRepo, isWorkspaceSocioRepo } from './workspace-members.repo';

export function getCompanies(
  userId?: string | null,
  userEmail?: string | null,
  fullName?: string | null
): Company[] {
  if (userId) {
    const userRows = db
      .query('SELECT * FROM companies WHERE user_id = ? ORDER BY created_at ASC')
      .all(userId) as CompanyDbRow[];

    const candidateShared = db
      .query("SELECT * FROM companies WHERE user_id IS NOT NULL AND user_id != 'demo' AND user_id != ? ORDER BY created_at ASC")
      .all(userId) as CompanyDbRow[];
    const sharedRows = candidateShared.filter(
      (row) => getEffectiveCompanyRoleRepo(row.id, userId, userEmail).role !== null
    );
    const allRows = [...userRows, ...sharedRows];

    // Si el usuario es nuevo y aún no tiene empresas propias ni compartidas, auto-crear su empresa inicial limpia
    if (allRows.length === 0) {
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
    return allRows.map(mapCompanyRow);
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

export function getCompanyById(
  companyId: string,
  userId?: string | null,
  userEmail?: string | null
): Company | null {
  const row = db
    .query('SELECT * FROM companies WHERE id = ?')
    .get(companyId) as CompanyDbRow | null;
  if (!row) {
    return null;
  }
  // Aislamiento Multi-Tenant estricto: empresas privadas exigen coincidencia de userId o membresía RBAC de despacho
  if (row.user_id && row.user_id !== 'demo') {
    if (userId && row.user_id === userId) {
      return mapCompanyRow(row);
    }
    if (userId || userEmail) {
      const eff = getEffectiveCompanyRoleRepo(companyId, userId, userEmail);
      if (eff.role !== null) {
        return mapCompanyRow(row);
      }
    }
    return null;
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

function canMutateCompanyRecord(
  id: string,
  userId?: string | null,
  userEmail?: string | null,
  requireSocioForDelete = false
): boolean {
  const row = db.query('SELECT user_id FROM companies WHERE id = ?').get(id) as {
    user_id: string | null;
  } | null;
  if (!row) return false;
  if (row.user_id && row.user_id !== 'demo') {
    if (userId && row.user_id === userId) return true;
    if (!userId && !userEmail) return false;
    const eff = getEffectiveCompanyRoleRepo(id, userId, userEmail);
    return requireSocioForDelete ? eff.role === 'SOCIO' : eff.canWrite;
  }
  if (row.user_id === 'demo' && userId) {
    return isWorkspaceSocioRepo('ws_demo', userId, userEmail);
  }
  return true;
}

export function updateCompanyRecord(
  id: string,
  input: { name: string; rfc: string; regimenFiscal: string; codigoPostal: string },
  userId?: string | null,
  userEmail?: string | null
): Company | null {
  if (!canMutateCompanyRecord(id, userId, userEmail)) return null;
  const result = db
    .prepare(
      'UPDATE companies SET name = ?, rfc = ?, regimen_fiscal = ?, codigo_postal = ? WHERE id = ?'
    )
    .run(input.name, input.rfc, input.regimenFiscal, input.codigoPostal, id);

  if (result.changes === 0) return null;
  return getCompanyById(id, userId, userEmail);
}

export function deleteCompanyRecord(
  id: string,
  userId?: string | null,
  userEmail?: string | null
): boolean {
  if (!canMutateCompanyRecord(id, userId, userEmail, true)) return false;
  const result = db.prepare('DELETE FROM companies WHERE id = ?').run(id);
  return result.changes > 0;
}

export function updateCompanyPeriodRecord(
  id: string,
  currentYear: number,
  currentPeriod: number,
  userId?: string | null,
  userEmail?: string | null
): Company | null {
  if (!canMutateCompanyRecord(id, userId, userEmail)) return null;
  const result = db
    .prepare('UPDATE companies SET current_year = ?, current_period = ? WHERE id = ?')
    .run(currentYear, currentPeriod, id);

  if (result.changes === 0) return null;
  return getCompanyById(id, userId, userEmail);
}
