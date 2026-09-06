-- ==============================================================================
-- VERITAS PRODUCTION SECURITY HARDENING & RLS MIGRATION
-- Migration Date: 2026-09-03
-- Purpose:
--   1. Resolve Supabase Security Advisor "function_search_path_mutable" on public.set_updated_at
--   2. Provision RBAC admin_users table & is_admin() / is_super_admin() security definers
--   3. Replace dangerous development "USING (true)" anon write policies with authenticated/admin-only policies
--   4. Harden order privacy: Guest checkout can INSERT new orders, but only authenticated admins can SELECT/UPDATE
--   5. Provision audit_logs table for administrative compliance
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FIX FUNCTION SEARCH PATH WARNING (Supabase Security Advisor)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 2. RBAC INFRASTRUCTURE (admin_users table & security functions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('super_admin', 'admin', 'manager')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()) OR
            (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'admin', 'manager') OR
            (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'manager') OR
            (auth.jwt() ->> 'email') = 'mimikwande777@gmail.com'
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND role = 'super_admin') OR
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin' OR
            (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin' OR
            (auth.jwt() ->> 'email') = 'mimikwande777@gmail.com'
        )
    );
END;
$$;

-- Admin users RLS: Only super_admin can modify admin_users; authenticated admins can view
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
-- 3. AUDIT LOGGING TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    actor_email TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" 
    ON public.audit_logs FOR SELECT 
    TO authenticated 
    USING (public.is_admin());

CREATE POLICY "Admins can insert audit logs" 
    ON public.audit_logs FOR INSERT 
    TO authenticated 
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 4. DROP DANGEROUS ANONYMOUS DEVELOPMENT WRITE POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin write access for products" ON public.products;
DROP POLICY IF EXISTS "Admin write access for variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admin write access for media" ON public.product_media;
DROP POLICY IF EXISTS "Admin write access for categories" ON public.categories;
DROP POLICY IF EXISTS "Admin write access for collections" ON public.collections;
DROP POLICY IF EXISTS "Admin write access for colours" ON public.product_colours;

-- ------------------------------------------------------------------------------
-- 5. APPLY AUTHENTICATED / ADMIN-ONLY WRITE POLICIES
-- ------------------------------------------------------------------------------

-- Products: Admins have full write; public can only read published + active
CREATE POLICY "Admins full access to products" 
    ON public.products FOR ALL 
    TO authenticated 
    USING (public.is_admin()) 
    WITH CHECK (public.is_admin());

-- Product Variants
CREATE POLICY "Admins full access to variants" 
    ON public.product_variants FOR ALL 
    TO authenticated 
    USING (public.is_admin()) 
    WITH CHECK (public.is_admin());

-- Product Colours
CREATE POLICY "Admins full access to colours" 
    ON public.product_colours FOR ALL 
    TO authenticated 
    USING (public.is_admin()) 
    WITH CHECK (public.is_admin());

-- Product Media
CREATE POLICY "Admins full access to media" 
    ON public.product_media FOR ALL 
    TO authenticated 
    USING (public.is_admin()) 
    WITH CHECK (public.is_admin());

-- Categories
CREATE POLICY "Admins full access to categories" 
    ON public.categories FOR ALL 
    TO authenticated 
    USING (public.is_admin()) 
    WITH CHECK (public.is_admin());

-- Collections
CREATE POLICY "Admins full access to collections" 
    ON public.collections FOR ALL 
    TO authenticated 
    USING (public.is_admin()) 
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 6. ORDER PRIVACY & GUEST CHECKOUT ACCESS
-- ------------------------------------------------------------------------------
-- Remove overly permissive policies on orders, items, and addresses
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;
DROP POLICY IF EXISTS "Public write access for orders" ON public.orders;
DROP POLICY IF EXISTS "Public can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Public write access for order items" ON public.order_items;
DROP POLICY IF EXISTS "Public can view order addresses" ON public.order_addresses;
DROP POLICY IF EXISTS "Public write access for order addresses" ON public.order_addresses;

-- Guest Checkout: Allow INSERT of new orders, items, and addresses
CREATE POLICY "Guest checkout can create orders" 
    ON public.orders FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);

CREATE POLICY "Guest checkout can create order items" 
    ON public.order_items FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);

CREATE POLICY "Guest checkout can create order addresses" 
    ON public.order_addresses FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);

-- Admin Orders: Authenticated administrators can SELECT and UPDATE orders
CREATE POLICY "Admins can view all orders" 
    ON public.orders FOR SELECT 
    TO authenticated 
    USING (public.is_admin());

CREATE POLICY "Admins can update orders" 
    ON public.orders FOR UPDATE 
    TO authenticated 
    USING (public.is_admin()) 
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can view all order items" 
    ON public.order_items FOR SELECT 
    TO authenticated 
    USING (public.is_admin());

CREATE POLICY "Admins can view all order addresses" 
    ON public.order_addresses FOR SELECT 
    TO authenticated 
    USING (public.is_admin());

-- Customers Table
DROP POLICY IF EXISTS "Public can view customers" ON public.customers;
DROP POLICY IF EXISTS "Public write access for customers" ON public.customers;

CREATE POLICY "Guest checkout can insert customer" 
    ON public.customers FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);

CREATE POLICY "Admins can view customers" 
    ON public.customers FOR SELECT 
    TO authenticated 
    USING (public.is_admin());

CREATE POLICY "Admins can update customers" 
    ON public.customers FOR UPDATE 
    TO authenticated 
    USING (public.is_admin()) 
    WITH CHECK (public.is_admin());
