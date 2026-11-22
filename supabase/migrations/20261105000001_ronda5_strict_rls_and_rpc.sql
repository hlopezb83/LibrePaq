-- ============================================================================
-- LIBREPAQ PRO — MIGRACIÓN RONDA 5: RLS ESTRICTO MULTI-TENANT Y BLINDAJE RPC
-- [SEC-R5-01] Drop definitivo de políticas abiertas 'USING (true)' en todas las tablas
-- [SEC-R5-02] Verificación obligatoria de propiedad en delete_company_cascade
-- [SEC-R5-04] Migración a app_metadata->>'role' = 'superadmin'
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. LIMPIEZA TOTAL DE POLÍTICAS LEGACY ABIERTAS 'USING (true)'
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'companies', 'accounts', 'polizas', 'poliza_movements',
    'cfdi_documents', 'bank_statement_lines', 'fiel_credentials',
    'sat_download_requests', 'period_locks', 'third_parties',
    'fixed_assets', 'tax_parameters'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Permitir acceso completo a %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Acceso a %I segun empresa del usuario" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Acceso a cuentas segun empresa del usuario" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Acceso a polizas segun empresa del usuario" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Acceso a cfdis segun empresa del usuario" ON public.%I', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. POLÍTICAS RLS ESTRICTAS PARA TABLAS CON company_id DIRECTO
