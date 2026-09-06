-- ==============================================================================
-- VERITAS SUPABASE SECURITY BOUNDARY & ADMIN RBAC MIGRATION
-- Migration Version: 2026-09-04 (Hardened Production Security Revision)
-- Single Source of Truth for Database Row Level Security (RLS) & Server Checkout
-- 
-- Objectives:
--   1. Drop all development anonymous write policies (dev_anon_* on all tables)
--   2. Establish public.admin_users table with strict RBAC constraints
--   3. Create security-definer helper functions with fixed search_path to prevent
--      privilege escalation and resolve Security Advisor warnings
--   4. Implement strict Public Read policies (active + published catalog only)
--   5. Restrict catalog mutations to authenticated and verified Admins
--   6. Enforce strict Orders, Order Items, and Order Addresses privacy (Zero Anon Access)
--   7. Secure Supabase Storage bucket 'product-media'
--   8. Provide authoritative server-only atomic checkout & stock reservation stored procedure
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DROP ALL INSECURE ANONYMOUS DEVELOPMENT POLICIES
-- ------------------------------------------------------------------------------

-- Products
DROP POLICY IF EXISTS "dev_anon_insert_products" ON public.products;
DROP POLICY IF EXISTS "dev_anon_update_products" ON public.products;
DROP POLICY IF EXISTS "dev_anon_delete_products" ON public.products;
DROP POLICY IF EXISTS "dev_anon_select_products" ON public.products;
DROP POLICY IF EXISTS "Public can view products" ON public.products;
DROP POLICY IF EXISTS "Public can view published products" ON public.products;
DROP POLICY IF EXISTS "Admin write access for products" ON public.products;
DROP POLICY IF EXISTS "Admins full access to products" ON public.products;
DROP POLICY IF EXISTS "Public can view active published products" ON public.products;
DROP POLICY IF EXISTS "Admins full management of products" ON public.products;
DROP POLICY IF EXISTS "Admins can view all products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;

-- Product Variants
DROP POLICY IF EXISTS "dev_anon_insert_variants" ON public.product_variants;
DROP POLICY IF EXISTS "dev_anon_update_variants" ON public.product_variants;
DROP POLICY IF EXISTS "dev_anon_delete_variants" ON public.product_variants;
DROP POLICY IF EXISTS "dev_anon_select_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Public can view variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admin write access for variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins full access to variants" ON public.product_variants;
DROP POLICY IF EXISTS "Public can view variants of active published products" ON public.product_variants;
DROP POLICY IF EXISTS "Admins full management of variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can view all variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can insert variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can update variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can delete variants" ON public.product_variants;

-- Product Colours
DROP POLICY IF EXISTS "dev_anon_insert_colours" ON public.product_colours;
DROP POLICY IF EXISTS "dev_anon_update_colours" ON public.product_colours;
DROP POLICY IF EXISTS "dev_anon_delete_colours" ON public.product_colours;
DROP POLICY IF EXISTS "dev_anon_select_colours" ON public.product_colours;
DROP POLICY IF EXISTS "Public can view colours" ON public.product_colours;
DROP POLICY IF EXISTS "Admin write access for colours" ON public.product_colours;
DROP POLICY IF EXISTS "Admins full access to colours" ON public.product_colours;
DROP POLICY IF EXISTS "Public can view colours of active published products" ON public.product_colours;
DROP POLICY IF EXISTS "Admins full management of colours" ON public.product_colours;
DROP POLICY IF EXISTS "Admins can view all colours" ON public.product_colours;
DROP POLICY IF EXISTS "Admins can insert colours" ON public.product_colours;
DROP POLICY IF EXISTS "Admins can update colours" ON public.product_colours;
DROP POLICY IF EXISTS "Admins can delete colours" ON public.product_colours;

