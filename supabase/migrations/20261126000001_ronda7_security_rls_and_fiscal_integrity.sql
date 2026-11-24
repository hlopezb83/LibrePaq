-- ============================================================================
-- LIBREPAQ PRO — RONDA 7 (OLA 1): SEGURIDAD MULTI-TENANT, RLS ESTRICTO,
-- BLOQUEO SUSPENDIDO, INTEGRIDAD FISCAL Y CANDADOS DE PERIODO
-- 100% IDEMPOTENTE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper SECURITY DEFINER para verificar si el usuario actual está SUSPENDIDO
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_user_suspended()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = (SELECT auth.uid())::text
      AND upper(coalesce(up.status, 'ACTIVO')) = 'SUSPENDIDO'
  );
$$;

REVOKE ALL ON FUNCTION public.is_user_suspended() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_user_suspended() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Endurecer public.has_company_role(TEXT, TEXT):
--    Elimina la regla 3d de membresía inversa cross-tenant y exige
--    companies.organization_id = wm.workspace_id para acceso a nivel despacho.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_company_role(
  p_company_id TEXT,
  p_min_role TEXT DEFAULT 'CLIENTE_LECTURA'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := (SELECT auth.uid())::text;
  v_email TEXT := lower(coalesce((SELECT auth.jwt()) ->> 'email', ''));
  v_platform_role TEXT;
  v_company_owner_id TEXT;
  v_company_org_id TEXT;
  v_min_rank INT;
  v_eff_role TEXT;
  v_eff_rank INT;
BEGIN
  IF v_uid IS NULL OR p_company_id IS NULL OR trim(p_company_id) = '' THEN
    RETURN FALSE;
  END IF;

  IF public.is_user_suspended() THEN
    RETURN FALSE;
  END IF;

  v_min_rank := CASE upper(coalesce(p_min_role, 'CLIENTE_LECTURA'))
    WHEN 'SOCIO' THEN 4
    WHEN 'CONTADOR' THEN 3
    WHEN 'AUXILIAR' THEN 2
    ELSE 1
  END;

  v_platform_role := public.get_platform_role();
  IF v_platform_role = 'SUPERADMIN' THEN
    RETURN TRUE;
  END IF;
  IF v_platform_role = 'SUPPORT_READONLY' AND v_min_rank <= 1 THEN
    RETURN TRUE;
  END IF;

  SELECT c.user_id, c.organization_id
  INTO v_company_owner_id, v_company_org_id
  FROM public.companies c
  WHERE c.id = p_company_id
  LIMIT 1;

  IF v_company_owner_id IS NULL AND v_company_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Propiedad directa (nunca coincide con 'demo')
  IF v_company_owner_id = v_uid THEN
    RETURN TRUE;
  END IF;

  -- 3a. Dueño / Socio de la organización explícita en companies.organization_id
  IF v_company_org_id IS NOT NULL AND (
    v_company_org_id = v_uid
    OR v_company_org_id = ('ws_' || left(v_uid, 8))
    OR public.is_workspace_socio(v_company_org_id)
  ) THEN
    RETURN TRUE;
  END IF;

  -- 3b. Membresía explícita por empresa en company_member_access
  SELECT coalesce(cma.role_override, wm.role) INTO v_eff_role
  FROM public.company_member_access cma
  JOIN public.workspace_members wm ON wm.id = cma.member_id
  WHERE cma.company_id = p_company_id
    AND wm.status = 'ACTIVO'
    AND (
      wm.user_id = v_uid
      OR (wm.user_id IS NULL AND v_email <> '' AND lower(wm.email) = v_email)
    )
  ORDER BY CASE coalesce(cma.role_override, wm.role)
    WHEN 'SOCIO' THEN 4
    WHEN 'CONTADOR' THEN 3
    WHEN 'AUXILIAR' THEN 2
    ELSE 1
  END DESC
  LIMIT 1;

  -- 3c. Membresía general de despacho sin restricciones específicas:
  --     Exige coincidencia estricta companies.organization_id = wm.workspace_id
  IF v_eff_role IS NULL AND v_company_org_id IS NOT NULL THEN
    SELECT wm.role INTO v_eff_role
    FROM public.workspace_members wm
    WHERE wm.status = 'ACTIVO'
      AND wm.workspace_id = v_company_org_id
      AND (
        wm.user_id = v_uid
        OR (wm.user_id IS NULL AND v_email <> '' AND lower(wm.email) = v_email)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.company_member_access cma_any
        WHERE cma_any.member_id = wm.id
      )
    ORDER BY CASE wm.role
      WHEN 'SOCIO' THEN 4
      WHEN 'CONTADOR' THEN 3
      WHEN 'AUXILIAR' THEN 2
      ELSE 1
    END DESC
    LIMIT 1;
  END IF;

  IF v_eff_role IS NULL THEN
    RETURN FALSE;
  END IF;

  v_eff_rank := CASE v_eff_role
    WHEN 'SOCIO' THEN 4
    WHEN 'CONTADOR' THEN 3
    WHEN 'AUXILIAR' THEN 2
    ELSE 1
  END;

  RETURN v_eff_rank >= v_min_rank;
END;
$$;

REVOKE ALL ON FUNCTION public.has_company_role(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_company_role(TEXT, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Eliminar políticas PERMISSIVE legacy (owner bypass, 'demo', user_id IS NULL)
--    y asegurar políticas estrictas en companies
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  legacy_child_tables TEXT[] := ARRAY[
    'accounts',
    'polizas',
    'poliza_movements',
    'cfdi_documents',
    'bank_statement_lines',
    'period_locks',
    'third_parties',
    'fixed_assets',
    'tax_parameters',
    'sat_download_requests',
    'fiel_credentials'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    DROP POLICY IF EXISTS "Usuarios ven sus propias empresas o las demo" ON public.companies;
    DROP POLICY IF EXISTS "Usuarios solo insertan sus propias empresas" ON public.companies;
    DROP POLICY IF EXISTS "Usuarios solo modifican sus propias empresas" ON public.companies;
    DROP POLICY IF EXISTS "Usuarios solo eliminan sus propias empresas" ON public.companies;
    DROP POLICY IF EXISTS "rls_companies_select" ON public.companies;
    DROP POLICY IF EXISTS "rls_companies_insert" ON public.companies;
    DROP POLICY IF EXISTS "rls_companies_update" ON public.companies;
    DROP POLICY IF EXISTS "rls_companies_delete" ON public.companies;

    CREATE POLICY "rls_companies_insert"
      ON public.companies AS PERMISSIVE FOR INSERT TO authenticated
      WITH CHECK (
        NOT public.is_user_suspended()
        AND (
          user_id = (SELECT auth.uid())::text
          OR public.is_platform_superadmin()
        )
      );

    CREATE POLICY "rls_companies_delete"
      ON public.companies AS PERMISSIVE FOR DELETE TO authenticated
      USING (public.has_company_role(id, 'SOCIO'));
  END IF;

  FOREACH t IN ARRAY legacy_child_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_select', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_insert', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_update', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_delete', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_write', t);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounting_rules') THEN
    DROP POLICY IF EXISTS accounting_rules_tenant_isolation ON public.accounting_rules;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_statement_matches') THEN
    DROP POLICY IF EXISTS "Acceso a bank_statement_matches segun empresa del usuario" ON public.bank_statement_matches;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'annual_tax_snapshots') THEN
    DROP POLICY IF EXISTS annual_tax_snapshots_owner_isolation ON public.annual_tax_snapshots;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_periods') THEN
    DROP POLICY IF EXISTS inventory_periods_owner_isolation ON public.inventory_periods;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Adiciones de esquema idempotentes (columnas fiscales, cierres bancarios,
--    branding de entregables del despacho y soporte cuenta de orden)
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.third_parties
  ADD COLUMN IF NOT EXISTS id_fiscal text,
  ADD COLUMN IF NOT EXISTS pais text,
  ADD COLUMN IF NOT EXISTS jurisdiccion_fiscal text;

ALTER TABLE IF EXISTS public.cfdi_documents
  ADD COLUMN IF NOT EXISTS fecha_pago text;

ALTER TABLE IF EXISTS public.tax_parameters
  ADD COLUMN IF NOT EXISTS ptu_pagada_ejercicio numeric(14,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.bank_reconciliation_closures (
  id text PRIMARY KEY,
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  ejercicio int NOT NULL,
  periodo int NOT NULL,
  saldo_banco_cierre numeric(14,2) NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, account_id, ejercicio, periodo)
);

CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_closures_comp
  ON public.bank_reconciliation_closures (company_id, ejercicio, periodo);

ALTER TABLE public.bank_reconciliation_closures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bank_reconciliation_closures FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bank_reconciliation_closures TO authenticated;
GRANT ALL ON TABLE public.bank_reconciliation_closures TO service_role;

DROP POLICY IF EXISTS "rls_bank_reconciliation_closures_member_select" ON public.bank_reconciliation_closures;
CREATE POLICY "rls_bank_reconciliation_closures_member_select"
  ON public.bank_reconciliation_closures AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.has_company_role(company_id, 'CLIENTE_LECTURA'));

DROP POLICY IF EXISTS "rls_bank_reconciliation_closures_member_write" ON public.bank_reconciliation_closures;
CREATE POLICY "rls_bank_reconciliation_closures_member_write"
  ON public.bank_reconciliation_closures AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_company_role(company_id, 'AUXILIAR'))
  WITH CHECK (public.has_company_role(company_id, 'AUXILIAR'));

