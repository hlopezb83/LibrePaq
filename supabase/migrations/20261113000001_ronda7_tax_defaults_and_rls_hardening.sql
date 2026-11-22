-- ============================================================================
-- LIBREPAQ PRO — MIGRACIÓN RONDA 7: PARÁMETROS FISCALES EN 0 & HARDENING FIEL
-- ============================================================================

-- 1. Dejar en 0 los valores por defecto de tax_parameters para nuevas empresas
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tax_parameters'
  ) THEN
    ALTER TABLE public.tax_parameters
      ALTER COLUMN coeficiente_utilidad SET DEFAULT 0,
      ALTER COLUMN perdidas_fiscales_pendientes SET DEFAULT 0,
      ALTER COLUMN pagos_provisionales_anteriores SET DEFAULT 0,
      ALTER COLUMN saldo_favor_iva_anterior SET DEFAULT 0,
      ALTER COLUMN tipo_cambio_dof_cierre SET DEFAULT 0;
  END IF;
END $$;

-- 2. Restringir escrituras en fiel_credentials exclusivamente a service_role (Edge Functions)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fiel_credentials'
  ) THEN
    REVOKE INSERT, UPDATE, DELETE ON TABLE public.fiel_credentials FROM anon, authenticated;
  END IF;
END $$;
