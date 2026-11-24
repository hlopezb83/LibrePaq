-- ============================================================================
-- LIBREPAQ PRO — RONDA 4: BLINDAJE CLOUD, PARIDAD PYME Y TRANSACCIONALIDAD
-- Corrige: P0-9, P0-14, P0-19, P0-20, P0-22 + persistencia ISN/SUA
-- 100% IDEMPOTENTE | RLS ADITIVO (AS PERMISSIVE)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. P0-19: Permitir UPDATE en public.companies a SOCIO y CONTADOR del despacho
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies')
     AND to_regprocedure('public.has_company_role(text, text)') IS NOT NULL THEN
    DROP POLICY IF EXISTS "rls_companies_update_team" ON public.companies;
    CREATE POLICY "rls_companies_update_team"
      ON public.companies AS PERMISSIVE FOR UPDATE TO authenticated
      USING (public.has_company_role(id, 'CONTADOR'))
      WITH CHECK (public.has_company_role(id, 'CONTADOR'));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. P0-9: tax_parameters por (company_id, ejercicio, periodo) y defaults en 0
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  pk_name TEXT;
  has_periodo BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tax_parameters') THEN
    ALTER TABLE public.tax_parameters
      ADD COLUMN IF NOT EXISTS periodo INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE public.tax_parameters
      ALTER COLUMN coeficiente_utilidad SET DEFAULT 0,
      ALTER COLUMN perdidas_fiscales_pendientes SET DEFAULT 0,
      ALTER COLUMN pagos_provisionales_anteriores SET DEFAULT 0,
      ALTER COLUMN saldo_favor_iva_anterior SET DEFAULT 0,
      ALTER COLUMN tipo_cambio_dof_cierre SET DEFAULT 0;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tax_parameters' AND column_name = 'periodo'
    ) INTO has_periodo;

    IF has_periodo THEN
      SELECT conname INTO pk_name
      FROM pg_constraint
      WHERE conrelid = 'public.tax_parameters'::regclass
        AND contype = 'p'
      LIMIT 1;

      -- Recrear PK solo si la PK actual es de 2 columnas (company_id, ejercicio)
      IF pk_name IS NOT NULL AND (
        SELECT array_length(conkey, 1)
        FROM pg_constraint
        WHERE conrelid = 'public.tax_parameters'::regclass AND conname = pk_name
      ) < 3 THEN
        EXECUTE format('ALTER TABLE public.tax_parameters DROP CONSTRAINT %I', pk_name);
        ALTER TABLE public.tax_parameters ADD PRIMARY KEY (company_id, ejercicio, periodo);
      ELSIF pk_name IS NULL THEN
        ALTER TABLE public.tax_parameters ADD PRIMARY KEY (company_id, ejercicio, periodo);
      END IF;
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. P0-14: Tabla poliza_cfdis (relación 1:N Póliza <-> CFDIs) + backfill
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poliza_cfdis (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  poliza_id TEXT NOT NULL REFERENCES public.polizas(id) ON DELETE CASCADE,
  cfdi_uuid TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_poliza_cfdis_pair
  ON public.poliza_cfdis (poliza_id, cfdi_uuid);

CREATE INDEX IF NOT EXISTS idx_poliza_cfdis_company_uuid
  ON public.poliza_cfdis (company_id, cfdi_uuid);

CREATE INDEX IF NOT EXISTS idx_poliza_movements_cfdi_uuid
  ON public.poliza_movements (cfdi_uuid)
  WHERE cfdi_uuid IS NOT NULL;

INSERT INTO public.poliza_cfdis (id, company_id, poliza_id, cfdi_uuid)
SELECT
  'pc_' || substr(md5(p.id || ':' || upper(p.cfdi_uuid)), 1, 20),
  p.company_id,
  p.id,
  upper(trim(p.cfdi_uuid))
FROM public.polizas p
WHERE p.cfdi_uuid IS NOT NULL
  AND trim(p.cfdi_uuid) <> ''
ON CONFLICT (poliza_id, cfdi_uuid) DO NOTHING;

ALTER TABLE public.poliza_cfdis ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.poliza_cfdis FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.poliza_cfdis TO authenticated;
GRANT ALL ON TABLE public.poliza_cfdis TO service_role;

DO $$ BEGIN
  IF to_regprocedure('public.has_company_role(text, text)') IS NOT NULL THEN
    DROP POLICY IF EXISTS "rls_poliza_cfdis_member_select" ON public.poliza_cfdis;
    CREATE POLICY "rls_poliza_cfdis_member_select"
      ON public.poliza_cfdis AS PERMISSIVE FOR SELECT TO authenticated
      USING (public.has_company_role(company_id, 'CLIENTE_LECTURA'));

    DROP POLICY IF EXISTS "rls_poliza_cfdis_member_write" ON public.poliza_cfdis;
    CREATE POLICY "rls_poliza_cfdis_member_write"
      ON public.poliza_cfdis AS PERMISSIVE FOR ALL TO authenticated
      USING (public.has_company_role(company_id, 'AUXILIAR'))
      WITH CHECK (public.has_company_role(company_id, 'AUXILIAR'));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Persistencia de Nómina / ISN / SUA por empresa y periodo
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_period_settings (
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ejercicio INTEGER NOT NULL,
  periodo INTEGER NOT NULL,
  state_code TEXT NOT NULL DEFAULT 'CMX',
  isn_rate NUMERIC(6, 3) NOT NULL DEFAULT 4.0,
  imss_patronal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  rcv NUMERIC(14, 2) NOT NULL DEFAULT 0,
  infonavit NUMERIC(14, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, ejercicio, periodo)
);

ALTER TABLE public.payroll_period_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payroll_period_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payroll_period_settings TO authenticated;
GRANT ALL ON TABLE public.payroll_period_settings TO service_role;

DO $$ BEGIN
  IF to_regprocedure('public.has_company_role(text, text)') IS NOT NULL THEN
    DROP POLICY IF EXISTS "rls_payroll_period_settings_select" ON public.payroll_period_settings;
    CREATE POLICY "rls_payroll_period_settings_select"
      ON public.payroll_period_settings AS PERMISSIVE FOR SELECT TO authenticated
      USING (public.has_company_role(company_id, 'CLIENTE_LECTURA'));

    DROP POLICY IF EXISTS "rls_payroll_period_settings_write" ON public.payroll_period_settings;
    CREATE POLICY "rls_payroll_period_settings_write"
      ON public.payroll_period_settings AS PERMISSIVE FOR ALL TO authenticated
      USING (public.has_company_role(company_id, 'AUXILIAR'))
      WITH CHECK (public.has_company_role(company_id, 'AUXILIAR'));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. P0-20: Enforcement server-side de period_locks en PostgreSQL
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_period_locked(
  p_company_id TEXT,
  p_ejercicio INTEGER,
  p_periodo INTEGER
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.period_locks pl
    WHERE pl.company_id = p_company_id
      AND pl.ejercicio = p_ejercicio
      AND pl.periodo = p_periodo
      AND pl.is_locked IS TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_period_locked(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_period_locked(TEXT, INTEGER, INTEGER) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := coalesce((SELECT auth.role()), '');
  v_bypass TEXT := coalesce(current_setting('librepaq.bypass_period_lock', true), '');
  v_company_id TEXT;
  v_ejercicio INTEGER;
  v_periodo INTEGER;
BEGIN
  IF v_role = 'service_role' OR v_bypass = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'polizas' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') AND public.is_period_locked(OLD.company_id, OLD.ejercicio, OLD.periodo) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios.', OLD.periodo, OLD.ejercicio;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND public.is_period_locked(NEW.company_id, NEW.ejercicio, NEW.periodo) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios.', NEW.periodo, NEW.ejercicio;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'poliza_movements' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      SELECT p.company_id, p.ejercicio, p.periodo
      INTO v_company_id, v_ejercicio, v_periodo
      FROM public.polizas p
      WHERE p.id = OLD.poliza_id
      LIMIT 1;
      IF v_company_id IS NOT NULL AND public.is_period_locked(v_company_id, v_ejercicio, v_periodo) THEN
        RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en movimientos.', v_periodo, v_ejercicio;
      END IF;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      SELECT p.company_id, p.ejercicio, p.periodo
      INTO v_company_id, v_ejercicio, v_periodo
      FROM public.polizas p
      WHERE p.id = NEW.poliza_id
      LIMIT 1;
      IF v_company_id IS NOT NULL AND public.is_period_locked(v_company_id, v_ejercicio, v_periodo) THEN
        RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en movimientos.', v_periodo, v_ejercicio;
      END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'inventory_periods' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') AND public.is_period_locked(OLD.company_id, OLD.ejercicio, OLD.periodo) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en inventarios.', OLD.periodo, OLD.ejercicio;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND public.is_period_locked(NEW.company_id, NEW.ejercicio, NEW.periodo) THEN
      RAISE EXCEPTION 'PERIOD_LOCKED: El periodo %/% está cerrado ante el SAT y no permite cambios en inventarios.', NEW.periodo, NEW.ejercicio;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_period_lock() FROM PUBLIC, anon;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'polizas') THEN
    DROP TRIGGER IF EXISTS trg_enforce_period_lock_polizas ON public.polizas;
    CREATE TRIGGER trg_enforce_period_lock_polizas
      BEFORE INSERT OR UPDATE OR DELETE ON public.polizas
      FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'poliza_movements') THEN
    DROP TRIGGER IF EXISTS trg_enforce_period_lock_movements ON public.poliza_movements;
    CREATE TRIGGER trg_enforce_period_lock_movements
      BEFORE INSERT OR UPDATE OR DELETE ON public.poliza_movements
      FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_periods') THEN
    DROP TRIGGER IF EXISTS trg_enforce_period_lock_inventory ON public.inventory_periods;
    CREATE TRIGGER trg_enforce_period_lock_inventory
      BEFORE INSERT OR UPDATE OR DELETE ON public.inventory_periods
      FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. P0-22: Restauración de respaldos ATÓMICA (transaccional) en Cloud
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_company_backup_atomic(p_payload JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := (SELECT auth.uid())::text;
  v_role TEXT := coalesce((SELECT auth.role()), '');
  v_comp JSONB := coalesce(p_payload -> 'company', '{}'::jsonb);
  v_company_id TEXT := trim(coalesce(v_comp ->> 'id', ''));
  v_rfc TEXT := upper(trim(coalesce(v_comp ->> 'rfc', '')));
  v_exists BOOLEAN := FALSE;
  v_owner_id TEXT;
BEGIN
  IF v_company_id = '' OR v_rfc = '' THEN
    RAISE EXCEPTION 'INVALID_BACKUP_BUNDLE: El respaldo carece de id o rfc de empresa.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = v_company_id) INTO v_exists;

  IF v_exists THEN
    IF NOT (
      v_role = 'service_role'
      OR public.is_platform_superadmin()
      OR public.has_company_role(v_company_id, 'SOCIO')
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Solo el propietario o Socio puede restaurar esta empresa.';
    END IF;
    SELECT user_id INTO v_owner_id FROM public.companies WHERE id = v_company_id;
  ELSE
    IF v_role <> 'service_role' AND v_uid IS NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Debes iniciar sesión para restaurar una empresa.';
    END IF;
    v_owner_id := coalesce(nullif(trim(v_comp ->> 'userId'), ''), v_uid);
    IF v_role <> 'service_role' AND NOT public.is_platform_superadmin() AND v_owner_id <> v_uid THEN
      v_owner_id := v_uid;
    END IF;
  END IF;

  PERFORM set_config('librepaq.bypass_period_lock', 'true', true);

  INSERT INTO public.companies (
    id, name, rfc, regimen_fiscal, codigo_postal, mask_format,
    current_year, current_period, created_at, user_id
  )
  VALUES (
    v_company_id,
    coalesce(nullif(v_comp ->> 'name', ''), 'Empresa Restaurada'),
    v_rfc,
    coalesce(nullif(v_comp ->> 'regimenFiscal', ''), '601 - General de Ley Personas Morales'),
    coalesce(nullif(v_comp ->> 'codigoPostal', ''), '06600'),
    coalesce(nullif(v_comp ->> 'maskFormat', ''), 'XXX-XX-XXX'),
    coalesce((v_comp ->> 'currentYear')::integer, 2026),
    coalesce((v_comp ->> 'currentPeriod')::integer, 1),
    coalesce(nullif(v_comp ->> 'createdAt', '')::timestamptz, now()),
    v_owner_id
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    rfc = EXCLUDED.rfc,
    regimen_fiscal = EXCLUDED.regimen_fiscal,
    codigo_postal = EXCLUDED.codigo_postal,
    mask_format = EXCLUDED.mask_format,
    current_year = EXCLUDED.current_year,
    current_period = EXCLUDED.current_period;

  -- Limpieza ordenada por llaves foráneas dentro de la misma transacción
  DELETE FROM public.bank_statement_matches WHERE company_id = v_company_id;
  DELETE FROM public.poliza_cfdis WHERE company_id = v_company_id;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'poliza_pedimentos') THEN
    DELETE FROM public.poliza_pedimentos WHERE poliza_id IN (SELECT id FROM public.polizas WHERE company_id = v_company_id);
  END IF;
  DELETE FROM public.poliza_movements WHERE poliza_id IN (SELECT id FROM public.polizas WHERE company_id = v_company_id);
  DELETE FROM public.polizas WHERE company_id = v_company_id;
  DELETE FROM public.bank_statement_lines WHERE company_id = v_company_id;
  DELETE FROM public.cfdi_documents WHERE company_id = v_company_id;
  DELETE FROM public.fixed_assets WHERE company_id = v_company_id;
  DELETE FROM public.third_parties WHERE company_id = v_company_id;
  DELETE FROM public.period_locks WHERE company_id = v_company_id;
  DELETE FROM public.tax_parameters WHERE company_id = v_company_id;
  DELETE FROM public.accounting_rules WHERE company_id = v_company_id;
  DELETE FROM public.annual_tax_snapshots WHERE company_id = v_company_id;
  DELETE FROM public.inventory_periods WHERE company_id = v_company_id;
  DELETE FROM public.payroll_period_settings WHERE company_id = v_company_id;
  DELETE FROM public.accounts WHERE company_id = v_company_id;

  -- 1. Cuentas contables (preservando jerarquía completa)
  IF jsonb_typeof(p_payload -> 'accounts') = 'array' AND jsonb_array_length(p_payload -> 'accounts') > 0 THEN
    INSERT INTO public.accounts (
      id, company_id, code, name, parent_code, type, nature, level,
      is_affectable, sat_group_code, currency, initial_balance
    )
    SELECT
      coalesce(nullif(a ->> 'id', ''), 'acc_' || substr(md5(v_company_id || ':' || (a ->> 'code')), 1, 16)),
      v_company_id,
      a ->> 'code',
      coalesce(a ->> 'name', ''),
      nullif(a ->> 'parentCode', ''),
      coalesce(a ->> 'type', 'ACTIVO'),
      coalesce(a ->> 'nature', 'DEUDORA'),
      coalesce((a ->> 'level')::integer, 3),
      coalesce((a ->> 'isAffectable')::boolean, TRUE),
      coalesce(nullif(a ->> 'satGroupCode', ''), '100'),
      coalesce(nullif(a ->> 'currency', ''), 'MXN'),
      coalesce((a ->> 'initialBalance')::numeric, 0)
    FROM jsonb_array_elements(p_payload -> 'accounts') AS a
    ON CONFLICT (company_id, code) DO UPDATE SET
      name = EXCLUDED.name,
      parent_code = EXCLUDED.parent_code,
      type = EXCLUDED.type,
      nature = EXCLUDED.nature,
      level = EXCLUDED.level,
      is_affectable = EXCLUDED.is_affectable,
      sat_group_code = EXCLUDED.sat_group_code,
      currency = EXCLUDED.currency,
      initial_balance = EXCLUDED.initial_balance;
  END IF;

  -- 2. Parámetros fiscales
  IF jsonb_typeof(p_payload -> 'taxParameters') = 'array' AND jsonb_array_length(p_payload -> 'taxParameters') > 0 THEN
    INSERT INTO public.tax_parameters (
      company_id, ejercicio, periodo, coeficiente_utilidad,
      perdidas_fiscales_pendientes, pagos_provisionales_anteriores,
      saldo_favor_iva_anterior, tipo_cambio_dof_cierre
    )
    SELECT
      v_company_id,
      coalesce((tp ->> 'ejercicio')::integer, coalesce((v_comp ->> 'currentYear')::integer, 2026)),
      coalesce((tp ->> 'periodo')::integer, 0),
      coalesce((tp ->> 'coeficienteUtilidad')::numeric, 0),
      coalesce((tp ->> 'perdidasFiscalesPendientes')::numeric, 0),
      coalesce((tp ->> 'pagosProvisionalesAnteriores')::numeric, 0),
      coalesce((tp ->> 'saldoFavorIvaAnterior')::numeric, 0),
      coalesce((tp ->> 'tipoCambioDofCierre')::numeric, 0)
    FROM jsonb_array_elements(p_payload -> 'taxParameters') AS tp
    ON CONFLICT (company_id, ejercicio, periodo) DO UPDATE SET
      coeficiente_utilidad = EXCLUDED.coeficiente_utilidad,
      perdidas_fiscales_pendientes = EXCLUDED.perdidas_fiscales_pendientes,
      pagos_provisionales_anteriores = EXCLUDED.pagos_provisionales_anteriores,
      saldo_favor_iva_anterior = EXCLUDED.saldo_favor_iva_anterior,
      tipo_cambio_dof_cierre = EXCLUDED.tipo_cambio_dof_cierre;
  END IF;

  -- 3. Pólizas, movimientos y relación N:M poliza_cfdis
  IF jsonb_typeof(p_payload -> 'polizas') = 'array' AND jsonb_array_length(p_payload -> 'polizas') > 0 THEN
    INSERT INTO public.polizas (
      id, company_id, tipo, folio, fecha, ejercicio, periodo,
      concepto, cfdi_uuid, origin, created_at
    )
    SELECT
      p ->> 'id',
      v_company_id,
      p ->> 'tipo',
      (p ->> 'folio')::integer,
      (p ->> 'fecha')::timestamptz,
      (p ->> 'ejercicio')::integer,
      (p ->> 'periodo')::integer,
      coalesce(p ->> 'concepto', ''),
      nullif(p ->> 'cfdiUuid', ''),
      coalesce(nullif(p ->> 'origin', ''), 'MANUAL'),
      coalesce(nullif(p ->> 'createdAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'polizas') AS p;

    INSERT INTO public.poliza_movements (
      id, poliza_id, account_id, account_code, account_name,
      referencia, concepto, cargo, abono, cfdi_uuid
    )
    SELECT
      m ->> 'id',
      p ->> 'id',
      m ->> 'accountId',
      coalesce(m ->> 'accountCode', ''),
      coalesce(m ->> 'accountName', ''),
      coalesce(m ->> 'referencia', ''),
      coalesce(m ->> 'concepto', ''),
      coalesce((m ->> 'cargo')::numeric, 0),
      coalesce((m ->> 'abono')::numeric, 0),
      nullif(m ->> 'cfdiUuid', '')
    FROM jsonb_array_elements(p_payload -> 'polizas') AS p,
         jsonb_array_elements(coalesce(p -> 'movements', '[]'::jsonb)) AS m;

    INSERT INTO public.poliza_cfdis (id, company_id, poliza_id, cfdi_uuid)
    SELECT
      'pc_' || substr(md5((p ->> 'id') || ':' || upper(trim(u.val))), 1, 20),
      v_company_id,
      p ->> 'id',
      upper(trim(u.val))
    FROM jsonb_array_elements(p_payload -> 'polizas') AS p
    CROSS JOIN LATERAL (
      SELECT nullif(p ->> 'cfdiUuid', '') AS val
      UNION
      SELECT nullif(m ->> 'cfdiUuid', '') AS val
      FROM jsonb_array_elements(coalesce(p -> 'movements', '[]'::jsonb)) AS m
      UNION
      SELECT jsonb_array_elements_text(coalesce(p -> 'cfdiUuids', '[]'::jsonb)) AS val
    ) AS u
    WHERE u.val IS NOT NULL AND trim(u.val) <> ''
    ON CONFLICT (poliza_id, cfdi_uuid) DO NOTHING;
  END IF;

  -- 4. CFDIs
  IF jsonb_typeof(p_payload -> 'cfdis') = 'array' AND jsonb_array_length(p_payload -> 'cfdis') > 0 THEN
    INSERT INTO public.cfdi_documents (
      id, company_id, uuid, fecha, tipo_comprobante, direction, serie, folio,
      emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre, concepto_principal,
      clave_prod_serv, moneda, tipo_cambio, subtotal, descuento, iva_trasladado,
      isr_retenido, iva_retenido, total, metodo_pago, forma_pago, uso_cfdi,
      uuid_relacionado, status_sat, poliza_id, tax_breakdown, related_docs, xml_raw
    )
    SELECT
      c ->> 'id',
      v_company_id,
      c ->> 'uuid',
      (c ->> 'fecha')::timestamptz,
      c ->> 'tipoComprobante',
      c ->> 'direction',
      coalesce(c ->> 'serie', ''),
      coalesce(c ->> 'folio', ''),
      c ->> 'emisorRfc',
      c ->> 'emisorNombre',
      c ->> 'receptorRfc',
      c ->> 'receptorNombre',
      coalesce(c ->> 'conceptoPrincipal', ''),
      coalesce(nullif(c ->> 'claveProdServ', ''), '01010101'),
      coalesce(nullif(c ->> 'moneda', ''), 'MXN'),
      coalesce((c ->> 'tipoCambio')::numeric, 1),
      coalesce((c ->> 'subtotal')::numeric, 0),
      coalesce((c ->> 'descuento')::numeric, 0),
      coalesce((c ->> 'ivaTrasladado')::numeric, 0),
      coalesce((c ->> 'isrRetenido')::numeric, 0),
      coalesce((c ->> 'ivaRetenido')::numeric, 0),
      coalesce((c ->> 'total')::numeric, 0),
      coalesce(nullif(c ->> 'metodoPago', ''), 'PUE'),
      coalesce(nullif(c ->> 'formaPago', ''), '03'),
      coalesce(nullif(c ->> 'usoCfdi', ''), 'G03'),
      nullif(c ->> 'uuidRelacionado', ''),
      coalesce(nullif(c ->> 'statusSat', ''), 'VIGENTE'),
      nullif(c ->> 'polizaId', ''),
      c -> 'taxBreakdown',
      c -> 'relatedDocs',
      coalesce(c ->> 'xmlRaw', '')
    FROM jsonb_array_elements(p_payload -> 'cfdis') AS c;
  END IF;

  -- 5. Padrón de terceros
  IF jsonb_typeof(p_payload -> 'thirdParties') = 'array' AND jsonb_array_length(p_payload -> 'thirdParties') > 0 THEN
    INSERT INTO public.third_parties (
      id, company_id, rfc, nombre, rol, cuenta_operacion_code, cuenta_contrapartida_code,
      tipo_tercero_diot, tipo_operacion_diot, tasa_iva_default, deductible_pct, estatus_69b, updated_at
    )
    SELECT
      tp ->> 'id',
      v_company_id,
      tp ->> 'rfc',
      tp ->> 'nombre',
      coalesce(nullif(tp ->> 'rol', ''), 'PROVEEDOR'),
      coalesce(tp ->> 'cuentaOperacionCode', '601-01-001'),
      coalesce(tp ->> 'cuentaContrapartidaCode', '201-01-001'),
      coalesce(nullif(tp ->> 'tipoTerceroDiot', ''), '04'),
      coalesce(nullif(tp ->> 'tipoOperacionDiot', ''), '85'),
      coalesce((tp ->> 'tasaIvaDefault')::integer, 16),
      coalesce((tp ->> 'deductiblePct')::numeric, 100),
      coalesce(nullif(tp ->> 'estatus69b', ''), 'LIMPIO'),
      coalesce(nullif(tp ->> 'updatedAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'thirdParties') AS tp;
  END IF;

  -- 6. Activos fijos
  IF jsonb_typeof(p_payload -> 'fixedAssets') = 'array' AND jsonb_array_length(p_payload -> 'fixedAssets') > 0 THEN
    INSERT INTO public.fixed_assets (
      id, company_id, codigo, nombre, categoria, fecha_adquisicion, cfdi_uuid,
      monto_original_inversion, tasa_anual_pct, meses_depreciados_previos,
      inpc_adquisicion, inpc_medio_periodo, cuenta_activo_code,
      cuenta_dep_acum_code, cuenta_gasto_dep_code, estatus, created_at
    )
    SELECT
      fa ->> 'id',
      v_company_id,
      fa ->> 'codigo',
      fa ->> 'nombre',
      fa ->> 'categoria',
      (fa ->> 'fechaAdquisicion')::date,
      nullif(fa ->> 'cfdiUuid', ''),
      (fa ->> 'montoOriginalInversion')::numeric,
      (fa ->> 'tasaAnualPct')::numeric,
      coalesce((fa ->> 'mesesDepreciadosPrevios')::integer, 0),
      coalesce((fa ->> 'inpcAdquisicion')::numeric, 132.54),
      coalesce((fa ->> 'inpcMedioPeriodo')::numeric, 136.82),
      coalesce(nullif(fa ->> 'cuentaActivoCode', ''), '156-01-001'),
      coalesce(nullif(fa ->> 'cuentaDepAcumCode', ''), '171-01-001'),
      coalesce(nullif(fa ->> 'cuentaGastoDepCode', ''), '601-01-006'),
      coalesce(nullif(fa ->> 'estatus', ''), 'ACTIVO'),
      coalesce(nullif(fa ->> 'createdAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'fixedAssets') AS fa;
  END IF;

  -- 7. Candados, reglas contables, anual e inventarios
  IF jsonb_typeof(p_payload -> 'periodLocks') = 'array' AND jsonb_array_length(p_payload -> 'periodLocks') > 0 THEN
    INSERT INTO public.period_locks (company_id, ejercicio, periodo, is_locked, locked_at, notes)
    SELECT
      v_company_id,
      (pl ->> 'ejercicio')::integer,
      (pl ->> 'periodo')::integer,
      coalesce((pl ->> 'isLocked')::boolean, FALSE),
      nullif(pl ->> 'lockedAt', '')::timestamptz,
      coalesce(pl ->> 'notes', '')
    FROM jsonb_array_elements(p_payload -> 'periodLocks') AS pl;
  END IF;

  IF jsonb_typeof(p_payload -> 'accountingRules') = 'array' AND jsonb_array_length(p_payload -> 'accountingRules') > 0 THEN
    INSERT INTO public.accounting_rules (
      id, company_id, name, match_rfc, match_clave_prod_serv, match_uso_cfdi,
      direction, operation_account_code, counter_account_code, deductible_pct,
      priority, auto_learned, created_at, updated_at
    )
    SELECT
      r ->> 'id',
      v_company_id,
      coalesce(r ->> 'name', ''),
      nullif(r ->> 'matchRfc', ''),
      nullif(r ->> 'matchClaveProdServ', ''),
      nullif(r ->> 'matchUsoCfdi', ''),
      coalesce(nullif(r ->> 'direction', ''), 'RECIBIDO'),
      r ->> 'operationAccountCode',
      nullif(r ->> 'counterAccountCode', ''),
      coalesce((r ->> 'deductiblePct')::numeric, 100),
      coalesce((r ->> 'priority')::integer, 10),
      coalesce((r ->> 'autoLearned')::boolean, FALSE),
      coalesce(nullif(r ->> 'createdAt', '')::timestamptz, now()),
      coalesce(nullif(r ->> 'updatedAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'accountingRules') AS r;
  END IF;

  IF jsonb_typeof(p_payload -> 'annualTaxSnapshots') = 'array' AND jsonb_array_length(p_payload -> 'annualTaxSnapshots') > 0 THEN
    INSERT INTO public.annual_tax_snapshots (
      id, company_id, ejercicio, inpc_cierre_anterior, inpc_cierre_actual,
      cuca_inicial, aportaciones_capital, reducciones_capital, cufin_inicial,
      dividendos_pagados, ptu_pagada_anterior, no_deducibles_manual, updated_at
    )
    SELECT
      'ats_' || v_company_id || '_' || (s ->> 'ejercicio'),
      v_company_id,
      (s ->> 'ejercicio')::integer,
      coalesce((s ->> 'inpcCierreAnterior')::numeric, 139.38),
      coalesce((s ->> 'inpcCierreActual')::numeric, 145.4),
      coalesce((s ->> 'cucaInicial')::numeric, 0),
      coalesce((s ->> 'aportacionesCapital')::numeric, 0),
      coalesce((s ->> 'reduccionesCapital')::numeric, 0),
      coalesce((s ->> 'cufinInicial')::numeric, 0),
      coalesce((s ->> 'dividendosPagados')::numeric, 0),
      coalesce((s ->> 'ptuPagadaAnterior')::numeric, 0),
      coalesce((s ->> 'noDeduciblesManual')::numeric, 0),
      now()
    FROM jsonb_array_elements(p_payload -> 'annualTaxSnapshots') AS s;
  END IF;

  IF jsonb_typeof(p_payload -> 'inventoryPeriods') = 'array' AND jsonb_array_length(p_payload -> 'inventoryPeriods') > 0 THEN
    INSERT INTO public.inventory_periods (
      id, company_id, ejercicio, periodo, initial_inventory,
      purchases_override, final_inventory, method, poliza_id, updated_at
    )
    SELECT
      coalesce(nullif(ip ->> 'id', ''), 'inv_' || v_company_id || '_' || (ip ->> 'ejercicio') || '_' || (ip ->> 'periodo')),
      v_company_id,
      (ip ->> 'ejercicio')::integer,
      (ip ->> 'periodo')::integer,
      coalesce((ip ->> 'initialInventory')::numeric, 0),
      CASE WHEN ip ? 'purchasesOverride' AND ip ->> 'purchasesOverride' IS NOT NULL THEN (ip ->> 'purchasesOverride')::numeric ELSE NULL END,
      coalesce((ip ->> 'finalInventory')::numeric, 0),
      coalesce(nullif(ip ->> 'method', ''), 'ANALITICO'),
      nullif(ip ->> 'polizaId', ''),
      now()
    FROM jsonb_array_elements(p_payload -> 'inventoryPeriods') AS ip;
  END IF;

  -- 8. Bancos y conciliación N-a-1
  IF jsonb_typeof(p_payload -> 'bankStatementLines') = 'array' AND jsonb_array_length(p_payload -> 'bankStatementLines') > 0 THEN
    INSERT INTO public.bank_statement_lines (
      id, company_id, account_id, fecha, ejercicio, periodo,
      referencia, descripcion, cargo_banco, abono_banco, matched_movement_id
    )
    SELECT
      b ->> 'id',
      v_company_id,
      b ->> 'accountId',
      (b ->> 'fecha')::timestamptz,
      (b ->> 'ejercicio')::integer,
      (b ->> 'periodo')::integer,
      coalesce(b ->> 'referencia', ''),
      coalesce(b ->> 'descripcion', ''),
      coalesce((b ->> 'cargoBanco')::numeric, 0),
      coalesce((b ->> 'abonoBanco')::numeric, 0),
      nullif(b ->> 'matchedMovementId', '')
    FROM jsonb_array_elements(p_payload -> 'bankStatementLines') AS b;
  END IF;

  IF jsonb_typeof(p_payload -> 'bankStatementMatches') = 'array' AND jsonb_array_length(p_payload -> 'bankStatementMatches') > 0 THEN
    INSERT INTO public.bank_statement_matches (
      id, company_id, bank_line_id, movement_id, poliza_id, matched_amount, created_at
    )
    SELECT
      bm ->> 'id',
      v_company_id,
      bm ->> 'bankLineId',
      bm ->> 'movementId',
      coalesce(bm ->> 'polizaId', ''),
      coalesce((bm ->> 'matchedAmount')::numeric, 0),
      coalesce(nullif(bm ->> 'createdAt', '')::timestamptz, now())
    FROM jsonb_array_elements(p_payload -> 'bankStatementMatches') AS bm
    ON CONFLICT (bank_line_id, movement_id) DO NOTHING;
  END IF;

  RETURN v_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_company_backup_atomic(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_company_backup_atomic(JSONB) TO authenticated, service_role;

-- Actualizar delete_company_cascade para limpiar poliza_cfdis y payroll_period_settings
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
    OR public.has_company_role(company_id_param, 'SOCIO')
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Solo el propietario, Socio del despacho o SuperAdmin puede eliminar esta empresa';
  END IF;

  PERFORM set_config('librepaq.bypass_period_lock', 'true', true);

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'poliza_cfdis') THEN
    DELETE FROM public.poliza_cfdis WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payroll_period_settings') THEN
    DELETE FROM public.payroll_period_settings WHERE company_id = company_id_param;
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

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'annual_tax_snapshots') THEN
    DELETE FROM public.annual_tax_snapshots WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inventory_periods') THEN
    DELETE FROM public.inventory_periods WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_audit_logs') THEN
    DELETE FROM public.company_audit_logs WHERE company_id = company_id_param;
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

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'platform_alerts') THEN
    UPDATE public.platform_alerts
    SET status = 'resolved',
        resolved_at = now(),
        resolved_by = 'system_company_deleted'
    WHERE target_type = 'company'
      AND target_id = company_id_param
      AND status IN ('open', 'acknowledged');
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_company_cascade(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_company_cascade(TEXT) TO authenticated, service_role;
