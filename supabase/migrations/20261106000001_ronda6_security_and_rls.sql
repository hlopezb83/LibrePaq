-- ============================================================================
-- LIBREPAQ PRO — MIGRACIÓN RONDA 6: BLINDAJE RLS COMPANIES, PROFILES Y FIEL
-- [SEC-R6-01] Políticas RLS explícitas en public.companies (SELECT, INSERT, UPDATE, DELETE)
-- [SEC-R6-02] Políticas INSERT y UPDATE en public.user_profiles para auth.uid()
-- [SEC-R6-03] Blindaje de columnas privadas de public.fiel_credentials
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. POLÍTICAS RLS COMPLETAS PARA public.companies
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "rls_companies_select" ON public.companies;
    DROP POLICY IF EXISTS "rls_companies_insert" ON public.companies;
    DROP POLICY IF EXISTS "rls_companies_update" ON public.companies;
    DROP POLICY IF EXISTS "rls_companies_delete" ON public.companies;

    -- SELECT: Dueño, demos compartidas, o SuperAdmin
    CREATE POLICY "rls_companies_select"
    ON public.companies FOR SELECT
    TO authenticated
    USING (
      user_id = auth.uid()::text 
      OR user_id IS NULL 
      OR user_id = 'demo'
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      OR lower(auth.jwt() ->> 'email') = 'hlopezb@gmail.com'
    );

    -- INSERT: Exclusivamente para el usuario autenticado actual o SuperAdmin
    CREATE POLICY "rls_companies_insert"
    ON public.companies FOR INSERT
    TO authenticated
    WITH CHECK (
      user_id = auth.uid()::text
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      OR lower(auth.jwt() ->> 'email') = 'hlopezb@gmail.com'
    );

    -- UPDATE: Solo el dueño de la empresa o SuperAdmin
    CREATE POLICY "rls_companies_update"
    ON public.companies FOR UPDATE
    TO authenticated
    USING (
      user_id = auth.uid()::text
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      OR lower(auth.jwt() ->> 'email') = 'hlopezb@gmail.com'
    )
    WITH CHECK (
      user_id = auth.uid()::text
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      OR lower(auth.jwt() ->> 'email') = 'hlopezb@gmail.com'
    );

    -- DELETE: Solo el dueño de la empresa o SuperAdmin
    CREATE POLICY "rls_companies_delete"
    ON public.companies FOR DELETE
    TO authenticated
    USING (
      user_id = auth.uid()::text
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      OR lower(auth.jwt() ->> 'email') = 'hlopezb@gmail.com'
    );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. POLÍTICAS RLS INSERT Y UPDATE PARA public.user_profiles
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
    ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "rls_user_profiles_insert" ON public.user_profiles;
    DROP POLICY IF EXISTS "rls_user_profiles_update" ON public.user_profiles;

    -- INSERT: Un usuario solo puede insertar su propio registro de perfil
    CREATE POLICY "rls_user_profiles_insert"
    ON public.user_profiles FOR INSERT
    TO authenticated
    WITH CHECK (
      id = auth.uid()::text
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      OR lower(auth.jwt() ->> 'email') = 'hlopezb@gmail.com'
    );

    -- UPDATE: Un usuario solo puede actualizar su propio registro de perfil
    CREATE POLICY "rls_user_profiles_update"
    ON public.user_profiles FOR UPDATE
    TO authenticated
    USING (
      id = auth.uid()::text
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      OR lower(auth.jwt() ->> 'email') = 'hlopezb@gmail.com'
    )
    WITH CHECK (
      id = auth.uid()::text
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      OR lower(auth.jwt() ->> 'email') = 'hlopezb@gmail.com'
    );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. REVOCAR ACCESO DIRECTO A COLUMNAS CRÍTICAS DE FIEL A CLIENTES WEB
--    Edge Function sat-soap-sync ejecuta con service_role (bypasses RLS)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fiel_credentials') THEN
    -- Garantizamos que clientes authenticated no puedan leer private_key_pem
    REVOKE SELECT (private_key_pem, key_base64) ON TABLE public.fiel_credentials FROM authenticated;
  END IF;
END $$;
