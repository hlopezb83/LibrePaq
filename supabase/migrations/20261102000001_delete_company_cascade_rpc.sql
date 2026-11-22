-- ============================================================================
-- LIBREPAQ PRO — BORRADO ATÓMICO EN CASCADA DE EMPRESAS (RPC)
-- ============================================================================
-- Elimina una empresa y todas sus dependencias relacionales de manera atómica
-- en una sola transacción PostgreSQL, respetando las FKs con ON DELETE RESTRICT
-- (especialmente poliza_movements -> accounts).

CREATE OR REPLACE FUNCTION public.delete_company_cascade(company_id_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Movimientos de póliza (para desbloquear restricción de FK sobre accounts)
  DELETE FROM public.poliza_movements
  WHERE poliza_id IN (
    SELECT id FROM public.polizas WHERE company_id = company_id_param
  );

  -- 2. Pólizas contables
  DELETE FROM public.polizas
  WHERE company_id = company_id_param;

  -- 3. Documentos CFDI de la bóveda digital
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cfdi_documents') THEN
    DELETE FROM public.cfdi_documents WHERE company_id = company_id_param;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cfdis') THEN
    EXECUTE 'DELETE FROM public.cfdis WHERE company_id = $1' USING company_id_param;
  END IF;

  -- 4. Movimientos y extractos bancarios
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bank_statement_lines') THEN
    DELETE FROM public.bank_statement_lines WHERE company_id = company_id_param;
  END IF;

  -- 5. Activos fijos y depreciaciones
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fixed_assets') THEN
    DELETE FROM public.fixed_assets WHERE company_id = company_id_param;
  END IF;

  -- 6. Padrón de Terceros y proveedores DIOT
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'third_parties') THEN
    DELETE FROM public.third_parties WHERE company_id = company_id_param;
  END IF;

  -- 7. Catálogo de cuentas contables
  DELETE FROM public.accounts
  WHERE company_id = company_id_param;

  -- 8. Empresa principal
  DELETE FROM public.companies
  WHERE id = company_id_param;

  RETURN TRUE;
END;
$$;

-- Permisos de ejecución
GRANT EXECUTE ON FUNCTION public.delete_company_cascade(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_company_cascade(TEXT) TO service_role;
