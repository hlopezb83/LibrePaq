-- ============================================================================
-- LIBREPAQ PRO — ATRIBUCIÓN GOOGLE ADS (GCLID / UTM) Y WORKSPACE EN user_profiles
-- ============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS workspace_id TEXT,
  ADD COLUMN IF NOT EXISTS workspace_name TEXT,
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT,
  ADD COLUMN IF NOT EXISTS gclid TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT;

DROP POLICY IF EXISTS "Propio usuario actualiza su perfil y atribucion" ON public.user_profiles;

CREATE POLICY "Propio usuario actualiza su perfil y atribucion"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (id = auth.uid()::text)
WITH CHECK (id = auth.uid()::text);
