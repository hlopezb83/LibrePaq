-- ============================================================================
-- LIBREPAQ PRO — SUPERADMIN AUDIT WAVE 2 BUGFIXES
-- (SUSPENDED ROLE BLOCK, PAGINATION CLAMP & QUERY OPT, FIEL CEIL & TITLE)
-- 100% IDEMPOTENTE
-- ============================================================================

-- 1. Bug #2: Bloquear acceso de plataforma cuando el usuario está SUSPENDIDO
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
          WHEN upper(coalesce(status, 'ACTIVO')) = 'SUSPENDIDO' THEN 'NONE'
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

REVOKE ALL ON FUNCTION public.get_platform_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_role() TO authenticated, service_role;

-- 2. Bugs #8 & #13: Clamp v_page <= v_total_pages + optimizar LATERAL en admin_list_companies_paginated
CREATE OR REPLACE FUNCTION public.admin_list_companies_paginated(
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20,
  p_search TEXT DEFAULT '',
  p_owner_type TEXT DEFAULT 'ALL',
  p_fiel_filter TEXT DEFAULT 'ALL',
  p_sort_by TEXT DEFAULT 'created_at',
  p_sort_dir TEXT DEFAULT 'desc'
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
  v_raw_search TEXT := lower(trim(coalesce(p_search, '')));
  v_search TEXT := public.escape_like_pattern(v_raw_search);
  v_owner_type TEXT := coalesce(nullif(trim(p_owner_type), ''), 'ALL');
  v_fiel_filter TEXT := upper(coalesce(nullif(trim(p_fiel_filter), ''), 'ALL'));
  v_sort_by TEXT := CASE
    WHEN lower(trim(coalesce(p_sort_by, ''))) IN ('polizascount', 'polizas_count') THEN 'polizasCount'
    WHEN lower(trim(coalesce(p_sort_by, ''))) IN ('cfdiscount', 'cfdis_count') THEN 'cfdisCount'
    ELSE 'created_at'
  END;
  v_sort_dir TEXT := CASE
    WHEN lower(trim(coalesce(p_sort_dir, ''))) = 'asc' THEN 'asc'
    ELSE 'desc'
  END;
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
      up.workspace_id AS user_workspace_id,
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
      v_raw_search = ''
      OR lower(coalesce(b.name, '')) LIKE '%' || v_search || '%' ESCAPE '\'
      OR lower(coalesce(b.rfc, '')) LIKE '%' || v_search || '%' ESCAPE '\'
      OR lower(coalesce(b.user_email, '')) LIKE '%' || v_search || '%' ESCAPE '\'
      OR lower(coalesce(b.user_full_name, '')) LIKE '%' || v_search || '%' ESCAPE '\'
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
  v_page := LEAST(v_page, v_total_pages);

  IF v_sort_by = 'created_at' THEN
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
        up.workspace_id AS user_workspace_id,
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
        v_raw_search = ''
        OR lower(coalesce(b.name, '')) LIKE '%' || v_search || '%' ESCAPE '\'
        OR lower(coalesce(b.rfc, '')) LIKE '%' || v_search || '%' ESCAPE '\'
        OR lower(coalesce(b.user_email, '')) LIKE '%' || v_search || '%' ESCAPE '\'
        OR lower(coalesce(b.user_full_name, '')) LIKE '%' || v_search || '%' ESCAPE '\'
      )
        AND (upper(v_owner_type) = 'ALL' OR b.owner_type = lower(v_owner_type))
        AND (
          v_fiel_filter = 'ALL'
          OR (v_fiel_filter = 'WITH_FIEL' AND b.has_fiel = true)
          OR (v_fiel_filter = 'WITHOUT_FIEL' AND b.has_fiel = false)
        )
    ),
    paged AS (
      SELECT *
      FROM filtered f
      ORDER BY
        CASE WHEN v_sort_dir = 'asc' THEN f.created_at END ASC NULLS LAST,
        CASE WHEN v_sort_dir = 'desc' THEN f.created_at END DESC NULLS LAST,
        f.created_at DESC,
        f.id ASC
      LIMIT v_page_size
      OFFSET (v_page - 1) * v_page_size
    ),
    enriched AS (
      SELECT
        p.*,
        coalesce(po.cnt, 0) AS polizas_count,
        coalesce(cd.cnt, 0) AS cfdis_count
      FROM paged p
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS cnt FROM public.polizas po WHERE po.company_id = p.id
      ) po ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS cnt FROM public.cfdi_documents cd WHERE cd.company_id = p.id
      ) cd ON true
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
          'userWorkspaceId', p.user_workspace_id,
          'userProvider', p.user_provider,
          'userIsSuperAdmin', p.user_is_superadmin,
          'ownerType', p.owner_type,
          'createdAt', to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'polizasCount', p.polizas_count,
          'cfdisCount', p.cfdis_count,
          'hasFiel', p.has_fiel,
          'fielValidTo', p.fiel_valid_to
        )
        ORDER BY
          CASE WHEN v_sort_dir = 'asc' THEN p.created_at END ASC NULLS LAST,
          CASE WHEN v_sort_dir = 'desc' THEN p.created_at END DESC NULLS LAST,
          p.created_at DESC,
          p.id ASC
      ),
      '[]'::jsonb
    )
    INTO v_items
    FROM enriched p;
  ELSE
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
        up.workspace_id AS user_workspace_id,
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
        v_raw_search = ''
        OR lower(coalesce(b.name, '')) LIKE '%' || v_search || '%' ESCAPE '\'
        OR lower(coalesce(b.rfc, '')) LIKE '%' || v_search || '%' ESCAPE '\'
        OR lower(coalesce(b.user_email, '')) LIKE '%' || v_search || '%' ESCAPE '\'
        OR lower(coalesce(b.user_full_name, '')) LIKE '%' || v_search || '%' ESCAPE '\'
      )
        AND (upper(v_owner_type) = 'ALL' OR b.owner_type = lower(v_owner_type))
        AND (
          v_fiel_filter = 'ALL'
          OR (v_fiel_filter = 'WITH_FIEL' AND b.has_fiel = true)
          OR (v_fiel_filter = 'WITHOUT_FIEL' AND b.has_fiel = false)
        )
    ),
    polizas_counts AS (
      SELECT company_id, count(*)::int AS cnt
      FROM public.polizas
      GROUP BY company_id
    ),
    cfdis_counts AS (
      SELECT company_id, count(*)::int AS cnt
      FROM public.cfdi_documents
      GROUP BY company_id
    ),
    enriched AS (
      SELECT
        f.*,
        coalesce(po.cnt, 0) AS polizas_count,
        coalesce(cd.cnt, 0) AS cfdis_count
      FROM filtered f
      LEFT JOIN polizas_counts po ON po.company_id = f.id
      LEFT JOIN cfdis_counts cd ON cd.company_id = f.id
    ),
    paged AS (
      SELECT *
      FROM enriched e
      ORDER BY
        CASE WHEN v_sort_by = 'polizasCount' AND v_sort_dir = 'asc' THEN e.polizas_count END ASC NULLS LAST,
        CASE WHEN v_sort_by = 'polizasCount' AND v_sort_dir = 'desc' THEN e.polizas_count END DESC NULLS LAST,
        CASE WHEN v_sort_by = 'cfdisCount' AND v_sort_dir = 'asc' THEN e.cfdis_count END ASC NULLS LAST,
        CASE WHEN v_sort_by = 'cfdisCount' AND v_sort_dir = 'desc' THEN e.cfdis_count END DESC NULLS LAST,
        e.created_at DESC,
        e.id ASC
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
          'userWorkspaceId', p.user_workspace_id,
          'userProvider', p.user_provider,
          'userIsSuperAdmin', p.user_is_superadmin,
          'ownerType', p.owner_type,
          'createdAt', to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'polizasCount', p.polizas_count,
          'cfdisCount', p.cfdis_count,
          'hasFiel', p.has_fiel,
          'fielValidTo', p.fiel_valid_to
        )
        ORDER BY
          CASE WHEN v_sort_by = 'polizasCount' AND v_sort_dir = 'asc' THEN p.polizas_count END ASC NULLS LAST,
          CASE WHEN v_sort_by = 'polizasCount' AND v_sort_dir = 'desc' THEN p.polizas_count END DESC NULLS LAST,
          CASE WHEN v_sort_by = 'cfdisCount' AND v_sort_dir = 'asc' THEN p.cfdis_count END ASC NULLS LAST,
          CASE WHEN v_sort_by = 'cfdisCount' AND v_sort_dir = 'desc' THEN p.cfdis_count END DESC NULLS LAST,
          p.created_at DESC,
          p.id ASC
      ),
      '[]'::jsonb
    )
    INTO v_items
    FROM paged p;
  END IF;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'pageSize', v_page_size,
    'totalPages', v_total_pages
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_companies_paginated(INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_companies_paginated(INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 3. Bug #13: Clamp v_page <= v_total_pages en admin_list_users_paginated
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
  v_raw_search TEXT := lower(trim(coalesce(p_search, '')));
  v_search TEXT := public.escape_like_pattern(v_raw_search);
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
      v_raw_search = ''
      OR lower(b.email) LIKE '%' || v_search || '%' ESCAPE '\'
      OR lower(b.full_name) LIKE '%' || v_search || '%' ESCAPE '\'
      OR lower(coalesce(b.workspace_name, '')) LIKE '%' || v_search || '%' ESCAPE '\'
      OR lower(coalesce(b.workspace_id, '')) LIKE '%' || v_search || '%' ESCAPE '\'
    )
      AND (v_status = 'ALL' OR b.effective_status = v_status)
      AND (v_role = 'ALL' OR b.effective_role = v_role)
  )
  SELECT count(*)::int INTO v_total FROM filtered;

  v_total_pages := GREATEST(ceil(v_total::numeric / v_page_size)::int, 1);
  v_page := LEAST(v_page, v_total_pages);

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
      v_raw_search = ''
      OR lower(b.email) LIKE '%' || v_search || '%' ESCAPE '\'
      OR lower(b.full_name) LIKE '%' || v_search || '%' ESCAPE '\'
      OR lower(coalesce(b.workspace_name, '')) LIKE '%' || v_search || '%' ESCAPE '\'
      OR lower(coalesce(b.workspace_id, '')) LIKE '%' || v_search || '%' ESCAPE '\'
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

