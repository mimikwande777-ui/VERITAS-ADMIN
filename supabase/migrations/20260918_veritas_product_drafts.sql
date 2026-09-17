-- ==============================================================================
-- VERITAS PRODUCT DRAFTS & REVISIONS SCHEMA
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.product_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID UNIQUE NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    draft_data JSONB NOT NULL,
    created_by TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.product_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service_role full access on product_drafts" ON public.product_drafts;
CREATE POLICY "Allow service_role full access on product_drafts"
  ON public.product_drafts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read on product_drafts" ON public.product_drafts;
CREATE POLICY "Allow public read on product_drafts"
  ON public.product_drafts FOR SELECT
  USING (true);
