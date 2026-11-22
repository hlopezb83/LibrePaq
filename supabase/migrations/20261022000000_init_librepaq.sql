-- ============================================================================
-- LIBREPAQ PRO — MIGRACIÓN INICIAL SUPABASE
-- ============================================================================

-- 1. TABLA: EMPRESAS (MULTI-RFC)
CREATE TABLE IF NOT EXISTS public.companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rfc TEXT NOT NULL UNIQUE,
  regimen_fiscal TEXT NOT NULL,
  codigo_postal TEXT NOT NULL,
  mask_format TEXT NOT NULL DEFAULT 'XXX-XX-XXX',
  current_year INTEGER NOT NULL DEFAULT 2026,
  current_period INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABLA: CATÁLOGO DE CUENTAS (ÁRBOL JERÁRQUICO SAT ANEXO 24)
CREATE TABLE IF NOT EXISTS public.accounts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_code TEXT,
  type TEXT NOT NULL,
  nature TEXT NOT NULL,
  level INTEGER NOT NULL,
  is_affectable BOOLEAN NOT NULL DEFAULT TRUE,
  sat_group_code TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  initial_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  CONSTRAINT uq_accounts_company_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_accounts_company_code ON public.accounts(company_id, code);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON public.accounts(company_id, parent_code);

-- 3. TABLA: BÓVEDA DIGITAL DE CFDIs (ADD XML 4.0 / 3.3)
CREATE TABLE IF NOT EXISTS public.cfdi_documents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  uuid TEXT NOT NULL,
  fecha TIMESTAMPTZ NOT NULL,
  tipo_comprobante TEXT NOT NULL,
  direction TEXT NOT NULL,
  serie TEXT NOT NULL DEFAULT '',
  folio TEXT NOT NULL DEFAULT '',
  emisor_rfc TEXT NOT NULL,
  emisor_nombre TEXT NOT NULL,
  receptor_rfc TEXT NOT NULL,
  receptor_nombre TEXT NOT NULL,
  concepto_principal TEXT NOT NULL,
  clave_prod_serv TEXT NOT NULL DEFAULT '01010101',
  moneda TEXT NOT NULL DEFAULT 'MXN',
  tipo_cambio NUMERIC(10, 4) NOT NULL DEFAULT 1.0000,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  descuento NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  iva_trasladado NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  isr_retenido NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  iva_retenido NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  metodo_pago TEXT NOT NULL DEFAULT 'PUE',
  forma_pago TEXT NOT NULL DEFAULT '03',
  uso_cfdi TEXT NOT NULL DEFAULT 'G03',
  uuid_relacionado TEXT,
  status_sat TEXT NOT NULL DEFAULT 'VIGENTE',
  poliza_id TEXT,
  xml_raw TEXT NOT NULL,
  CONSTRAINT uq_cfdi_company_uuid UNIQUE (company_id, uuid)
);

CREATE INDEX IF NOT EXISTS idx_cfdi_company_uuid ON public.cfdi_documents(company_id, uuid);
CREATE INDEX IF NOT EXISTS idx_cfdi_company_fecha ON public.cfdi_documents(company_id, fecha);