--    SELECT: Permite usuario autenticado propietario + demo de solo lectura
--    INSERT, UPDATE, DELETE: Estrictamente restringido al propietario
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'accounts', 'polizas', 'cfdi_documents', 'bank_statement_lines',
    'period_locks', 'third_parties', 'fixed_assets', 'tax_parameters',
    'sat_download_requests', 'fiel_credentials'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      -- SELECT
      EXECUTE format('
        CREATE POLICY %I ON public.%I FOR SELECT USING (
          company_id IN (
            SELECT id FROM public.companies 
            WHERE user_id = auth.uid()::text OR user_id IS NULL OR user_id = ''demo''
          )
          OR (auth.jwt() -> ''app_metadata'' ->> ''role'') = ''superadmin''
        )
      ', 'rls_' || t || '_select', t);

      -- INSERT
      EXECUTE format('
        CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (
          company_id IN (
            SELECT id FROM public.companies 
            WHERE user_id = auth.uid()::text
          )
          OR (auth.jwt() -> ''app_metadata'' ->> ''role'') = ''superadmin''
        )
      ', 'rls_' || t || '_insert', t);

      -- UPDATE
      EXECUTE format('
        CREATE POLICY %I ON public.%I FOR UPDATE USING (
          company_id IN (
            SELECT id FROM public.companies 
            WHERE user_id = auth.uid()::text
          )
          OR (auth.jwt() -> ''app_metadata'' ->> ''role'') = ''superadmin''
        ) WITH CHECK (
          company_id IN (
            SELECT id FROM public.companies 
            WHERE user_id = auth.uid()::text
          )
          OR (auth.jwt() -> ''app_metadata'' ->> ''role'') = ''superadmin''
        )
      ', 'rls_' || t || '_update', t);

      -- DELETE
      EXECUTE format('
        CREATE POLICY %I ON public.%I FOR DELETE USING (
          company_id IN (
            SELECT id FROM public.companies 
            WHERE user_id = auth.uid()::text
          )
          OR (auth.jwt() -> ''app_metadata'' ->> ''role'') = ''superadmin''
        )
      ', 'rls_' || t || '_delete', t);
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. POLÍTICAS RLS ESTRICTAS PARA poliza_movements (VÍA poliza_id -> polizas)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'poliza_movements') THEN
    ALTER TABLE public.poliza_movements ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "rls_poliza_movements_select" ON public.poliza_movements;
    DROP POLICY IF EXISTS "rls_poliza_movements_insert" ON public.poliza_movements;
    DROP POLICY IF EXISTS "rls_poliza_movements_update" ON public.poliza_movements;
    DROP POLICY IF EXISTS "rls_poliza_movements_delete" ON public.poliza_movements;

    CREATE POLICY "rls_poliza_movements_select"
    ON public.poliza_movements FOR SELECT USING (
      poliza_id IN (
        SELECT p.id FROM public.polizas p
        JOIN public.companies c ON p.company_id = c.id
        WHERE c.user_id = auth.uid()::text OR c.user_id IS NULL OR c.user_id = 'demo'
      )
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
    );

    CREATE POLICY "rls_poliza_movements_insert"
    ON public.poliza_movements FOR INSERT WITH CHECK (
      poliza_id IN (
        SELECT p.id FROM public.polizas p
        JOIN public.companies c ON p.company_id = c.id
        WHERE c.user_id = auth.uid()::text
      )
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
    );

    CREATE POLICY "rls_poliza_movements_update"
    ON public.poliza_movements FOR UPDATE USING (
      poliza_id IN (
        SELECT p.id FROM public.polizas p
        JOIN public.companies c ON p.company_id = c.id
        WHERE c.user_id = auth.uid()::text
      )
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
    ) WITH CHECK (
      poliza_id IN (
        SELECT p.id FROM public.polizas p
        JOIN public.companies c ON p.company_id = c.id
        WHERE c.user_id = auth.uid()::text
      )
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
    );

    CREATE POLICY "rls_poliza_movements_delete"
    ON public.poliza_movements FOR DELETE USING (
      poliza_id IN (
        SELECT p.id FROM public.polizas p
        JOIN public.companies c ON p.company_id = c.id
        WHERE c.user_id = auth.uid()::text
      )
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
    );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. RPC delete_company_cascade CON VALIDACIÓN OBLIGATORIA DE PROPIEDAD
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_company_cascade(company_id_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar que el usuario autenticado sea dueño de la empresa o tenga rol superadmin
  IF NOT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = company_id_param
      AND (
        user_id = auth.uid()::text
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
        OR lower(auth.jwt() ->> 'email') = 'hlopezb@gmail.com'
      )
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: No tienes permisos para eliminar esta empresa';
  END IF;

  -- 1. Movimientos de póliza
  DELETE FROM public.poliza_movements
  WHERE poliza_id IN (
    SELECT id FROM public.polizas WHERE company_id = company_id_param
  );

  -- 2. Pólizas contables
  DELETE FROM public.polizas
  WHERE company_id = company_id_param;

  -- 3. Documentos CFDI
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cfdi_documents') THEN
    DELETE FROM public.cfdi_documents WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cfdis') THEN
    EXECUTE 'DELETE FROM public.cfdis WHERE company_id = $1' USING company_id_param;
  END IF;

  -- 4. Movimientos y extractos bancarios
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bank_statement_lines') THEN
    DELETE FROM public.bank_statement_lines WHERE company_id = company_id_param;
  END IF;

  -- 5. Activos fijos y depreciaciones
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fixed_assets') THEN
    DELETE FROM public.fixed_assets WHERE company_id = company_id_param;
  END IF;

  -- 6. Padrón de Terceros
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'third_parties') THEN
    DELETE FROM public.third_parties WHERE company_id = company_id_param;
  END IF;

  -- 7. Candados de periodo y parámetros fiscales
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'period_locks') THEN
    DELETE FROM public.period_locks WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tax_parameters') THEN
    DELETE FROM public.tax_parameters WHERE company_id = company_id_param;
  END IF;

  -- 8. Credenciales FIEL y solicitudes SAT
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fiel_credentials') THEN
    DELETE FROM public.fiel_credentials WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sat_download_requests') THEN
    DELETE FROM public.sat_download_requests WHERE company_id = company_id_param;
  END IF;

  -- 9. Catálogo de cuentas contables
  DELETE FROM public.accounts
  WHERE company_id = company_id_param;

  -- 10. Registro principal de la empresa
  DELETE FROM public.companies
  WHERE id = company_id_param;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_company_cascade(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_company_cascade(TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 5. user_profiles: EXCLUSIVAMENTE app_metadata O EMAIL SUPERADMIN
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "SuperAdmin y propio usuario leen user_profiles" ON public.user_profiles;

CREATE POLICY "SuperAdmin y propio usuario leen user_profiles"
ON public.user_profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()::text
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  OR lower(auth.jwt() ->> 'email') = 'hlopezb@gmail.com'
);
