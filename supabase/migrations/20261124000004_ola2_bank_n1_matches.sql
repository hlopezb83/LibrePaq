-- ============================================================================
-- LIBREPAQ PRO — OLA 2C: CONCILIACIÓN BANCARIA N-A-1 (bank_statement_matches)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bank_statement_matches (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_line_id TEXT NOT NULL REFERENCES public.bank_statement_lines(id) ON DELETE CASCADE,
  movement_id TEXT NOT NULL,
  poliza_id TEXT NOT NULL,
  matched_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bank_statement_matches' AND column_name = 'statement_line_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bank_statement_matches' AND column_name = 'bank_line_id'
  ) THEN
    ALTER TABLE public.bank_statement_matches RENAME COLUMN statement_line_id TO bank_line_id;
  END IF;
END $$;

ALTER TABLE public.bank_statement_matches
  ADD COLUMN IF NOT EXISTS poliza_id TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_statement_matches_pair
  ON public.bank_statement_matches(bank_line_id, movement_id);

CREATE INDEX IF NOT EXISTS idx_bank_statement_matches_company
  ON public.bank_statement_matches(company_id, bank_line_id);

ALTER TABLE public.bank_statement_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso a bank_statement_matches segun empresa del usuario" ON public.bank_statement_matches;
CREATE POLICY "Acceso a bank_statement_matches segun empresa del usuario"
  ON public.bank_statement_matches
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()::text
    )
  );

GRANT ALL ON TABLE public.bank_statement_matches TO authenticated, service_role;

DO $$ BEGIN
  IF to_regprocedure('public.has_company_role(text, text)') IS NOT NULL THEN
    DROP POLICY IF EXISTS rls_bank_statement_matches_member_select ON public.bank_statement_matches;
    CREATE POLICY rls_bank_statement_matches_member_select
      ON public.bank_statement_matches AS PERMISSIVE FOR SELECT TO authenticated
      USING (public.has_company_role(company_id, 'CLIENTE_LECTURA'));

    DROP POLICY IF EXISTS rls_bank_statement_matches_member_write ON public.bank_statement_matches;
    CREATE POLICY rls_bank_statement_matches_member_write
      ON public.bank_statement_matches AS PERMISSIVE FOR ALL TO authenticated
      USING (public.has_company_role(company_id, 'AUXILIAR'))
      WITH CHECK (public.has_company_role(company_id, 'AUXILIAR'));
  END IF;
END $$;
