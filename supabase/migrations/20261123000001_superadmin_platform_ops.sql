-- ============================================================================
-- LIBREPAQ PRO — SUPERADMIN PLATFORM OPS: BROADCASTS, AUDIT LOGS & ANALYTICS RPCs
-- ============================================================================

-- 1. Helper SECURITY DEFINER para validar SuperAdmin de plataforma
CREATE OR REPLACE FUNCTION public.is_platform_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lower(coalesce((SELECT auth.jwt()) ->> 'email', '')) = 'hlopezb@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = (SELECT auth.uid())::text
        AND is_superadmin = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_platform_superadmin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_superadmin() TO authenticated, service_role;

-- 2. Tabla: Comunicados globales de plataforma (platform_broadcasts)
CREATE TABLE IF NOT EXISTS public.platform_broadcasts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'success')),
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_broadcasts
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_platform_broadcasts_active_created
  ON public.platform_broadcasts (active, created_at DESC);

ALTER TABLE public.platform_broadcasts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_broadcasts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_broadcasts TO authenticated;

DROP POLICY IF EXISTS "rls_platform_broadcasts_select" ON public.platform_broadcasts;
DROP POLICY IF EXISTS "rls_platform_broadcasts_insert" ON public.platform_broadcasts;
DROP POLICY IF EXISTS "rls_platform_broadcasts_update" ON public.platform_broadcasts;
DROP POLICY IF EXISTS "rls_platform_broadcasts_delete" ON public.platform_broadcasts;

CREATE POLICY "rls_platform_broadcasts_select"
ON public.platform_broadcasts FOR SELECT
TO authenticated
USING (
  (active = true AND (expires_at IS NULL OR expires_at > now()))
  OR (SELECT public.is_platform_superadmin())
);

CREATE POLICY "rls_platform_broadcasts_insert"
ON public.platform_broadcasts FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.is_platform_superadmin()));

CREATE POLICY "rls_platform_broadcasts_update"
ON public.platform_broadcasts FOR UPDATE
TO authenticated
USING ((SELECT public.is_platform_superadmin()))
WITH CHECK ((SELECT public.is_platform_superadmin()));

CREATE POLICY "rls_platform_broadcasts_delete"
ON public.platform_broadcasts FOR DELETE
TO authenticated
USING ((SELECT public.is_platform_superadmin()));

-- 3. Tabla: Bitácora de auditoría administrativa (admin_audit_logs)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_audit_logs FROM anon;
GRANT SELECT, INSERT ON TABLE public.admin_audit_logs TO authenticated;

DROP POLICY IF EXISTS "rls_admin_audit_logs_select" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "rls_admin_audit_logs_insert" ON public.admin_audit_logs;

CREATE POLICY "rls_admin_audit_logs_select"
ON public.admin_audit_logs FOR SELECT
TO authenticated
USING ((SELECT public.is_platform_superadmin()));

CREATE POLICY "rls_admin_audit_logs_insert"
ON public.admin_audit_logs FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.is_platform_superadmin()));

-- 4. Índice de rendimiento en sat_download_requests para salud operativa SAT
CREATE INDEX IF NOT EXISTS idx_sat_download_requests_created_at
  ON public.sat_download_requests (created_at DESC);

-- 5. Política RLS UPDATE en user_profiles para SuperAdmin de plataforma
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    DROP POLICY IF EXISTS "rls_user_profiles_superadmin_update" ON public.user_profiles;
    CREATE POLICY "rls_user_profiles_superadmin_update"
    ON public.user_profiles FOR UPDATE
    TO authenticated
    USING ((SELECT public.is_platform_superadmin()))
    WITH CHECK ((SELECT public.is_platform_superadmin()));
  END IF;
END $$;

-- 6. Actualizar delete_company_cascade preservando control B2B SOCIO + SuperAdmin/service_role
CREATE OR REPLACE FUNCTION public.delete_company_cascade(company_id_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    (SELECT auth.role()) = 'service_role'
    OR public.is_platform_superadmin()
    OR public.user_has_company_access(company_id_param, 'SOCIO')
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Solo el propietario, Socio del despacho o SuperAdmin puede eliminar esta empresa';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'poliza_pedimentos') THEN
    DELETE FROM public.poliza_pedimentos
    WHERE poliza_id IN (SELECT id FROM public.polizas WHERE company_id = company_id_param);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bank_statement_matches') THEN
    DELETE FROM public.bank_statement_matches WHERE company_id = company_id_param;
  END IF;

  DELETE FROM public.poliza_movements
  WHERE poliza_id IN (
    SELECT id FROM public.polizas WHERE company_id = company_id_param
  );

  DELETE FROM public.polizas WHERE company_id = company_id_param;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cfdi_documents') THEN
    DELETE FROM public.cfdi_documents WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cfdis') THEN
    EXECUTE 'DELETE FROM public.cfdis WHERE company_id = $1' USING company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bank_statement_lines') THEN
    DELETE FROM public.bank_statement_lines WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fixed_assets') THEN
    DELETE FROM public.fixed_assets WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'third_parties') THEN
    DELETE FROM public.third_parties WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'accounting_rules') THEN
    DELETE FROM public.accounting_rules WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'period_locks') THEN
    DELETE FROM public.period_locks WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tax_parameters_history') THEN
    DELETE FROM public.tax_parameters_history WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tax_parameters') THEN
    DELETE FROM public.tax_parameters WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fiel_credentials') THEN
    DELETE FROM public.fiel_credentials WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sat_download_requests') THEN
    DELETE FROM public.sat_download_requests WHERE company_id = company_id_param;
  END IF;

  DELETE FROM public.accounts WHERE company_id = company_id_param;
  DELETE FROM public.companies WHERE id = company_id_param;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_company_cascade(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_company_cascade(TEXT) TO authenticated, service_role;

-- 7. RPC: Resumen ejecutivo de plataforma para SuperAdmin
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
  IF NOT public.is_platform_superadmin() THEN
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

-- 8. RPC: Salud operativa SAT y e.firmas por vencer (sin exponer llaves privadas)
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
  IF NOT public.is_platform_superadmin() THEN
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

  -- Solo metadatos públicos de fiel_credentials (nunca key_base64 ni private_key_pem)
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

-- 9. RPC: Detalle profundo de una empresa para inspección SuperAdmin
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
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_comp
  FROM public.companies
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_comp.user_id IS NOT NULL AND v_comp.user_id <> 'demo' THEN
    SELECT id, email, full_name, provider, is_superadmin
    INTO v_profile
    FROM public.user_profiles
    WHERE id = v_comp.user_id;
  END IF;

  -- Solo metadatos públicos de fiel_credentials
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
