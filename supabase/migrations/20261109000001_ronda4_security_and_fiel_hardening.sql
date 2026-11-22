-- ============================================================================
-- LIBREPAQ PRO — RONDA 4: ENDURECIMIENTO DE SEGURIDAD RLS Y FIEL CREDENTIALS
-- ============================================================================

-- 1. Proteger columnas sensibles de fiel_credentials:
-- Revocar SELECT general y conceder acceso únicamente a columnas de metadatos públicos/operativos.
-- La columna 'private_key_pem' queda inaccesible para clientes directos vía PostgREST,
-- quedando reservada exclusivamente para el rol 'service_role' (Edge Functions y cron workers).
REVOKE SELECT ON TABLE public.fiel_credentials FROM anon, authenticated;

GRANT SELECT (
  id,
  company_id,
  rfc_titular,
  nombre_titular,
  numero_serie,
  valid_from,
  valid_to,
  sha1_fingerprint,
  cer_base64,
  created_at,
  updated_at
) ON TABLE public.fiel_credentials TO authenticated;

GRANT INSERT, UPDATE, DELETE ON TABLE public.fiel_credentials TO authenticated;

-- 2. Eliminar políticas RLS permisivas antiguas en fiel_credentials
DROP POLICY IF EXISTS "Permitir acceso completo a fiel_credentials" ON public.fiel_credentials;
DROP POLICY IF EXISTS "Acceso a fiel_credentials segun empresa del usuario" ON public.fiel_credentials;
DROP POLICY IF EXISTS "rls_fiel_credentials_select" ON public.fiel_credentials;
DROP POLICY IF EXISTS "rls_fiel_credentials_write" ON public.fiel_credentials;

-- 3. Crear política RLS estricta para lectura de metadatos de e.firma
CREATE POLICY "rls_fiel_credentials_select"
ON public.fiel_credentials FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT id FROM public.companies 
    WHERE user_id = auth.uid()::text 
       OR (auth.uid() IS NOT NULL AND user_id = 'demo')
       OR auth.jwt() ->> 'email' = 'hlopezb@gmail.com'
  )
);

-- 4. Crear política RLS estricta para escritura/actualización de credenciales
CREATE POLICY "rls_fiel_credentials_write"
ON public.fiel_credentials FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT id FROM public.companies 
    WHERE user_id = auth.uid()::text 
       OR auth.jwt() ->> 'email' = 'hlopezb@gmail.com'
  )
)
WITH CHECK (
  company_id IN (
    SELECT id FROM public.companies 
    WHERE user_id = auth.uid()::text 
       OR auth.jwt() ->> 'email' = 'hlopezb@gmail.com'
  )
);

-- 5. Endurecer RLS en sat_download_requests eliminando la cláusula 'user_id IS NULL'
DROP POLICY IF EXISTS "Permitir acceso completo a sat_download_requests" ON public.sat_download_requests;
DROP POLICY IF EXISTS "Acceso a sat_download_requests segun empresa del usuario" ON public.sat_download_requests;
DROP POLICY IF EXISTS "rls_sat_download_requests_all" ON public.sat_download_requests;

CREATE POLICY "rls_sat_download_requests_all"
ON public.sat_download_requests FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT id FROM public.companies 
    WHERE user_id = auth.uid()::text 
       OR (auth.uid() IS NOT NULL AND user_id = 'demo')
       OR auth.jwt() ->> 'email' = 'hlopezb@gmail.com'
  )
)
WITH CHECK (
  company_id IN (
    SELECT id FROM public.companies 
    WHERE user_id = auth.uid()::text 
       OR auth.jwt() ->> 'email' = 'hlopezb@gmail.com'
  )
);
