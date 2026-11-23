-- ============================================================================
-- LIBREPAQ PRO — OLA 2B: REGLAS CONTABLES APRENDIDAS & NO DEDUCIBLES (801)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accounting_rules (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  match_rfc TEXT,
  match_clave_prod_serv TEXT,
  match_uso_cfdi TEXT,
  direction TEXT NOT NULL DEFAULT 'RECIBIDO' CHECK (direction IN ('EMITIDO', 'RECIBIDO')),
  operation_account_code TEXT NOT NULL,
  counter_account_code TEXT,
  deductible_pct NUMERIC NOT NULL DEFAULT 100 CHECK (deductible_pct >= 0 AND deductible_pct <= 100),
  priority INTEGER NOT NULL DEFAULT 10,
  auto_learned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounting_rules
  ADD COLUMN IF NOT EXISTS match_uso_cfdi TEXT;
ALTER TABLE public.accounting_rules
  ADD COLUMN IF NOT EXISTS deductible_pct NUMERIC NOT NULL DEFAULT 100;
ALTER TABLE public.accounting_rules
  ADD COLUMN IF NOT EXISTS auto_learned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.accounting_rules
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_accounting_rules_company_id
  ON public.accounting_rules(company_id);

CREATE INDEX IF NOT EXISTS idx_accounting_rules_company_priority
  ON public.accounting_rules(company_id, priority DESC);

ALTER TABLE public.accounting_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_rules_tenant_isolation ON public.accounting_rules;
CREATE POLICY accounting_rules_tenant_isolation
  ON public.accounting_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = company_id
        AND c.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = company_id
        AND c.user_id = auth.uid()::text
    )
  );

GRANT ALL ON TABLE public.accounting_rules TO authenticated, service_role;

DO $$ BEGIN
  IF to_regprocedure('public.has_company_role(text, text)') IS NOT NULL THEN
    DROP POLICY IF EXISTS rls_accounting_rules_member_select ON public.accounting_rules;
    CREATE POLICY rls_accounting_rules_member_select
      ON public.accounting_rules AS PERMISSIVE FOR SELECT TO authenticated
      USING (public.has_company_role(company_id, 'CLIENTE_LECTURA'));

    DROP POLICY IF EXISTS rls_accounting_rules_member_write ON public.accounting_rules;
    CREATE POLICY rls_accounting_rules_member_write
      ON public.accounting_rules AS PERMISSIVE FOR ALL TO authenticated
      USING (public.has_company_role(company_id, 'AUXILIAR'))
      WITH CHECK (public.has_company_role(company_id, 'AUXILIAR'));
  END IF;
END $$;
