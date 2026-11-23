-- ============================================================================
-- LIBREPAQ PRO — RONDA 3: ENDURECIMIENTO DE SEGURIDAD Y RBAC DESPACHO
-- Corrige: BUG-01, BUG-13, BUG-14, BUG-17 y BUG-44
-- 100% IDEMPOTENTE | RLS ADITIVO (AS PERMISSIVE)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BUG-01: Protección de columnas privilegiadas en public.user_profiles
--    Evita auto-escalación a SuperAdmin / platform_role / status / workspace_id
--    preservando la actualización legítima de workspace_name y atribución Ads.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_user_profiles_privileged_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := coalesce((SELECT auth.role()), '');
BEGIN
  IF v_role = 'service_role' OR public.is_platform_superadmin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_superadmin := FALSE;
    NEW.platform_role := 'NONE';
    NEW.status := 'ACTIVO';

    IF NEW.workspace_id IS NOT NULL
       AND NEW.workspace_id IS DISTINCT FROM ('ws_' || left(NEW.id, 8))
       AND NEW.workspace_id IS DISTINCT FROM NEW.id THEN
      NEW.workspace_id := 'ws_' || left(NEW.id, 8);
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_superadmin IS TRUE AND OLD.is_superadmin IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Privileged user_profiles columns cannot be modified by client';
    END IF;

    IF NEW.platform_role IS DISTINCT FROM OLD.platform_role
       AND coalesce(NEW.platform_role, 'NONE') <> 'NONE' THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Privileged user_profiles columns cannot be modified by client';
    END IF;

    NEW.is_superadmin := OLD.is_superadmin;
    NEW.platform_role := OLD.platform_role;
    NEW.status := OLD.status;
    NEW.email := OLD.email;

    -- Permitir únicamente asignación inicial de workspace_id al propio workspace del usuario
    IF OLD.workspace_id IS NULL
       AND NEW.workspace_id IN (OLD.id, 'ws_' || left(OLD.id, 8)) THEN
      NEW.workspace_id := NEW.workspace_id;
    ELSE
      NEW.workspace_id := OLD.workspace_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_user_profiles_privileged_cols() FROM PUBLIC, anon;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    DROP TRIGGER IF EXISTS trg_protect_user_profiles_privileged_cols ON public.user_profiles;
    CREATE TRIGGER trg_protect_user_profiles_privileged_cols
      BEFORE INSERT OR UPDATE ON public.user_profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.protect_user_profiles_privileged_cols();

    -- Revocar UPDATE directo por columna sobre atributos privilegiados (mantiene
    -- intactas workspace_id, workspace_name, acquisition_source, gclid, utm_campaign, utm_term)
    REVOKE UPDATE (is_superadmin, platform_role, status, email) ON public.user_profiles FROM authenticated;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. BUG-13: Cerrar escalación a SOCIO en public.is_workspace_socio(TEXT)
