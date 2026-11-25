-- ============================================================================
-- LIBREPAQ PRO — RONDA 11: PARIDAD SAT (DIOT 2025/2026, EFOS 69-B,
-- ACTIVOS FIJOS BAJA/TOPE, PÉRDIDAS FISCALES, INPC) + PARIDAD CONTPAQi
-- (SEGMENTOS DE NEGOCIO, PLANTILLAS DE PÓLIZA, DATOS BANCARIOS DE PÓLIZA)
-- 100% IDEMPOTENTE | RLS MULTI-TENANT has_company_role + RESTRICTIVE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. third_parties: eliminar UNIQUE(company_id, rfc) vía pg_constraint,
--    crear 2 índices únicos parciales (nacional vs extranjero '05'),
--    agregar region_fronteriza y deductible_pct, ampliar tipo_operacion_diot
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'third_parties'
  ) THEN
    FOR r IN
      SELECT c.conname
      FROM pg_constraint c
      WHERE c.conrelid = 'public.third_parties'::regclass
        AND c.contype = 'u'
        AND array_length(c.conkey, 1) = 2
        AND (
          SELECT array_agg(a.attname::text ORDER BY a.attname::text)
          FROM unnest(c.conkey) AS k(attnum)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
        ) = ARRAY['company_id', 'rfc']
    LOOP
      EXECUTE format('ALTER TABLE public.third_parties DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    FOR r IN
      SELECT i.relname AS idxname
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      WHERE ix.indrelid = 'public.third_parties'::regclass
        AND ix.indisunique IS TRUE
        AND ix.indisprimary IS FALSE
        AND ix.indpred IS NULL
        AND array_length(ix.indkey::smallint[], 1) = 2
        AND (
          SELECT array_agg(a.attname::text ORDER BY a.attname::text)
          FROM unnest(ix.indkey::smallint[]) AS k(attnum)
          JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = k.attnum
        ) = ARRAY['company_id', 'rfc']
    LOOP
      EXECUTE format('DROP INDEX IF EXISTS public.%I', r.idxname);
    END LOOP;

    ALTER TABLE public.third_parties
      ADD COLUMN IF NOT EXISTS region_fronteriza TEXT NOT NULL DEFAULT 'NORTE';

    ALTER TABLE public.third_parties
      ADD COLUMN IF NOT EXISTS deductible_pct INTEGER NOT NULL DEFAULT 100;

    UPDATE public.third_parties
    SET region_fronteriza = 'NORTE'
    WHERE region_fronteriza IS NULL OR region_fronteriza NOT IN ('NORTE', 'SUR');

    UPDATE public.third_parties
    SET deductible_pct = 100
    WHERE deductible_pct IS NULL;

    ALTER TABLE public.third_parties
      ALTER COLUMN deductible_pct TYPE INTEGER USING round(coalesce(deductible_pct, 100))::integer,
      ALTER COLUMN deductible_pct SET DEFAULT 100,
      ALTER COLUMN deductible_pct SET NOT NULL;

    FOR r IN
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'public.third_parties'::regclass
        AND contype = 'c'
    LOOP
      IF r.def ~* '\ytipo_operacion_diot\y' THEN
        EXECUTE format('ALTER TABLE public.third_parties DROP CONSTRAINT IF EXISTS %I', r.conname);
      END IF;
    END LOOP;

    UPDATE public.third_parties
    SET tipo_operacion_diot = '85'
    WHERE tipo_operacion_diot IS NULL
       OR tipo_operacion_diot NOT IN ('02', '03', '06', '07', '08', '85', '87');

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.third_parties'::regclass
        AND conname = 'chk_third_parties_tipo_operacion_diot'
    ) THEN
      ALTER TABLE public.third_parties
        ADD CONSTRAINT chk_third_parties_tipo_operacion_diot
        CHECK (tipo_operacion_diot IN ('02', '03', '06', '07', '08', '85', '87'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.third_parties'::regclass
        AND conname = 'chk_third_parties_region_fronteriza'
    ) THEN
      ALTER TABLE public.third_parties
        ADD CONSTRAINT chk_third_parties_region_fronteriza
        CHECK (region_fronteriza IN ('NORTE', 'SUR'));
    END IF;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_third_parties_company_rfc_non_foreign
  ON public.third_parties (company_id, rfc)
  WHERE tipo_tercero_diot <> '05';

CREATE UNIQUE INDEX IF NOT EXISTS uq_third_parties_company_rfc_foreign
  ON public.third_parties (company_id, rfc, COALESCE(id_fiscal, ''), nombre)
  WHERE tipo_tercero_diot = '05';

-- ----------------------------------------------------------------------------
-- 2. cfdi_documents: columnas EFOS/cancelación/deducibilidad/extranjeros sin CFDI
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.cfdi_documents
  ADD COLUMN IF NOT EXISTS validacion_efos TEXT,
  ADD COLUMN IF NOT EXISTS es_cancelable TEXT,
  ADD COLUMN IF NOT EXISTS estatus_cancelacion TEXT,
  ADD COLUMN IF NOT EXISTS deductible_pct INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS is_foreign_no_cfdi BOOLEAN NOT NULL DEFAULT FALSE;

-- ----------------------------------------------------------------------------
-- 3. poliza_movements: métodos de pago SAT, datos bancarios, cheques y segmento
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.poliza_movements
  ADD COLUMN IF NOT EXISTS payment_method_sat TEXT,
  ADD COLUMN IF NOT EXISTS bank_code_ori TEXT,
  ADD COLUMN IF NOT EXISTS account_ori TEXT,
  ADD COLUMN IF NOT EXISTS bank_code_dest TEXT,
  ADD COLUMN IF NOT EXISTS account_dest TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_name TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_rfc TEXT,
  ADD COLUMN IF NOT EXISTS cheque_num TEXT,
  ADD COLUMN IF NOT EXISTS business_segment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_poliza_movements_segment
  ON public.poliza_movements (business_segment_id)
  WHERE business_segment_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. fixed_assets: baja de activos y tope deducible de vehículos
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.fixed_assets
  ADD COLUMN IF NOT EXISTS fecha_baja DATE,
  ADD COLUMN IF NOT EXISTS precio_venta NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS baja_poliza_id TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_cap_type TEXT;

-- ----------------------------------------------------------------------------
-- 5. Nuevas tablas con RLS has_company_role + RESTRICTIVE not_suspended
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_segments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_business_segments_company
  ON public.business_segments (company_id, code);

CREATE TABLE IF NOT EXISTS public.poliza_templates (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'DIARIO' CHECK (tipo IN ('INGRESO', 'EGRESO', 'DIARIO')),
  concepto_default TEXT NOT NULL DEFAULT '',
  movements_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poliza_templates_company
  ON public.poliza_templates (company_id, name);

CREATE TABLE IF NOT EXISTS public.custom_inpc_entries (
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  inpc_value NUMERIC(12, 4) NOT NULL,
  source TEXT NOT NULL DEFAULT 'MANUAL',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, year, month)
);

CREATE TABLE IF NOT EXISTS public.fiscal_loss_carryforwards (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  loss_year INTEGER NOT NULL,
  original_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  applied_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  inpc_first_update_month INTEGER,
  inpc_last_applied NUMERIC(12, 4),
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, loss_year)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_loss_carryforwards_company
  ON public.fiscal_loss_carryforwards (company_id, loss_year);

DO $$
DECLARE
  t TEXT;
  write_role TEXT;
  r11_tables TEXT[] := ARRAY[
    'business_segments',
    'poliza_templates',
    'custom_inpc_entries',
    'fiscal_loss_carryforwards'
  ];
BEGIN
  FOREACH t IN ARRAY r11_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);

    write_role := CASE
      WHEN t IN ('custom_inpc_entries', 'fiscal_loss_carryforwards') THEN 'CONTADOR'
      ELSE 'AUXILIAR'
    END;

    IF to_regprocedure('public.has_company_role(text, text)') IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_member_select', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_company_role(company_id, ''CLIENTE_LECTURA''))',
        'rls_' || t || '_member_select',
        t
      );

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_member_write', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING (public.has_company_role(company_id, %L)) WITH CHECK (public.has_company_role(company_id, %L))',
        'rls_' || t || '_member_write',
        t,
        write_role,
        write_role
      );
    END IF;

    IF to_regprocedure('public.is_user_suspended()') IS NOT NULL THEN
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
-- 6. Actualizar enforce_period_lock(): agregar cfdi_documents (evaluando
--    COALESCE(fecha_pago, fecha) cuando tipo_comprobante IN ('P','N')) y
--    validar también Periodo 13 en annual_tax_snapshots
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
  v_eff_date DATE;
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

  IF TG_TABLE_NAME = 'cfdi_documents' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      v_eff_date := CASE
        WHEN OLD.tipo_comprobante IN ('P', 'N')
             AND nullif(trim(coalesce(OLD.fecha_pago, '')), '') IS NOT NULL
             AND trim(OLD.fecha_pago) ~ '^\d{4}-\d{2}-\d{2}'
          THEN left(trim(OLD.fecha_pago), 10)::date
        ELSE (OLD.fecha AT TIME ZONE 'UTC')::date
      END;
      v_ejercicio := EXTRACT(YEAR FROM v_eff_date)::integer;
      v_periodo := EXTRACT(MONTH FROM v_eff_date)::integer;
      IF public.is_period_locked(OLD.company_id, v_ejercicio, v_periodo) THEN
        RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en CFDIs.', v_periodo, v_ejercicio;
      END IF;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      v_eff_date := CASE
        WHEN NEW.tipo_comprobante IN ('P', 'N')
             AND nullif(trim(coalesce(NEW.fecha_pago, '')), '') IS NOT NULL
             AND trim(NEW.fecha_pago) ~ '^\d{4}-\d{2}-\d{2}'
          THEN left(trim(NEW.fecha_pago), 10)::date
        ELSE (NEW.fecha AT TIME ZONE 'UTC')::date
      END;
      v_ejercicio := EXTRACT(YEAR FROM v_eff_date)::integer;
      v_periodo := EXTRACT(MONTH FROM v_eff_date)::integer;
      IF public.is_period_locked(NEW.company_id, v_ejercicio, v_periodo) THEN
        RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en CFDIs.', v_periodo, v_ejercicio;
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

  IF TG_TABLE_NAME = 'tax_parameters' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      IF COALESCE(OLD.periodo, 0) = 0 THEN
        IF EXISTS (
          SELECT 1 FROM public.period_locks pl
          WHERE pl.company_id = OLD.company_id
            AND pl.ejercicio = OLD.ejercicio
            AND pl.periodo BETWEEN 1 AND 12
            AND pl.is_locked IS TRUE
        ) THEN
          RAISE EXCEPTION 'PERIOD_LOCKED: Existen periodos cerrados (1..12) en el ejercicio % y no permite cambios en parámetros fiscales.', OLD.ejercicio;
        END IF;
      ELSIF public.is_period_locked(OLD.company_id, OLD.ejercicio, OLD.periodo) THEN
        RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en parámetros fiscales.', OLD.periodo, OLD.ejercicio;
      END IF;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      IF COALESCE(NEW.periodo, 0) = 0 THEN
        IF EXISTS (
          SELECT 1 FROM public.period_locks pl
          WHERE pl.company_id = NEW.company_id
            AND pl.ejercicio = NEW.ejercicio
            AND pl.periodo BETWEEN 1 AND 12
            AND pl.is_locked IS TRUE
        ) THEN
          RAISE EXCEPTION 'PERIOD_LOCKED: Existen periodos cerrados (1..12) en el ejercicio % y no permite cambios en parámetros fiscales.', NEW.ejercicio;
        END IF;
      ELSIF public.is_period_locked(NEW.company_id, NEW.ejercicio, NEW.periodo) THEN
        RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en parámetros fiscales.', NEW.periodo, NEW.ejercicio;
      END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'payroll_period_settings' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') AND public.is_period_locked(OLD.company_id, OLD.ejercicio, COALESCE(OLD.periodo, 12)) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en nómina.', COALESCE(OLD.periodo, 12), OLD.ejercicio;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND public.is_period_locked(NEW.company_id, NEW.ejercicio, COALESCE(NEW.periodo, 12)) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en nómina.', COALESCE(NEW.periodo, 12), NEW.ejercicio;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'annual_tax_snapshots' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') AND (
      public.is_period_locked(OLD.company_id, OLD.ejercicio, 12)
      OR public.is_period_locked(OLD.company_id, OLD.ejercicio, 13)
    ) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El cierre del ejercicio % (periodo 12/13) está cerrado ante el SAT y no permite cambios anuales.', OLD.ejercicio;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND (
      public.is_period_locked(NEW.company_id, NEW.ejercicio, 12)
      OR public.is_period_locked(NEW.company_id, NEW.ejercicio, 13)
    ) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El cierre del ejercicio % (periodo 12/13) está cerrado ante el SAT y no permite cambios anuales.', NEW.ejercicio;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_period_lock() FROM PUBLIC, anon;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cfdi_documents') THEN
    DROP TRIGGER IF EXISTS trg_enforce_period_lock_cfdi_documents ON public.cfdi_documents;
    CREATE TRIGGER trg_enforce_period_lock_cfdi_documents
      BEFORE INSERT OR UPDATE OR DELETE ON public.cfdi_documents
      FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. Actualizar restore_company_backup_atomic(p_payload JSONB) para v2.1
