-- ============================================================================
-- LIBREPAQ PRO — MIGRACIÓN MULTI-TENANT & PERMISOS DE AISLAMIENTO POR USUARIO
-- ============================================================================

-- 1. Añadir columna user_id en companies si no existe
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON public.companies(user_id);

-- 2. Eliminar restricción de RFC único global para permitir multi-tenant
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_rfc_key;
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS uq_companies_user_rfc;
ALTER TABLE public.companies ADD CONSTRAINT uq_companies_user_rfc UNIQUE NULLS NOT DISTINCT (user_id, rfc);

-- 3. Políticas RLS estrictas en tabla public.companies
DROP POLICY IF EXISTS "Permitir acceso completo a companies" ON public.companies;
DROP POLICY IF EXISTS "Usuarios ven sus propias empresas o las demo" ON public.companies;
DROP POLICY IF EXISTS "Usuarios solo insertan sus propias empresas" ON public.companies;
DROP POLICY IF EXISTS "Usuarios solo modifican sus propias empresas" ON public.companies;
DROP POLICY IF EXISTS "Usuarios solo eliminan sus propias empresas" ON public.companies;

CREATE POLICY "Usuarios ven sus propias empresas o las demo"
ON public.companies FOR SELECT
USING (
  user_id = auth.uid()::text 
  OR user_id IS NULL 
  OR user_id = 'demo'
);

CREATE POLICY "Usuarios solo insertan sus propias empresas"
ON public.companies FOR INSERT
WITH CHECK (
  user_id = auth.uid()::text 
  OR user_id IS NULL
);

CREATE POLICY "Usuarios solo modifican sus propias empresas"
ON public.companies FOR UPDATE
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Usuarios solo eliminan sus propias empresas"
ON public.companies FOR DELETE
USING (user_id = auth.uid()::text);

-- 4. Aislamiento en cascada para cuentas y movimientos
DROP POLICY IF EXISTS "Permitir acceso completo a accounts" ON public.accounts;
CREATE POLICY "Acceso a cuentas segun empresa del usuario"
ON public.accounts FOR ALL
USING (
  company_id IN (
    SELECT id FROM public.companies 
    WHERE user_id = auth.uid()::text OR user_id IS NULL OR user_id = 'demo'
  )
);

DROP POLICY IF EXISTS "Permitir acceso completo a polizas" ON public.polizas;
CREATE POLICY "Acceso a polizas segun empresa del usuario"
ON public.polizas FOR ALL
USING (
  company_id IN (
    SELECT id FROM public.companies 
    WHERE user_id = auth.uid()::text OR user_id IS NULL OR user_id = 'demo'
  )
);

DROP POLICY IF EXISTS "Permitir acceso completo a cfdi_documents" ON public.cfdi_documents;
CREATE POLICY "Acceso a cfdi segun empresa del usuario"
ON public.cfdi_documents FOR ALL
USING (
  company_id IN (
    SELECT id FROM public.companies 
    WHERE user_id = auth.uid()::text OR user_id IS NULL OR user_id = 'demo'
  )
);