--    Elimina la condición por user_profiles.workspace_id; solo SUPERADMIN,
--    dueño directo (v_uid o ws_<left(v_uid,8)>) o miembro ACTIVO con role='SOCIO'.
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
      AND (
        wm.user_id = v_uid
        OR (wm.user_id IS NULL AND v_email <> '' AND lower(wm.email) = v_email)
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_workspace_socio(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_socio(TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. BUG-14: Actualizar delete_company_cascade(TEXT) a has_company_role(...,'SOCIO')
--    y añadir limpieza condicional de tablas Ola 2 / Ola 3.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_company_cascade(company_id_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    (SELECT auth.role()) = 'service_role'
    OR public.is_platform_superadmin()
    OR public.has_company_role(company_id_param, 'SOCIO')
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Solo el propietario, Socio del despacho o SuperAdmin puede eliminar esta empresa';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'poliza_pedimentos') THEN
    DELETE FROM public.poliza_pedimentos
    WHERE poliza_id IN (SELECT id FROM public.polizas WHERE company_id = company_id_param);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bank_statement_matches') THEN
    DELETE FROM public.bank_statement_matches WHERE company_id = company_id_param;
  END IF;

  DELETE FROM public.poliza_movements
  WHERE poliza_id IN (
    SELECT id FROM public.polizas WHERE company_id = company_id_param
  );

  DELETE FROM public.polizas WHERE company_id = company_id_param;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cfdi_documents') THEN
    DELETE FROM public.cfdi_documents WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cfdis') THEN
    EXECUTE 'DELETE FROM public.cfdis WHERE company_id = $1' USING company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bank_statement_lines') THEN
    DELETE FROM public.bank_statement_lines WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fixed_assets') THEN
    DELETE FROM public.fixed_assets WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'third_parties') THEN
    DELETE FROM public.third_parties WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'accounting_rules') THEN
    DELETE FROM public.accounting_rules WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'annual_tax_snapshots') THEN
    DELETE FROM public.annual_tax_snapshots WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inventory_periods') THEN
    DELETE FROM public.inventory_periods WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_audit_logs') THEN
    DELETE FROM public.company_audit_logs WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'period_locks') THEN
    DELETE FROM public.period_locks WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tax_parameters_history') THEN
    DELETE FROM public.tax_parameters_history WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tax_parameters') THEN
    DELETE FROM public.tax_parameters WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fiel_credentials') THEN
    DELETE FROM public.fiel_credentials WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sat_download_requests') THEN
    DELETE FROM public.sat_download_requests WHERE company_id = company_id_param;
  END IF;

  DELETE FROM public.accounts WHERE company_id = company_id_param;
  DELETE FROM public.companies WHERE id = company_id_param;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'platform_alerts') THEN
    UPDATE public.platform_alerts
    SET status = 'resolved',
        resolved_at = now(),
        resolved_by = 'system_company_deleted'
    WHERE target_type = 'company'
      AND target_id = company_id_param
      AND status IN ('open', 'acknowledged');
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_company_cascade(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_company_cascade(TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. BUG-17: Políticas RLS aditivas (AS PERMISSIVE) para has_company_role
--    en 7 tablas operativas + políticas FOR DELETE en tablas base RBAC.
--    Preserva intactos los GRANT/REVOKE de columnas privadas en fiel_credentials.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  auxiliar_tables TEXT[] := ARRAY[
    'third_parties',
    'bank_statement_lines',
    'fixed_assets',
    'sat_download_requests'
  ];
  contador_tables TEXT[] := ARRAY[
    'period_locks',
    'tax_parameters'
  ];
BEGIN
  -- Tablas con SELECT (CLIENTE_LECTURA) e INSERT/UPDATE/DELETE (AUXILIAR)
  FOREACH t IN ARRAY auxiliar_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_member_select', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_company_role(company_id, ''CLIENTE_LECTURA''))',
        'rls_' || t || '_member_select', t
      );

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_member_insert', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ''AUXILIAR''))',
        'rls_' || t || '_member_insert', t
      );

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_member_update', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ''AUXILIAR'')) WITH CHECK (public.has_company_role(company_id, ''AUXILIAR''))',
        'rls_' || t || '_member_update', t
      );

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_member_delete', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR DELETE TO authenticated USING (public.has_company_role(company_id, ''AUXILIAR''))',
        'rls_' || t || '_member_delete', t
      );
    END IF;
  END LOOP;

  -- Tablas con SELECT (CLIENTE_LECTURA) e INSERT/UPDATE/DELETE (CONTADOR)
  FOREACH t IN ARRAY contador_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_member_select', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_company_role(company_id, ''CLIENTE_LECTURA''))',
        'rls_' || t || '_member_select', t
      );

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_member_insert', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ''CONTADOR''))',
        'rls_' || t || '_member_insert', t
      );

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_member_update', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ''CONTADOR'')) WITH CHECK (public.has_company_role(company_id, ''CONTADOR''))',
        'rls_' || t || '_member_update', t
      );

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_member_delete', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR DELETE TO authenticated USING (public.has_company_role(company_id, ''CONTADOR''))',
        'rls_' || t || '_member_delete', t
      );
    END IF;
  END LOOP;

  -- fiel_credentials: solo SELECT para AUXILIAR (mantiene key_base64 / private_key_pem revocadas)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fiel_credentials'
  ) THEN
    DROP POLICY IF EXISTS "rls_fiel_credentials_member_select" ON public.fiel_credentials;
    CREATE POLICY "rls_fiel_credentials_member_select"
      ON public.fiel_credentials AS PERMISSIVE FOR SELECT TO authenticated
      USING (public.has_company_role(company_id, 'AUXILIAR'));
  END IF;

  -- Políticas FOR DELETE faltantes en tablas RBAC base
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'accounts'
  ) THEN
    DROP POLICY IF EXISTS "rls_accounts_member_delete" ON public.accounts;
    CREATE POLICY "rls_accounts_member_delete"
      ON public.accounts AS PERMISSIVE FOR DELETE TO authenticated
      USING (public.has_company_role(company_id, 'CONTADOR'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'polizas'
  ) THEN
    DROP POLICY IF EXISTS "rls_polizas_member_delete" ON public.polizas;
    CREATE POLICY "rls_polizas_member_delete"
      ON public.polizas AS PERMISSIVE FOR DELETE TO authenticated
      USING (public.has_company_role(company_id, 'AUXILIAR'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'poliza_movements'
  ) THEN
    DROP POLICY IF EXISTS "rls_poliza_movements_member_delete" ON public.poliza_movements;
    CREATE POLICY "rls_poliza_movements_member_delete"
      ON public.poliza_movements AS PERMISSIVE FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.polizas p
          WHERE p.id = poliza_id
            AND public.has_company_role(p.company_id, 'AUXILIAR')
        )
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cfdi_documents'
  ) THEN
    DROP POLICY IF EXISTS "rls_cfdi_documents_member_delete" ON public.cfdi_documents;
    CREATE POLICY "rls_cfdi_documents_member_delete"
      ON public.cfdi_documents AS PERMISSIVE FOR DELETE TO authenticated
      USING (public.has_company_role(company_id, 'AUXILIAR'));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. BUG-44: Evitar suplantación de actor en public.company_audit_logs
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_audit_logs'
  ) THEN
    DROP POLICY IF EXISTS "rls_company_audit_logs_insert" ON public.company_audit_logs;
    CREATE POLICY "rls_company_audit_logs_insert"
      ON public.company_audit_logs AS PERMISSIVE FOR INSERT TO authenticated
      WITH CHECK (
        public.has_company_role(company_id, 'AUXILIAR')
        AND actor_user_id = (SELECT auth.uid())::text
        AND lower(coalesce(actor_email, '')) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
      );
  END IF;
END $$;
