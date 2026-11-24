ALTER TABLE IF EXISTS public.despacho_deliverable_branding
  ADD COLUMN IF NOT EXISTS legal_rep_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS legal_rep_title text NOT NULL DEFAULT 'Representante Legal';
