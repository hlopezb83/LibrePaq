-- ============================================================================
-- LIBREPAQ PRO — OLA 1 BLOQUE 1B: MULTI-TASA CFDI, COMPLEMENTO PAGO 2.0, EFOS 69-B
-- ============================================================================

-- 1. Desglose multi-tasa (16%, 8%, 0%, Exento, IEPS) y documentos relacionados (REP 2.0)
ALTER TABLE public.cfdi_documents
  ADD COLUMN IF NOT EXISTS tax_breakdown JSONB;

ALTER TABLE public.cfdi_documents
  ADD COLUMN IF NOT EXISTS related_docs JSONB;

-- 2. Padrón local / caché oficial Lista Negra SAT Art. 69-B (EFOS)
CREATE TABLE IF NOT EXISTS public.sat_efos_69b (
  rfc TEXT PRIMARY KEY,
  nombre TEXT NOT NULL DEFAULT '',
  situacion TEXT NOT NULL DEFAULT 'PRESUNTO',
  fecha_publicacion TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sat_efos_69b
  ADD COLUMN IF NOT EXISTS fecha_publicacion TEXT;

CREATE INDEX IF NOT EXISTS idx_sat_efos_69b_situacion
  ON public.sat_efos_69b(situacion);

-- RLS en sat_efos_69b: lectura para usuarios autenticados, escritura solo service_role
ALTER TABLE public.sat_efos_69b ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sat_efos_69b_select_authenticated ON public.sat_efos_69b;
CREATE POLICY sat_efos_69b_select_authenticated
  ON public.sat_efos_69b
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.sat_efos_69b FROM anon, authenticated;
GRANT SELECT ON TABLE public.sat_efos_69b TO authenticated;
GRANT ALL ON TABLE public.sat_efos_69b TO service_role;

-- 3. Porcentaje de deducibilidad configurable en padrón de terceros (si la tabla existe)
ALTER TABLE IF EXISTS public.third_parties
  ADD COLUMN IF NOT EXISTS deductible_pct NUMERIC DEFAULT 100;
