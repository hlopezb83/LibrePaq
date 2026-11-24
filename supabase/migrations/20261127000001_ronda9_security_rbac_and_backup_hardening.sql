-- ============================================================================
-- LIBREPAQ PRO — RONDA 9: SEGURIDAD MULTI-TENANT, RBAC, QUOTAS Y BACKUP ATOMIC
-- 100% IDEMPOTENTE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Explicit access_scope en public.workspace_members + backfill + RBAC
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.workspace_members
  ADD COLUMN IF NOT EXISTS access_scope TEXT NOT NULL DEFAULT 'ALL_COMPANIES';

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workspace_members'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.workspace_members'::regclass
      AND conname = 'chk_workspace_members_access_scope'
  ) THEN
    ALTER TABLE public.workspace_members
      ADD CONSTRAINT chk_workspace_members_access_scope
      CHECK (access_scope IN ('ALL_COMPANIES', 'RESTRICTED'));
  END IF;
END $$;

UPDATE public.workspace_members wm
SET access_scope = 'RESTRICTED'
WHERE wm.access_scope IS DISTINCT FROM 'RESTRICTED'
  AND (
    wm.role = 'CLIENTE_LECTURA'
    OR EXISTS (
      SELECT 1 FROM public.company_member_access cma
      WHERE cma.member_id = wm.id
    )
  );

-- Garantizar columnas fiscales opcionales usadas en backup/restauración
ALTER TABLE IF EXISTS public.annual_tax_snapshots
  ADD COLUMN IF NOT EXISTS deducciones_personales NUMERIC DEFAULT 0;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cfdi_documents'
  ) THEN
    ALTER TABLE public.cfdi_documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
    ALTER TABLE public.cfdi_documents ALTER COLUMN created_at SET DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cfdi_documents_company_created
  ON public.cfdi_documents (company_id, created_at);

