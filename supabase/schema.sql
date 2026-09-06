-- ==============================================================================
-- VERITAS SHARED SUPABASE DATABASE SCHEMA MIGRATION
-- Single Source of Truth for VERITAS Production Database & Row Level Security
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ADMIN USERS TABLE (RBAC)
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. COLLECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image_path TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    product_type TEXT DEFAULT 'T-Shirts',
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL,
    selling_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    cost_price NUMERIC(10,2) DEFAULT 0.00,
    profit_per_unit NUMERIC(10,2) DEFAULT 0.00,
    profit_margin NUMERIC(5,2) DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    published BOOLEAN NOT NULL DEFAULT false,
    featured BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. PRODUCT COLOURS TABLE
CREATE TABLE IF NOT EXISTS public.product_colours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    hex_code TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. PRODUCT VARIANTS TABLE
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    colour TEXT NOT NULL,
    size TEXT NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 5,
    colour_id UUID REFERENCES public.product_colours(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. PRODUCT MEDIA TABLE
CREATE TABLE IF NOT EXISTS public.product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    alt_text TEXT,
    media_type TEXT DEFAULT 'gallery' CHECK (media_type IN ('front', 'back', 'model', 'detail', 'gallery')),
    sort_order INT DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    colour_id UUID REFERENCES public.product_colours(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    shipping_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'ZAR',
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    order_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (order_status IN ('confirmed', 'processing', 'completed', 'cancelled')),
    fulfilment_status TEXT NOT NULL DEFAULT 'pending' CHECK (fulfilment_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    product_name_snapshot TEXT NOT NULL,
    sku_snapshot TEXT NOT NULL,
    colour_snapshot TEXT NOT NULL,
    size_snapshot TEXT NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    quantity INT NOT NULL DEFAULT 1,
    line_total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. ORDER ADDRESSES TABLE
CREATE TABLE IF NOT EXISTS public.order_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    suburb TEXT,
    city TEXT NOT NULL,
    province TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'South Africa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ====================================================
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status_published ON public.products(status, published);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_media_product_id ON public.product_media(product_id);
CREATE INDEX IF NOT EXISTS idx_product_colours_product_id ON public.product_colours(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_addresses_order_id ON public.order_addresses(order_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);

-- ====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_colours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_addresses ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------
-- HELPER FUNCTIONS (SECURITY DEFINER, FIXED SEARCH_PATH)
-- ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
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
      AND role IN ('super_admin', 'admin', 'manager')
  );
$$;

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
      AND (
        (required_role = 'manager' AND role IN ('super_admin', 'admin', 'manager')) OR
        (required_role = 'admin' AND role IN ('super_admin', 'admin')) OR
        (required_role = 'super_admin' AND role = 'super_admin')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.has_admin_role('super_admin');
$$;

-- ----------------------------------------------------
-- PUBLIC READ POLICIES
-- ----------------------------------------------------
CREATE POLICY "Public can view active published products"
    ON public.products FOR SELECT
    TO public
    USING (status = 'active' AND published = true);

CREATE POLICY "Public can view active collections"
    ON public.collections FOR SELECT
    TO public
    USING (is_active = true);

CREATE POLICY "Public can view catalog categories"
    ON public.categories FOR SELECT
    TO public
    USING (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.category_id = public.categories.id
          AND p.status = 'active'
          AND p.published = true
      )
    );

CREATE POLICY "Public can view variants of active published products"
    ON public.product_variants FOR SELECT
    TO public
    USING (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = public.product_variants.product_id
          AND p.status = 'active'
          AND p.published = true
      )
    );

CREATE POLICY "Public can view colours of active published products"
    ON public.product_colours FOR SELECT
    TO public
    USING (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = public.product_colours.product_id
          AND p.status = 'active'
          AND p.published = true
      )
    );

CREATE POLICY "Public can view media of active published products"
    ON public.product_media FOR SELECT
    TO public
    USING (
      EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = public.product_media.product_id
          AND p.status = 'active'
          AND p.published = true
      )
    );

-- ----------------------------------------------------
-- ADMIN POLICIES (DATABASE-ENFORCED ACCESS)
-- ----------------------------------------------------
CREATE POLICY "Admins can view admin_users"
    ON public.admin_users FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Super Admins can manage admin_users"
    ON public.admin_users FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Admins full management of products"
    ON public.products FOR ALL
    TO authenticated
    USING (public.has_admin_role('manager'))
    WITH CHECK (public.has_admin_role('manager'));

CREATE POLICY "Admins full management of variants"
    ON public.product_variants FOR ALL
    TO authenticated
    USING (public.has_admin_role('manager'))
    WITH CHECK (public.has_admin_role('manager'));

CREATE POLICY "Admins full management of colours"
    ON public.product_colours FOR ALL
    TO authenticated
    USING (public.has_admin_role('manager'))
    WITH CHECK (public.has_admin_role('manager'));

CREATE POLICY "Admins full management of media"
    ON public.product_media FOR ALL
    TO authenticated
    USING (public.has_admin_role('manager'))
    WITH CHECK (public.has_admin_role('manager'));

CREATE POLICY "Admins full management of collections"
    ON public.collections FOR ALL
    TO authenticated
    USING (public.has_admin_role('admin'))
    WITH CHECK (public.has_admin_role('admin'));

CREATE POLICY "Admins full management of categories"
    ON public.categories FOR ALL
    TO authenticated
    USING (public.has_admin_role('admin'))
    WITH CHECK (public.has_admin_role('admin'));

-- ----------------------------------------------------
-- ORDERS SECURITY (ZERO ANON ACCESS)
-- ----------------------------------------------------
CREATE POLICY "Admins can view orders"
    ON public.orders FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admins can update orders"
    ON public.orders FOR UPDATE
    TO authenticated
    USING (public.has_admin_role('manager'))
    WITH CHECK (public.has_admin_role('manager'));

CREATE POLICY "Super Admins can delete orders"
    ON public.orders FOR DELETE
    TO authenticated
    USING (public.is_super_admin());

CREATE POLICY "Admins can view order items"
    ON public.order_items FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admins can view order addresses"
    ON public.order_addresses FOR SELECT
    TO authenticated
    USING (public.is_admin());