-- Product Media
DROP POLICY IF EXISTS "dev_anon_insert_product_media" ON public.product_media;
DROP POLICY IF EXISTS "dev_anon_update_product_media" ON public.product_media;
DROP POLICY IF EXISTS "dev_anon_delete_product_media" ON public.product_media;
DROP POLICY IF EXISTS "dev_anon_select_product_media" ON public.product_media;
DROP POLICY IF EXISTS "Public can view media" ON public.product_media;
DROP POLICY IF EXISTS "Admin write access for media" ON public.product_media;
DROP POLICY IF EXISTS "Admins full access to media" ON public.product_media;
DROP POLICY IF EXISTS "Public can view media of active published products" ON public.product_media;
DROP POLICY IF EXISTS "Admins full management of media" ON public.product_media;
DROP POLICY IF EXISTS "Admins can view all media" ON public.product_media;
DROP POLICY IF EXISTS "Admins can insert media" ON public.product_media;
DROP POLICY IF EXISTS "Admins can update media" ON public.product_media;
DROP POLICY IF EXISTS "Admins can delete media" ON public.product_media;

-- Collections
DROP POLICY IF EXISTS "dev_anon_insert_collections" ON public.collections;
DROP POLICY IF EXISTS "dev_anon_update_collections" ON public.collections;
DROP POLICY IF EXISTS "dev_anon_delete_collections" ON public.collections;
DROP POLICY IF EXISTS "dev_anon_select_collections" ON public.collections;
DROP POLICY IF EXISTS "Public can view collections" ON public.collections;
DROP POLICY IF EXISTS "Admin write access for collections" ON public.collections;
DROP POLICY IF EXISTS "Admins full access to collections" ON public.collections;
DROP POLICY IF EXISTS "Public can view active collections" ON public.collections;
DROP POLICY IF EXISTS "Admins full management of collections" ON public.collections;
DROP POLICY IF EXISTS "Admins can view all collections" ON public.collections;
DROP POLICY IF EXISTS "Admins can insert collections" ON public.collections;
DROP POLICY IF EXISTS "Admins can update collections" ON public.collections;
DROP POLICY IF EXISTS "Admins can delete collections" ON public.collections;

-- Categories
DROP POLICY IF EXISTS "dev_anon_insert_categories" ON public.categories;
DROP POLICY IF EXISTS "dev_anon_update_categories" ON public.categories;
DROP POLICY IF EXISTS "dev_anon_delete_categories" ON public.categories;
DROP POLICY IF EXISTS "dev_anon_select_categories" ON public.categories;
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
DROP POLICY IF EXISTS "Admin write access for categories" ON public.categories;
DROP POLICY IF EXISTS "Admins full access to categories" ON public.categories;
DROP POLICY IF EXISTS "Public can view catalog categories" ON public.categories;
DROP POLICY IF EXISTS "Admins full management of categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can view all categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;

-- Orders
DROP POLICY IF EXISTS "dev_anon_insert_orders" ON public.orders;
DROP POLICY IF EXISTS "dev_anon_update_orders" ON public.orders;
DROP POLICY IF EXISTS "dev_anon_delete_orders" ON public.orders;
DROP POLICY IF EXISTS "dev_anon_select_orders" ON public.orders;
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;
DROP POLICY IF EXISTS "Public write access for orders" ON public.orders;
DROP POLICY IF EXISTS "Guest checkout can create orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view orders" ON public.orders;
DROP POLICY IF EXISTS "Super Admins can delete orders" ON public.orders;

-- Order Items
DROP POLICY IF EXISTS "dev_anon_insert_order_items" ON public.order_items;
DROP POLICY IF EXISTS "dev_anon_update_order_items" ON public.order_items;
DROP POLICY IF EXISTS "dev_anon_delete_order_items" ON public.order_items;
DROP POLICY IF EXISTS "dev_anon_select_order_items" ON public.order_items;
DROP POLICY IF EXISTS "Public can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Public write access for order items" ON public.order_items;
DROP POLICY IF EXISTS "Guest checkout can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can view order items" ON public.order_items;