CREATE TABLE IF NOT EXISTS public.despacho_deliverable_branding (
  id text PRIMARY KEY,
  scope_key text NOT NULL,
  company_id text REFERENCES public.companies(id) ON DELETE CASCADE,
  organization_id text,
  firm_name text NOT NULL DEFAULT '',
  auditor_name text NOT NULL DEFAULT '',
  auditor_cedula text NOT NULL DEFAULT '',
  preparer_name text NOT NULL DEFAULT 'Auxiliar Contable',
  issuance_city text NOT NULL DEFAULT 'Ciudad de México',
  logo_data_url text,
  notes_text text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(scope_key)
);

CREATE INDEX IF NOT EXISTS idx_despacho_deliverable_branding_comp
  ON public.despacho_deliverable_branding (company_id)
  WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_despacho_deliverable_branding_org
  ON public.despacho_deliverable_branding (organization_id)
  WHERE organization_id IS NOT NULL;

ALTER TABLE public.despacho_deliverable_branding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.despacho_deliverable_branding FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.despacho_deliverable_branding TO authenticated;
GRANT ALL ON TABLE public.despacho_deliverable_branding TO service_role;

DROP POLICY IF EXISTS "rls_despacho_deliverable_branding_select" ON public.despacho_deliverable_branding;
CREATE POLICY "rls_despacho_deliverable_branding_select"
  ON public.despacho_deliverable_branding AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    (company_id IS NOT NULL AND public.has_company_role(company_id, 'CLIENTE_LECTURA'))
    OR (
      company_id IS NULL
      AND organization_id IS NOT NULL
      AND (
        organization_id = (SELECT auth.uid())::text
        OR organization_id = ('ws_' || left((SELECT auth.uid())::text, 8))
        OR public.is_workspace_socio(organization_id)
        OR EXISTS (
          SELECT 1
          FROM public.workspace_members wm
          WHERE wm.workspace_id = organization_id
            AND wm.status = 'ACTIVO'
            AND (
              wm.user_id = (SELECT auth.uid())::text
              OR (
                wm.user_id IS NULL
                AND lower(coalesce((SELECT auth.jwt()) ->> 'email', '')) <> ''
                AND lower(wm.email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
              )
            )
        )
        OR public.has_platform_access()
      )
    )
  );

