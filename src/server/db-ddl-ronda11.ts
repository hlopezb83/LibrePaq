import type { SqliteDdlTarget } from './db-migrations';

export const RONDA11_TABLES_DDL = `
  CREATE TABLE IF NOT EXISTS business_segments (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_id TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(company_id, code)
  );

  CREATE TABLE IF NOT EXISTS poliza_templates (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'DIARIO' CHECK (tipo IN ('INGRESO', 'EGRESO', 'DIARIO')),
    concepto_default TEXT NOT NULL DEFAULT '',
    movements_json TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS custom_inpc_entries (
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    inpc_value REAL NOT NULL,
    source TEXT NOT NULL DEFAULT 'MANUAL',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (company_id, year, month)
  );

  CREATE TABLE IF NOT EXISTS fiscal_loss_carryforwards (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    loss_year INTEGER NOT NULL,
    original_amount REAL NOT NULL DEFAULT 0,
    applied_amount REAL NOT NULL DEFAULT 0,
    remaining_amount REAL NOT NULL DEFAULT 0,
    inpc_first_update_month INTEGER,
    inpc_last_applied REAL,
    notes TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(company_id, loss_year)
  );

  CREATE INDEX IF NOT EXISTS idx_business_segments_company ON business_segments(company_id, code);
  CREATE INDEX IF NOT EXISTS idx_poliza_templates_company ON poliza_templates(company_id, name);
  CREATE INDEX IF NOT EXISTS idx_fiscal_loss_carryforwards_company ON fiscal_loss_carryforwards(company_id, loss_year);
  CREATE INDEX IF NOT EXISTS idx_poliza_movements_segment ON poliza_movements(business_segment_id);
`;

function addMissingColumn(
  database: SqliteDdlTarget,
  existingCols: ReadonlyArray<{ name: string }>,
  table: string,
  col: string,
  definition: string
): void {
  if (!existingCols.some((c) => c.name === col)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${definition};`);
  }
}

function migrateThirdPartiesSqlite(database: SqliteDdlTarget): void {
  if (!database.query) return;
  const tpMeta = database
    .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'third_parties'")
    .all() as Array<{ sql?: string }>;
  const tableSql = tpMeta[0]?.sql || '';
  const hasLegacyUnique = /UNIQUE\s*\(\s*company_id\s*,\s*rfc\s*\)/i.test(tableSql);
  const lacksExpandedOps = !tableSql.includes("'02'") || !tableSql.includes("'87'");

  if (tableSql && (hasLegacyUnique || lacksExpandedOps)) {
    const tpCols = database.query('PRAGMA table_info(third_parties)').all() as Array<{ name: string }>;
    const hasIdFiscal = tpCols.some((c) => c.name === 'id_fiscal');
    const hasPais = tpCols.some((c) => c.name === 'pais');
    const hasJuris = tpCols.some((c) => c.name === 'jurisdiccion_fiscal');
    const hasRegion = tpCols.some((c) => c.name === 'region_fronteriza');
    const hasDedPct = tpCols.some((c) => c.name === 'deductible_pct');

    database.exec(`
      CREATE TABLE third_parties_r11 (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        rfc TEXT NOT NULL,
        nombre TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT 'PROVEEDOR',
        cuenta_operacion_code TEXT NOT NULL,
        cuenta_contrapartida_code TEXT NOT NULL,
        tipo_tercero_diot TEXT NOT NULL DEFAULT '04',
        tipo_operacion_diot TEXT NOT NULL DEFAULT '85' CHECK (tipo_operacion_diot IN ('02','03','06','07','08','85','87')),
        tasa_iva_default INTEGER NOT NULL DEFAULT 16,
        estatus_69b TEXT NOT NULL DEFAULT 'LIMPIO',
        id_fiscal TEXT,
        pais TEXT,
        jurisdiccion_fiscal TEXT,
        region_fronteriza TEXT NOT NULL DEFAULT 'NORTE',
        deductible_pct INTEGER NOT NULL DEFAULT 100,
        updated_at TEXT NOT NULL
      );
      INSERT INTO third_parties_r11 (
        id, company_id, rfc, nombre, rol, cuenta_operacion_code, cuenta_contrapartida_code,
        tipo_tercero_diot, tipo_operacion_diot, tasa_iva_default, estatus_69b,
        id_fiscal, pais, jurisdiccion_fiscal, region_fronteriza, deductible_pct, updated_at
      )
      SELECT
        id, company_id, rfc, nombre, rol, cuenta_operacion_code, cuenta_contrapartida_code,
        tipo_tercero_diot,
        CASE WHEN tipo_operacion_diot IN ('02','03','06','07','08','85','87') THEN tipo_operacion_diot ELSE '85' END,
        tasa_iva_default, estatus_69b,
        ${hasIdFiscal ? 'id_fiscal' : 'NULL'},
        ${hasPais ? 'pais' : 'NULL'},
        ${hasJuris ? 'jurisdiccion_fiscal' : 'NULL'},
        ${hasRegion ? "COALESCE(NULLIF(region_fronteriza, ''), 'NORTE')" : "'NORTE'"},
        ${hasDedPct ? 'CAST(COALESCE(deductible_pct, 100) AS INTEGER)' : '100'},
        updated_at
      FROM third_parties;
      DROP TABLE third_parties;
      ALTER TABLE third_parties_r11 RENAME TO third_parties;
    `);
  } else {
    const tpCols = database.query('PRAGMA table_info(third_parties)').all() as Array<{ name: string }>;
    if (tpCols.length > 0) {
      addMissingColumn(database, tpCols, 'third_parties', 'region_fronteriza', "TEXT NOT NULL DEFAULT 'NORTE'");
      addMissingColumn(database, tpCols, 'third_parties', 'deductible_pct', 'INTEGER NOT NULL DEFAULT 100');
    }
  }

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_third_parties_company_rfc_non_foreign
      ON third_parties(company_id, rfc) WHERE tipo_tercero_diot <> '05';
    CREATE UNIQUE INDEX IF NOT EXISTS uq_third_parties_company_rfc_foreign
      ON third_parties(company_id, rfc, COALESCE(id_fiscal, ''), nombre) WHERE tipo_tercero_diot = '05';
  `);
}

