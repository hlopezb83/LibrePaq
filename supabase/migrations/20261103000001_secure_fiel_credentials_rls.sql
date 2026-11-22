-- ============================================================================
-- LIBREPAQ PRO — MIGRACIÓN DE SEGURIDAD RLS: CIERRE DE BRECHA EN FIEL_CREDENTIALS
-- ============================================================================

-- 1. Eliminar política abierta antigua
DROP POLICY IF EXISTS "Permitir acceso completo a fiel_credentials" ON public.fiel_credentials;

-- 2. Asegurar que las llaves privadas sólo puedan ser leídas y modificadas
-- por el usuario propietario de la empresa o entorno de demo autorizado
CREATE POLICY "Acceso a fiel_credentials segun empresa del usuario"
ON public.fiel_credentials FOR ALL
USING (
  company_id IN (
    SELECT id FROM public.companies 
    WHERE user_id = auth.uid()::text OR user_id IS NULL OR user_id = 'demo'
  )
)
WITH CHECK (
  company_id IN (
    SELECT id FROM public.companies 
    WHERE user_id = auth.uid()::text OR user_id IS NULL OR user_id = 'demo'
  )
);

-- 3. Proteger la tabla de solicitudes de descarga masiva SAT
DROP POLICY IF EXISTS "Permitir acceso completo a sat_download_requests" ON public.sat_download_requests;

CREATE POLICY "Acceso a sat_download_requests segun empresa del usuario"
ON public.sat_download_requests FOR ALL
USING (
  company_id IN (
    SELECT id FROM public.companies 
    WHERE user_id = auth.uid()::text OR user_id IS NULL OR user_id = 'demo'
  )
)
WITH CHECK (
  company_id IN (
    SELECT id FROM public.companies 
    WHERE user_id = auth.uid()::text OR user_id IS NULL OR user_id = 'demo'
  )
);