--    (retrocompatible con v2.0)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_company_backup_atomic(p_payload JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := (SELECT auth.uid())::text;
  v_role TEXT := coalesce((SELECT auth.role()), '');
  v_comp JSONB := coalesce(p_payload -> 'company', '{}'::jsonb);
  v_company_id TEXT := trim(coalesce(v_comp ->> 'id', ''));
  v_rfc TEXT := upper(trim(coalesce(v_comp ->> 'rfc', '')));
  v_exists BOOLEAN := FALSE;
  v_owner_id TEXT;
  v_org_id TEXT;
  v_req_org_id TEXT := nullif(trim(coalesce(v_comp ->> 'organizationId', '')), '');
  v_branding JSONB;
BEGIN
  IF v_role <> 'service_role' AND v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Debes iniciar sesión para restaurar una empresa.';
  END IF;

  IF v_role <> 'service_role' AND public.is_user_suspended() THEN
    RAISE EXCEPTION 'USER_SUSPENDED';
  END IF;

  IF v_company_id = '' OR v_rfc = '' THEN
    RAISE EXCEPTION 'INVALID_BACKUP_BUNDLE: El respaldo carece de id o rfc de empresa.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = v_company_id) INTO v_exists;

  IF v_exists THEN
    IF NOT (
      v_role = 'service_role'
      OR public.is_platform_superadmin()
      OR public.has_company_role(v_company_id, 'SOCIO')
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Solo el propietario o Socio puede restaurar esta empresa.';
    END IF;
    SELECT user_id, organization_id INTO v_owner_id, v_org_id
    FROM public.companies
    WHERE id = v_company_id;

    IF v_org_id IS NULL AND v_req_org_id IS NOT NULL THEN
      IF v_role = 'service_role' OR public.is_platform_superadmin()
         OR v_req_org_id = ('ws_' || left(v_uid, 8))
         OR public.is_workspace_socio(v_req_org_id)
         OR EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = v_req_org_id AND o.owner_user_id = v_uid) THEN
        v_org_id := v_req_org_id;
      END IF;
    END IF;
    IF v_org_id IS NULL AND v_owner_id IS NOT NULL AND v_owner_id <> 'demo' THEN
      v_org_id := 'ws_' || left(v_owner_id, 8);
    END IF;
  ELSE
    v_owner_id := coalesce(nullif(trim(v_comp ->> 'userId'), ''), v_uid);
    IF v_role <> 'service_role' AND NOT public.is_platform_superadmin() AND v_owner_id <> v_uid THEN
      v_owner_id := v_uid;
    END IF;

    v_org_id := coalesce(v_req_org_id, CASE WHEN v_uid IS NOT NULL THEN 'ws_' || left(v_uid, 8) ELSE NULL END);
    IF v_role <> 'service_role' AND NOT public.is_platform_superadmin() AND v_org_id IS NOT NULL THEN
      IF NOT (
        v_org_id = v_uid
        OR v_org_id = ('ws_' || left(v_uid, 8))
        OR public.is_workspace_socio(v_org_id)
        OR EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = v_org_id AND o.owner_user_id = v_uid)
      ) THEN
        v_org_id := 'ws_' || left(v_uid, 8);
      END IF;
    END IF;
  END IF;

  PERFORM set_config('librepaq.bypass_period_lock', 'true', true);
  PERFORM set_config('app.bypass_period_lock', 'true', true);

  INSERT INTO public.companies (
    id, name, rfc, regimen_fiscal, codigo_postal, mask_format,
    current_year, current_period, created_at, user_id, organization_id
  )
  VALUES (
    v_company_id,
    coalesce(nullif(v_comp ->> 'name', ''), 'Empresa Restaurada'),
    v_rfc,
    coalesce(nullif(v_comp ->> 'regimenFiscal', ''), '601 - General de Ley Personas Morales'),
    coalesce(nullif(v_comp ->> 'codigoPostal', ''), '06600'),
    coalesce(nullif(v_comp ->> 'maskFormat', ''), 'XXX-XX-XXX'),
    coalesce((v_comp ->> 'currentYear')::integer, 2026),
    coalesce((v_comp ->> 'currentPeriod')::integer, 1),
    coalesce(nullif(v_comp ->> 'createdAt', '')::timestamptz, now()),
    v_owner_id,
    v_org_id
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    rfc = EXCLUDED.rfc,
    regimen_fiscal = EXCLUDED.regimen_fiscal,
    codigo_postal = EXCLUDED.codigo_postal,
    mask_format = EXCLUDED.mask_format,
    current_year = EXCLUDED.current_year,
    current_period = EXCLUDED.current_period;

  DELETE FROM public.bank_reconciliation_closures WHERE company_id = v_company_id;
  DELETE FROM public.despacho_deliverable_branding WHERE company_id = v_company_id;
  DELETE FROM public.bank_statement_matches WHERE company_id = v_company_id;
  DELETE FROM public.poliza_cfdis WHERE company_id = v_company_id;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'poliza_pedimentos') THEN
    DELETE FROM public.poliza_pedimentos WHERE poliza_id IN (SELECT id FROM public.polizas WHERE company_id = v_company_id);
  END IF;
  DELETE FROM public.poliza_movements WHERE poliza_id IN (SELECT id FROM public.polizas WHERE company_id = v_company_id);
  DELETE FROM public.polizas WHERE company_id = v_company_id;
  DELETE FROM public.bank_statement_lines WHERE company_id = v_company_id;
  DELETE FROM public.cfdi_documents WHERE company_id = v_company_id;
  DELETE FROM public.fixed_assets WHERE company_id = v_company_id;
  DELETE FROM public.third_parties WHERE company_id = v_company_id;
  DELETE FROM public.period_locks WHERE company_id = v_company_id;
  DELETE FROM public.tax_parameters WHERE company_id = v_company_id;
  DELETE FROM public.accounting_rules WHERE company_id = v_company_id;
  DELETE FROM public.annual_tax_snapshots WHERE company_id = v_company_id;
  DELETE FROM public.inventory_periods WHERE company_id = v_company_id;
  DELETE FROM public.payroll_period_settings WHERE company_id = v_company_id;
  DELETE FROM public.poliza_templates WHERE company_id = v_company_id;
  DELETE FROM public.business_segments WHERE company_id = v_company_id;
  DELETE FROM public.custom_inpc_entries WHERE company_id = v_company_id;
  DELETE FROM public.fiscal_loss_carryforwards WHERE company_id = v_company_id;
  DELETE FROM public.accounts WHERE company_id = v_company_id;

  -- 1. Cuentas contables
  IF jsonb_typeof(p_payload -> 'accounts') = 'array' AND jsonb_array_length(p_payload -> 'accounts') > 0 THEN
    INSERT INTO public.accounts (
      id, company_id, code, name, parent_code, type, nature, level,
      is_affectable, sat_group_code, currency, initial_balance
    )
    SELECT
      coalesce(nullif(a ->> 'id', ''), 'acc_' || substr(md5(v_company_id || ':' || (a ->> 'code')), 1, 16)),
      v_company_id,
      a ->> 'code',
      coalesce(a ->> 'name', ''),
      nullif(a ->> 'parentCode', ''),
      coalesce(a ->> 'type', 'ACTIVO'),
      coalesce(a ->> 'nature', 'DEUDORA'),
      coalesce((a ->> 'level')::integer, 3),
      coalesce((a ->> 'isAffectable')::boolean, TRUE),
      coalesce(nullif(a ->> 'satGroupCode', ''), '100'),
      coalesce(nullif(a ->> 'currency', ''), 'MXN'),
      coalesce((a ->> 'initialBalance')::numeric, 0)
    FROM jsonb_array_elements(p_payload -> 'accounts') AS a
    ON CONFLICT (company_id, code) DO UPDATE SET
      name = EXCLUDED.name,
      parent_code = EXCLUDED.parent_code,
      type = EXCLUDED.type,
      nature = EXCLUDED.nature,
      level = EXCLUDED.level,
      is_affectable = EXCLUDED.is_affectable,
      sat_group_code = EXCLUDED.sat_group_code,
      currency = EXCLUDED.currency,
      initial_balance = EXCLUDED.initial_balance;
  END IF;

  -- 1b. Segmentos de negocio (antes de pólizas/movimientos)
  IF jsonb_typeof(p_payload -> 'businessSegments') = 'array' AND jsonb_array_length(p_payload -> 'businessSegments') > 0 THEN
    INSERT INTO public.business_segments (
      id, company_id, code, name, parent_id, is_active, created_at, updated_at
    )
    SELECT
      bs ->> 'id',
      v_company_id,
      bs ->> 'code',
      coalesce(bs ->> 'name', ''),
      nullif(bs ->> 'parentId', ''),
      coalesce((bs ->> 'isActive')::boolean, TRUE),
      coalesce(nullif(bs ->> 'createdAt', '')::timestamptz, now()),
      coalesce(nullif(bs ->> 'updatedAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'businessSegments') AS bs
    ON CONFLICT (company_id, code) DO UPDATE SET
      name = EXCLUDED.name,
      parent_id = EXCLUDED.parent_id,
      is_active = EXCLUDED.is_active,
      updated_at = EXCLUDED.updated_at;
  END IF;

  -- 2. Parámetros fiscales
  IF jsonb_typeof(p_payload -> 'taxParameters') = 'array' AND jsonb_array_length(p_payload -> 'taxParameters') > 0 THEN
    INSERT INTO public.tax_parameters (
      company_id, ejercicio, periodo, coeficiente_utilidad,
      perdidas_fiscales_pendientes, pagos_provisionales_anteriores,
      saldo_favor_iva_anterior, tipo_cambio_dof_cierre, ptu_pagada_ejercicio
    )
    SELECT
      v_company_id,
      coalesce((tp ->> 'ejercicio')::integer, coalesce((v_comp ->> 'currentYear')::integer, 2026)),
      coalesce((tp ->> 'periodo')::integer, 0),
      coalesce((tp ->> 'coeficienteUtilidad')::numeric, 0),
      coalesce((tp ->> 'perdidasFiscalesPendientes')::numeric, 0),
      coalesce((tp ->> 'pagosProvisionalesAnteriores')::numeric, 0),
      coalesce((tp ->> 'saldoFavorIvaAnterior')::numeric, 0),
      coalesce((tp ->> 'tipoCambioDofCierre')::numeric, 0),
      coalesce((tp ->> 'ptuPagadaEjercicio')::numeric, 0)
    FROM jsonb_array_elements(p_payload -> 'taxParameters') AS tp
    ON CONFLICT (company_id, ejercicio, periodo) DO UPDATE SET
      coeficiente_utilidad = EXCLUDED.coeficiente_utilidad,
      perdidas_fiscales_pendientes = EXCLUDED.perdidas_fiscales_pendientes,
      pagos_provisionales_anteriores = EXCLUDED.pagos_provisionales_anteriores,
      saldo_favor_iva_anterior = EXCLUDED.saldo_favor_iva_anterior,
      tipo_cambio_dof_cierre = EXCLUDED.tipo_cambio_dof_cierre,
      ptu_pagada_ejercicio = EXCLUDED.ptu_pagada_ejercicio;
  END IF;

  -- 3. Pólizas, movimientos (con campos bancarios/segmento) y poliza_cfdis
  IF jsonb_typeof(p_payload -> 'polizas') = 'array' AND jsonb_array_length(p_payload -> 'polizas') > 0 THEN
    INSERT INTO public.polizas (
      id, company_id, tipo, folio, fecha, ejercicio, periodo,
      concepto, cfdi_uuid, origin, created_at
    )
    SELECT
      p ->> 'id',
      v_company_id,
      p ->> 'tipo',
      (p ->> 'folio')::integer,
      (p ->> 'fecha')::timestamptz,
      (p ->> 'ejercicio')::integer,
      (p ->> 'periodo')::integer,
      coalesce(p ->> 'concepto', ''),
      nullif(p ->> 'cfdiUuid', ''),
      coalesce(nullif(p ->> 'origin', ''), 'MANUAL'),
      coalesce(nullif(p ->> 'createdAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'polizas') AS p;

    INSERT INTO public.poliza_movements (
      id, poliza_id, account_id, account_code, account_name,
      referencia, concepto, cargo, abono, cfdi_uuid,
      payment_method_sat, bank_code_ori, account_ori, bank_code_dest,
      account_dest, beneficiary_name, beneficiary_rfc, cheque_num, business_segment_id
    )
    SELECT
      m ->> 'id',
      p ->> 'id',
      m ->> 'accountId',
      coalesce(m ->> 'accountCode', ''),
      coalesce(m ->> 'accountName', ''),
      coalesce(m ->> 'referencia', ''),
      coalesce(m ->> 'concepto', ''),
      coalesce((m ->> 'cargo')::numeric, 0),
      coalesce((m ->> 'abono')::numeric, 0),
      nullif(m ->> 'cfdiUuid', ''),
      nullif(m ->> 'paymentMethodSat', ''),
      nullif(m ->> 'bankCodeOri', ''),
      nullif(m ->> 'accountOri', ''),
      nullif(m ->> 'bankCodeDest', ''),
      nullif(m ->> 'accountDest', ''),
      nullif(m ->> 'beneficiaryName', ''),
      nullif(m ->> 'beneficiaryRfc', ''),
      nullif(m ->> 'chequeNum', ''),
      nullif(m ->> 'businessSegmentId', '')
    FROM jsonb_array_elements(p_payload -> 'polizas') AS p,
         jsonb_array_elements(coalesce(p -> 'movements', '[]'::jsonb)) AS m;

    INSERT INTO public.poliza_cfdis (id, company_id, poliza_id, cfdi_uuid)
    SELECT
      'pc_' || substr(md5((p ->> 'id') || ':' || upper(trim(u.val))), 1, 20),
      v_company_id,
      p ->> 'id',
      upper(trim(u.val))
    FROM jsonb_array_elements(p_payload -> 'polizas') AS p
    CROSS JOIN LATERAL (
      SELECT nullif(p ->> 'cfdiUuid', '') AS val
      UNION
      SELECT nullif(m ->> 'cfdiUuid', '') AS val
      FROM jsonb_array_elements(coalesce(p -> 'movements', '[]'::jsonb)) AS m
      UNION
      SELECT jsonb_array_elements_text(coalesce(p -> 'cfdiUuids', '[]'::jsonb)) AS val
    ) AS u
    WHERE u.val IS NOT NULL AND trim(u.val) <> ''
    ON CONFLICT (poliza_id, cfdi_uuid) DO NOTHING;
  END IF;

  IF jsonb_typeof(p_payload -> 'polizaCfdis') = 'array' AND jsonb_array_length(p_payload -> 'polizaCfdis') > 0 THEN
    INSERT INTO public.poliza_cfdis (id, company_id, poliza_id, cfdi_uuid, created_at)
    SELECT
      coalesce(nullif(pc ->> 'id', ''), 'pc_' || substr(md5((pc ->> 'polizaId') || ':' || upper(trim(pc ->> 'cfdiUuid'))), 1, 20)),
      v_company_id,
      pc ->> 'polizaId',
      upper(trim(pc ->> 'cfdiUuid')),
      coalesce(nullif(pc ->> 'createdAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'polizaCfdis') AS pc
    WHERE nullif(trim(pc ->> 'polizaId'), '') IS NOT NULL
      AND nullif(trim(pc ->> 'cfdiUuid'), '') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.polizas p
        WHERE p.id = (pc ->> 'polizaId') AND p.company_id = v_company_id
      )
    ON CONFLICT (poliza_id, cfdi_uuid) DO NOTHING;
  END IF;

  -- 4. CFDIs (incluyendo EFOS/cancelación/deductible_pct/is_foreign_no_cfdi)
  IF jsonb_typeof(p_payload -> 'cfdis') = 'array' AND jsonb_array_length(p_payload -> 'cfdis') > 0 THEN
    INSERT INTO public.cfdi_documents (
      id, company_id, uuid, fecha, fecha_pago, tipo_comprobante, direction, serie, folio,
      emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre, concepto_principal,
      clave_prod_serv, moneda, tipo_cambio, subtotal, descuento, iva_trasladado,
      isr_retenido, iva_retenido, total, metodo_pago, forma_pago, uso_cfdi,
      uuid_relacionado, status_sat, validacion_efos, es_cancelable, estatus_cancelacion,
      poliza_id, deductible_pct, is_foreign_no_cfdi, tax_breakdown, related_docs, xml_raw
    )
    SELECT
      c ->> 'id',
      v_company_id,
      c ->> 'uuid',
      (c ->> 'fecha')::timestamptz,
      nullif(c ->> 'fechaPago', ''),
      c ->> 'tipoComprobante',
      c ->> 'direction',
      coalesce(c ->> 'serie', ''),
      coalesce(c ->> 'folio', ''),
      c ->> 'emisorRfc',
      c ->> 'emisorNombre',
      c ->> 'receptorRfc',
      c ->> 'receptorNombre',
      coalesce(c ->> 'conceptoPrincipal', ''),
      coalesce(nullif(c ->> 'claveProdServ', ''), '01010101'),
      coalesce(nullif(c ->> 'moneda', ''), 'MXN'),
      coalesce((c ->> 'tipoCambio')::numeric, 1),
      coalesce((c ->> 'subtotal')::numeric, 0),
      coalesce((c ->> 'descuento')::numeric, 0),
      coalesce((c ->> 'ivaTrasladado')::numeric, 0),
      coalesce((c ->> 'isrRetenido')::numeric, 0),
      coalesce((c ->> 'ivaRetenido')::numeric, 0),
      coalesce((c ->> 'total')::numeric, 0),
      coalesce(nullif(c ->> 'metodoPago', ''), 'PUE'),
      coalesce(nullif(c ->> 'formaPago', ''), '03'),
      coalesce(nullif(c ->> 'usoCfdi', ''), 'G03'),
      nullif(c ->> 'uuidRelacionado', ''),
      coalesce(nullif(c ->> 'statusSat', ''), 'VIGENTE'),
      nullif(c ->> 'validacionEfos', ''),
      nullif(c ->> 'esCancelable', ''),
      nullif(c ->> 'estatusCancelacion', ''),
      nullif(c ->> 'polizaId', ''),
      round(coalesce((c ->> 'deductiblePct')::numeric, 100))::integer,
      coalesce((c ->> 'isForeignNoCfdi')::boolean, FALSE),
      c -> 'taxBreakdown',
      c -> 'relatedDocs',
      coalesce(c ->> 'xmlRaw', '')
    FROM jsonb_array_elements(p_payload -> 'cfdis') AS c
    ON CONFLICT (company_id, uuid) DO NOTHING;
  END IF;

  -- 5. Padrón de terceros (con region_fronteriza y soporte parcial DIOT '05')
  IF jsonb_typeof(p_payload -> 'thirdParties') = 'array' AND jsonb_array_length(p_payload -> 'thirdParties') > 0 THEN
    INSERT INTO public.third_parties (
      id, company_id, rfc, nombre, rol, cuenta_operacion_code, cuenta_contrapartida_code,
      tipo_tercero_diot, tipo_operacion_diot, tasa_iva_default, deductible_pct, estatus_69b,
      id_fiscal, pais, jurisdiccion_fiscal, region_fronteriza, updated_at
    )
    SELECT
      tp ->> 'id',
      v_company_id,
      tp ->> 'rfc',
      tp ->> 'nombre',
      coalesce(nullif(tp ->> 'rol', ''), 'PROVEEDOR'),
      coalesce(tp ->> 'cuentaOperacionCode', '601-01-001'),
      coalesce(tp ->> 'cuentaContrapartidaCode', '201-01-001'),
      coalesce(nullif(tp ->> 'tipoTerceroDiot', ''), '04'),
      CASE
        WHEN nullif(tp ->> 'tipoOperacionDiot', '') IN ('02', '03', '06', '07', '08', '85', '87')
          THEN tp ->> 'tipoOperacionDiot'
        ELSE '85'
      END,
      coalesce((tp ->> 'tasaIvaDefault')::integer, 16),
      round(coalesce((tp ->> 'deductiblePct')::numeric, 100))::integer,
      coalesce(nullif(tp ->> 'estatus69B', ''), nullif(tp ->> 'estatus69b', ''), 'LIMPIO'),
      nullif(tp ->> 'idFiscal', ''),
      nullif(tp ->> 'pais', ''),
      nullif(tp ->> 'jurisdiccionFiscal', ''),
      CASE
        WHEN upper(coalesce(tp ->> 'regionFronteriza', '')) = 'SUR' THEN 'SUR'
        ELSE 'NORTE'
      END,
      coalesce(nullif(tp ->> 'updatedAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'thirdParties') AS tp;
  END IF;

  -- 6. Activos fijos (incluyendo baja y vehicle_cap_type)
  IF jsonb_typeof(p_payload -> 'fixedAssets') = 'array' AND jsonb_array_length(p_payload -> 'fixedAssets') > 0 THEN
    INSERT INTO public.fixed_assets (
      id, company_id, codigo, nombre, categoria, fecha_adquisicion, cfdi_uuid,
      monto_original_inversion, tasa_anual_pct, meses_depreciados_previos,
      inpc_adquisicion, inpc_medio_periodo, cuenta_activo_code,
      cuenta_dep_acum_code, cuenta_gasto_dep_code, estatus,
      fecha_baja, precio_venta, baja_poliza_id, vehicle_cap_type, created_at
    )
    SELECT
      fa ->> 'id',
      v_company_id,
      fa ->> 'codigo',
      fa ->> 'nombre',
      fa ->> 'categoria',
      (fa ->> 'fechaAdquisicion')::date,
      nullif(fa ->> 'cfdiUuid', ''),
      (fa ->> 'montoOriginalInversion')::numeric,
      (fa ->> 'tasaAnualPct')::numeric,
      coalesce((fa ->> 'mesesDepreciadosPrevios')::integer, 0),
      coalesce((fa ->> 'inpcAdquisicion')::numeric, 132.54),
      coalesce((fa ->> 'inpcMedioPeriodo')::numeric, 136.82),
      coalesce(nullif(fa ->> 'cuentaActivoCode', ''), '156-01-001'),
      coalesce(nullif(fa ->> 'cuentaDepAcumCode', ''), '171-01-001'),
      coalesce(nullif(fa ->> 'cuentaGastoDepCode', ''), '601-01-006'),
      coalesce(nullif(fa ->> 'estatus', ''), 'ACTIVO'),
      nullif(fa ->> 'fechaBaja', '')::date,
      CASE
        WHEN fa ? 'precioVenta' AND fa ->> 'precioVenta' IS NOT NULL AND trim(fa ->> 'precioVenta') <> ''
          THEN (fa ->> 'precioVenta')::numeric
        ELSE NULL
      END,
      nullif(fa ->> 'bajaPolizaId', ''),
      nullif(fa ->> 'vehicleCapType', ''),
      coalesce(nullif(fa ->> 'createdAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'fixedAssets') AS fa;
  END IF;

  -- 7. Reglas contables, anual, inventarios, nómina y tablas Ronda 11
  IF jsonb_typeof(p_payload -> 'accountingRules') = 'array' AND jsonb_array_length(p_payload -> 'accountingRules') > 0 THEN
    INSERT INTO public.accounting_rules (
      id, company_id, name, match_rfc, match_clave_prod_serv, match_uso_cfdi,
      direction, operation_account_code, counter_account_code, deductible_pct,
      priority, auto_learned, created_at, updated_at
    )
    SELECT
      r ->> 'id',
      v_company_id,
      coalesce(r ->> 'name', ''),
      nullif(r ->> 'matchRfc', ''),
      nullif(r ->> 'matchClaveProdServ', ''),
      nullif(r ->> 'matchUsoCfdi', ''),
      coalesce(nullif(r ->> 'direction', ''), 'RECIBIDO'),
      r ->> 'operationAccountCode',
      nullif(r ->> 'counterAccountCode', ''),
      coalesce((r ->> 'deductiblePct')::numeric, 100),
      coalesce((r ->> 'priority')::integer, 10),
      coalesce((r ->> 'autoLearned')::boolean, FALSE),
      coalesce(nullif(r ->> 'createdAt', '')::timestamptz, now()),
      coalesce(nullif(r ->> 'updatedAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'accountingRules') AS r;
  END IF;

  IF jsonb_typeof(p_payload -> 'annualTaxSnapshots') = 'array' AND jsonb_array_length(p_payload -> 'annualTaxSnapshots') > 0 THEN
    INSERT INTO public.annual_tax_snapshots (
      id, company_id, ejercicio, inpc_cierre_anterior, inpc_cierre_actual,
      cuca_inicial, aportaciones_capital, reducciones_capital, cufin_inicial,
      dividendos_pagados, ptu_pagada_anterior, no_deducibles_manual,
      deducciones_personales, updated_at
    )
    SELECT
      'ats_' || v_company_id || '_' || (s ->> 'ejercicio'),
      v_company_id,
      (s ->> 'ejercicio')::integer,
      coalesce((s ->> 'inpcCierreAnterior')::numeric, 139.38),
      coalesce((s ->> 'inpcCierreActual')::numeric, 145.4),
      coalesce((s ->> 'cucaInicial')::numeric, 0),
      coalesce((s ->> 'aportacionesCapital')::numeric, 0),
      coalesce((s ->> 'reduccionesCapital')::numeric, 0),
      coalesce((s ->> 'cufinInicial')::numeric, 0),
      coalesce((s ->> 'dividendosPagados')::numeric, 0),
      coalesce((s ->> 'ptuPagadaAnterior')::numeric, 0),
      coalesce((s ->> 'noDeduciblesManual')::numeric, 0),
      coalesce((s ->> 'deduccionesPersonales')::numeric, 0),
      now()
    FROM jsonb_array_elements(p_payload -> 'annualTaxSnapshots') AS s;
  END IF;

  IF jsonb_typeof(p_payload -> 'inventoryPeriods') = 'array' AND jsonb_array_length(p_payload -> 'inventoryPeriods') > 0 THEN
    INSERT INTO public.inventory_periods (
      id, company_id, ejercicio, periodo, initial_inventory,
      purchases_override, final_inventory, method, poliza_id, updated_at
    )
    SELECT
      coalesce(nullif(ip ->> 'id', ''), 'inv_' || v_company_id || '_' || (ip ->> 'ejercicio') || '_' || (ip ->> 'periodo')),
      v_company_id,
      (ip ->> 'ejercicio')::integer,
      (ip ->> 'periodo')::integer,
      coalesce((ip ->> 'initialInventory')::numeric, 0),
      CASE WHEN ip ? 'purchasesOverride' AND ip ->> 'purchasesOverride' IS NOT NULL THEN (ip ->> 'purchasesOverride')::numeric ELSE NULL END,
      coalesce((ip ->> 'finalInventory')::numeric, 0),
      coalesce(nullif(ip ->> 'method', ''), 'ANALITICO'),
      nullif(ip ->> 'polizaId', ''),
      now()
    FROM jsonb_array_elements(p_payload -> 'inventoryPeriods') AS ip;
  END IF;

  IF jsonb_typeof(p_payload -> 'payrollPeriodSettings') = 'array' AND jsonb_array_length(p_payload -> 'payrollPeriodSettings') > 0 THEN
    INSERT INTO public.payroll_period_settings (
      company_id, ejercicio, periodo, state_code, isn_rate,
      imss_patronal, rcv, infonavit, updated_at
    )
    SELECT
      v_company_id,
      (ps ->> 'ejercicio')::integer,
      (ps ->> 'periodo')::integer,
      coalesce(nullif(ps ->> 'stateCode', ''), 'CMX'),
      coalesce((ps ->> 'isnRate')::numeric, 4.0),
      coalesce((ps ->> 'imssPatronal')::numeric, 0),
      coalesce((ps ->> 'rcv')::numeric, 0),
      coalesce((ps ->> 'infonavit')::numeric, 0),
      coalesce(nullif(ps ->> 'updatedAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'payrollPeriodSettings') AS ps
    ON CONFLICT (company_id, ejercicio, periodo) DO UPDATE SET
      state_code = EXCLUDED.state_code,
      isn_rate = EXCLUDED.isn_rate,
      imss_patronal = EXCLUDED.imss_patronal,
      rcv = EXCLUDED.rcv,
      infonavit = EXCLUDED.infonavit,
      updated_at = EXCLUDED.updated_at;
  END IF;

  IF jsonb_typeof(p_payload -> 'polizaTemplates') = 'array' AND jsonb_array_length(p_payload -> 'polizaTemplates') > 0 THEN
    INSERT INTO public.poliza_templates (
      id, company_id, name, tipo, concepto_default, movements_json, is_active, created_at, updated_at
    )
    SELECT
      pt ->> 'id',
      v_company_id,
      coalesce(pt ->> 'name', ''),
      coalesce(nullif(pt ->> 'tipo', ''), 'DIARIO'),
      coalesce(pt ->> 'conceptoDefault', ''),
      coalesce(pt -> 'movementsJson', '[]'::jsonb),
      coalesce((pt ->> 'isActive')::boolean, TRUE),
      coalesce(nullif(pt ->> 'createdAt', '')::timestamptz, now()),
      coalesce(nullif(pt ->> 'updatedAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'polizaTemplates') AS pt;
  END IF;

  IF jsonb_typeof(p_payload -> 'customInpcEntries') = 'array' AND jsonb_array_length(p_payload -> 'customInpcEntries') > 0 THEN
    INSERT INTO public.custom_inpc_entries (
      company_id, year, month, inpc_value, source, updated_at
    )
    SELECT
      v_company_id,
      (ci ->> 'year')::integer,
      (ci ->> 'month')::integer,
      (ci ->> 'inpcValue')::numeric,
      coalesce(nullif(ci ->> 'source', ''), 'MANUAL'),
      coalesce(nullif(ci ->> 'updatedAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'customInpcEntries') AS ci
    ON CONFLICT (company_id, year, month) DO UPDATE SET
      inpc_value = EXCLUDED.inpc_value,
      source = EXCLUDED.source,
      updated_at = EXCLUDED.updated_at;
  END IF;

  IF jsonb_typeof(p_payload -> 'fiscalLossCarryforwards') = 'array' AND jsonb_array_length(p_payload -> 'fiscalLossCarryforwards') > 0 THEN
    INSERT INTO public.fiscal_loss_carryforwards (
      id, company_id, loss_year, original_amount, applied_amount, remaining_amount,
      inpc_first_update_month, inpc_last_applied, notes, updated_at
    )
    SELECT
      coalesce(nullif(fl ->> 'id', ''), 'flc_' || v_company_id || '_' || (fl ->> 'lossYear')),
      v_company_id,
      (fl ->> 'lossYear')::integer,
      coalesce((fl ->> 'originalAmount')::numeric, 0),
      coalesce((fl ->> 'appliedAmount')::numeric, 0),
      coalesce((fl ->> 'remainingAmount')::numeric, 0),
      CASE WHEN fl ? 'inpcFirstUpdateMonth' AND fl ->> 'inpcFirstUpdateMonth' IS NOT NULL THEN (fl ->> 'inpcFirstUpdateMonth')::integer ELSE NULL END,
      CASE WHEN fl ? 'inpcLastApplied' AND fl ->> 'inpcLastApplied' IS NOT NULL THEN (fl ->> 'inpcLastApplied')::numeric ELSE NULL END,
      coalesce(fl ->> 'notes', ''),
      coalesce(nullif(fl ->> 'updatedAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'fiscalLossCarryforwards') AS fl
    ON CONFLICT (company_id, loss_year) DO UPDATE SET
      original_amount = EXCLUDED.original_amount,
      applied_amount = EXCLUDED.applied_amount,
      remaining_amount = EXCLUDED.remaining_amount,
      inpc_first_update_month = EXCLUDED.inpc_first_update_month,
      inpc_last_applied = EXCLUDED.inpc_last_applied,
      notes = EXCLUDED.notes,
      updated_at = EXCLUDED.updated_at;
  END IF;

  -- 8. Bancos, conciliación N-a-1 y cierres bancarios
  IF jsonb_typeof(p_payload -> 'bankStatementLines') = 'array' AND jsonb_array_length(p_payload -> 'bankStatementLines') > 0 THEN
    INSERT INTO public.bank_statement_lines (
      id, company_id, account_id, fecha, ejercicio, periodo,
      referencia, descripcion, cargo_banco, abono_banco, matched_movement_id
    )
    SELECT
      b ->> 'id',
      v_company_id,
      b ->> 'accountId',
      (b ->> 'fecha')::timestamptz,
      (b ->> 'ejercicio')::integer,
      (b ->> 'periodo')::integer,
      coalesce(b ->> 'referencia', ''),
      coalesce(b ->> 'descripcion', ''),
      coalesce((b ->> 'cargoBanco')::numeric, 0),
      coalesce((b ->> 'abonoBanco')::numeric, 0),
      nullif(b ->> 'matchedMovementId', '')
    FROM jsonb_array_elements(p_payload -> 'bankStatementLines') AS b;
  END IF;

  IF jsonb_typeof(p_payload -> 'bankStatementMatches') = 'array' AND jsonb_array_length(p_payload -> 'bankStatementMatches') > 0 THEN
    INSERT INTO public.bank_statement_matches (
      id, company_id, bank_line_id, movement_id, poliza_id, matched_amount, created_at
    )
    SELECT
      bm ->> 'id',
      v_company_id,
      bm ->> 'bankLineId',
      bm ->> 'movementId',
      coalesce(bm ->> 'polizaId', ''),
      coalesce((bm ->> 'matchedAmount')::numeric, 0),
      coalesce(nullif(bm ->> 'createdAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'bankStatementMatches') AS bm
    ON CONFLICT (bank_line_id, movement_id) DO NOTHING;
  END IF;

  IF jsonb_typeof(p_payload -> 'bankReconciliationClosures') = 'array' AND jsonb_array_length(p_payload -> 'bankReconciliationClosures') > 0 THEN
    INSERT INTO public.bank_reconciliation_closures (
      id, company_id, account_id, ejercicio, periodo, saldo_banco_cierre, updated_at
    )
    SELECT
      coalesce(nullif(bc ->> 'id', ''), 'brc_' || substr(md5(v_company_id || ':' || (bc ->> 'accountId') || ':' || (bc ->> 'ejercicio') || ':' || (bc ->> 'periodo')), 1, 16)),
      v_company_id,
      bc ->> 'accountId',
      (bc ->> 'ejercicio')::integer,
      (bc ->> 'periodo')::integer,
      coalesce((bc ->> 'saldoBancoCierre')::numeric, 0),
      coalesce(nullif(bc ->> 'updatedAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'bankReconciliationClosures') AS bc
    ON CONFLICT (company_id, account_id, ejercicio, periodo) DO UPDATE SET
      saldo_banco_cierre = EXCLUDED.saldo_banco_cierre,
      updated_at = EXCLUDED.updated_at;
  END IF;

  -- 9. Branding de entregables (despacho_deliverable_branding)
  v_branding := coalesce(p_payload -> 'deliverableBranding', p_payload -> 'despachoDeliverableBranding');
  IF jsonb_typeof(v_branding) = 'array' AND jsonb_array_length(v_branding) > 0 THEN
    v_branding := v_branding -> 0;
  END IF;
  IF jsonb_typeof(v_branding) = 'object' THEN
    INSERT INTO public.despacho_deliverable_branding (
      id, scope_key, company_id, organization_id,
      firm_name, auditor_name, auditor_cedula, preparer_name,
      issuance_city, logo_data_url, notes_text,
      legal_rep_name, legal_rep_title, updated_at
    )
    VALUES (
      'brand_' || v_company_id,
      'comp_' || v_company_id,
      v_company_id,
      v_org_id,
      coalesce(v_branding ->> 'firmName', v_branding ->> 'firm_name', ''),
      coalesce(v_branding ->> 'auditorName', v_branding ->> 'auditor_name', ''),
      coalesce(v_branding ->> 'auditorCedula', v_branding ->> 'auditor_cedula', ''),
      coalesce(nullif(coalesce(v_branding ->> 'preparerName', v_branding ->> 'preparer_name'), ''), 'Auxiliar Contable'),
      coalesce(nullif(coalesce(v_branding ->> 'issuanceCity', v_branding ->> 'issuance_city'), ''), 'Ciudad de México'),
      nullif(coalesce(v_branding ->> 'logoDataUrl', v_branding ->> 'logo_data_url'), ''),
      coalesce(v_branding ->> 'accountantNotes', v_branding ->> 'notesText', v_branding ->> 'notes_text', ''),
      coalesce(v_branding ->> 'legalRepName', v_branding ->> 'legal_rep_name', ''),
      coalesce(nullif(coalesce(v_branding ->> 'legalRepTitle', v_branding ->> 'legal_rep_title'), ''), 'Representante Legal'),
      now()
    )
    ON CONFLICT (scope_key) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      organization_id = EXCLUDED.organization_id,
      firm_name = EXCLUDED.firm_name,
      auditor_name = EXCLUDED.auditor_name,
      auditor_cedula = EXCLUDED.auditor_cedula,
      preparer_name = EXCLUDED.preparer_name,
      issuance_city = EXCLUDED.issuance_city,
      logo_data_url = EXCLUDED.logo_data_url,
      notes_text = EXCLUDED.notes_text,
      legal_rep_name = EXCLUDED.legal_rep_name,
      legal_rep_title = EXCLUDED.legal_rep_title,
      updated_at = EXCLUDED.updated_at;
  END IF;

  -- 10. Candados de periodo SIEMPRE al final
  IF jsonb_typeof(p_payload -> 'periodLocks') = 'array' AND jsonb_array_length(p_payload -> 'periodLocks') > 0 THEN
    INSERT INTO public.period_locks (company_id, ejercicio, periodo, is_locked, locked_at, notes)
    SELECT
      v_company_id,
      (pl ->> 'ejercicio')::integer,
      (pl ->> 'periodo')::integer,
      coalesce((pl ->> 'isLocked')::boolean, FALSE),
      nullif(pl ->> 'lockedAt', '')::timestamptz,
      coalesce(pl ->> 'notes', '')
    FROM jsonb_array_elements(p_payload -> 'periodLocks') AS pl;
  END IF;

  RETURN v_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_company_backup_atomic(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_company_backup_atomic(JSONB) TO authenticated, service_role;
