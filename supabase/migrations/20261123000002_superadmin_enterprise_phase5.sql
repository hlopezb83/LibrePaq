-- ============================================================================
-- LIBREPAQ PRO — FASE 5: SUPERADMIN ENTERPRISE (RBAC, SUPPORT RLS, QUOTAS,
-- PAGINATED RPCs & HEALTH MONITORING ALERTS)
-- 100% IDEMPOTENTE
-- ============================================================================

-- 1. Columna platform_role en public.user_profiles + constraint + backfill
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN IF NOT EXISTS platform_role TEXT NOT NULL DEFAULT 'NONE';

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'chk_user_profiles_platform_role'
    ) THEN
      ALTER TABLE public.user_profiles
        ADD CONSTRAINT chk_user_profiles_platform_role
        CHECK (platform_role IN ('SUPERADMIN', 'SUPPORT_READONLY', 'BILLING_OPS', 'NONE'));
    END IF;

    UPDATE public.user_profiles
    SET platform_role = 'SUPERADMIN'
    WHERE (
      coalesce(is_superadmin, false) = true
      OR lower(coalesce(email, '')) = 'hlopezb@gmail.com'
    )
      AND platform_role IS DISTINCT FROM 'SUPERADMIN';
  END IF;
END $$;

-- 2. Funciones helper RBAC SECURITY DEFINER (SET search_path = public)
CREATE OR REPLACE FUNCTION public.get_platform_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(coalesce((SELECT auth.jwt()) ->> 'email', '')) = 'hlopezb@gmail.com'
      THEN 'SUPERADMIN'
    ELSE coalesce(
      (
        SELECT CASE
          WHEN platform_role IN ('SUPERADMIN', 'SUPPORT_READONLY', 'BILLING_OPS') THEN platform_role
          WHEN coalesce(is_superadmin, false) = true THEN 'SUPERADMIN'
          ELSE 'NONE'
        END
        FROM public.user_profiles
        WHERE id = (SELECT auth.uid())::text
        LIMIT 1
      ),
      'NONE'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_platform_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_platform_role() IN ('SUPERADMIN', 'SUPPORT_READONLY', 'BILLING_OPS');
$$;

CREATE OR REPLACE FUNCTION public.is_platform_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_platform_role() = 'SUPERADMIN';
$$;

REVOKE ALL ON FUNCTION public.get_platform_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_role() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_platform_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_platform_access() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_platform_superadmin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_superadmin() TO authenticated, service_role;

-- 3. Políticas RLS de lectura (solo SELECT) para Modo Soporte en tablas operativas
DO $$
DECLARE
  t TEXT;
  pol_name TEXT;
  support_tables TEXT[] := ARRAY[
    'companies',
    'accounts',
    'polizas',
    'poliza_movements',
    'cfdi_documents',
    'bank_statement_lines',
    'period_locks',
    'fixed_assets',
    'third_parties',
    'fiel_credentials',
    'sat_download_requests',
    'user_profiles'
  ];
BEGIN
  FOREACH t IN ARRAY support_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      pol_name := 'rls_' || t || '_platform_support_select';
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_name, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.has_platform_access()))',
        pol_name,
        t
      );
    END IF;
  END LOOP;
END $$;

-- 4. Tabla nueva: public.workspace_quotas
CREATE TABLE IF NOT EXISTS public.workspace_quotas (
  workspace_id TEXT PRIMARY KEY,
  user_id TEXT,
  plan_tier TEXT NOT NULL DEFAULT 'FREE' CHECK (plan_tier IN ('FREE', 'PRO', 'DESPACHO', 'ENTERPRISE')),
  max_companies INT NOT NULL DEFAULT 3,
  max_cfdis_per_month INT NOT NULL DEFAULT 500,
  max_storage_mb INT NOT NULL DEFAULT 250,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

ALTER TABLE public.workspace_quotas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.workspace_quotas FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.workspace_quotas TO authenticated;

DROP POLICY IF EXISTS "rls_workspace_quotas_select" ON public.workspace_quotas;
DROP POLICY IF EXISTS "rls_workspace_quotas_insert" ON public.workspace_quotas;
DROP POLICY IF EXISTS "rls_workspace_quotas_update" ON public.workspace_quotas;

CREATE POLICY "rls_workspace_quotas_select"
ON public.workspace_quotas FOR SELECT
TO authenticated
USING (
  (SELECT public.has_platform_access())
  OR user_id = (SELECT auth.uid())::text
);

CREATE POLICY "rls_workspace_quotas_insert"
ON public.workspace_quotas FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.get_platform_role()) IN ('SUPERADMIN', 'BILLING_OPS'));

CREATE POLICY "rls_workspace_quotas_update"
ON public.workspace_quotas FOR UPDATE
TO authenticated
USING ((SELECT public.get_platform_role()) IN ('SUPERADMIN', 'BILLING_OPS'))
WITH CHECK ((SELECT public.get_platform_role()) IN ('SUPERADMIN', 'BILLING_OPS'));

