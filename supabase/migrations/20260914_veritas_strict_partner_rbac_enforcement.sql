-- ==============================================================================
-- VERITAS STRICT PARTNER ROLE-BASED ACCESS CONTROL (RBAC) HARDENING
-- Migration Version: 2026-09-14
--
-- Objectives:
--   1. Enforce strict server-side & database-level authorization boundaries
--   2. Eliminate broad legacy manager/admin client-side table writes
--   3. Super Admin retains exclusive rights to product pricing, publishing, deletion,
--      discounts, order financial modifications, and system security
--   4. Operations partner restricted to product content, production specs, variant inventory,
--      fulfilment updates, and media uploads
--   5. Creative & Marketing partner restricted to product content, collections,
--      categories, and media uploads (NO pricing, NO inventory editing, NO fulfilment)
--   6. Finance partner is read-only across catalog, sales, and financials
--   7. Zero disruption to public storefront catalog browsing and guest checkout
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDEN SECURITY DEFINER HELPER FUNCTIONS
-- ------------------------------------------------------------------------------

-- Ensure admin_users role constraint is strict
ALTER TABLE public.admin_users 
DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE public.admin_users 
ADD CONSTRAINT admin_users_role_check 
CHECK (role IN ('super_admin', 'operations', 'marketing', 'finance', 'admin', 'manager'));

-- Update has_admin_role helper to be strict and un-aliased for partners
CREATE OR REPLACE FUNCTION public.has_admin_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.admin_users 
    WHERE user_id = auth.uid() 
      AND (is_active IS TRUE)
      AND (
        (role = 'super_admin') OR
        (role = required_role) OR
        (required_role = 'admin' AND role IN ('super_admin', 'admin'))
      )
  );
$$;

-- Specific Helper: Super Admin Only
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.admin_users 
    WHERE user_id = auth.uid()
      AND (is_active IS TRUE)
      AND role = 'super_admin'
  );
$$;

-- Specific Helper: Operations or Super Admin
CREATE OR REPLACE FUNCTION public.can_manage_operations()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.admin_users 
    WHERE user_id = auth.uid()
      AND (is_active IS TRUE)
      AND role IN ('super_admin', 'operations', 'admin')
  );
$$;

-- Specific Helper: Marketing or Super Admin
CREATE OR REPLACE FUNCTION public.can_manage_marketing()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.admin_users 
    WHERE user_id = auth.uid()
      AND (is_active IS TRUE)
      AND role IN ('super_admin', 'marketing', 'admin')
  );
$$;

-- ------------------------------------------------------------------------------
-- 2. TIGHTEN ROW LEVEL SECURITY POLICIES ON PRODUCTS
-- ------------------------------------------------------------------------------

-- Drop broad/legacy write policies
DROP POLICY IF EXISTS "Admins full management of products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Admin write access for products" ON public.products;
DROP POLICY IF EXISTS "Admins full access to products" ON public.products;

-- Products: SELECT
-- Public storefront can view active published products
DROP POLICY IF EXISTS "Public can view active published products" ON public.products;
CREATE POLICY "Public can view active published products"
    ON public.products FOR SELECT
    TO anon, authenticated
    USING (
      (status = 'active' AND published IS TRUE) OR public.is_admin()
    );

-- Products: INSERT (Super Admin only for direct client queries; API routes use service role)
CREATE POLICY "Super Admins can insert products"
    ON public.products FOR INSERT
    TO authenticated
    WITH CHECK (public.is_super_admin());

-- Products: UPDATE (Super Admin only for direct client queries)
CREATE POLICY "Super Admins can update products"
    ON public.products FOR UPDATE
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Products: DELETE (Super Admin only)
CREATE POLICY "Super Admins can delete products"
    ON public.products FOR DELETE
    TO authenticated
    USING (public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 3. TIGHTEN ROW LEVEL SECURITY POLICIES ON PRODUCT VARIANTS & COLOURS
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins full management of variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can insert variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can update variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can delete variants" ON public.product_variants;

DROP POLICY IF EXISTS "Public can view variants of active published products" ON public.product_variants;
CREATE POLICY "Public can view variants of active published products"
    ON public.product_variants FOR SELECT
    TO anon, authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.id = product_variants.product_id 
          AND ((p.status = 'active' AND p.published IS TRUE) OR public.is_admin())
      )
    );

CREATE POLICY "Super Admins and Operations can update variants"
    ON public.product_variants FOR UPDATE
    TO authenticated
    USING (public.can_manage_operations())
    WITH CHECK (public.can_manage_operations());

CREATE POLICY "Super Admins can insert variants"
    ON public.product_variants FOR INSERT
    TO authenticated
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super Admins can delete variants"
    ON public.product_variants FOR DELETE
    TO authenticated
    USING (public.is_super_admin());

-- Product Colours
DROP POLICY IF EXISTS "Admins full management of colours" ON public.product_colours;
DROP POLICY IF EXISTS "Admins can insert colours" ON public.product_colours;
DROP POLICY IF EXISTS "Admins can update colours" ON public.product_colours;
DROP POLICY IF EXISTS "Admins can delete colours" ON public.product_colours;