-- ----------------------------------------------------------------------------
-- 2. Actualizar is_workspace_socio(TEXT) y has_company_role(TEXT, TEXT)
--    para respetar access_scope = 'ALL_COMPANIES' y evitar escalación por CASCADE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_workspace_socio(p_workspace_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := (SELECT auth.uid())::text;
  v_email TEXT := lower(coalesce((SELECT auth.jwt()) ->> 'email', ''));
  v_status TEXT;
BEGIN
  IF v_uid IS NULL OR p_workspace_id IS NULL OR trim(p_workspace_id) = '' THEN
    RETURN FALSE;
  END IF;

  SELECT upper(coalesce(status, 'ACTIVO')) INTO v_status
  FROM public.user_profiles
  WHERE id = v_uid
  LIMIT 1;

  IF v_status = 'SUSPENDIDO' THEN
    RETURN FALSE;
  END IF;

  IF public.get_platform_role() = 'SUPERADMIN' THEN
    RETURN TRUE;
  END IF;

  IF p_workspace_id = v_uid OR p_workspace_id = ('ws_' || left(v_uid, 8)) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.status = 'ACTIVO'
      AND wm.role = 'SOCIO'
      AND wm.access_scope = 'ALL_COMPANIES'
      AND (
        wm.user_id = v_uid
        OR (wm.user_id IS NULL AND v_email <> '' AND lower(wm.email) = v_email)
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_workspace_socio(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_socio(TEXT) TO authenticated, service_role;

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

  IF v_company_owner_id = v_uid THEN
    RETURN TRUE;
  END IF;

  -- 3a. Dueño / Socio sin restricciones de la organización en companies.organization_id
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

  -- 3c. Membresía general de despacho sin restricciones:
  --     Solo aplica cuando wm.access_scope = 'ALL_COMPANIES' AND wm.role <> 'CLIENTE_LECTURA'.
  IF v_eff_role IS NULL AND v_company_org_id IS NOT NULL THEN
    SELECT wm.role INTO v_eff_role
    FROM public.workspace_members wm
    WHERE wm.status = 'ACTIVO'
      AND wm.workspace_id = v_company_org_id
      AND wm.access_scope = 'ALL_COMPANIES'
      AND wm.role <> 'CLIENTE_LECTURA'
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
-- 3. Proteger companies.user_id y companies.organization_id en UPDATE e INSERT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_company_ownership_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := coalesce((SELECT auth.role()), '');
  v_uid TEXT := (SELECT auth.uid())::text;
BEGIN
  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    IF v_uid IS NULL OR OLD.user_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Only the existing owner can modify company user_id or organization_id';
    END IF;

    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id AND NEW.organization_id IS NOT NULL THEN
      IF NOT (
        NEW.organization_id = v_uid
        OR NEW.organization_id = ('ws_' || left(v_uid, 8))
        OR public.is_workspace_socio(NEW.organization_id)
        OR EXISTS (
          SELECT 1 FROM public.organizations o
          WHERE o.id = NEW.organization_id
            AND o.owner_user_id = v_uid
        )
      ) THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Target organization_id does not belong to caller';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_company_ownership_cols() FROM PUBLIC, anon;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'companies'
  ) THEN
    DROP TRIGGER IF EXISTS trg_protect_company_ownership_cols ON public.companies;
    CREATE TRIGGER trg_protect_company_ownership_cols
      BEFORE UPDATE ON public.companies
      FOR EACH ROW
      EXECUTE FUNCTION public.protect_company_ownership_cols();

    DROP POLICY IF EXISTS "rls_companies_insert" ON public.companies;
    CREATE POLICY "rls_companies_insert"
      ON public.companies AS PERMISSIVE FOR INSERT TO authenticated
      WITH CHECK (
        NOT public.is_user_suspended()
        AND (
          public.is_platform_superadmin()
          OR (
            user_id = (SELECT auth.uid())::text
            AND (
              organization_id IS NULL
              OR organization_id = ('ws_' || left((SELECT auth.uid())::text, 8))
              OR EXISTS (
                SELECT 1
                FROM public.organizations o
                WHERE o.id = organization_id
                  AND o.owner_user_id = (SELECT auth.uid())::text
              )
              OR EXISTS (
                SELECT 1
                FROM public.workspace_members wm
                WHERE wm.workspace_id = organization_id
                  AND wm.status = 'ACTIVO'
                  AND wm.role = 'SOCIO'
                  AND wm.access_scope = 'ALL_COMPANIES'
                  AND (
                    wm.user_id = (SELECT auth.uid())::text
                    OR (
                      wm.user_id IS NULL
                      AND lower(coalesce((SELECT auth.jwt()) ->> 'email', '')) <> ''
                      AND lower(wm.email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
                    )
                  )
              )
            )
          )
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Endurecer rls_despacho_deliverable_branding_write (org-level: SOCIO/CONTADOR ALL_COMPANIES)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'despacho_deliverable_branding'
  ) THEN
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
                AND wm.role IN ('SOCIO', 'CONTADOR')
                AND wm.access_scope = 'ALL_COMPANIES'
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
                AND wm.role IN ('SOCIO', 'CONTADOR')
                AND wm.access_scope = 'ALL_COMPANIES'
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
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Corregir handle_new_user_profile() para no confiar en metadata workspace_id
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
  v_full_name TEXT := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(coalesce(NEW.email, ''), '@', 1)
  );
  v_default_ws_id TEXT := 'ws_' || left(NEW.id::text, 8);
  v_ws_id TEXT := CASE
    WHEN v_jwt_role = 'service_role'
      THEN COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'workspace_id'), ''), v_default_ws_id)
    ELSE v_default_ws_id
  END;
  v_ws_name TEXT := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'workspace_name'), ''),
    'Despacho ' || COALESCE(NULLIF(trim(v_full_name), ''), 'Contable')
  );
BEGIN
  INSERT INTO public.user_profiles (
    id, email, full_name, provider, is_superadmin, workspace_id, created_at, last_sign_in_at
  )
  VALUES (
    NEW.id::text,
    NEW.email,
    v_full_name,
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    (NEW.email = 'hlopezb@gmail.com'),
    v_ws_id,
    NEW.created_at,
    NEW.last_sign_in_at
  )
  ON CONFLICT (id) DO UPDATE SET
    last_sign_in_at = EXCLUDED.last_sign_in_at,
    workspace_id = COALESCE(NULLIF(trim(public.user_profiles.workspace_id), ''), EXCLUDED.workspace_id);

  INSERT INTO public.organizations (id, name, owner_user_id)
  VALUES (v_ws_id, v_ws_name, NEW.id::text)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 6. Corregir enforce_period_lock() para tax_parameters (periodo = 0)
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