-- 4. Bug #13: Clamp v_page <= v_total_pages en admin_list_audit_logs_paginated
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
  v_raw_search TEXT := lower(trim(coalesce(p_search, '')));
  v_search TEXT := public.escape_like_pattern(v_raw_search);
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
    v_raw_search = ''
    OR lower(coalesce(l.actor_email, '')) LIKE '%' || v_search || '%' ESCAPE '\'
    OR lower(coalesce(l.action, '')) LIKE '%' || v_search || '%' ESCAPE '\'
    OR lower(coalesce(l.target_type, '')) LIKE '%' || v_search || '%' ESCAPE '\'
    OR lower(coalesce(l.target_id, '')) LIKE '%' || v_search || '%' ESCAPE '\'
  )
    AND (v_action = '' OR v_action = 'ALL' OR upper(coalesce(l.action, '')) = v_action)
    AND (v_target_type = '' OR v_target_type = 'all' OR lower(coalesce(l.target_type, '')) = v_target_type);

  v_total_pages := GREATEST(ceil(v_total::numeric / v_page_size)::int, 1);
  v_page := LEAST(v_page, v_total_pages);

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
      v_raw_search = ''
      OR lower(coalesce(l.actor_email, '')) LIKE '%' || v_search || '%' ESCAPE '\'
      OR lower(coalesce(l.action, '')) LIKE '%' || v_search || '%' ESCAPE '\'
      OR lower(coalesce(l.target_type, '')) LIKE '%' || v_search || '%' ESCAPE '\'
      OR lower(coalesce(l.target_id, '')) LIKE '%' || v_search || '%' ESCAPE '\'
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

