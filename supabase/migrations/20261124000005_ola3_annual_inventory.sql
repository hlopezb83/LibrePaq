-- ============================================================================
-- LIBREPAQ PRO — OLA 3A / 4A: DECLARACIÓN ANUAL (CUCA/CUFIN/INPC) E INVENTARIOS
-- 100% IDEMPOTENTE | RLS MULTI-TENANT + SOPORTE RBAC DESPACHO
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.annual_tax_snapshots (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ejercicio INTEGER NOT NULL,
  inpc_cierre_anterior NUMERIC NOT NULL DEFAULT 139.38,
  inpc_cierre_actual NUMERIC NOT NULL DEFAULT 145.4,
  cuca_inicial NUMERIC NOT NULL DEFAULT 0,
  aportaciones_capital NUMERIC NOT NULL DEFAULT 0,
  reducciones_capital NUMERIC NOT NULL DEFAULT 0,
  cufin_inicial NUMERIC NOT NULL DEFAULT 0,
  dividendos_pagados NUMERIC NOT NULL DEFAULT 0,
  ptu_pagada_anterior NUMERIC NOT NULL DEFAULT 0,
  no_deducibles_manual NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_annual_tax_snapshots_company_year
  ON public.annual_tax_snapshots (company_id, ejercicio);

CREATE INDEX IF NOT EXISTS idx_annual_tax_snapshots_company
  ON public.annual_tax_snapshots (company_id);

CREATE TABLE IF NOT EXISTS public.inventory_periods (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ejercicio INTEGER NOT NULL,
  periodo INTEGER NOT NULL,
  initial_inventory NUMERIC NOT NULL DEFAULT 0,
  purchases_override NUMERIC,
  final_inventory NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'ANALITICO' CHECK (method IN ('ANALITICO', 'PERPETUO')),
  poliza_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_periods_company_period
  ON public.inventory_periods (company_id, ejercicio, periodo);

CREATE INDEX IF NOT EXISTS idx_inventory_periods_company
  ON public.inventory_periods (company_id, ejercicio);

ALTER TABLE public.annual_tax_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_periods ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.annual_tax_snapshots FROM anon;
REVOKE ALL ON TABLE public.inventory_periods FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.annual_tax_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_periods TO authenticated;
GRANT ALL ON TABLE public.annual_tax_snapshots TO service_role;
GRANT ALL ON TABLE public.inventory_periods TO service_role;

-- Políticas base por propietario de empresa
DROP POLICY IF EXISTS annual_tax_snapshots_owner_isolation ON public.annual_tax_snapshots;
CREATE POLICY annual_tax_snapshots_owner_isolation
  ON public.annual_tax_snapshots
  AS PERMISSIVE
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

DROP POLICY IF EXISTS inventory_periods_owner_isolation ON public.inventory_periods;
CREATE POLICY inventory_periods_owner_isolation
  ON public.inventory_periods
  AS PERMISSIVE
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

-- Políticas aditivas RBAC de despacho cuando has_company_role está disponible
DO $$ BEGIN
  IF to_regprocedure('public.has_company_role(text, text)') IS NOT NULL THEN
    DROP POLICY IF EXISTS rls_annual_tax_snapshots_member_select ON public.annual_tax_snapshots;
    CREATE POLICY rls_annual_tax_snapshots_member_select
      ON public.annual_tax_snapshots AS PERMISSIVE FOR SELECT TO authenticated
      USING (public.has_company_role(company_id, 'CLIENTE_LECTURA'));

    DROP POLICY IF EXISTS rls_annual_tax_snapshots_member_write ON public.annual_tax_snapshots;
    CREATE POLICY rls_annual_tax_snapshots_member_write
      ON public.annual_tax_snapshots AS PERMISSIVE FOR ALL TO authenticated
      USING (public.has_company_role(company_id, 'CONTADOR'))
      WITH CHECK (public.has_company_role(company_id, 'CONTADOR'));

    DROP POLICY IF EXISTS rls_inventory_periods_member_select ON public.inventory_periods;
    CREATE POLICY rls_inventory_periods_member_select
      ON public.inventory_periods AS PERMISSIVE FOR SELECT TO authenticated
      USING (public.has_company_role(company_id, 'CLIENTE_LECTURA'));

    DROP POLICY IF EXISTS rls_inventory_periods_member_write ON public.inventory_periods;
    CREATE POLICY rls_inventory_periods_member_write
      ON public.inventory_periods AS PERMISSIVE FOR ALL TO authenticated
      USING (public.has_company_role(company_id, 'AUXILIAR'))
      WITH CHECK (public.has_company_role(company_id, 'AUXILIAR'));
  END IF;
END $$;