-- Order Addresses
DROP POLICY IF EXISTS "dev_anon_insert_order_addresses" ON public.order_addresses;
DROP POLICY IF EXISTS "dev_anon_update_order_addresses" ON public.order_addresses;
DROP POLICY IF EXISTS "dev_anon_delete_order_addresses" ON public.order_addresses;
DROP POLICY IF EXISTS "dev_anon_select_order_addresses" ON public.order_addresses;
DROP POLICY IF EXISTS "Public can view order addresses" ON public.order_addresses;
DROP POLICY IF EXISTS "Public write access for order addresses" ON public.order_addresses;
DROP POLICY IF EXISTS "Guest checkout can create order addresses" ON public.order_addresses;
DROP POLICY IF EXISTS "Admins can view all order addresses" ON public.order_addresses;
DROP POLICY IF EXISTS "Admins can view order addresses" ON public.order_addresses;

-- ------------------------------------------------------------------------------
-- 2. ENSURE ROW LEVEL SECURITY IS STRICTLY ENABLED
-- ------------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_colours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_addresses ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. PROVISION ADMIN AUTHORIZATION TABLE (public.admin_users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER tr_admin_users_updated_at
    BEFORE UPDATE ON public.admin_users
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 4. SECURE ADMIN CHECK FUNCTIONS (SECURITY DEFINER, FIXED SEARCH PATH)
-- ------------------------------------------------------------------------------

-- Generic Admin Check (any canonical role: super_admin, admin, manager)
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

-- Role-Aware Hierarchy Check
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

-- Super Admin Shortcut Helper
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.has_admin_role('super_admin');
$$;

-- ------------------------------------------------------------------------------
-- 5. SAFE EXPLICIT ADMIN BOOTSTRAPPING (NO AUTOMATIC FIRST-USER PROMOTION)
-- ------------------------------------------------------------------------------
-- SECURITY MANDATE: Do NOT automatically promote arbitrary or first-registered
-- auth users to super_admin.
--
-- To designate an initial Super Admin, the project owner can execute in Supabase SQL editor:
--   INSERT INTO public.admin_users (user_id, role)
--   VALUES ('<YOUR_AUTH_USER_UUID>', 'super_admin')
--   ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin', updated_at = now();
--
-- Alternatively, use the secure server-only RPC function below (service_role only):

CREATE OR REPLACE FUNCTION public.bootstrap_admin_user(
  p_user_id UUID,
  p_role TEXT DEFAULT 'super_admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_role NOT IN ('super_admin', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Invalid role: %. Valid roles are: super_admin, admin, manager', p_role;
  END IF;

  INSERT INTO public.admin_users (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id) DO UPDATE 
    SET role = EXCLUDED.role, 
        updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'role', p_role
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bootstrap_admin_user FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin_user TO service_role;

-- ------------------------------------------------------------------------------
-- 6. ADMIN USERS TABLE RLS POLICIES (NO ANON ACCESS)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Super Admins can manage admin_users" ON public.admin_users;

-- Authenticated admins can view the admin team roster
CREATE POLICY "Admins can view admin_users"
    ON public.admin_users FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- Only Super Admins can insert, update, or delete admin user roles
CREATE POLICY "Super Admins can manage admin_users"
    ON public.admin_users FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 7. PUBLIC READ POLICIES (MINIMAL PRIVILEGE FOR PUBLIC STOREFRONT)
-- ------------------------------------------------------------------------------

-- Products: Public can read ONLY active + published products
CREATE POLICY "Public can view active published products"
    ON public.products FOR SELECT
    TO public
    USING (status = 'active' AND published = true);

-- Collections: Public can read ONLY active collections
CREATE POLICY "Public can view active collections"
    ON public.collections FOR SELECT
    TO public
    USING (is_active = true);

-- Categories: Public can read public taxonomy categories
CREATE POLICY "Public can view catalog categories"
    ON public.categories FOR SELECT
    TO public
    USING (true);

-- Product Variants: Public can read only variants belonging to an active + published product
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

-- Product Colours: Public can read only colours belonging to an active + published product
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

-- Product Media: Public can read only media belonging to an active + published product
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

-- ------------------------------------------------------------------------------
-- 8. AUTHENTICATED ADMIN POLICIES (ROLE MATRIX ENFORCEMENT)
-- ------------------------------------------------------------------------------

-- Products:
-- - All Admin roles can SELECT all products (including drafts & archived)
-- - Managers, Admins, Super Admins can INSERT and UPDATE products
-- - Admins and Super Admins can DELETE products (Managers cannot delete products)
CREATE POLICY "Admins can view all products"
    ON public.products FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admins can insert products"
    ON public.products FOR INSERT
    TO authenticated
    WITH CHECK (public.has_admin_role('manager'));

CREATE POLICY "Admins can update products"
    ON public.products FOR UPDATE
    TO authenticated
    USING (public.has_admin_role('manager'))
    WITH CHECK (public.has_admin_role('manager'));

CREATE POLICY "Admins can delete products"
    ON public.products FOR DELETE
    TO authenticated
    USING (public.has_admin_role('admin'));

-- Product Variants:
CREATE POLICY "Admins can view all variants"
    ON public.product_variants FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admins can insert variants"
    ON public.product_variants FOR INSERT
    TO authenticated
    WITH CHECK (public.has_admin_role('manager'));

CREATE POLICY "Admins can update variants"
    ON public.product_variants FOR UPDATE
    TO authenticated
    USING (public.has_admin_role('manager'))
    WITH CHECK (public.has_admin_role('manager'));

CREATE POLICY "Admins can delete variants"
    ON public.product_variants FOR DELETE
    TO authenticated
    USING (public.has_admin_role('admin'));

-- Product Colours:
CREATE POLICY "Admins can view all colours"
    ON public.product_colours FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admins can insert colours"
    ON public.product_colours FOR INSERT
    TO authenticated
    WITH CHECK (public.has_admin_role('manager'));

CREATE POLICY "Admins can update colours"
    ON public.product_colours FOR UPDATE
    TO authenticated
    USING (public.has_admin_role('manager'))
    WITH CHECK (public.has_admin_role('manager'));

CREATE POLICY "Admins can delete colours"
    ON public.product_colours FOR DELETE
    TO authenticated
    USING (public.has_admin_role('admin'));

-- Product Media:
CREATE POLICY "Admins can view all media"
    ON public.product_media FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admins can insert media"
    ON public.product_media FOR INSERT
    TO authenticated
    WITH CHECK (public.has_admin_role('manager'));

CREATE POLICY "Admins can update media"
    ON public.product_media FOR UPDATE
    TO authenticated
    USING (public.has_admin_role('manager'))
    WITH CHECK (public.has_admin_role('manager'));

CREATE POLICY "Admins can delete media"
    ON public.product_media FOR DELETE
    TO authenticated
    USING (public.has_admin_role('manager'));

-- Collections (Catalog Structure: Admin/Super Admin only):
CREATE POLICY "Admins can view all collections"
    ON public.collections FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admins can insert collections"
    ON public.collections FOR INSERT
    TO authenticated
    WITH CHECK (public.has_admin_role('admin'));

CREATE POLICY "Admins can update collections"
    ON public.collections FOR UPDATE
    TO authenticated
    USING (public.has_admin_role('admin'))
    WITH CHECK (public.has_admin_role('admin'));

CREATE POLICY "Admins can delete collections"
    ON public.collections FOR DELETE
    TO authenticated
    USING (public.has_admin_role('admin'));

-- Categories (Catalog Structure: Admin/Super Admin only):
CREATE POLICY "Admins can view all categories"
    ON public.categories FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admins can insert categories"
    ON public.categories FOR INSERT
    TO authenticated
    WITH CHECK (public.has_admin_role('admin'));

CREATE POLICY "Admins can update categories"
    ON public.categories FOR UPDATE
    TO authenticated
    USING (public.has_admin_role('admin'))
    WITH CHECK (public.has_admin_role('admin'));

CREATE POLICY "Admins can delete categories"
    ON public.categories FOR DELETE
    TO authenticated
    USING (public.has_admin_role('admin'));

-- ------------------------------------------------------------------------------
-- 9. STRICT ORDER PRIVACY (NO ANONYMOUS ACCESS)
-- ------------------------------------------------------------------------------

-- Orders: Authenticated Admins can SELECT
CREATE POLICY "Admins can view orders"
    ON public.orders FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- Orders: Managers/Admins can UPDATE operational fields (fulfilment, payment, order status)
CREATE POLICY "Admins can update orders"
    ON public.orders FOR UPDATE
    TO authenticated
    USING (public.has_admin_role('manager'))
    WITH CHECK (public.has_admin_role('manager'));

-- Orders: Only Super Admins can DELETE orders
CREATE POLICY "Super Admins can delete orders"
    ON public.orders FOR DELETE
    TO authenticated
    USING (public.is_super_admin());

-- Order Items: Authenticated Admins only
CREATE POLICY "Admins can view order items"
    ON public.order_items FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- Order Addresses: Authenticated Admins only
CREATE POLICY "Admins can view order addresses"
    ON public.order_addresses FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 10. AUTHORITATIVE SERVER-SIDE ATOMIC CHECKOUT & STOCK RESERVATION RPC
-- ------------------------------------------------------------------------------
-- SECURITY MANDATES:
-- - Server-side only: NO EXECUTE permission for anon role.
-- - Calculates authoritative subtotal/total from database prices (products.selling_price).
-- - Validates that variant belongs to referenced product.
-- - Validates quantity > 0.
-- - Locks variant row (FOR UPDATE) to verify and atomically decrement stock.
-- - Enforces pending payment and confirmed order statuses.
-- - Inserts orders, order_items, and order_addresses in a single ACID transaction.

CREATE OR REPLACE FUNCTION public.process_checkout_order(
  p_order_number TEXT,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_address_line1 TEXT,
  p_address_line2 TEXT,
  p_suburb TEXT,
  p_city TEXT,
  p_province TEXT,
  p_postal_code TEXT,
  p_country TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_variant_id UUID;
  v_product_id UUID;
  v_variant_prod_id UUID;
  v_qty INT;
  v_current_stock INT;
  v_sku TEXT;
  v_colour TEXT;
  v_size TEXT;
  v_product_name TEXT;
  v_authoritative_price NUMERIC(10,2);
  v_product_status TEXT;
  v_product_published BOOLEAN;
  v_line_total NUMERIC(10,2);
  v_calculated_subtotal NUMERIC(10,2) := 0.00;
  v_calculated_shipping NUMERIC(10,2) := 0.00;
  v_calculated_total NUMERIC(10,2) := 0.00;
BEGIN
  -- Validate payload items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order items payload cannot be empty';
  END IF;

  IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;

  IF p_customer_email IS NULL OR trim(p_customer_email) = '' THEN
    RAISE EXCEPTION 'Customer email is required';
  END IF;

  -- 1. Validate & lock inventory for each item, compute authoritative prices
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := (v_item->>'variant_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid order quantity (%) requested', v_qty;
    END IF;

    -- Validate and lock variant row
    SELECT pv.stock_quantity, pv.sku, pv.colour, pv.size, pv.product_id
    INTO v_current_stock, v_sku, v_colour, v_size, v_variant_prod_id
    FROM public.product_variants pv
    WHERE pv.id = v_variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product variant % does not exist', v_variant_id;
    END IF;

    IF v_variant_prod_id != v_product_id THEN
      RAISE EXCEPTION 'Variant % does not belong to product %', v_variant_id, v_product_id;
    END IF;

    IF v_current_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for % (Available: %, Requested: %)', 
        COALESCE(v_sku, v_variant_id::TEXT), v_current_stock, v_qty;
    END IF;

    -- Look up authoritative product price and active/published status from database
    SELECT p.name, p.selling_price, p.status, p.published
    INTO v_product_name, v_authoritative_price, v_product_status, v_product_published
    FROM public.products p
    WHERE p.id = v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % does not exist in catalog', v_product_id;
    END IF;

    IF v_product_status != 'active' OR NOT v_product_published THEN
      RAISE EXCEPTION 'Product % is not available for purchase', v_product_name;
    END IF;

    v_line_total := ROUND(v_authoritative_price * v_qty, 2);
    v_calculated_subtotal := v_calculated_subtotal + v_line_total;
  END LOOP;

  -- 2. Compute authoritative shipping & total according to store policy:
  -- Free shipping for orders >= ZAR 1000, otherwise ZAR 150 standard courier
  IF v_calculated_subtotal >= 1000.00 THEN
    v_calculated_shipping := 0.00;
  ELSE
    v_calculated_shipping := 150.00;
  END IF;

  v_calculated_total := v_calculated_subtotal + v_calculated_shipping;

  -- 3. Insert primary Order record with authoritative financial totals
  INSERT INTO public.orders (
    order_number,
    customer_name,
    customer_email,
    customer_phone,
    subtotal,
    shipping_amount,
    total,
    currency,
    payment_status,
    order_status,
    fulfilment_status,
    created_at,
    updated_at
  ) VALUES (
    p_order_number,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    v_calculated_subtotal,
    v_calculated_shipping,
    v_calculated_total,
    'ZAR',
    'pending',
    'confirmed',
    'pending',
    now(),
    now()
  ) RETURNING id INTO v_order_id;

  -- 4. Insert Order Items snapshots & Decrement Stock atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := (v_item->>'variant_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;

    -- Re-fetch variant details for snapshot
    SELECT pv.sku, pv.colour, pv.size
    INTO v_sku, v_colour, v_size
    FROM public.product_variants pv
    WHERE pv.id = v_variant_id;

    -- Fetch authoritative product price
    SELECT p.name, p.selling_price
    INTO v_product_name, v_authoritative_price
    FROM public.products p
    WHERE p.id = v_product_id;

    v_line_total := ROUND(v_authoritative_price * v_qty, 2);

    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      product_name_snapshot,
      sku_snapshot,
      colour_snapshot,
      size_snapshot,
      unit_price,
      quantity,
      line_total,
      created_at
    ) VALUES (
      v_order_id,
      v_product_id,
      v_variant_id,
      v_product_name,
      v_sku,
      v_colour,
      v_size,
      v_authoritative_price,
      v_qty,
      v_line_total,
      now()
    );

    -- Decrement stock safely
    UPDATE public.product_variants
    SET stock_quantity = stock_quantity - v_qty,
        updated_at = now()
    WHERE id = v_variant_id;
  END LOOP;

  -- 5. Insert Order Address snapshot if address provided
  IF p_address_line1 IS NOT NULL AND trim(p_address_line1) != '' THEN
    INSERT INTO public.order_addresses (
      order_id,
      address_line1,
      address_line2,
      suburb,
      city,
      province,
      postal_code,
      country,
      created_at
    ) VALUES (
      v_order_id,
      p_address_line1,
      p_address_line2,
      p_suburb,
      p_city,
      p_province,
      p_postal_code,
      COALESCE(p_country, 'South Africa'),
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', p_order_number,
    'subtotal', v_calculated_subtotal,
    'shipping_amount', v_calculated_shipping,
    'total', v_calculated_total
  );
END;
$$;

-- CRITICAL SECURITY: REVOKE EXECUTE from public, anon, and authenticated roles; allow ONLY service_role
REVOKE EXECUTE ON FUNCTION public.process_checkout_order FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_checkout_order TO service_role;

-- ------------------------------------------------------------------------------
-- 11. SUPABASE STORAGE SECURITY (product-media bucket)
-- ------------------------------------------------------------------------------
-- Ensure bucket exists and has correct public read status
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-media', 'product-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop insecure storage policies if any exist
DROP POLICY IF EXISTS "Public can view product media files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload product media files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update product media files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product media files" ON storage.objects;
DROP POLICY IF EXISTS "dev_anon_storage_insert" ON storage.objects;

-- Public can SELECT objects in product-media bucket
CREATE POLICY "Public can view product media files"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'product-media');

-- Only authenticated Admins can upload, update, or delete in product-media bucket
CREATE POLICY "Admins can upload product media files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'product-media' AND public.has_admin_role('manager'));

CREATE POLICY "Admins can update product media files"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'product-media' AND public.has_admin_role('manager'));

CREATE POLICY "Admins can delete product media files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'product-media' AND public.has_admin_role('manager'));

-- ==============================================================================
-- END OF MIGRATION
-- ==============================================================================