-- 5. Tabla nueva: public.platform_alerts
CREATE TABLE IF NOT EXISTS public.platform_alerts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  category TEXT NOT NULL CHECK (category IN ('fiel_expiry', 'sat_error_spike', 'quota_limit', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

ALTER TABLE public.platform_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_alerts FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.platform_alerts TO authenticated;

DROP POLICY IF EXISTS "rls_platform_alerts_select" ON public.platform_alerts;
DROP POLICY IF EXISTS "rls_platform_alerts_insert" ON public.platform_alerts;
DROP POLICY IF EXISTS "rls_platform_alerts_update" ON public.platform_alerts;

CREATE POLICY "rls_platform_alerts_select"
ON public.platform_alerts FOR SELECT
TO authenticated
USING ((SELECT public.has_platform_access()));

CREATE POLICY "rls_platform_alerts_insert"
ON public.platform_alerts FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.has_platform_access()));

CREATE POLICY "rls_platform_alerts_update"
ON public.platform_alerts FOR UPDATE
TO authenticated
USING ((SELECT public.has_platform_access()))
WITH CHECK ((SELECT public.has_platform_access()));

-- 6. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_workspace_quotas_user_id
  ON public.workspace_quotas (user_id);

CREATE INDEX IF NOT EXISTS idx_platform_alerts_status_detected
  ON public.platform_alerts (status, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_companies_created_at_desc
  ON public.companies (created_at DESC);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at_desc
      ON public.user_profiles (created_at DESC);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action_created
  ON public.admin_audit_logs (action, created_at DESC);

-- 7. Actualizar políticas RLS de admin_audit_logs para has_platform_access()
DROP POLICY IF EXISTS "rls_admin_audit_logs_select" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "rls_admin_audit_logs_insert" ON public.admin_audit_logs;

CREATE POLICY "rls_admin_audit_logs_select"
ON public.admin_audit_logs FOR SELECT
TO authenticated
USING ((SELECT public.has_platform_access()));

CREATE POLICY "rls_admin_audit_logs_insert"
ON public.admin_audit_logs FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.has_platform_access()));

-- 8. Actualizar RPCs analíticos existentes para validar public.has_platform_access()
CREATE OR REPLACE FUNCTION public.admin_get_platform_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_users INTEGER := 0;
  v_new_users_7d INTEGER := 0;
  v_new_users_30d INTEGER := 0;
  v_total_companies INTEGER := 0;
  v_active_companies INTEGER := 0;
  v_companies_with_fiel INTEGER := 0;
  v_total_polizas INTEGER := 0;
  v_total_cfdis INTEGER := 0;
  v_sat_errors_7d INTEGER := 0;
