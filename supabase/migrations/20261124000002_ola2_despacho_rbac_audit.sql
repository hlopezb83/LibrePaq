-- ============================================================================
-- LIBREPAQ PRO — OLA 2 BLOQUE 2A: MULTIUSUARIO REAL POR DESPACHO (RBAC + BITÁCORA)
-- 100% IDEMPOTENTE | RLS ADITIVO (AS PERMISSIVE)
-- ============================================================================

-- 1. Miembros del Despacho (Workspace)
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('SOCIO', 'CONTADOR', 'AUXILIAR', 'CLIENTE_LECTURA')),
  status TEXT NOT NULL DEFAULT 'INVITADO' CHECK (status IN ('ACTIVO', 'INVITADO', 'REVOCADO')),
  invited_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_members_ws_email
  ON public.workspace_members (workspace_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id
  ON public.workspace_members (user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_email_lower
  ON public.workspace_members (lower(email));

-- 2. Restricción/Asignación de Empresas por Miembro
CREATE TABLE IF NOT EXISTS public.company_member_access (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  user_id TEXT,
  role_override TEXT CHECK (role_override IN ('SOCIO', 'CONTADOR', 'AUXILIAR', 'CLIENTE_LECTURA')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_member_access_comp_member
  ON public.company_member_access (company_id, member_id);

CREATE INDEX IF NOT EXISTS idx_company_member_access_member
  ON public.company_member_access (member_id);

CREATE INDEX IF NOT EXISTS idx_company_member_access_user
  ON public.company_member_access (user_id);

-- 3. Bitácora Contable por Empresa
CREATE TABLE IF NOT EXISTS public.company_audit_logs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  actor_user_id TEXT,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_audit_logs_comp_created
  ON public.company_audit_logs (company_id, created_at DESC);

-- 4. Función auxiliar sin recursión para validar SOCIO o dueño del workspace
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

  IF EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = v_uid
      AND up.workspace_id = p_workspace_id
  ) THEN
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

-- 5. Función canónica RBAC por empresa: has_company_role(company_id, min_role)
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
  v_profile_status TEXT;
  v_platform_role TEXT;
  v_company_owner_id TEXT;
  v_min_rank INT;
  v_eff_role TEXT;
  v_eff_rank INT;
BEGIN
  IF v_uid IS NULL OR p_company_id IS NULL OR trim(p_company_id) = '' THEN
    RETURN FALSE;
  END IF;

  v_min_rank := CASE upper(coalesce(p_min_role, 'CLIENTE_LECTURA'))
    WHEN 'SOCIO' THEN 4
    WHEN 'CONTADOR' THEN 3
    WHEN 'AUXILIAR' THEN 2
    ELSE 1
  END;

  -- Bloqueo absoluto si la cuenta está suspendida
  SELECT upper(coalesce(status, 'ACTIVO')) INTO v_profile_status
  FROM public.user_profiles
  WHERE id = v_uid
  LIMIT 1;

  IF v_profile_status = 'SUSPENDIDO' THEN
    RETURN FALSE;
  END IF;

  -- Plataforma SuperAdmin / Support Readonly
  v_platform_role := public.get_platform_role();
  IF v_platform_role = 'SUPERADMIN' THEN
    RETURN TRUE;
  END IF;
  IF v_platform_role = 'SUPPORT_READONLY' AND v_min_rank <= 1 THEN
    RETURN TRUE;
  END IF;

  -- Dueño directo de la empresa
  SELECT c.user_id INTO v_company_owner_id
  FROM public.companies c
  WHERE c.id = p_company_id
  LIMIT 1;

  IF v_company_owner_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_company_owner_id = v_uid THEN
    RETURN TRUE;
  END IF;

  -- 5a. Membresía explícita por empresa en company_member_access
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

  -- 5b. Membresía general de despacho (cuando el miembro no tiene restricciones específicas en company_member_access)
  IF v_eff_role IS NULL THEN
    SELECT wm.role INTO v_eff_role
    FROM public.workspace_members wm
    WHERE wm.status = 'ACTIVO'
      AND (
        wm.user_id = v_uid
        OR (wm.user_id IS NULL AND v_email <> '' AND lower(wm.email) = v_email)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.company_member_access cma_any
        WHERE cma_any.member_id = wm.id
      )
      AND (
        wm.workspace_id = v_company_owner_id
        OR wm.workspace_id = ('ws_' || left(v_company_owner_id, 8))
        OR EXISTS (
          SELECT 1
          FROM public.user_profiles owner_up
          WHERE owner_up.id = v_company_owner_id
            AND owner_up.workspace_id = wm.workspace_id
        )
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

-- 6. RLS para nuevas tablas (workspace_members, company_member_access, company_audit_logs)
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_member_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.workspace_members FROM anon;
REVOKE ALL ON TABLE public.company_member_access FROM anon;
REVOKE ALL ON TABLE public.company_audit_logs FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_member_access TO authenticated;
GRANT SELECT, INSERT ON TABLE public.company_audit_logs TO authenticated;

GRANT ALL ON TABLE public.workspace_members TO service_role;
GRANT ALL ON TABLE public.company_member_access TO service_role;
GRANT ALL ON TABLE public.company_audit_logs TO service_role;

-- Policies: workspace_members
DROP POLICY IF EXISTS "rls_workspace_members_select" ON public.workspace_members;
CREATE POLICY "rls_workspace_members_select"
  ON public.workspace_members AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())::text
    OR lower(email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
    OR public.is_workspace_socio(workspace_id)
    OR public.get_platform_role() IN ('SUPERADMIN', 'SUPPORT_READONLY')
  );

DROP POLICY IF EXISTS "rls_workspace_members_insert" ON public.workspace_members;
CREATE POLICY "rls_workspace_members_insert"
  ON public.workspace_members AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_socio(workspace_id));

DROP POLICY IF EXISTS "rls_workspace_members_update" ON public.workspace_members;
CREATE POLICY "rls_workspace_members_update"
  ON public.workspace_members AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_workspace_socio(workspace_id))
  WITH CHECK (public.is_workspace_socio(workspace_id));

DROP POLICY IF EXISTS "rls_workspace_members_delete" ON public.workspace_members;
CREATE POLICY "rls_workspace_members_delete"
  ON public.workspace_members AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_workspace_socio(workspace_id));

