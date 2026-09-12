-- ==============================================================================
-- VERITAS PARTNER ROLE-BASED ACCESS CONTROL (RBAC) MIGRATION
-- Migration Version: 2026-09-12
--
-- Objective:
--   1. Add is_active column to public.admin_users with default true
--   2. Expand role constraint to include partner roles:
--      'super_admin', 'operations', 'marketing', 'finance', 'admin', 'manager'
--   3. Update security definer functions: is_admin(), has_admin_role(), is_super_admin()
--   4. Ensure Super-Admin-Only policies on admin_users table
--   5. Provision audit_logs table for multi-partner activity tracking
-- ==============================================================================

-- 1. ALTER TABLE public.admin_users: Add is_active column
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. UPDATE ROLE CHECK CONSTRAINT
ALTER TABLE public.admin_users 
DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE public.admin_users 
ADD CONSTRAINT admin_users_role_check 
CHECK (role IN ('super_admin', 'operations', 'marketing', 'finance', 'admin', 'manager'));

-- 3. UPDATE HELPER FUNCTIONS WITH is_active CHECK AND PARTNER ROLES

-- Generic Active Admin Check
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
      AND (is_active IS TRUE)
      AND role IN ('super_admin', 'operations', 'marketing', 'finance', 'admin', 'manager')
  );
$$;

-- Specific Role Check
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
        (required_role = 'admin' AND role IN ('super_admin', 'admin')) OR
        (required_role = 'manager' AND role IN ('super_admin', 'operations', 'admin', 'manager'))
      )
  );
$$;

-- Super Admin Only Helper
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

-- 4. CREATE OR UPDATE AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    action_label TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can view audit logs"
    ON public.admin_audit_logs FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can insert audit logs"
    ON public.admin_audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());