BEGIN
  IF NOT public.has_platform_access() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT
    GREATEST(
      count(*)::int,
      (SELECT count(DISTINCT user_id)::int FROM public.companies WHERE user_id IS NOT NULL AND user_id <> 'demo'),
      1
    ),
    count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int,
    count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int
  INTO v_total_users, v_new_users_7d, v_new_users_30d
  FROM public.user_profiles;

  WITH real_companies AS (
    SELECT id
    FROM public.companies
    WHERE upper(coalesce(rfc, '')) <> 'CEJ2106158A0'
      AND upper(coalesce(name, '')) NOT LIKE '[DEMO]%'
  )
  SELECT
    count(*)::int,
    count(*) FILTER (
      WHERE EXISTS (SELECT 1 FROM public.polizas p WHERE p.company_id = rc.id)
         OR EXISTS (SELECT 1 FROM public.cfdi_documents d WHERE d.company_id = rc.id)
    )::int,
    count(*) FILTER (
      WHERE EXISTS (SELECT 1 FROM public.fiel_credentials f WHERE f.company_id = rc.id)
    )::int
  INTO v_total_companies, v_active_companies, v_companies_with_fiel
  FROM real_companies rc;

  SELECT count(*)::int INTO v_total_polizas
  FROM public.polizas p
  JOIN public.companies c ON c.id = p.company_id
  WHERE upper(coalesce(c.rfc, '')) <> 'CEJ2106158A0'
    AND upper(coalesce(c.name, '')) NOT LIKE '[DEMO]%';

  SELECT count(*)::int INTO v_total_cfdis
  FROM public.cfdi_documents d
  JOIN public.companies c ON c.id = d.company_id
  WHERE upper(coalesce(c.rfc, '')) <> 'CEJ2106158A0'
    AND upper(coalesce(c.name, '')) NOT LIKE '[DEMO]%';

  SELECT count(*)::int INTO v_sat_errors_7d
  FROM public.sat_download_requests r
  WHERE r.created_at >= now() - interval '7 days'
    AND (
      upper(coalesce(r.estado_solicitud, '')) IN ('ERROR', 'RECHAZADA', 'VENCIDA')
      OR coalesce(r.codigo_estado_sat, '') NOT IN ('', '5000')
    );

  RETURN jsonb_build_object(
    'totalUsers', v_total_users,
    'newUsers7d', v_new_users_7d,
    'newUsers30d', v_new_users_30d,
    'totalCompanies', v_total_companies,
    'activeCompaniesCount', v_active_companies,
    'companiesWithFielCount', v_companies_with_fiel,
    'totalPolizas', v_total_polizas,
    'totalCfdis', v_total_cfdis,
    'satErrors7d', v_sat_errors_7d
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_platform_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_platform_summary() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_get_sat_health()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_7d INTEGER := 0;
  v_completed_7d INTEGER := 0;
  v_pending_7d INTEGER := 0;
  v_failed_7d INTEGER := 0;
  v_error_breakdown JSONB := '[]'::jsonb;
  v_recent_requests JSONB := '[]'::jsonb;
  v_expiring_fiels JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.has_platform_access() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT
    count(*)::int,
    count(*) FILTER (
      WHERE upper(coalesce(estado_solicitud, '')) IN ('TERMINADA', 'COMPLETADA')
    )::int,
    count(*) FILTER (
      WHERE upper(coalesce(estado_solicitud, '')) IN ('ACEPTADA', 'EN_PROCESO', 'SOLICITADA')
    )::int,
    count(*) FILTER (
      WHERE upper(coalesce(estado_solicitud, '')) IN ('ERROR', 'RECHAZADA', 'VENCIDA')
         OR upper(coalesce(estado_solicitud, '')) NOT IN ('TERMINADA', 'COMPLETADA', 'ACEPTADA', 'EN_PROCESO', 'SOLICITADA')
    )::int
  INTO v_total_7d, v_completed_7d, v_pending_7d, v_failed_7d
  FROM public.sat_download_requests
  WHERE created_at >= now() - interval '7 days';

  SELECT coalesce(
    jsonb_agg(jsonb_build_object('code', t.code, 'count', t.cnt) ORDER BY t.cnt DESC),
    '[]'::jsonb
  )
  INTO v_error_breakdown
  FROM (
    SELECT
      coalesce(nullif(trim(codigo_estado_sat), ''), 'UNKNOWN') AS code,
      count(*)::int AS cnt
    FROM public.sat_download_requests
    WHERE created_at >= now() - interval '7 days'
      AND (
        upper(coalesce(estado_solicitud, '')) IN ('ERROR', 'RECHAZADA', 'VENCIDA')
        OR coalesce(codigo_estado_sat, '') NOT IN ('', '5000')
      )
    GROUP BY 1
  ) t;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'companyId', r.company_id,
        'companyName', coalesce(c.name, 'Empresa'),
        'companyRfc', coalesce(c.rfc, ''),
        'tipoSolicitud', r.tipo_solicitud,
        'estadoSolicitud', r.estado_solicitud,
        'codigoEstadoSat', r.codigo_estado_sat,
        'mensajeSat', r.mensaje_sat,
        'cfdisDescargados', r.cfdis_descargados,
        'createdAt', to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
      ORDER BY r.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_recent_requests
  FROM (
    SELECT *
    FROM public.sat_download_requests
    ORDER BY created_at DESC
    LIMIT 25
  ) r
  LEFT JOIN public.companies c ON c.id = r.company_id;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'companyId', f.company_id,
        'companyName', coalesce(c.name, 'Empresa'),
        'companyRfc', coalesce(c.rfc, ''),
        'rfcTitular', f.rfc_titular,
        'numeroSerie', f.numero_serie,
        'validTo', f.valid_to,
        'daysRemaining', floor(extract(epoch FROM (f.valid_to::timestamptz - now())) / 86400)::int
      )
      ORDER BY f.valid_to::timestamptz ASC
    ),
    '[]'::jsonb
  )
  INTO v_expiring_fiels
  FROM public.fiel_credentials f
  LEFT JOIN public.companies c ON c.id = f.company_id
  WHERE f.valid_to ~ '^\d{4}-\d{2}-\d{2}'
    AND f.valid_to::timestamptz <= now() + interval '90 days';

  RETURN jsonb_build_object(
    'totalRequests7d', v_total_7d,
    'completedRequests7d', v_completed_7d,
    'pendingRequests7d', v_pending_7d,
    'failedRequests7d', v_failed_7d,
    'errorCodeBreakdown', v_error_breakdown,
    'recentRequests', v_recent_requests,
    'expiringFiels', v_expiring_fiels,
    'checkedAtIso', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_sat_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_sat_health() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_get_company_detail(p_company_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comp RECORD;
  v_profile RECORD;
  v_fiel RECORD;
  v_accounts_count INTEGER := 0;
  v_polizas_count INTEGER := 0;
  v_cfdis_count INTEGER := 0;
  v_bank_lines_count INTEGER := 0;
  v_is_locked BOOLEAN := false;
  v_last_poliza_at TIMESTAMPTZ;
  v_last_cfdi_date TIMESTAMPTZ;
  v_last_activity TIMESTAMPTZ;
  v_owner_type TEXT := 'user';
  v_is_super BOOLEAN := false;
BEGIN
  IF NOT public.has_platform_access() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_comp
  FROM public.companies
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_comp.user_id IS NOT NULL AND v_comp.user_id <> 'demo' THEN
    SELECT id, email, full_name, provider, is_superadmin, platform_role
    INTO v_profile
    FROM public.user_profiles
    WHERE id = v_comp.user_id;
  END IF;

  SELECT company_id, valid_to, numero_serie
  INTO v_fiel
  FROM public.fiel_credentials
  WHERE company_id = p_company_id;

  SELECT count(*)::int INTO v_accounts_count
  FROM public.accounts WHERE company_id = p_company_id;

  SELECT count(*)::int, max(created_at)
  INTO v_polizas_count, v_last_poliza_at
  FROM public.polizas WHERE company_id = p_company_id;

  SELECT count(*)::int, max(fecha)
  INTO v_cfdis_count, v_last_cfdi_date
  FROM public.cfdi_documents WHERE company_id = p_company_id;

  SELECT count(*)::int INTO v_bank_lines_count
  FROM public.bank_statement_lines WHERE company_id = p_company_id;

  SELECT coalesce(is_locked, false) INTO v_is_locked
  FROM public.period_locks
  WHERE company_id = p_company_id
    AND ejercicio = v_comp.current_year
    AND periodo = v_comp.current_period;

  v_is_super := coalesce(v_profile.is_superadmin, false)
    OR coalesce(v_profile.platform_role, 'NONE') = 'SUPERADMIN'
    OR lower(coalesce(v_profile.email, '')) = 'hlopezb@gmail.com';

  IF v_comp.user_id IS NULL
     OR v_comp.user_id = 'demo'
     OR upper(coalesce(v_comp.rfc, '')) = 'CEJ2106158A0'
     OR upper(coalesce(v_comp.name, '')) LIKE '[DEMO]%' THEN
    v_owner_type := 'demo';
  ELSIF v_is_super THEN
    v_owner_type := 'superadmin';
  ELSE
    v_owner_type := 'user';
  END IF;

  v_last_activity := CASE
    WHEN v_last_poliza_at IS NULL THEN v_last_cfdi_date
    WHEN v_last_cfdi_date IS NULL THEN v_last_poliza_at
    ELSE GREATEST(v_last_poliza_at, v_last_cfdi_date)
  END;

  RETURN jsonb_build_object(
    'company', jsonb_build_object(
      'id', v_comp.id,
      'name', v_comp.name,
      'rfc', v_comp.rfc,
      'regimenFiscal', v_comp.regimen_fiscal,
      'codigoPostal', v_comp.codigo_postal,
      'currentYear', v_comp.current_year,
      'currentPeriod', v_comp.current_period,
      'userId', v_comp.user_id,
      'userEmail', v_profile.email,
      'userFullName', v_profile.full_name,
      'userProvider', coalesce(v_profile.provider, 'email'),
      'userIsSuperAdmin', v_is_super,
      'ownerType', v_owner_type,
      'createdAt', to_char(v_comp.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'polizasCount', v_polizas_count,
      'cfdisCount', v_cfdis_count,
      'hasFiel', (v_fiel.company_id IS NOT NULL),
      'fielValidTo', v_fiel.valid_to,
      'lastActivityAt', CASE WHEN v_last_activity IS NOT NULL
        THEN to_char(v_last_activity AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ELSE NULL END
    ),
    'accountsCount', v_accounts_count,
    'polizasCount', v_polizas_count,
    'cfdisCount', v_cfdis_count,
    'bankLinesCount', v_bank_lines_count,
    'hasFiel', (v_fiel.company_id IS NOT NULL),
    'fielValidTo', v_fiel.valid_to,
    'fielNumeroSerie', v_fiel.numero_serie,
    'isCurrentPeriodLocked', coalesce(v_is_locked, false),
    'lastPolizaAt', CASE WHEN v_last_poliza_at IS NOT NULL
      THEN to_char(v_last_poliza_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ELSE NULL END,
    'lastCfdiDate', CASE WHEN v_last_cfdi_date IS NOT NULL
      THEN to_char(v_last_cfdi_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_company_detail(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_company_detail(TEXT) TO authenticated, service_role;

-- 9. RPC paginado: Empresas
CREATE OR REPLACE FUNCTION public.admin_list_companies_paginated(
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20,
  p_search TEXT DEFAULT '',
  p_owner_type TEXT DEFAULT 'ALL',
  p_fiel_filter TEXT DEFAULT 'ALL'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INT := GREATEST(coalesce(p_page, 1), 1);
  v_page_size INT := LEAST(GREATEST(coalesce(p_page_size, 20), 1), 100);
  v_search TEXT := lower(trim(coalesce(p_search, '')));
  v_owner_type TEXT := coalesce(nullif(trim(p_owner_type), ''), 'ALL');
  v_fiel_filter TEXT := upper(coalesce(nullif(trim(p_fiel_filter), ''), 'ALL'));
  v_total INT := 0;
  v_total_pages INT := 1;
  v_items JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.has_platform_access() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  WITH base AS (
    SELECT
      c.id,
      c.name,
      c.rfc,
      coalesce(nullif(c.regimen_fiscal, ''), '601 - General de Ley Personas Morales') AS regimen_fiscal,
      coalesce(nullif(c.codigo_postal, ''), '64000') AS codigo_postal,
      coalesce(c.current_year, 2026) AS current_year,
      coalesce(c.current_period, 10) AS current_period,
      c.user_id,
      c.created_at,
      up.email AS user_email,
      up.full_name AS user_full_name,
      coalesce(nullif(up.provider, ''), 'email') AS user_provider,
      (
        coalesce(up.is_superadmin, false)
        OR coalesce(up.platform_role, 'NONE') = 'SUPERADMIN'
        OR lower(coalesce(up.email, '')) = 'hlopezb@gmail.com'
      ) AS user_is_superadmin,
      CASE
        WHEN c.user_id IS NULL
          OR c.user_id = 'demo'
          OR upper(coalesce(c.rfc, '')) = 'CEJ2106158A0'
          OR upper(coalesce(c.name, '')) LIKE '[DEMO]%'
          THEN 'demo'
        WHEN coalesce(up.is_superadmin, false)
          OR coalesce(up.platform_role, 'NONE') = 'SUPERADMIN'
          OR lower(coalesce(up.email, '')) = 'hlopezb@gmail.com'
          THEN 'superadmin'
        ELSE 'user'
      END AS owner_type,
      (f.company_id IS NOT NULL) AS has_fiel,
      f.valid_to AS fiel_valid_to
    FROM public.companies c
    LEFT JOIN public.user_profiles up
      ON up.id = c.user_id AND c.user_id IS NOT NULL AND c.user_id <> 'demo'
    LEFT JOIN public.fiel_credentials f
      ON f.company_id = c.id
  ),
  filtered AS (
    SELECT *
    FROM base b
    WHERE (
      v_search = ''
      OR lower(coalesce(b.name, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(b.rfc, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(b.user_email, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(b.user_full_name, '')) LIKE '%' || v_search || '%'
    )
      AND (upper(v_owner_type) = 'ALL' OR b.owner_type = lower(v_owner_type))
      AND (
        v_fiel_filter = 'ALL'
        OR (v_fiel_filter = 'WITH_FIEL' AND b.has_fiel = true)
        OR (v_fiel_filter = 'WITHOUT_FIEL' AND b.has_fiel = false)
      )
  )
  SELECT count(*)::int INTO v_total FROM filtered;

  v_total_pages := GREATEST(ceil(v_total::numeric / v_page_size)::int, 1);

  WITH base AS (
    SELECT
      c.id,
      c.name,
      c.rfc,
      coalesce(nullif(c.regimen_fiscal, ''), '601 - General de Ley Personas Morales') AS regimen_fiscal,
      coalesce(nullif(c.codigo_postal, ''), '64000') AS codigo_postal,
      coalesce(c.current_year, 2026) AS current_year,
      coalesce(c.current_period, 10) AS current_period,
      c.user_id,
      c.created_at,
      up.email AS user_email,
      up.full_name AS user_full_name,
      coalesce(nullif(up.provider, ''), 'email') AS user_provider,
      (
        coalesce(up.is_superadmin, false)
        OR coalesce(up.platform_role, 'NONE') = 'SUPERADMIN'
        OR lower(coalesce(up.email, '')) = 'hlopezb@gmail.com'
      ) AS user_is_superadmin,
      CASE
        WHEN c.user_id IS NULL
          OR c.user_id = 'demo'
          OR upper(coalesce(c.rfc, '')) = 'CEJ2106158A0'
          OR upper(coalesce(c.name, '')) LIKE '[DEMO]%'
          THEN 'demo'
        WHEN coalesce(up.is_superadmin, false)
          OR coalesce(up.platform_role, 'NONE') = 'SUPERADMIN'
          OR lower(coalesce(up.email, '')) = 'hlopezb@gmail.com'
          THEN 'superadmin'
        ELSE 'user'
      END AS owner_type,
      (f.company_id IS NOT NULL) AS has_fiel,
      f.valid_to AS fiel_valid_to
    FROM public.companies c
    LEFT JOIN public.user_profiles up
      ON up.id = c.user_id AND c.user_id IS NOT NULL AND c.user_id <> 'demo'
    LEFT JOIN public.fiel_credentials f
      ON f.company_id = c.id
  ),
  filtered AS (
    SELECT *
    FROM base b
    WHERE (
      v_search = ''
      OR lower(coalesce(b.name, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(b.rfc, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(b.user_email, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(b.user_full_name, '')) LIKE '%' || v_search || '%'
    )
      AND (upper(v_owner_type) = 'ALL' OR b.owner_type = lower(v_owner_type))
      AND (
        v_fiel_filter = 'ALL'
        OR (v_fiel_filter = 'WITH_FIEL' AND b.has_fiel = true)
        OR (v_fiel_filter = 'WITHOUT_FIEL' AND b.has_fiel = false)
      )
    ORDER BY b.created_at DESC
    LIMIT v_page_size
    OFFSET (v_page - 1) * v_page_size
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'rfc', p.rfc,
        'regimenFiscal', p.regimen_fiscal,
        'codigoPostal', p.codigo_postal,
        'currentYear', p.current_year,
        'currentPeriod', p.current_period,
        'userId', p.user_id,
        'userEmail', p.user_email,
        'userFullName', p.user_full_name,
        'userProvider', p.user_provider,
        'userIsSuperAdmin', p.user_is_superadmin,
        'ownerType', p.owner_type,
        'createdAt', to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'polizasCount', (SELECT count(*)::int FROM public.polizas po WHERE po.company_id = p.id),
        'cfdisCount', (SELECT count(*)::int FROM public.cfdi_documents cd WHERE cd.company_id = p.id),
        'hasFiel', p.has_fiel,
        'fielValidTo', p.fiel_valid_to
      )
      ORDER BY p.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM filtered p;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'pageSize', v_page_size,
    'totalPages', v_total_pages
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_companies_paginated(INT, INT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_companies_paginated(INT, INT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 10. RPC paginado: Usuarios
CREATE OR REPLACE FUNCTION public.admin_list_users_paginated(
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20,
  p_search TEXT DEFAULT '',
  p_status TEXT DEFAULT 'ALL',
  p_role TEXT DEFAULT 'ALL'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INT := GREATEST(coalesce(p_page, 1), 1);
  v_page_size INT := LEAST(GREATEST(coalesce(p_page_size, 20), 1), 100);
  v_search TEXT := lower(trim(coalesce(p_search, '')));
  v_status TEXT := upper(coalesce(nullif(trim(p_status), ''), 'ALL'));
  v_role TEXT := upper(coalesce(nullif(trim(p_role), ''), 'ALL'));
  v_total INT := 0;
  v_total_pages INT := 1;
  v_items JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.has_platform_access() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  WITH base AS (
    SELECT
      up.id,
      coalesce(up.email, '') AS email,
      coalesce(nullif(up.full_name, ''), nullif(split_part(coalesce(up.email, ''), '@', 1), ''), 'Contador') AS full_name,
      up.workspace_id,
      up.workspace_name,
      coalesce(nullif(up.provider, ''), 'email') AS provider,
      CASE
        WHEN up.acquisition_source = 'google_ads' OR nullif(up.gclid, '') IS NOT NULL THEN 'google_ads'
        WHEN up.acquisition_source = 'utm' THEN 'utm'
        WHEN nullif(up.acquisition_source, '') IS NOT NULL THEN 'organic_or_direct'
        ELSE NULL
      END AS acquisition_source,
      up.gclid,
      up.utm_campaign,
      up.utm_term,
      CASE
        WHEN lower(coalesce(up.email, '')) = 'hlopezb@gmail.com' THEN 'SUPERADMIN'
        WHEN up.platform_role IN ('SUPERADMIN', 'SUPPORT_READONLY', 'BILLING_OPS') THEN up.platform_role
        WHEN coalesce(up.is_superadmin, false) = true THEN 'SUPERADMIN'
        ELSE 'NONE'
      END AS effective_role,
      upper(coalesce(nullif(up.status, ''), 'ACTIVO')) AS effective_status,
      up.created_at,
      up.last_sign_in_at
    FROM public.user_profiles up
  ),
  filtered AS (
    SELECT *
    FROM base b
    WHERE (
      v_search = ''
      OR lower(b.email) LIKE '%' || v_search || '%'
      OR lower(b.full_name) LIKE '%' || v_search || '%'
      OR lower(coalesce(b.workspace_name, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(b.workspace_id, '')) LIKE '%' || v_search || '%'
    )
      AND (v_status = 'ALL' OR b.effective_status = v_status)
      AND (v_role = 'ALL' OR b.effective_role = v_role)
  )
  SELECT count(*)::int INTO v_total FROM filtered;

  v_total_pages := GREATEST(ceil(v_total::numeric / v_page_size)::int, 1);

  WITH base AS (
    SELECT
      up.id,
      coalesce(up.email, '') AS email,
      coalesce(nullif(up.full_name, ''), nullif(split_part(coalesce(up.email, ''), '@', 1), ''), 'Contador') AS full_name,
      up.workspace_id,
      up.workspace_name,
      coalesce(nullif(up.provider, ''), 'email') AS provider,
      CASE
        WHEN up.acquisition_source = 'google_ads' OR nullif(up.gclid, '') IS NOT NULL THEN 'google_ads'
        WHEN up.acquisition_source = 'utm' THEN 'utm'
        WHEN nullif(up.acquisition_source, '') IS NOT NULL THEN 'organic_or_direct'
        ELSE NULL
      END AS acquisition_source,
      up.gclid,
      up.utm_campaign,
      up.utm_term,
      CASE
        WHEN lower(coalesce(up.email, '')) = 'hlopezb@gmail.com' THEN 'SUPERADMIN'
        WHEN up.platform_role IN ('SUPERADMIN', 'SUPPORT_READONLY', 'BILLING_OPS') THEN up.platform_role
        WHEN coalesce(up.is_superadmin, false) = true THEN 'SUPERADMIN'
        ELSE 'NONE'
      END AS effective_role,
      upper(coalesce(nullif(up.status, ''), 'ACTIVO')) AS effective_status,
      up.created_at,
      up.last_sign_in_at
    FROM public.user_profiles up
  ),
  filtered AS (
    SELECT *
    FROM base b
    WHERE (
      v_search = ''
      OR lower(b.email) LIKE '%' || v_search || '%'
      OR lower(b.full_name) LIKE '%' || v_search || '%'
      OR lower(coalesce(b.workspace_name, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(b.workspace_id, '')) LIKE '%' || v_search || '%'
    )
      AND (v_status = 'ALL' OR b.effective_status = v_status)
      AND (v_role = 'ALL' OR b.effective_role = v_role)
    ORDER BY b.created_at DESC
    LIMIT v_page_size
    OFFSET (v_page - 1) * v_page_size
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'fullName', u.full_name,
        'workspaceId', CASE WHEN u.effective_role = 'SUPERADMIN' THEN NULL ELSE coalesce(nullif(u.workspace_id, ''), 'ws_' || left(u.id, 8)) END,
        'workspaceName', CASE WHEN u.effective_role = 'SUPERADMIN' THEN NULL ELSE coalesce(nullif(u.workspace_name, ''), 'Workspace — ' || u.full_name) END,
        'provider', u.provider,
        'acquisitionSource', u.acquisition_source,
        'gclid', u.gclid,
        'utmCampaign', u.utm_campaign,
        'utmTerm', u.utm_term,
        'isSuperAdmin', (u.effective_role = 'SUPERADMIN'),
        'platformRole', u.effective_role,
        'createdAt', to_char(u.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'lastSignInAt', CASE WHEN u.last_sign_in_at IS NOT NULL THEN to_char(u.last_sign_in_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') ELSE NULL END,
        'companiesCount', (SELECT count(*)::int FROM public.companies c WHERE c.user_id = u.id),
        'status', u.effective_status
      )
      ORDER BY u.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM filtered u;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'pageSize', v_page_size,
    'totalPages', v_total_pages
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users_paginated(INT, INT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users_paginated(INT, INT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 11. RPC paginado: Bitácora de auditoría administrativa
CREATE OR REPLACE FUNCTION public.admin_list_audit_logs_paginated(
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25,
  p_search TEXT DEFAULT '',
  p_action TEXT DEFAULT '',
  p_target_type TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INT := GREATEST(coalesce(p_page, 1), 1);
  v_page_size INT := LEAST(GREATEST(coalesce(p_page_size, 25), 1), 100);
  v_search TEXT := lower(trim(coalesce(p_search, '')));
  v_action TEXT := upper(trim(coalesce(p_action, '')));
  v_target_type TEXT := lower(trim(coalesce(p_target_type, '')));
  v_total INT := 0;
  v_total_pages INT := 1;
  v_items JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.has_platform_access() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT count(*)::int
  INTO v_total
  FROM public.admin_audit_logs l
  WHERE (
    v_search = ''
    OR lower(coalesce(l.actor_email, '')) LIKE '%' || v_search || '%'
    OR lower(coalesce(l.action, '')) LIKE '%' || v_search || '%'
    OR lower(coalesce(l.target_type, '')) LIKE '%' || v_search || '%'
    OR lower(coalesce(l.target_id, '')) LIKE '%' || v_search || '%'
  )
    AND (v_action = '' OR v_action = 'ALL' OR upper(coalesce(l.action, '')) = v_action)
    AND (v_target_type = '' OR v_target_type = 'all' OR lower(coalesce(l.target_type, '')) = v_target_type);

  v_total_pages := GREATEST(ceil(v_total::numeric / v_page_size)::int, 1);

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'actorUserId', p.actor_user_id,
        'actorEmail', p.actor_email,
        'action', p.action,
        'targetType', p.target_type,
        'targetId', p.target_id,
        'metadata', p.metadata,
        'createdAt', to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
      ORDER BY p.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM (
    SELECT *
    FROM public.admin_audit_logs l
    WHERE (
      v_search = ''
      OR lower(coalesce(l.actor_email, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(l.action, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(l.target_type, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(l.target_id, '')) LIKE '%' || v_search || '%'
    )
      AND (v_action = '' OR v_action = 'ALL' OR upper(coalesce(l.action, '')) = v_action)
      AND (v_target_type = '' OR v_target_type = 'all' OR lower(coalesce(l.target_type, '')) = v_target_type)
    ORDER BY l.created_at DESC
    LIMIT v_page_size
    OFFSET (v_page - 1) * v_page_size
  ) p;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'pageSize', v_page_size,
    'totalPages', v_total_pages
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_audit_logs_paginated(INT, INT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_logs_paginated(INT, INT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 12. RPC: Motor de escaneo de salud y alertas proactivas de plataforma
CREATE OR REPLACE FUNCTION public.admin_run_health_scan()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sat_total INT := 0;
  v_sat_errors INT := 0;
  v_error_rate NUMERIC := 0;
  v_alerts_created INT := 0;
  v_open_alerts_count INT := 0;
  v_existing_id TEXT;
  r RECORD;
BEGIN
  IF NOT (
    (SELECT auth.role()) = 'service_role'
    OR public.has_platform_access()
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _detected_alerts (
    code TEXT NOT NULL,
    severity TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  ) ON COMMIT DROP;
  DELETE FROM _detected_alerts;

  -- A) e.firmas vencidas o por vencer en <= 30 días
  INSERT INTO _detected_alerts (code, severity, category, title, message, target_type, target_id, metadata)
  SELECT
    CASE
      WHEN floor(extract(epoch FROM (f.valid_to::timestamptz - now())) / 86400)::int < 0 THEN 'FIEL_EXPIRED'
      ELSE 'FIEL_EXPIRY_SOON'
    END,
    CASE
      WHEN floor(extract(epoch FROM (f.valid_to::timestamptz - now())) / 86400)::int <= 7 THEN 'critical'
      ELSE 'warning'
    END,
    'fiel_expiry',
    'e.firma próxima a vencer (' || coalesce(c.rfc, f.rfc_titular) || ')',
    CASE
      WHEN floor(extract(epoch FROM (f.valid_to::timestamptz - now())) / 86400)::int < 0
        THEN 'La e.firma de ' || coalesce(c.name, f.rfc_titular) || ' venció hace ' || abs(floor(extract(epoch FROM (f.valid_to::timestamptz - now())) / 86400)::int) || ' días.'
      ELSE 'La e.firma de ' || coalesce(c.name, f.rfc_titular) || ' vence en ' || floor(extract(epoch FROM (f.valid_to::timestamptz - now())) / 86400)::int || ' días.'
    END,
    'company',
    f.company_id,
    jsonb_build_object(
      'companyName', coalesce(c.name, 'Empresa'),
      'rfc', coalesce(c.rfc, f.rfc_titular),
      'validTo', f.valid_to,
      'daysRemaining', floor(extract(epoch FROM (f.valid_to::timestamptz - now())) / 86400)::int
    )
  FROM public.fiel_credentials f
  LEFT JOIN public.companies c ON c.id = f.company_id
  WHERE f.valid_to ~ '^\d{4}-\d{2}-\d{2}'
    AND f.valid_to::timestamptz <= now() + interval '30 days';

  -- B) Pico de errores SAT últimas 24h (>= 3 solicitudes y tasa > 20%)
  SELECT
    count(*)::int,
    count(*) FILTER (
      WHERE upper(coalesce(estado_solicitud, '')) IN ('ERROR', 'RECHAZADA', 'VENCIDA')
         OR coalesce(codigo_estado_sat, '') NOT IN ('', '5000')
    )::int
  INTO v_sat_total, v_sat_errors
  FROM public.sat_download_requests
  WHERE created_at >= now() - interval '24 hours';

  IF v_sat_total >= 3 THEN
    v_error_rate := (v_sat_errors::numeric / v_sat_total::numeric);
    IF v_error_rate > 0.20 THEN
      INSERT INTO _detected_alerts (code, severity, category, title, message, target_type, target_id, metadata)
      VALUES (
        'SAT_ERROR_SPIKE_24H',
        CASE WHEN v_error_rate >= 0.50 THEN 'critical' ELSE 'warning' END,
        'sat_error_spike',
        'Pico de errores en descargas SAT (24h)',
        format('%s de %s solicitudes SAT fallaron en las últimas 24h (%s%%).', v_sat_errors, v_sat_total, round(v_error_rate * 100)),
        'platform',
        'sat_soap',
        jsonb_build_object(
          'total24h', v_sat_total,
          'errors24h', v_sat_errors,
          'errorRatePct', round(v_error_rate * 100, 1)
        )
      );
    END IF;
  END IF;

  -- C) Cuotas de workspace alcanzadas o excedidas (>= max_companies)
  INSERT INTO _detected_alerts (code, severity, category, title, message, target_type, target_id, metadata)
  SELECT
    'WORKSPACE_QUOTA_REACHED',
    CASE WHEN q_usage.companies_used > wq.max_companies THEN 'critical' ELSE 'warning' END,
    'quota_limit',
    'Límite de empresas alcanzado en workspace ' || wq.workspace_id,
    format('El workspace usa %s de %s empresas permitidas (plan %s).', q_usage.companies_used, wq.max_companies, wq.plan_tier),
    'workspace',
    wq.workspace_id,
    jsonb_build_object(
      'workspaceId', wq.workspace_id,
      'planTier', wq.plan_tier,
      'companiesUsed', q_usage.companies_used,
      'maxCompanies', wq.max_companies
    )
  FROM public.workspace_quotas wq
  CROSS JOIN LATERAL (
    SELECT count(*)::int AS companies_used
    FROM public.companies c
    WHERE upper(coalesce(c.rfc, '')) <> 'CEJ2106158A0'
      AND upper(coalesce(c.name, '')) NOT LIKE '[DEMO]%'
      AND (
        (wq.user_id IS NOT NULL AND c.user_id = wq.user_id)
        OR c.user_id IN (
          SELECT up.id FROM public.user_profiles up WHERE up.workspace_id = wq.workspace_id
        )
      )
  ) q_usage
  WHERE wq.max_companies >= 0
    AND q_usage.companies_used >= wq.max_companies;

  -- Deduplicar / insertar nuevas alertas abiertas
  FOR r IN SELECT * FROM _detected_alerts LOOP
    SELECT pa.id INTO v_existing_id
    FROM public.platform_alerts pa
    WHERE pa.status IN ('open', 'acknowledged')
      AND pa.code = r.code
      AND pa.target_type = r.target_type
      AND coalesce(pa.target_id, '') = coalesce(r.target_id, '')
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.platform_alerts
      SET severity = r.severity,
          title = r.title,
          message = r.message,
          metadata = r.metadata,
          detected_at = now()
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.platform_alerts (
        id, code, severity, category, title, message,
        target_type, target_id, status, metadata, detected_at
      )
      VALUES (
        'alert_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
        r.code,
        r.severity,
        r.category,
        r.title,
        r.message,
        r.target_type,
        r.target_id,
        'open',
        r.metadata,
        now()
      );
      v_alerts_created := v_alerts_created + 1;
    END IF;
  END LOOP;

  -- Autoresolver alertas automáticas cuya condición ya desapareció
  UPDATE public.platform_alerts pa
  SET status = 'resolved',
      resolved_at = now(),
      resolved_by = 'system_health_scan'
  WHERE pa.status IN ('open', 'acknowledged')
    AND pa.category IN ('fiel_expiry', 'sat_error_spike', 'quota_limit')
    AND NOT EXISTS (
      SELECT 1 FROM _detected_alerts da
      WHERE da.code = pa.code
        AND da.target_type = pa.target_type
        AND coalesce(da.target_id, '') = coalesce(pa.target_id, '')
    );

  SELECT count(*)::int INTO v_open_alerts_count
  FROM public.platform_alerts
  WHERE status = 'open';

  RETURN jsonb_build_object(
    'scannedAtIso', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'alertsCreated', v_alerts_created,
    'openAlertsCount', v_open_alerts_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_run_health_scan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_run_health_scan() TO authenticated, service_role;