-- Policies: company_member_access
DROP POLICY IF EXISTS "rls_company_member_access_select" ON public.company_member_access;
CREATE POLICY "rls_company_member_access_select"
  ON public.company_member_access AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())::text
    OR public.has_company_role(company_id, 'SOCIO')
    OR public.get_platform_role() IN ('SUPERADMIN', 'SUPPORT_READONLY')
  );

DROP POLICY IF EXISTS "rls_company_member_access_insert" ON public.company_member_access;
CREATE POLICY "rls_company_member_access_insert"
  ON public.company_member_access AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(company_id, 'SOCIO'));

DROP POLICY IF EXISTS "rls_company_member_access_update" ON public.company_member_access;
CREATE POLICY "rls_company_member_access_update"
  ON public.company_member_access AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.has_company_role(company_id, 'SOCIO'))
  WITH CHECK (public.has_company_role(company_id, 'SOCIO'));

DROP POLICY IF EXISTS "rls_company_member_access_delete" ON public.company_member_access;
CREATE POLICY "rls_company_member_access_delete"
  ON public.company_member_access AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.has_company_role(company_id, 'SOCIO'));

-- Policies: company_audit_logs
DROP POLICY IF EXISTS "rls_company_audit_logs_select" ON public.company_audit_logs;
CREATE POLICY "rls_company_audit_logs_select"
  ON public.company_audit_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.has_company_role(company_id, 'CLIENTE_LECTURA'));

DROP POLICY IF EXISTS "rls_company_audit_logs_insert" ON public.company_audit_logs;
CREATE POLICY "rls_company_audit_logs_insert"
  ON public.company_audit_logs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(company_id, 'AUXILIAR'));