DROP POLICY IF EXISTS "rls_despacho_deliverable_branding_write" ON public.despacho_deliverable_branding;
CREATE POLICY "rls_despacho_deliverable_branding_write"
  ON public.despacho_deliverable_branding AS PERMISSIVE FOR ALL TO authenticated
  USING (
    (company_id IS NOT NULL AND public.has_company_role(company_id, 'AUXILIAR'))
    OR (
      company_id IS NULL
      AND organization_id IS NOT NULL
      AND (
        organization_id = (SELECT auth.uid())::text
        OR organization_id = ('ws_' || left((SELECT auth.uid())::text, 8))
        OR public.is_workspace_socio(organization_id)
        OR EXISTS (
          SELECT 1
          FROM public.workspace_members wm
          WHERE wm.workspace_id = organization_id
            AND wm.status = 'ACTIVO'
            AND wm.role IN ('SOCIO', 'CONTADOR', 'AUXILIAR')
            AND (
              wm.user_id = (SELECT auth.uid())::text
              OR (
                wm.user_id IS NULL
                AND lower(coalesce((SELECT auth.jwt()) ->> 'email', '')) <> ''
                AND lower(wm.email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
              )
            )
        )
        OR public.is_platform_superadmin()
      )
    )
  )
  WITH CHECK (
    (company_id IS NOT NULL AND public.has_company_role(company_id, 'AUXILIAR'))
    OR (
      company_id IS NULL
      AND organization_id IS NOT NULL
      AND (
        organization_id = (SELECT auth.uid())::text
        OR organization_id = ('ws_' || left((SELECT auth.uid())::text, 8))
        OR public.is_workspace_socio(organization_id)
        OR EXISTS (
          SELECT 1
          FROM public.workspace_members wm
          WHERE wm.workspace_id = organization_id
            AND wm.status = 'ACTIVO'
            AND wm.role IN ('SOCIO', 'CONTADOR', 'AUXILIAR')
            AND (
              wm.user_id = (SELECT auth.uid())::text
              OR (
                wm.user_id IS NULL
                AND lower(coalesce((SELECT auth.jwt()) ->> 'email', '')) <> ''
                AND lower(wm.email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
              )
            )
        )
        OR public.is_platform_superadmin()
      )
    )
  );

-- Asegurar que cualquier CHECK constraint de accounts.type permita 'ORDEN'
DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts') THEN
    FOR r IN
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'public.accounts'::regclass
        AND contype = 'c'
    LOOP
      IF r.def ~* '\ytype\y' AND r.def NOT LIKE '%ORDEN%' THEN
        EXECUTE format('ALTER TABLE public.accounts DROP CONSTRAINT %I', r.conname);
      END IF;
    END LOOP;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.accounts'::regclass
        AND conname = 'chk_accounts_type'
    ) THEN
      ALTER TABLE public.accounts
        ADD CONSTRAINT chk_accounts_type
        CHECK (type IN ('ACTIVO', 'PASIVO', 'CAPITAL', 'INGRESOS', 'COSTOS', 'GASTOS', 'ORDEN'));
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Revocar explícitamente acceso anon en tablas operativas sensibles
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounting_rules') THEN
    REVOKE ALL ON TABLE public.accounting_rules FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_statement_matches') THEN
    REVOKE ALL ON TABLE public.bank_statement_matches FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_reconciliation_closures') THEN
    REVOKE ALL ON TABLE public.bank_reconciliation_closures FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'despacho_deliverable_branding') THEN
    REVOKE ALL ON TABLE public.despacho_deliverable_branding FROM anon;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Políticas AS RESTRICTIVE para bloquear usuarios SUSPENDIDO en todas