-- 5. Bug #11: admin_get_sat_health() con ceil() para daysRemaining
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
      WHERE upper(coalesce(estado_solicitud, '')) NOT IN ('TERMINADA', 'COMPLETADA', 'ACEPTADA', 'EN_PROCESO', 'SOLICITADA')
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

  -- Solo metadatos públicos de fiel_credentials (parseo seguro con try_timestamptz)
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'companyId', f.company_id,
        'companyName', coalesce(c.name, 'Empresa'),
        'companyRfc', coalesce(c.rfc, ''),
        'rfcTitular', f.rfc_titular,
        'numeroSerie', f.numero_serie,
        'validTo', f.valid_to,
        'daysRemaining', ceil(extract(epoch FROM (public.try_timestamptz(f.valid_to) - now())) / 86400)::int
      )
      ORDER BY public.try_timestamptz(f.valid_to) ASC
    ),
    '[]'::jsonb
  )
  INTO v_expiring_fiels
  FROM public.fiel_credentials f
  LEFT JOIN public.companies c ON c.id = f.company_id
  WHERE public.try_timestamptz(f.valid_to) IS NOT NULL
    AND public.try_timestamptz(f.valid_to) <= now() + interval '90 days';

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

-- 6. Bug #11: admin_run_health_scan() con ceil() y título diferenciado para e.firma vencida
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

  -- A) e.firmas vencidas o por vencer en <= 30 días (usando try_timestamptz + ceil)
  INSERT INTO _detected_alerts (code, severity, category, title, message, target_type, target_id, metadata)
  SELECT
    CASE
      WHEN f_calc.days_remaining < 0 THEN 'FIEL_EXPIRED'
      ELSE 'FIEL_EXPIRY_SOON'
    END,
    CASE
      WHEN f_calc.days_remaining <= 7 THEN 'critical'
      ELSE 'warning'
    END,
    'fiel_expiry',
    CASE
      WHEN f_calc.days_remaining < 0 THEN 'e.firma vencida (' || coalesce(f_calc.company_rfc, f_calc.rfc_titular) || ')'
      ELSE 'e.firma próxima a vencer (' || coalesce(f_calc.company_rfc, f_calc.rfc_titular) || ')'
    END,
    CASE
      WHEN f_calc.days_remaining < 0
        THEN 'La e.firma de ' || coalesce(f_calc.company_name, f_calc.rfc_titular) || ' venció hace ' || abs(f_calc.days_remaining) || ' días.'
      ELSE 'La e.firma de ' || coalesce(f_calc.company_name, f_calc.rfc_titular) || ' vence en ' || f_calc.days_remaining || ' días.'
    END,
    'company',
    f_calc.company_id,
    jsonb_build_object(
      'companyName', coalesce(f_calc.company_name, 'Empresa'),
      'rfc', coalesce(f_calc.company_rfc, f_calc.rfc_titular),
      'validTo', f_calc.valid_to,
      'daysRemaining', f_calc.days_remaining
    )
  FROM (
    SELECT
      f.company_id,
      f.rfc_titular,
      f.valid_to,
      c.name AS company_name,
      c.rfc AS company_rfc,
      ceil(extract(epoch FROM (public.try_timestamptz(f.valid_to) - now())) / 86400)::int AS days_remaining
    FROM public.fiel_credentials f
    LEFT JOIN public.companies c ON c.id = f.company_id
    WHERE public.try_timestamptz(f.valid_to) IS NOT NULL
      AND public.try_timestamptz(f.valid_to) <= now() + interval '30 days'
  ) f_calc;

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

  -- C) Cuotas de workspace alcanzadas o excedidas (>= max_companies con max_companies > 0)
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
  WHERE wq.max_companies > 0
    AND q_usage.companies_used >= wq.max_companies;

  -- Deduplicar / insertar nuevas alertas abiertas (preservando detected_at original en existentes)
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
          metadata = r.metadata
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