export function ensureRonda11TablesAndMigrations(database: SqliteDdlTarget): void {
  if (database.query) {
    const cfdiCols = database.query('PRAGMA table_info(cfdi_documents)').all() as Array<{ name: string }>;
    if (cfdiCols.length > 0) {
      addMissingColumn(database, cfdiCols, 'cfdi_documents', 'validacion_efos', 'TEXT');
      addMissingColumn(database, cfdiCols, 'cfdi_documents', 'es_cancelable', 'TEXT');
      addMissingColumn(database, cfdiCols, 'cfdi_documents', 'estatus_cancelacion', 'TEXT');
      addMissingColumn(database, cfdiCols, 'cfdi_documents', 'deductible_pct', 'INTEGER NOT NULL DEFAULT 100');
      addMissingColumn(database, cfdiCols, 'cfdi_documents', 'is_foreign_no_cfdi', 'INTEGER NOT NULL DEFAULT 0');
    }

    const movCols = database.query('PRAGMA table_info(poliza_movements)').all() as Array<{ name: string }>;
    if (movCols.length > 0) {
      addMissingColumn(database, movCols, 'poliza_movements', 'payment_method_sat', 'TEXT');
      addMissingColumn(database, movCols, 'poliza_movements', 'bank_code_ori', 'TEXT');
      addMissingColumn(database, movCols, 'poliza_movements', 'account_ori', 'TEXT');
      addMissingColumn(database, movCols, 'poliza_movements', 'bank_code_dest', 'TEXT');
      addMissingColumn(database, movCols, 'poliza_movements', 'account_dest', 'TEXT');
      addMissingColumn(database, movCols, 'poliza_movements', 'beneficiary_name', 'TEXT');
      addMissingColumn(database, movCols, 'poliza_movements', 'beneficiary_rfc', 'TEXT');
      addMissingColumn(database, movCols, 'poliza_movements', 'cheque_num', 'TEXT');
      addMissingColumn(database, movCols, 'poliza_movements', 'business_segment_id', 'TEXT');
    }

    const faCols = database.query('PRAGMA table_info(fixed_assets)').all() as Array<{ name: string }>;
    if (faCols.length > 0) {
      addMissingColumn(database, faCols, 'fixed_assets', 'fecha_baja', 'TEXT');
      addMissingColumn(database, faCols, 'fixed_assets', 'precio_venta', 'REAL');
      addMissingColumn(database, faCols, 'fixed_assets', 'baja_poliza_id', 'TEXT');
      addMissingColumn(database, faCols, 'fixed_assets', 'vehicle_cap_type', 'TEXT');
    }

    migrateThirdPartiesSqlite(database);
  }

  database.exec(RONDA11_TABLES_DDL);
}
