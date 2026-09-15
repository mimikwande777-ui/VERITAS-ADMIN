-- ==============================================================================
-- VERITAS STRICT PARTNER ROLE-BASED ACCESS CONTROL (RBAC) HARDENING
-- Migration Version: 2026-09-14
--
-- Objectives:
--   1. Enforce strict server-side & database-level authorization boundaries
--   2. Direct partner table writes are removed; all partner mutations must pass
--      through validated /api/admin/* routes using the service-role client
--   3. Super Admin retains direct database maintenance capabilities
--   4. Storage bucket 'product-media' allows uploads for Super Admin, Operations,
--      and Marketing; Deletion and Updates are restricted to Super Admin only
--   5. Zero disruption to public storefront catalog browsing and guest checkout
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
-- 2. PRODUCTS TABLE POLICIES
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins full management of products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Admin write access for products" ON public.products;
DROP POLICY IF EXISTS "Admins full access to products" ON public.products;
DROP POLICY IF EXISTS "Super Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Super Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Super Admins can delete products" ON public.products;

-- Products: SELECT (Public storefront can view active published products; admins can view all)
DROP POLICY IF EXISTS "Public can view active published products" ON public.products;
CREATE POLICY "Public can view active published products"
    ON public.products FOR SELECT
    TO anon, authenticated
    USING (
      (status = 'active' AND published IS TRUE) OR public.is_admin()
    );

-- Products: Direct writes (Super Admin only; Partner mutations go through /api/admin/products)
CREATE POLICY "Super Admins can insert products"
    ON public.products FOR INSERT
    TO authenticated
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super Admins can update products"
    ON public.products FOR UPDATE
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super Admins can delete products"
    ON public.products FOR DELETE
    TO authenticated
    USING (public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 3. PRODUCT VARIANTS & COLOURS TABLE POLICIES
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins full management of variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can insert variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can update variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can delete variants" ON public.product_variants;
DROP POLICY IF EXISTS "Super Admins and Operations can update variants" ON public.product_variants;
DROP POLICY IF EXISTS "Super Admins can insert variants" ON public.product_variants;
DROP POLICY IF EXISTS "Super Admins can delete variants" ON public.product_variants;

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

CREATE POLICY "Super Admins can insert variants"
    ON public.product_variants FOR INSERT
    TO authenticated
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super Admins can update variants"
    ON public.product_variants FOR UPDATE
    TO authenticated
    USING (public.is_super_admin())
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
DROP POLICY IF EXISTS "Super Admins can insert colours" ON public.product_colours;
DROP POLICY IF EXISTS "Super Admins can update colours" ON public.product_colours;
DROP POLICY IF EXISTS "Super Admins can delete colours" ON public.product_colours;

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
-- 4. COLLECTIONS & CATEGORIES TABLE POLICIES
-- ------------------------------------------------------------------------------

-- Collections
DROP POLICY IF EXISTS "Admins full management of collections" ON public.collections;
DROP POLICY IF EXISTS "Admins can insert collections" ON public.collections;
DROP POLICY IF EXISTS "Admins can update collections" ON public.collections;
DROP POLICY IF EXISTS "Admins can delete collections" ON public.collections;
DROP POLICY IF EXISTS "Marketing and Super Admins can insert collections" ON public.collections;
DROP POLICY IF EXISTS "Marketing and Super Admins can update collections" ON public.collections;
DROP POLICY IF EXISTS "Marketing and Super Admins can delete collections" ON public.collections;

DROP POLICY IF EXISTS "Public can view active collections" ON public.collections;
CREATE POLICY "Public can view active collections"
    ON public.collections FOR SELECT
    TO anon, authenticated
    USING (is_active IS TRUE OR public.is_admin());

CREATE POLICY "Super Admins can insert collections"
    ON public.collections FOR INSERT
    TO authenticated
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super Admins can update collections"
    ON public.collections FOR UPDATE
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super Admins can delete collections"
    ON public.collections FOR DELETE
    TO authenticated
    USING (public.is_super_admin());

-- Categories
DROP POLICY IF EXISTS "Admins full management of categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;
DROP POLICY IF EXISTS "Marketing and Super Admins can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Marketing and Super Admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Marketing and Super Admins can delete categories" ON public.categories;

DROP POLICY IF EXISTS "Public can view catalog categories" ON public.categories;
CREATE POLICY "Public can view catalog categories"
    ON public.categories FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Super Admins can insert categories"
    ON public.categories FOR INSERT
    TO authenticated
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super Admins can update categories"
    ON public.categories FOR UPDATE
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super Admins can delete categories"
    ON public.categories FOR DELETE
    TO authenticated
    USING (public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 5. ORDERS TABLE POLICIES
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins full management of orders" ON public.orders;
DROP POLICY IF EXISTS "Operations can update order fulfilment" ON public.orders;
DROP POLICY IF EXISTS "Super Admins can update orders" ON public.orders;

-- Direct mutations restricted to Super Admin; Partner fulfilment updates go through /api/admin/orders
CREATE POLICY "Super Admins can update orders"
    ON public.orders FOR UPDATE
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 6. PRODUCT MEDIA TABLE POLICIES
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins full management of media" ON public.product_media;
DROP POLICY IF EXISTS "Admins can insert media" ON public.product_media;
DROP POLICY IF EXISTS "Admins can update media" ON public.product_media;
DROP POLICY IF EXISTS "Admins can delete media" ON public.product_media;
DROP POLICY IF EXISTS "Admins can insert product media" ON public.product_media;
DROP POLICY IF EXISTS "Admins can update product media" ON public.product_media;
DROP POLICY IF EXISTS "Admins can delete product media" ON public.product_media;

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

CREATE POLICY "Super Admins can insert product media"
    ON public.product_media FOR INSERT
    TO authenticated
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super Admins can update product media"
    ON public.product_media FOR UPDATE
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super Admins can delete product media"
    ON public.product_media FOR DELETE
    TO authenticated
    USING (public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 7. DISCOUNTS TABLE POLICIES
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins full management of discounts" ON public.discounts;
DROP POLICY IF EXISTS "Super Admins can insert discounts" ON public.discounts;
DROP POLICY IF EXISTS "Super Admins can update discounts" ON public.discounts;
DROP POLICY IF EXISTS "Super Admins can delete discounts" ON public.discounts;

CREATE POLICY "Super Admins can insert discounts"
    ON public.discounts FOR INSERT
    TO authenticated
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super Admins can update discounts"
    ON public.discounts FOR UPDATE
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super Admins can delete discounts"
    ON public.discounts FOR DELETE
    TO authenticated
    USING (public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 8. ADMIN USERS TABLE POLICIES
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Super admin can manage admin_users" ON public.admin_users;

CREATE POLICY "Admins can view admin_users"
    ON public.admin_users FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Super Admins can manage admin_users"
    ON public.admin_users FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 9. SUPABASE STORAGE (product-media BUCKET) POLICIES
-- ------------------------------------------------------------------------------

-- Drop exact legacy storage policies
DROP POLICY IF EXISTS "Admins can upload product media files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update product media files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product media files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view product media files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view product media objects" ON storage.objects;
DROP POLICY IF EXISTS "Partners can upload product media objects" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload product media" ON storage.objects;
DROP POLICY IF EXISTS "Super Admins can update product media objects" ON storage.objects;
DROP POLICY IF EXISTS "Super Admins can delete product media objects" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product media" ON storage.objects;

-- Ensure bucket exists and is public for image reads
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-media', 'product-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage: Public Read
CREATE POLICY "Public can view product media objects"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'product-media');

-- Storage: Insert (Upload) allowed for Super Admin, Operations, and Marketing
CREATE POLICY "Partners can upload product media objects"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'product-media' AND (
        public.is_super_admin() OR
        public.has_admin_role('operations') OR
        public.has_admin_role('marketing')
      )
    );

-- Storage: Update restricted to Super Admin only
CREATE POLICY "Super Admins can update product media objects"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'product-media' AND public.is_super_admin())
    WITH CHECK (bucket_id = 'product-media' AND public.is_super_admin());

-- Storage: Delete restricted to Super Admin only
CREATE POLICY "Super Admins can delete product media objects"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'product-media' AND public.is_super_admin());