DROP POLICY IF EXISTS "Public can view colours of active published products" ON public.product_colours;
CREATE POLICY "Public can view colours of active published products"
    ON public.product_colours FOR SELECT
    TO anon, authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.id = product_colours.product_id 
          AND ((p.status = 'active' AND p.published IS TRUE) OR public.is_admin())
      )
    );

CREATE POLICY "Super Admins can insert colours"
    ON public.product_colours FOR INSERT
    TO authenticated
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super Admins can update colours"
    ON public.product_colours FOR UPDATE
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super Admins can delete colours"
    ON public.product_colours FOR DELETE
    TO authenticated
    USING (public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 4. TIGHTEN ROW LEVEL SECURITY POLICIES ON COLLECTIONS & CATEGORIES
-- ------------------------------------------------------------------------------

-- Collections
DROP POLICY IF EXISTS "Admins full management of collections" ON public.collections;
DROP POLICY IF EXISTS "Admins can insert collections" ON public.collections;
DROP POLICY IF EXISTS "Admins can update collections" ON public.collections;
DROP POLICY IF EXISTS "Admins can delete collections" ON public.collections;

DROP POLICY IF EXISTS "Public can view active collections" ON public.collections;
CREATE POLICY "Public can view active collections"
    ON public.collections FOR SELECT
    TO anon, authenticated
    USING (is_active IS TRUE OR public.is_admin());

CREATE POLICY "Marketing and Super Admins can insert collections"
    ON public.collections FOR INSERT
    TO authenticated
    WITH CHECK (public.can_manage_marketing());

CREATE POLICY "Marketing and Super Admins can update collections"
    ON public.collections FOR UPDATE
    TO authenticated
    USING (public.can_manage_marketing())
    WITH CHECK (public.can_manage_marketing());

CREATE POLICY "Marketing and Super Admins can delete collections"
    ON public.collections FOR DELETE
    TO authenticated
    USING (public.can_manage_marketing());

-- Categories
DROP POLICY IF EXISTS "Admins full management of categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;

DROP POLICY IF EXISTS "Public can view catalog categories" ON public.categories;
CREATE POLICY "Public can view catalog categories"
    ON public.categories FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Marketing and Super Admins can insert categories"
    ON public.categories FOR INSERT
    TO authenticated
    WITH CHECK (public.can_manage_marketing());

CREATE POLICY "Marketing and Super Admins can update categories"
    ON public.categories FOR UPDATE
    TO authenticated
    USING (public.can_manage_marketing())
    WITH CHECK (public.can_manage_marketing());

CREATE POLICY "Marketing and Super Admins can delete categories"
    ON public.categories FOR DELETE
    TO authenticated
    USING (public.can_manage_marketing());

-- ------------------------------------------------------------------------------
-- 5. TIGHTEN ROW LEVEL SECURITY POLICIES ON ORDERS
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins full management of orders" ON public.orders;

-- Super Admin can manage all order updates (financials, cancellation, refunds)
CREATE POLICY "Super Admins can update orders"
    ON public.orders FOR UPDATE
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Operations can update orders (for fulfilment status only; sensitive columns enforced via API layer)
CREATE POLICY "Operations can update order fulfilment"
    ON public.orders FOR UPDATE
    TO authenticated
    USING (public.can_manage_operations())
    WITH CHECK (public.can_manage_operations());

-- ------------------------------------------------------------------------------
-- 6. TIGHTEN ROW LEVEL SECURITY POLICIES ON MEDIA
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins full management of media" ON public.product_media;
DROP POLICY IF EXISTS "Admins can insert media" ON public.product_media;
DROP POLICY IF EXISTS "Admins can update media" ON public.product_media;
DROP POLICY IF EXISTS "Admins can delete media" ON public.product_media;

DROP POLICY IF EXISTS "Public can view media of active published products" ON public.product_media;
CREATE POLICY "Public can view media of active published products"
    ON public.product_media FOR SELECT
    TO anon, authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.id = product_media.product_id 
          AND ((p.status = 'active' AND p.published IS TRUE) OR public.is_admin())
      )
    );

CREATE POLICY "Admins can insert product media"
    ON public.product_media FOR INSERT
    TO authenticated
    WITH CHECK (public.has_admin_role('operations') OR public.has_admin_role('marketing') OR public.is_super_admin());

CREATE POLICY "Admins can update product media"
    ON public.product_media FOR UPDATE
    TO authenticated
    USING (public.has_admin_role('operations') OR public.has_admin_role('marketing') OR public.is_super_admin())
    WITH CHECK (public.has_admin_role('operations') OR public.has_admin_role('marketing') OR public.is_super_admin());

CREATE POLICY "Admins can delete product media"
    ON public.product_media FOR DELETE
    TO authenticated
    USING (public.has_admin_role('operations') OR public.has_admin_role('marketing') OR public.is_super_admin());
