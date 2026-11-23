import { db } from './connection';
import { ensureBaseTables } from './db-ddl';
import { ensureProductionUpgradesOnDb, seedInitialDataOnDb } from './seed-data';
import type { Company } from '../shared/types';
import { getCompanies } from './repositories/companies.repo';
import { syncThirdPartiesFromCfdis } from './repositories/third-parties.repo';

export function ensureExtendedFiscalSeedsForCompany(company: Company): void {
  syncThirdPartiesFromCfdis(company.id);

  // Sembrar activos fijos iniciales si la empresa no tiene ninguno aún
  const assetCount = db
    .query('SELECT COUNT(*) as c FROM fixed_assets WHERE company_id = ?')
    .get(company.id) as { c: number } | null;

  if (!assetCount || assetCount.c === 0) {
    const now = new Date().toISOString();
    const insertAsset = db.prepare(`
      INSERT INTO fixed_assets (
        id, company_id, codigo, nombre, categoria, fecha_adquisicion, cfdi_uuid,
        monto_original_inversion, tasa_anual_pct, meses_depreciados_previos,
        inpc_adquisicion, inpc_medio_periodo, cuenta_activo_code, cuenta_dep_acum_code,
        cuenta_gasto_dep_code, estatus, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '156-01-001', '171-01-001', '601-01-006', 'ACTIVO', ?)
    `);

    insertAsset.run(
      `fa_${company.id}_01`,
      company.id,
      'AF-COMP-001',
      'Racks de Servidores Dell PowerEdge R760 y Switches Fibra',
      'COMPUTO_30',
      '2026-01-15',
      'D901B3C4-88A1-4F22-9E12-778899A0B1C2',
      280000,
      30,
      9,
      132.15,
      136.82,
      now
    );

    insertAsset.run(
      `fa_${company.id}_02`,
      company.id,
      'AF-COMP-002',
      'Estaciones de Trabajo MacBook Pro M3 Max (Ingeniería)',
      'COMPUTO_30',
      '2026-03-10',
      null,
      100000,
      30,
      7,
      133.42,
      136.82,
      now
    );
  }

  // Sembrar parámetros fiscales del ejercicio si no existen
  db.prepare(`
    INSERT OR IGNORE INTO tax_parameters (
      company_id, ejercicio, coeficiente_utilidad, perdidas_fiscales_pendientes,
      pagos_provisionales_anteriores, saldo_favor_iva_anterior, tipo_cambio_dof_cierre
    ) VALUES (?, ?, 0.1845, 45000, 74200, 0, 19.865)
  `).run(company.id, company.currentYear);
}

export function initDatabase(): void {
  ensureBaseTables(db);

  const cfdiCols = db.query('PRAGMA table_info(cfdi_documents)').all() as Array<{ name: string }>;
  const hasUuidRel = cfdiCols.some((col) => col.name === 'uuid_relacionado');
  if (!hasUuidRel) {
    db.exec('ALTER TABLE cfdi_documents ADD COLUMN uuid_relacionado TEXT;');
  }
  if (!cfdiCols.some((col) => col.name === 'tax_breakdown')) {
    db.exec('ALTER TABLE cfdi_documents ADD COLUMN tax_breakdown TEXT;');
  }
  if (!cfdiCols.some((col) => col.name === 'related_docs')) {
    db.exec('ALTER TABLE cfdi_documents ADD COLUMN related_docs TEXT;');
  }

  const compCols = db.query('PRAGMA table_info(companies)').all() as Array<{ name: string }>;
  const hasUserId = compCols.some((col) => col.name === 'user_id');
  if (!hasUserId) {
    db.exec('ALTER TABLE companies ADD COLUMN user_id TEXT;');
  }
  db.exec("UPDATE companies SET user_id = 'demo' WHERE user_id IS NULL AND id IN ('comp_tnn_01', 'comp_gac_02', 'comp_cve_03', 'comp_holding_master', 'comp_cib_02');");

  const countRow = db.query('SELECT COUNT(*) as count FROM companies').get() as {
    count: number;
  } | null;
  if (!countRow || countRow.count === 0) {
    seedInitialDataOnDb(db);
  }

  const companies = getCompanies();
  ensureProductionUpgradesOnDb(
    db,
    companies.map((c) => c.id)
  );

  for (const comp of companies) {
    ensureExtendedFiscalSeedsForCompany(comp);
  }
}