-- 4. TABLA: PÓLIZAS CONTABLES
CREATE TABLE IF NOT EXISTS public.polizas (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  folio INTEGER NOT NULL,
  fecha TIMESTAMPTZ NOT NULL,
  ejercicio INTEGER NOT NULL,
  periodo INTEGER NOT NULL,
  concepto TEXT NOT NULL,
  cfdi_uuid TEXT,
  origin TEXT NOT NULL DEFAULT 'MANUAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_polizas_company_period ON public.polizas(company_id, ejercicio, periodo);
CREATE INDEX IF NOT EXISTS idx_polizas_cfdi_uuid ON public.polizas(cfdi_uuid);

-- 5. TABLA: MOVIMIENTOS DE PÓLIZA
CREATE TABLE IF NOT EXISTS public.poliza_movements (
  id TEXT PRIMARY KEY,
  poliza_id TEXT NOT NULL REFERENCES public.polizas(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  referencia TEXT NOT NULL DEFAULT '',
  concepto TEXT NOT NULL DEFAULT '',
  cargo NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  abono NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  cfdi_uuid TEXT
);

CREATE INDEX IF NOT EXISTS idx_movements_poliza ON public.poliza_movements(poliza_id);
CREATE INDEX IF NOT EXISTS idx_movements_account ON public.poliza_movements(account_id);

-- 6. TABLA: LÍNEAS BANCARIAS
CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  fecha TIMESTAMPTZ NOT NULL,
  ejercicio INTEGER NOT NULL,
  periodo INTEGER NOT NULL,
  referencia TEXT NOT NULL DEFAULT '',
  descripcion TEXT NOT NULL,
  cargo_banco NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  abono_banco NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  matched_movement_id TEXT
);

-- 7. TABLA: CREDENCIALES E.FIRMA
CREATE TABLE IF NOT EXISTS public.fiel_credentials (
  company_id TEXT PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  rfc_titular TEXT NOT NULL,
  nombre_titular TEXT NOT NULL,
  numero_serie TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT NOT NULL,
  sha1_fingerprint TEXT NOT NULL,
  cer_base64 TEXT NOT NULL,
  key_base64 TEXT NOT NULL,
  private_key_pem TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABLA: SOLICITUDES DESCARGA MASIVA SOAP SAT
CREATE TABLE IF NOT EXISTS public.sat_download_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TABLA: CANDADOS DE CIERRE
CREATE TABLE IF NOT EXISTS public.period_locks (
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ejercicio INTEGER NOT NULL,
  periodo INTEGER NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (company_id, ejercicio, periodo)
);

-- 10. TABLA: PADRÓN TERCEROS
CREATE TABLE IF NOT EXISTS public.third_parties (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rfc TEXT NOT NULL,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'PROVEEDOR',
  cuenta_operacion_code TEXT NOT NULL,
  cuenta_contrapartida_code TEXT NOT NULL,
  tipo_tercero_diot TEXT NOT NULL DEFAULT '04',
  tipo_operacion_diot TEXT NOT NULL DEFAULT '85',
  tasa_iva_default INTEGER NOT NULL DEFAULT 16,
  estatus_69b TEXT NOT NULL DEFAULT 'LIMPIO',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_third_parties_company_rfc UNIQUE (company_id, rfc)
);

-- 11. TABLA: ACTIVOS FIJOS
CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  fecha_adquisicion DATE NOT NULL,
  cfdi_uuid TEXT,
  monto_original_inversion NUMERIC(14, 2) NOT NULL,
  tasa_anual_pct NUMERIC(6, 2) NOT NULL,
  meses_depreciados_previos INTEGER NOT NULL DEFAULT 0,
  inpc_adquisicion NUMERIC(8, 4) NOT NULL DEFAULT 132.5400,
  inpc_medio_periodo NUMERIC(8, 4) NOT NULL DEFAULT 136.8200,
  cuenta_activo_code TEXT NOT NULL DEFAULT '156-01-001',
  cuenta_dep_acum_code TEXT NOT NULL DEFAULT '171-01-001',
  cuenta_gasto_dep_code TEXT NOT NULL DEFAULT '601-01-006',
  estatus TEXT NOT NULL DEFAULT 'ACTIVO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. TABLA: PARÁMETROS FISCALES
CREATE TABLE IF NOT EXISTS public.tax_parameters (
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ejercicio INTEGER NOT NULL,
  coeficiente_utilidad NUMERIC(8, 4) NOT NULL DEFAULT 0.1845,
  perdidas_fiscales_pendientes NUMERIC(14, 2) NOT NULL DEFAULT 45000.00,
  pagos_provisionales_anteriores NUMERIC(14, 2) NOT NULL DEFAULT 128500.00,
  saldo_favor_iva_anterior NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  tipo_cambio_dof_cierre NUMERIC(8, 4) NOT NULL DEFAULT 19.8650,
  PRIMARY KEY (company_id, ejercicio)
);

-- POLÍTICAS RLS (ACCESO LIBREPAQ)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso completo a companies" ON public.companies FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso completo a accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.polizas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso completo a polizas" ON public.polizas FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.poliza_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso completo a poliza_movements" ON public.poliza_movements FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.cfdi_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso completo a cfdi_documents" ON public.cfdi_documents FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso completo a bank_statement_lines" ON public.bank_statement_lines FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.fiel_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso completo a fiel_credentials" ON public.fiel_credentials FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.sat_download_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso completo a sat_download_requests" ON public.sat_download_requests FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.period_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso completo a period_locks" ON public.period_locks FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.third_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso completo a third_parties" ON public.third_parties FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso completo a fixed_assets" ON public.fixed_assets FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.tax_parameters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso completo a tax_parameters" ON public.tax_parameters FOR ALL USING (true) WITH CHECK (true);

-- EMPRESAS INICIALES
INSERT INTO public.companies (id, name, rfc, regimen_fiscal, codigo_postal, mask_format, current_year, current_period, created_at)
VALUES 
  ('comp_tnn_01', 'Tecnologías Nube del Norte S.A. de C.V.', 'TNN2105148K2', '601 - General de Ley Personas Morales', '64000', 'XXX-XX-XXX', 2026, 10, NOW()),
  ('comp_cib_02', 'Comercializadora Industrial del Bajío S.A. de C.V.', 'CIB190822M94', '601 - General de Ley Personas Morales', '37000', 'XXX-XX-XXX', 2026, 10, NOW()),
  ('comp_tlb_03', 'TRANSPORTES Y LOGISTICA DEL BAJIO S.A. DE C.V.', 'TLB2203159A1', '601 - General de Ley Personas Morales', '64000', 'XXX-XX-XXX', 2026, 10, NOW()),
  ('comp_cfc_04', 'CONSULTORES FISCALES DEL CENTRO S.A. DE C.V.', 'CFC180905M11', '601 - General de Ley Personas Morales', '06000', 'XXX-XX-XXX', 2026, 10, NOW()),
  ('comp_hdl_05', 'HECTOR DANIEL LOPEZ BENAVIDES', 'LOBH831029IX9', '612 - Personas Físicas con Actividades Empresariales y Profesionales', '64000', 'XXX-XX-XXX', 2026, 10, NOW())
ON CONFLICT (id) DO NOTHING;
