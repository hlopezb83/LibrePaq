export const CREATE_TABLES_DDL = `
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rfc TEXT NOT NULL,
    regimen_fiscal TEXT NOT NULL,
    codigo_postal TEXT NOT NULL,
    mask_format TEXT NOT NULL DEFAULT 'XXX-XX-XXX',
    current_year INTEGER NOT NULL DEFAULT 2026,
    current_period INTEGER NOT NULL DEFAULT 10,
    created_at TEXT NOT NULL,
    user_id TEXT
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_code TEXT,
    type TEXT NOT NULL,
    nature TEXT NOT NULL,
    level INTEGER NOT NULL,
    is_affectable INTEGER NOT NULL DEFAULT 1,
    sat_group_code TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'MXN',
    initial_balance REAL NOT NULL DEFAULT 0,
    UNIQUE(company_id, code)
  );

  CREATE TABLE IF NOT EXISTS cfdi_documents (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    uuid TEXT NOT NULL,
    fecha TEXT NOT NULL,
    tipo_comprobante TEXT NOT NULL,
    direction TEXT NOT NULL,
    serie TEXT NOT NULL,
    folio TEXT NOT NULL,
    emisor_rfc TEXT NOT NULL,
    emisor_nombre TEXT NOT NULL,
    receptor_rfc TEXT NOT NULL,
    receptor_nombre TEXT NOT NULL,
    concepto_principal TEXT NOT NULL,
    clave_prod_serv TEXT NOT NULL,
    moneda TEXT NOT NULL DEFAULT 'MXN',
    tipo_cambio REAL NOT NULL DEFAULT 1,
    subtotal REAL NOT NULL,
    descuento REAL NOT NULL DEFAULT 0,
    iva_trasladado REAL NOT NULL DEFAULT 0,
    isr_retenido REAL NOT NULL DEFAULT 0,
    iva_retenido REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    metodo_pago TEXT NOT NULL DEFAULT 'PUE',
    forma_pago TEXT NOT NULL DEFAULT '03',
    uso_cfdi TEXT NOT NULL DEFAULT 'G03',
    uuid_relacionado TEXT,
    status_sat TEXT NOT NULL DEFAULT 'VIGENTE',
    poliza_id TEXT,
    xml_raw TEXT NOT NULL,
    UNIQUE(company_id, uuid)
  );

  CREATE TABLE IF NOT EXISTS polizas (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    folio INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    ejercicio INTEGER NOT NULL,
    periodo INTEGER NOT NULL,
    concepto TEXT NOT NULL,
    cfdi_uuid TEXT,
    origin TEXT NOT NULL DEFAULT 'MANUAL',
    created_at TEXT NOT NULL,
    UNIQUE(company_id, tipo, ejercicio, periodo, folio)
  );

  CREATE TABLE IF NOT EXISTS poliza_movements (
    id TEXT PRIMARY KEY,
    poliza_id TEXT NOT NULL REFERENCES polizas(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    referencia TEXT NOT NULL DEFAULT '',
    concepto TEXT NOT NULL DEFAULT '',
    cargo REAL NOT NULL DEFAULT 0,
    abono REAL NOT NULL DEFAULT 0,
    cfdi_uuid TEXT
  );

  CREATE TABLE IF NOT EXISTS bank_statement_lines (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL,
    ejercicio INTEGER NOT NULL,
    periodo INTEGER NOT NULL,
    referencia TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    cargo_banco REAL NOT NULL DEFAULT 0,
    abono_banco REAL NOT NULL DEFAULT 0,
    matched_movement_id TEXT
  );

  CREATE TABLE IF NOT EXISTS fiel_credentials (
    company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    rfc_titular TEXT NOT NULL,
    nombre_titular TEXT NOT NULL,
    numero_serie TEXT NOT NULL,
    valid_from TEXT NOT NULL,
    valid_to TEXT NOT NULL,
    sha1_fingerprint TEXT NOT NULL,
    cer_base64 TEXT NOT NULL,
    key_base64 TEXT NOT NULL,
    private_key_pem TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sat_download_requests (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    id_solicitud_sat TEXT NOT NULL,
    tipo_solicitud TEXT NOT NULL,
    fecha_inicial TEXT NOT NULL,
    fecha_final TEXT NOT NULL,
    estado_solicitud TEXT NOT NULL,
    codigo_estado_sat TEXT NOT NULL,
    mensaje_sat TEXT NOT NULL,
    id_paquete_sat TEXT,
    cfdis_descargados INTEGER NOT NULL DEFAULT 0,
    modo_ejecucion TEXT NOT NULL DEFAULT 'SANDBOX_CRYPTO',
    soap_request_xml TEXT NOT NULL,
    soap_response_xml TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS period_locks (
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    ejercicio INTEGER NOT NULL,
    periodo INTEGER NOT NULL,
    is_locked INTEGER NOT NULL DEFAULT 0,
    locked_at TEXT,
    notes TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (company_id, ejercicio, periodo)
  );

  CREATE TABLE IF NOT EXISTS third_parties (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    rfc TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'PROVEEDOR',
    cuenta_operacion_code TEXT NOT NULL,
    cuenta_contrapartida_code TEXT NOT NULL,
    tipo_tercero_diot TEXT NOT NULL DEFAULT '04',
    tipo_operacion_diot TEXT NOT NULL DEFAULT '85',
    tasa_iva_default INTEGER NOT NULL DEFAULT 16,
    estatus_69b TEXT NOT NULL DEFAULT 'LIMPIO',
    updated_at TEXT NOT NULL,
    UNIQUE(company_id, rfc)
  );

  CREATE TABLE IF NOT EXISTS fixed_assets (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    fecha_adquisicion TEXT NOT NULL,
    cfdi_uuid TEXT,
    monto_original_inversion REAL NOT NULL,
    tasa_anual_pct REAL NOT NULL,
    meses_depreciados_previos INTEGER NOT NULL DEFAULT 0,
    inpc_adquisicion REAL NOT NULL DEFAULT 132.54,
    inpc_medio_periodo REAL NOT NULL DEFAULT 136.82,
    cuenta_activo_code TEXT NOT NULL DEFAULT '156-01-001',
    cuenta_dep_acum_code TEXT NOT NULL DEFAULT '171-01-001',
    cuenta_gasto_dep_code TEXT NOT NULL DEFAULT '601-01-006',
    estatus TEXT NOT NULL DEFAULT 'ACTIVO',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tax_parameters (
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    ejercicio INTEGER NOT NULL,
    coeficiente_utilidad REAL NOT NULL DEFAULT 0.1845,
    perdidas_fiscales_pendientes REAL NOT NULL DEFAULT 45000,
    pagos_provisionales_anteriores REAL NOT NULL DEFAULT 128500,
    saldo_favor_iva_anterior REAL NOT NULL DEFAULT 0,
    tipo_cambio_dof_cierre REAL NOT NULL DEFAULT 19.865,
    PRIMARY KEY (company_id, ejercicio)
  );

  CREATE INDEX IF NOT EXISTS idx_poliza_movements_poliza_id ON poliza_movements(poliza_id);
  CREATE INDEX IF NOT EXISTS idx_poliza_movements_account_id ON poliza_movements(account_id);
  CREATE INDEX IF NOT EXISTS idx_polizas_company_period ON polizas(company_id, ejercicio, periodo);
  CREATE INDEX IF NOT EXISTS idx_cfdi_company_fecha ON cfdi_documents(company_id, fecha DESC);
  CREATE INDEX IF NOT EXISTS idx_cfdi_poliza_id ON cfdi_documents(poliza_id);
  CREATE INDEX IF NOT EXISTS idx_bank_lines_period ON bank_statement_lines(company_id, account_id, ejercicio, periodo);
  CREATE INDEX IF NOT EXISTS idx_accounts_company_parent ON accounts(company_id, parent_code);

  CREATE TABLE IF NOT EXISTS platform_broadcasts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    active INTEGER NOT NULL DEFAULT 1,
    starts_at TEXT,
    expires_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_user_overrides (
    user_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'ACTIVO',
    updated_at TEXT NOT NULL,
    updated_by TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_platform_broadcasts_active ON platform_broadcasts(active, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);
`;

export function ensureBaseTables(database: { exec: (sql: string) => void }): void {
  database.exec(CREATE_TABLES_DDL);
}
