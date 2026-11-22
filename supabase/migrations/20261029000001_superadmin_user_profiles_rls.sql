-- ============================================================================
-- LIBREPAQ PRO — LECTURA SEGURA DE user_profiles PARA SUPERADMIN Y PROPIO USUARIO
-- ============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SuperAdmin y propio usuario leen user_profiles" ON public.user_profiles;

CREATE POLICY "SuperAdmin y propio usuario leen user_profiles"
ON public.user_profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()::text
  OR lower(auth.jwt() ->> 'email') = 'hlopezb@gmail.com'
);
