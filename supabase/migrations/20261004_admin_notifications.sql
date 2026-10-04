-- ==============================================================================
-- VERITAS ADMIN NOTIFICATION CENTRE & PER-ADMIN READ STATE MIGRATION
-- Migration file: supabase/migrations/20261004_admin_notifications.sql
-- ==============================================================================

-- 1. Table: public.admin_notifications
CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('paid_order', 'low_stock', 'out_of_stock', 'upcoming_release', 'payment_attention', 'delivery_failure')),
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'medium', 'high')),
    title TEXT NOT NULL,
    message TEXT,
    entity_type TEXT, -- 'order', 'inventory', 'product', 'system'
    entity_id UUID,
    target_role TEXT CHECK (target_role IS NULL OR target_role IN ('super_admin', 'operations', 'marketing', 'finance')),
    metadata JSONB DEFAULT '{}'::jsonb,
    dedup_key TEXT UNIQUE, -- Ensures idempotent event generation (e.g., 'paid_order_<order_id>', 'out_of_stock_<variant_id>')
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for rapid queries and role filtering
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON public.admin_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON public.admin_notifications (type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_target_role ON public.admin_notifications (target_role);

-- 2. Table: public.admin_notification_reads (Per-Admin Read State)
CREATE TABLE IF NOT EXISTS public.admin_notification_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES public.admin_notifications(id) ON DELETE CASCADE,
    admin_user_id UUID NOT NULL REFERENCES public.admin_users(user_id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_admin_notification_reads UNIQUE (notification_id, admin_user_id)
);

-- Indexing for unread counts and lookups
CREATE INDEX IF NOT EXISTS idx_admin_notification_reads_admin ON public.admin_notification_reads (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_notification_reads_notif ON public.admin_notification_reads (notification_id);

-- 3. Row Level Security (RLS) Configuration
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_reads ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated Admins can view notifications matching their role or universal notifications
DROP POLICY IF EXISTS "Admins can view notifications" ON public.admin_notifications;
CREATE POLICY "Admins can view notifications"
    ON public.admin_notifications FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
              AND au.is_active = true
              AND (
                  public.admin_notifications.target_role IS NULL
                  OR public.admin_notifications.target_role = au.role
                  OR au.role = 'super_admin'
              )
        )
    );

-- Policy: Service role has full access to insert/update notifications
DROP POLICY IF EXISTS "Service role manages notifications" ON public.admin_notifications;
CREATE POLICY "Service role manages notifications"
    ON public.admin_notifications FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Active Admins can manage their own notification read receipts
DROP POLICY IF EXISTS "Admins manage their own read receipts" ON public.admin_notification_reads;
CREATE POLICY "Admins manage their own read receipts"
    ON public.admin_notification_reads FOR ALL
    TO authenticated
    USING (
        admin_user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
              AND au.is_active = true
        )
    )
    WITH CHECK (
        admin_user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
              AND au.is_active = true
        )
    );

-- Policy: Service role manages all read receipts
DROP POLICY IF EXISTS "Service role manages read receipts" ON public.admin_notification_reads;
CREATE POLICY "Service role manages read receipts"
    ON public.admin_notification_reads FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
