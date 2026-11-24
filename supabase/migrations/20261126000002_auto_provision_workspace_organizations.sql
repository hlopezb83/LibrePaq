-- ============================================================================
-- LIBREPAQ PRO — AUTO-APROVISIONAMIENTO DE ORGANIZATIONS PARA WORKSPACE_ID
-- Corrige companies_organization_id_fkey para cuentas nuevas y existentes
-- 100% IDEMPOTENTE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Backfill idempotente de public.organizations desde user_profiles y
--    membresías activas de despacho en workspace_members
-- ----------------------------------------------------------------------------
INSERT INTO public.organizations (id, name, owner_user_id)
SELECT
  COALESCE(NULLIF(trim(up.workspace_id), ''), 'ws_' || left(up.id, 8)) AS id,
  COALESCE(
    NULLIF(trim(up.workspace_name), ''),
    'Despacho ' || COALESCE(NULLIF(trim(up.full_name), ''), NULLIF(split_part(coalesce(up.email, ''), '@', 1), ''), 'Contable')
  ) AS name,
  up.id AS owner_user_id
FROM public.user_profiles up
WHERE up.id IS NOT NULL
  AND trim(up.id) <> ''
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations (id, name, owner_user_id)
SELECT DISTINCT ON (wm.workspace_id)
  wm.workspace_id AS id,
  'Despacho ' || wm.workspace_id AS name,
  COALESCE(
    (SELECT up.id FROM public.user_profiles up WHERE up.workspace_id = wm.workspace_id LIMIT 1),
    NULLIF(trim(wm.user_id), ''),
    'system'
  ) AS owner_user_id
FROM public.workspace_members wm
WHERE wm.status = 'ACTIVO'
  AND wm.workspace_id IS NOT NULL
  AND trim(wm.workspace_id) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.organizations o WHERE o.id = wm.workspace_id
  )
ORDER BY wm.workspace_id, wm.created_at ASC
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Backfill de user_profiles.workspace_id y companies.organization_id
-- ----------------------------------------------------------------------------
UPDATE public.user_profiles up
SET workspace_id = 'ws_' || left(up.id, 8)
WHERE (up.workspace_id IS NULL OR trim(up.workspace_id) = '')
  AND up.id IS NOT NULL
  AND trim(up.id) <> '';

UPDATE public.companies c
SET organization_id = up.workspace_id
FROM public.user_profiles up
WHERE c.organization_id IS NULL
  AND c.user_id IS NOT NULL
  AND c.user_id <> 'demo'
  AND up.id = c.user_id
  AND up.workspace_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.organizations o WHERE o.id = up.workspace_id
  );

-- ----------------------------------------------------------------------------
-- 3. Trigger BEFORE INSERT OR UPDATE OF organization_id ON public.companies
--    Garantiza que exista la fila en public.organizations antes del FK
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_company_organization_exists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_name TEXT;
BEGIN
  IF NEW.organization_id IS NULL OR trim(NEW.organization_id) = '' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = NEW.organization_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NOT NULL AND NEW.user_id <> 'demo' AND (
    NEW.organization_id = NEW.user_id
    OR NEW.organization_id = ('ws_' || left(NEW.user_id, 8))
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = NEW.user_id
        AND up.workspace_id = NEW.organization_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = NEW.organization_id
        AND wm.status = 'ACTIVO'
        AND wm.role IN ('SOCIO', 'CONTADOR')
        AND wm.user_id = NEW.user_id
    )
  ) THEN
    SELECT COALESCE(
      NULLIF(trim(up.workspace_name), ''),
      'Despacho ' || COALESCE(NULLIF(trim(up.full_name), ''), NULLIF(split_part(coalesce(up.email, ''), '@', 1), ''), 'Contable')
    )
    INTO v_org_name
    FROM public.user_profiles up
    WHERE up.id = NEW.user_id
    LIMIT 1;

    INSERT INTO public.organizations (id, name, owner_user_id)
    VALUES (
      NEW.organization_id,
      COALESCE(v_org_name, 'Despacho Contable'),
      NEW.user_id
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_company_organization_exists() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_ensure_company_organization_exists ON public.companies;
CREATE TRIGGER trg_ensure_company_organization_exists
  BEFORE INSERT OR UPDATE OF organization_id ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.ensure_company_organization_exists();

-- ----------------------------------------------------------------------------
-- 4. Actualizar public.handle_new_user_profile() para aprovisionar workspace
--    y fila en public.organizations desde el registro inicial en auth.users
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_full_name TEXT := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  v_ws_id TEXT := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'workspace_id'), ''),
    'ws_' || left(NEW.id::text, 8)
  );
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
-- 5. Política AS RESTRICTIVE para bloquear usuarios SUSPENDIDO en organizations
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
    DROP POLICY IF EXISTS "rls_organizations_not_suspended" ON public.organizations;
    CREATE POLICY "rls_organizations_not_suspended"
      ON public.organizations AS RESTRICTIVE FOR ALL TO authenticated
      USING (NOT public.is_user_suspended())
      WITH CHECK (NOT public.is_user_suspended());
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Registrar migración en supabase_migrations.schema_migrations
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261126000002', 'auto_provision_workspace_organizations')
ON CONFLICT (version) DO NOTHING;