--    las tablas multi-tenant (anulan cualquier política PERMISSIVE)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'companies',
    'accounts',
    'polizas',
    'poliza_movements',
    'poliza_cfdis',
    'cfdi_documents',
    'bank_statement_lines',
    'bank_statement_matches',
    'bank_reconciliation_closures',
    'fiel_credentials',
    'sat_download_requests',
    'period_locks',
    'third_parties',
    'fixed_assets',
    'tax_parameters',
    'accounting_rules',
    'annual_tax_snapshots',
    'inventory_periods',
    'payroll_period_settings',
    'workspace_members',
    'company_member_access',
    'company_audit_logs',
    'despacho_deliverable_branding'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_not_suspended', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_user_suspended()) WITH CHECK (NOT public.is_user_suspended())',
        'rls_' || t || '_not_suspended',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 7. Extender enforce_period_lock() a tax_parameters, payroll_period_settings
--    y annual_tax_snapshots (con bypass via app.bypass_period_lock o librepaq.bypass_period_lock)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := coalesce((SELECT auth.role()), '');
  v_bypass TEXT := coalesce(
    nullif(current_setting('app.bypass_period_lock', true), ''),
    nullif(current_setting('librepaq.bypass_period_lock', true), ''),
    ''
  );
  v_company_id TEXT;
  v_ejercicio INTEGER;
  v_periodo INTEGER;