-- ----------------------------------------------------------------------------
-- 7. Endurecer restore_company_backup_atomic(p_payload JSONB)
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
  DELETE FROM public.accounts WHERE company_id = v_company_id;

  -- 1. Cuentas contables (preservando currency)
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

  -- 2. Parámetros fiscales (incluyendo ptu_pagada_ejercicio)
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

  -- 3. Pólizas, movimientos y relación N:M poliza_cfdis
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
      referencia, concepto, cargo, abono, cfdi_uuid
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
      nullif(m ->> 'cfdiUuid', '')
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

  -- 4. CFDIs (incluyendo fecha_pago)
  IF jsonb_typeof(p_payload -> 'cfdis') = 'array' AND jsonb_array_length(p_payload -> 'cfdis') > 0 THEN
    INSERT INTO public.cfdi_documents (
      id, company_id, uuid, fecha, fecha_pago, tipo_comprobante, direction, serie, folio,
      emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre, concepto_principal,
      clave_prod_serv, moneda, tipo_cambio, subtotal, descuento, iva_trasladado,
      isr_retenido, iva_retenido, total, metodo_pago, forma_pago, uso_cfdi,
      uuid_relacionado, status_sat, poliza_id, tax_breakdown, related_docs, xml_raw
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
      nullif(c ->> 'polizaId', ''),
      c -> 'taxBreakdown',
      c -> 'relatedDocs',
      coalesce(c ->> 'xmlRaw', '')
    FROM jsonb_array_elements(p_payload -> 'cfdis') AS c
    ON CONFLICT (company_id, uuid) DO NOTHING;
  END IF;

  -- 5. Padrón de terceros (incluyendo id_fiscal, pais, jurisdiccion_fiscal)
  IF jsonb_typeof(p_payload -> 'thirdParties') = 'array' AND jsonb_array_length(p_payload -> 'thirdParties') > 0 THEN
    INSERT INTO public.third_parties (
      id, company_id, rfc, nombre, rol, cuenta_operacion_code, cuenta_contrapartida_code,
      tipo_tercero_diot, tipo_operacion_diot, tasa_iva_default, deductible_pct, estatus_69b,
      id_fiscal, pais, jurisdiccion_fiscal, updated_at
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
      coalesce(nullif(tp ->> 'tipoOperacionDiot', ''), '85'),
      coalesce((tp ->> 'tasaIvaDefault')::integer, 16),
      coalesce((tp ->> 'deductiblePct')::numeric, 100),
      coalesce(nullif(tp ->> 'estatus69B', ''), nullif(tp ->> 'estatus69b', ''), 'LIMPIO'),
      nullif(tp ->> 'idFiscal', ''),
      nullif(tp ->> 'pais', ''),
      nullif(tp ->> 'jurisdiccionFiscal', ''),
      coalesce(nullif(tp ->> 'updatedAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'thirdParties') AS tp;
  END IF;

  -- 6. Activos fijos
  IF jsonb_typeof(p_payload -> 'fixedAssets') = 'array' AND jsonb_array_length(p_payload -> 'fixedAssets') > 0 THEN
    INSERT INTO public.fixed_assets (
      id, company_id, codigo, nombre, categoria, fecha_adquisicion, cfdi_uuid,
      monto_original_inversion, tasa_anual_pct, meses_depreciados_previos,
      inpc_adquisicion, inpc_medio_periodo, cuenta_activo_code,
      cuenta_dep_acum_code, cuenta_gasto_dep_code, estatus, created_at
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
      coalesce(nullif(fa ->> 'createdAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'fixedAssets') AS fa;
  END IF;

  -- 7. Reglas contables, anual (con deducciones_personales), inventarios y nómina/ISN/SUA
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

  -- 10. Candados de periodo SIEMPRE al final para no disparar locks durante la carga de tablas hijas
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

-- ----------------------------------------------------------------------------
-- 8. Enforcement de workspace_quotas en BEFORE INSERT de companies y cfdi_documents
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_workspace_company_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := coalesce((SELECT auth.role()), '');
  v_ws_id TEXT;
  v_max_companies INT;
  v_current_count INT;
BEGIN
  IF v_role = 'service_role'
     OR public.is_platform_superadmin()
     OR coalesce(current_setting('librepaq.bypass_quotas', true), '') = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF upper(coalesce(NEW.rfc, '')) = 'CEJ2106158A0'
     OR upper(coalesce(NEW.name, '')) LIKE '[DEMO]%'
     OR coalesce(NEW.user_id, '') = 'demo' THEN
    RETURN NEW;
  END IF;

  v_ws_id := COALESCE(
    NULLIF(trim(NEW.organization_id), ''),
    CASE
      WHEN NEW.user_id IS NOT NULL AND NEW.user_id <> 'demo' THEN 'ws_' || left(NEW.user_id, 8)
      ELSE NULL
    END
  );

  IF v_ws_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT wq.max_companies
  INTO v_max_companies
  FROM public.workspace_quotas wq
  WHERE wq.workspace_id = v_ws_id
     OR (NEW.user_id IS NOT NULL AND wq.user_id = NEW.user_id)
  ORDER BY (wq.workspace_id = v_ws_id) DESC
  LIMIT 1;

  IF NOT FOUND OR v_max_companies IS NULL OR v_max_companies < 0 THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::int
  INTO v_current_count
  FROM public.companies c
  WHERE upper(coalesce(c.rfc, '')) <> 'CEJ2106158A0'
    AND upper(coalesce(c.name, '')) NOT LIKE '[DEMO]%'
    AND (
      c.organization_id = v_ws_id
      OR (c.organization_id IS NULL AND NEW.user_id IS NOT NULL AND c.user_id = NEW.user_id)
    );

  IF v_current_count >= v_max_companies THEN
    RAISE EXCEPTION 'QUOTA_EXCEEDED: El workspace % alcanzó su límite máximo de % empresas.', v_ws_id, v_max_companies;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_workspace_company_quota() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.enforce_workspace_cfdi_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := coalesce((SELECT auth.role()), '');
  v_org_id TEXT;
  v_owner_id TEXT;
  v_ws_id TEXT;
  v_max_cfdis INT;
  v_month_count INT;
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
  v_month_end TIMESTAMPTZ := date_trunc('month', now()) + interval '1 month';
BEGIN
  IF v_role = 'service_role'
     OR public.is_platform_superadmin()
     OR coalesce(current_setting('librepaq.bypass_quotas', true), '') = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.company_id IS NOT NULL AND NEW.uuid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.cfdi_documents d
    WHERE d.company_id = NEW.company_id AND d.uuid = NEW.uuid
  ) THEN
    RETURN NEW;
  END IF;

  SELECT c.organization_id, c.user_id
  INTO v_org_id, v_owner_id
  FROM public.companies c
  WHERE c.id = NEW.company_id
  LIMIT 1;

  v_ws_id := COALESCE(
    NULLIF(trim(v_org_id), ''),
    CASE
      WHEN v_owner_id IS NOT NULL AND v_owner_id <> 'demo' THEN 'ws_' || left(v_owner_id, 8)
      ELSE NULL
    END
  );

  IF v_ws_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT wq.max_cfdis_per_month
  INTO v_max_cfdis
  FROM public.workspace_quotas wq
  WHERE wq.workspace_id = v_ws_id
     OR (v_owner_id IS NOT NULL AND wq.user_id = v_owner_id)
  ORDER BY (wq.workspace_id = v_ws_id) DESC
  LIMIT 1;

  IF NOT FOUND OR v_max_cfdis IS NULL OR v_max_cfdis < 0 THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::int
  INTO v_month_count
  FROM public.cfdi_documents d
  JOIN public.companies c ON c.id = d.company_id
  WHERE coalesce(d.created_at, d.fecha) >= v_month_start
    AND coalesce(d.created_at, d.fecha) < v_month_end
    AND (
      c.organization_id = v_ws_id
      OR (c.organization_id IS NULL AND v_owner_id IS NOT NULL AND c.user_id = v_owner_id)
    );

  IF v_month_count >= v_max_cfdis THEN
    RAISE EXCEPTION 'QUOTA_EXCEEDED: El workspace % alcanzó su límite mensual de % CFDIs.', v_ws_id, v_max_cfdis;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_workspace_cfdi_quota() FROM PUBLIC, anon;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'companies'
  ) THEN
    DROP TRIGGER IF EXISTS trg_enforce_workspace_company_quota ON public.companies;
    CREATE TRIGGER trg_enforce_workspace_company_quota
      BEFORE INSERT ON public.companies
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_workspace_company_quota();
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cfdi_documents'
  ) THEN
    DROP TRIGGER IF EXISTS trg_enforce_workspace_cfdi_quota ON public.cfdi_documents;
    CREATE TRIGGER trg_enforce_workspace_cfdi_quota
      BEFORE INSERT ON public.cfdi_documents
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_workspace_cfdi_quota();
  END IF;
END $$;