-- 7. Políticas RLS Aditivas (AS PERMISSIVE) en companies, accounts, polizas, cfdi_documents y poliza_movements
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    DROP POLICY IF EXISTS "rls_companies_member_select" ON public.companies;
    CREATE POLICY "rls_companies_member_select"
      ON public.companies AS PERMISSIVE FOR SELECT TO authenticated
      USING (public.has_company_role(id, 'CLIENTE_LECTURA'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts') THEN
    DROP POLICY IF EXISTS "rls_accounts_member_select" ON public.accounts;
    CREATE POLICY "rls_accounts_member_select"
      ON public.accounts AS PERMISSIVE FOR SELECT TO authenticated
      USING (public.has_company_role(company_id, 'CLIENTE_LECTURA'));

    DROP POLICY IF EXISTS "rls_accounts_member_insert" ON public.accounts;
    CREATE POLICY "rls_accounts_member_insert"
      ON public.accounts AS PERMISSIVE FOR INSERT TO authenticated
      WITH CHECK (public.has_company_role(company_id, 'AUXILIAR'));

    DROP POLICY IF EXISTS "rls_accounts_member_update" ON public.accounts;
    CREATE POLICY "rls_accounts_member_update"
      ON public.accounts AS PERMISSIVE FOR UPDATE TO authenticated
      USING (public.has_company_role(company_id, 'AUXILIAR'))
      WITH CHECK (public.has_company_role(company_id, 'AUXILIAR'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'polizas') THEN
    DROP POLICY IF EXISTS "rls_polizas_member_select" ON public.polizas;
    CREATE POLICY "rls_polizas_member_select"
      ON public.polizas AS PERMISSIVE FOR SELECT TO authenticated
      USING (public.has_company_role(company_id, 'CLIENTE_LECTURA'));

    DROP POLICY IF EXISTS "rls_polizas_member_insert" ON public.polizas;
    CREATE POLICY "rls_polizas_member_insert"
      ON public.polizas AS PERMISSIVE FOR INSERT TO authenticated
      WITH CHECK (public.has_company_role(company_id, 'AUXILIAR'));

    DROP POLICY IF EXISTS "rls_polizas_member_update" ON public.polizas;
    CREATE POLICY "rls_polizas_member_update"
      ON public.polizas AS PERMISSIVE FOR UPDATE TO authenticated
      USING (public.has_company_role(company_id, 'AUXILIAR'))
      WITH CHECK (public.has_company_role(company_id, 'AUXILIAR'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'poliza_movements') THEN
    DROP POLICY IF EXISTS "rls_poliza_movements_member_select" ON public.poliza_movements;
    CREATE POLICY "rls_poliza_movements_member_select"
      ON public.poliza_movements AS PERMISSIVE FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.polizas p
          WHERE p.id = poliza_id
            AND public.has_company_role(p.company_id, 'CLIENTE_LECTURA')
        )
      );

    DROP POLICY IF EXISTS "rls_poliza_movements_member_insert" ON public.poliza_movements;
    CREATE POLICY "rls_poliza_movements_member_insert"
      ON public.poliza_movements AS PERMISSIVE FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.polizas p
          WHERE p.id = poliza_id
            AND public.has_company_role(p.company_id, 'AUXILIAR')
        )
      );

    DROP POLICY IF EXISTS "rls_poliza_movements_member_update" ON public.poliza_movements;
    CREATE POLICY "rls_poliza_movements_member_update"
      ON public.poliza_movements AS PERMISSIVE FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.polizas p
          WHERE p.id = poliza_id
            AND public.has_company_role(p.company_id, 'AUXILIAR')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.polizas p
          WHERE p.id = poliza_id
            AND public.has_company_role(p.company_id, 'AUXILIAR')
        )
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cfdi_documents') THEN
    DROP POLICY IF EXISTS "rls_cfdi_documents_member_select" ON public.cfdi_documents;
    CREATE POLICY "rls_cfdi_documents_member_select"
      ON public.cfdi_documents AS PERMISSIVE FOR SELECT TO authenticated
      USING (public.has_company_role(company_id, 'CLIENTE_LECTURA'));

    DROP POLICY IF EXISTS "rls_cfdi_documents_member_insert" ON public.cfdi_documents;
    CREATE POLICY "rls_cfdi_documents_member_insert"
      ON public.cfdi_documents AS PERMISSIVE FOR INSERT TO authenticated
      WITH CHECK (public.has_company_role(company_id, 'AUXILIAR'));

    DROP POLICY IF EXISTS "rls_cfdi_documents_member_update" ON public.cfdi_documents;
    CREATE POLICY "rls_cfdi_documents_member_update"
      ON public.cfdi_documents AS PERMISSIVE FOR UPDATE TO authenticated
      USING (public.has_company_role(company_id, 'AUXILIAR'))
      WITH CHECK (public.has_company_role(company_id, 'AUXILIAR'));
  END IF;
END $$;
