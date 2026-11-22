-- ============================================================================
-- LIBREPAQ PRO — MIGRACIÓN CORRECTIVA FIEL GRANTS, RLS ANON CLEANUP & POLIZAS UNIQUE
-- ============================================================================

-- 1. Corregir GRANT SELECT en public.fiel_credentials usando solo columnas existentes
--    (elimina referencias inexistentes a 'id' y 'created_at' de 20261109000001,
--     manteniendo oculta la columna 'private_key_pem').
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fiel_credentials'
  ) THEN
    REVOKE SELECT ON TABLE public.fiel_credentials FROM anon, authenticated;
    GRANT SELECT (
      company_id,
      rfc_titular,
      nombre_titular,
      numero_serie,
      valid_from,
      valid_to,
      sha1_fingerprint,
      cer_base64,
      updated_at
    ) ON TABLE public.fiel_credentials TO authenticated;
    GRANT INSERT, UPDATE, DELETE ON TABLE public.fiel_credentials TO authenticated;
  END IF;
END $$;

-- 2. Eliminar políticas legacy permisivas omitidas en migraciones previas
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    DROP POLICY IF EXISTS "Usuarios ven sus propias empresas o las demo" ON public.companies;
    DROP POLICY IF EXISTS "Usuarios solo insertan sus propias empresas" ON public.companies;
    DROP POLICY IF EXISTS "Usuarios solo modifican sus propias empresas" ON public.companies;
    DROP POLICY IF EXISTS "Usuarios solo eliminan sus propias empresas" ON public.companies;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cfdi_documents') THEN
    DROP POLICY IF EXISTS "Acceso a cfdi segun empresa del usuario" ON public.cfdi_documents;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fiel_credentials') THEN
    DROP POLICY IF EXISTS "rls_fiel_credentials_insert" ON public.fiel_credentials;
    DROP POLICY IF EXISTS "rls_fiel_credentials_update" ON public.fiel_credentials;
    DROP POLICY IF EXISTS "rls_fiel_credentials_delete" ON public.fiel_credentials;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sat_download_requests') THEN
    DROP POLICY IF EXISTS "rls_sat_download_requests_select" ON public.sat_download_requests;
    DROP POLICY IF EXISTS "rls_sat_download_requests_insert" ON public.sat_download_requests;
    DROP POLICY IF EXISTS "rls_sat_download_requests_update" ON public.sat_download_requests;
    DROP POLICY IF EXISTS "rls_sat_download_requests_delete" ON public.sat_download_requests;
    DROP POLICY IF EXISTS "rls_sat_download_requests_all" ON public.sat_download_requests;

    CREATE POLICY "rls_sat_download_requests_select"
    ON public.sat_download_requests FOR SELECT
    TO authenticated
    USING (
      company_id IN (
        SELECT id FROM public.companies
        WHERE user_id = auth.uid()::text
          OR user_id IS NULL
          OR user_id = 'demo'
      )
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      OR lower(auth.jwt() ->> 'email') = 'hlopezb@gmail.com'
    );

    CREATE POLICY "rls_sat_download_requests_write"
    ON public.sat_download_requests FOR ALL
    TO authenticated
    USING (
      company_id IN (
        SELECT id FROM public.companies
        WHERE user_id = auth.uid()::text
      )
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      OR lower(auth.jwt() ->> 'email') = 'hlopezb@gmail.com'
    )
    WITH CHECK (
      company_id IN (
        SELECT id FROM public.companies
        WHERE user_id = auth.uid()::text
      )
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      OR lower(auth.jwt() ->> 'email') = 'hlopezb@gmail.com'
    );
  END IF;
END $$;

-- 3. Restringir todas las políticas SELECT de tablas contables hijas estrictamente a TO authenticated
DO $$
DECLARE
  t TEXT;
  child_tables TEXT[] := ARRAY[
    'accounts', 'polizas', 'cfdi_documents', 'bank_statement_lines',
    'period_locks', 'third_parties', 'fixed_assets', 'tax_parameters'
  ];
BEGIN
  FOREACH t IN ARRAY child_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rls_' || t || '_select', t);
      EXECUTE format('
        CREATE POLICY %I ON public.%I FOR SELECT
        TO authenticated
        USING (
          company_id IN (
            SELECT id FROM public.companies
            WHERE user_id = auth.uid()::text OR user_id IS NULL OR user_id = ''demo''
          )
          OR (auth.jwt() -> ''app_metadata'' ->> ''role'') = ''superadmin''
          OR lower(auth.jwt() ->> ''email'') = ''hlopezb@gmail.com''
        )
      ', 'rls_' || t || '_select', t);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'poliza_movements') THEN
    DROP POLICY IF EXISTS "rls_poliza_movements_select" ON public.poliza_movements;
    CREATE POLICY "rls_poliza_movements_select"
    ON public.poliza_movements FOR SELECT
    TO authenticated
    USING (
      poliza_id IN (
        SELECT p.id FROM public.polizas p
        JOIN public.companies c ON p.company_id = c.id
        WHERE c.user_id = auth.uid()::text OR c.user_id IS NULL OR c.user_id = 'demo'
      )
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      OR lower(auth.jwt() ->> 'email') = 'hlopezb@gmail.com'
    );
  END IF;
END $$;

-- 4. Unicidad de folio en public.polizas equivalente a SQLite (si no hay duplicados existentes)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'polizas')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_polizas_company_folio')
     AND NOT EXISTS (
       SELECT 1 FROM public.polizas
       GROUP BY company_id, tipo, ejercicio, periodo, folio
       HAVING COUNT(*) > 1
     ) THEN
    ALTER TABLE public.polizas
      ADD CONSTRAINT uq_polizas_company_folio
      UNIQUE (company_id, tipo, ejercicio, periodo, folio);
  END IF;
END $$;