BEGIN
  IF v_role = 'service_role' OR v_bypass = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'polizas' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') AND public.is_period_locked(OLD.company_id, OLD.ejercicio, OLD.periodo) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios.', OLD.periodo, OLD.ejercicio;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND public.is_period_locked(NEW.company_id, NEW.ejercicio, NEW.periodo) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios.', NEW.periodo, NEW.ejercicio;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME IN ('poliza_movements', 'poliza_cfdis') THEN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      SELECT p.company_id, p.ejercicio, p.periodo
      INTO v_company_id, v_ejercicio, v_periodo
      FROM public.polizas p
      WHERE p.id = OLD.poliza_id
      LIMIT 1;
      IF v_company_id IS NOT NULL AND public.is_period_locked(v_company_id, v_ejercicio, v_periodo) THEN
        RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en pólizas vinculadas.', v_periodo, v_ejercicio;
      END IF;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      SELECT p.company_id, p.ejercicio, p.periodo
      INTO v_company_id, v_ejercicio, v_periodo
      FROM public.polizas p
      WHERE p.id = NEW.poliza_id
      LIMIT 1;
      IF v_company_id IS NOT NULL AND public.is_period_locked(v_company_id, v_ejercicio, v_periodo) THEN
        RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en pólizas vinculadas.', v_periodo, v_ejercicio;
      END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'inventory_periods' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') AND public.is_period_locked(OLD.company_id, OLD.ejercicio, OLD.periodo) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en inventarios.', OLD.periodo, OLD.ejercicio;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND public.is_period_locked(NEW.company_id, NEW.ejercicio, NEW.periodo) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en inventarios.', NEW.periodo, NEW.ejercicio;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME IN ('tax_parameters', 'payroll_period_settings') THEN
    IF TG_OP IN ('UPDATE', 'DELETE') AND public.is_period_locked(OLD.company_id, OLD.ejercicio, COALESCE(OLD.periodo, 12)) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en parámetros fiscales o nómina.', COALESCE(OLD.periodo, 12), OLD.ejercicio;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND public.is_period_locked(NEW.company_id, NEW.ejercicio, COALESCE(NEW.periodo, 12)) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en parámetros fiscales o nómina.', COALESCE(NEW.periodo, 12), NEW.ejercicio;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'annual_tax_snapshots' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') AND public.is_period_locked(OLD.company_id, OLD.ejercicio, 12) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El cierre del ejercicio % (periodo 12) está cerrado ante el SAT y no permite cambios anuales.', OLD.ejercicio;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND public.is_period_locked(NEW.company_id, NEW.ejercicio, 12) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El cierre del ejercicio % (periodo 12) está cerrado ante el SAT y no permite cambios anuales.', NEW.ejercicio;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_period_lock() FROM PUBLIC, anon;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tax_parameters') THEN
    DROP TRIGGER IF EXISTS trg_enforce_period_lock_tax_parameters ON public.tax_parameters;
    CREATE TRIGGER trg_enforce_period_lock_tax_parameters
      BEFORE INSERT OR UPDATE OR DELETE ON public.tax_parameters
      FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_period_settings') THEN
    DROP TRIGGER IF EXISTS trg_enforce_period_lock_payroll_period_settings ON public.payroll_period_settings;
    CREATE TRIGGER trg_enforce_period_lock_payroll_period_settings
      BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_period_settings
      FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'annual_tax_snapshots') THEN
    DROP TRIGGER IF EXISTS trg_enforce_period_lock_annual_tax_snapshots ON public.annual_tax_snapshots;
    CREATE TRIGGER trg_enforce_period_lock_annual_tax_snapshots
      BEFORE INSERT OR UPDATE OR DELETE ON public.annual_tax_snapshots
      FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();
  END IF;
END $$;
