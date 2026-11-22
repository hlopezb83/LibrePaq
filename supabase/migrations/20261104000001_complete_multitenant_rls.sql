-- ============================================================================
-- LIBREPAQ PRO — MIGRACIÓN MULTI-TENANT COMPLETA RLS PARA TODAS LAS ENTIDADES
-- [WORKFLOW-R4-02] Aislamiento estricto de poliza_movements, bank_statement_lines,
-- period_locks, third_parties, fixed_assets, tax_parameters
-- ============================================================================

-- 1. poliza_movements
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'poliza_movements') THEN
    ALTER TABLE public.poliza_movements ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Acceso a poliza_movements segun empresa del usuario" ON public.poliza_movements;
    CREATE POLICY "Acceso a poliza_movements segun empresa del usuario"
    ON public.poliza_movements FOR ALL
    USING (
      poliza_id IN (
        SELECT p.id FROM public.polizas p
        JOIN public.companies c ON p.company_id = c.id
        WHERE c.user_id = auth.uid()::text OR c.user_id IS NULL OR c.user_id = 'demo'
      )
    );
  END IF;
END $$;

-- 2. bank_statement_lines
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_statement_lines') THEN
    ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Acceso a bank_statement_lines segun empresa del usuario" ON public.bank_statement_lines;
    CREATE POLICY "Acceso a bank_statement_lines segun empresa del usuario"
    ON public.bank_statement_lines FOR ALL
    USING (
      company_id IN (
        SELECT id FROM public.companies
        WHERE user_id = auth.uid()::text OR user_id IS NULL OR user_id = 'demo'
      )
    );
  END IF;
END $$;

-- 3. period_locks
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'period_locks') THEN
    ALTER TABLE public.period_locks ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Acceso a period_locks segun empresa del usuario" ON public.period_locks;
    CREATE POLICY "Acceso a period_locks segun empresa del usuario"
    ON public.period_locks FOR ALL
    USING (
      company_id IN (
        SELECT id FROM public.companies
        WHERE user_id = auth.uid()::text OR user_id IS NULL OR user_id = 'demo'
      )
    );
  END IF;
END $$;

-- 4. third_parties
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'third_parties') THEN
    ALTER TABLE public.third_parties ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Acceso a third_parties segun empresa del usuario" ON public.third_parties;
    CREATE POLICY "Acceso a third_parties segun empresa del usuario"
    ON public.third_parties FOR ALL
    USING (
      company_id IN (
        SELECT id FROM public.companies
        WHERE user_id = auth.uid()::text OR user_id IS NULL OR user_id = 'demo'
      )
    );
  END IF;
END $$;

-- 5. fixed_assets
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fixed_assets') THEN
    ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Acceso a fixed_assets segun empresa del usuario" ON public.fixed_assets;
    CREATE POLICY "Acceso a fixed_assets segun empresa del usuario"
    ON public.fixed_assets FOR ALL
    USING (
      company_id IN (
        SELECT id FROM public.companies
        WHERE user_id = auth.uid()::text OR user_id IS NULL OR user_id = 'demo'
      )
    );
  END IF;
END $$;

-- 6. tax_parameters
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tax_parameters') THEN
    ALTER TABLE public.tax_parameters ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Acceso a tax_parameters segun empresa del usuario" ON public.tax_parameters;
    CREATE POLICY "Acceso a tax_parameters segun empresa del usuario"
    ON public.tax_parameters FOR ALL
    USING (
      company_id IN (
        SELECT id FROM public.companies
        WHERE user_id = auth.uid()::text OR user_id IS NULL OR user_id = 'demo'
      )
    );
  END IF;
END $$;
