export interface SqliteDdlTarget {
  exec: (sql: string) => void;
  query?: (sql: string) => { all: () => unknown[] };
}

export function ensureOptionalColumnMigrations(database: SqliteDdlTarget): void {
  if (!database.query) return;

  const taxParamCols = database.query('PRAGMA table_info(tax_parameters)').all() as Array<{ name: string }>;
  if (taxParamCols.length > 0 && !taxParamCols.some((c) => c.name === 'periodo')) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS tax_parameters_v2 (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        ejercicio INTEGER NOT NULL,
        periodo INTEGER NOT NULL DEFAULT 0,
        coeficiente_utilidad REAL NOT NULL DEFAULT 0,
        perdidas_fiscales_pendientes REAL NOT NULL DEFAULT 0,
        pagos_provisionales_anteriores REAL NOT NULL DEFAULT 0,
        saldo_favor_iva_anterior REAL NOT NULL DEFAULT 0,
        tipo_cambio_dof_cierre REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (company_id, ejercicio, periodo)
      );
      INSERT INTO tax_parameters_v2 (
        company_id, ejercicio, periodo, coeficiente_utilidad,
        perdidas_fiscales_pendientes, pagos_provisionales_anteriores,
        saldo_favor_iva_anterior, tipo_cambio_dof_cierre
      )
      SELECT
        company_id, ejercicio, 0, coeficiente_utilidad,
        perdidas_fiscales_pendientes, pagos_provisionales_anteriores,
        saldo_favor_iva_anterior, tipo_cambio_dof_cierre
      FROM tax_parameters;
      DROP TABLE tax_parameters;
      ALTER TABLE tax_parameters_v2 RENAME TO tax_parameters;
    `);
  }

  const overrideCols = database.query('PRAGMA table_info(admin_user_overrides)').all() as Array<{ name: string }>;
  if (overrideCols.length > 0 && !overrideCols.some((c) => c.name === 'platform_role')) {
    database.exec('ALTER TABLE admin_user_overrides ADD COLUMN platform_role TEXT;');
  }

  const profileTables = database
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_profiles'")
    .all() as Array<{ name: string }>;
  if (profileTables.length === 0) return;

  const profileCols = database.query('PRAGMA table_info(user_profiles)').all() as Array<{ name: string }>;
  if (!profileCols.some((c) => c.name === 'platform_role')) {
    database.exec("ALTER TABLE user_profiles ADD COLUMN platform_role TEXT NOT NULL DEFAULT 'NONE';");
  }

  const hasSuperFlag = profileCols.some((c) => c.name === 'is_superadmin');
  const hasEmail = profileCols.some((c) => c.name === 'email');
  if (hasSuperFlag && hasEmail) {
    database.exec(
      "UPDATE user_profiles SET platform_role = 'SUPERADMIN' WHERE is_superadmin = 1 OR lower(email) = 'hlopezb@gmail.com';"
    );
  } else if (hasSuperFlag) {
    database.exec("UPDATE user_profiles SET platform_role = 'SUPERADMIN' WHERE is_superadmin = 1;");
  } else if (hasEmail) {
    database.exec("UPDATE user_profiles SET platform_role = 'SUPERADMIN' WHERE lower(email) = 'hlopezb@gmail.com';");
  }
}
