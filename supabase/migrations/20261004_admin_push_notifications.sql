-- ==============================================================================
-- VERITAS ADMIN BACKGROUND WEB PUSH NOTIFICATIONS MIGRATION (PHASE 1)
-- Migration file: supabase/migrations/20261004_admin_push_notifications.sql
-- ==============================================================================

-- 1. Table: public.admin_push_subscriptions
CREATE TABLE IF NOT EXISTS public.admin_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES public.admin_users(user_id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    device_name TEXT,
    user_agent_summary TEXT,
    preferences JSONB NOT NULL DEFAULT '{"paid_order": true, "low_stock": true, "out_of_stock": true, "upcoming_release": true, "payment_attention": true}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT chk_push_preferences_valid CHECK (
        jsonb_typeof(preferences) = 'object'
        AND (preferences - ARRAY['paid_order', 'low_stock', 'out_of_stock', 'upcoming_release', 'payment_attention'] = '{}'::jsonb)
        AND (NOT (preferences ? 'paid_order') OR jsonb_typeof(preferences->'paid_order') = 'boolean')
        AND (NOT (preferences ? 'low_stock') OR jsonb_typeof(preferences->'low_stock') = 'boolean')
        AND (NOT (preferences ? 'out_of_stock') OR jsonb_typeof(preferences->'out_of_stock') = 'boolean')
        AND (NOT (preferences ? 'upcoming_release') OR jsonb_typeof(preferences->'upcoming_release') = 'boolean')
        AND (NOT (preferences ? 'payment_attention') OR jsonb_typeof(preferences->'payment_attention') = 'boolean')
    )
);

-- Indexing for lookup, dispatch, and cleanup
CREATE INDEX IF NOT EXISTS idx_admin_push_subscriptions_admin ON public.admin_push_subscriptions (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_push_subscriptions_revoked ON public.admin_push_subscriptions (revoked_at);

-- 2. Table: public.admin_push_deliveries (Idempotent delivery audit tracking)
CREATE TABLE IF NOT EXISTS public.admin_push_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES public.admin_notifications(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES public.admin_push_subscriptions(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
    http_status INTEGER,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_admin_push_deliveries UNIQUE (notification_id, subscription_id)
);

-- Indexing for dispatch tracking and stats
CREATE INDEX IF NOT EXISTS idx_admin_push_deliveries_notif ON public.admin_push_deliveries (notification_id);
CREATE INDEX IF NOT EXISTS idx_admin_push_deliveries_sub ON public.admin_push_deliveries (subscription_id);
CREATE INDEX IF NOT EXISTS idx_admin_push_deliveries_status ON public.admin_push_deliveries (status);

-- 3. Row Level Security (RLS) Configuration
ALTER TABLE public.admin_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_push_deliveries ENABLE ROW LEVEL SECURITY;

-- Policy: Active Modern Admins can manage only their own device subscriptions
DROP POLICY IF EXISTS "Admins manage their own push subscriptions" ON public.admin_push_subscriptions;
CREATE POLICY "Admins manage their own push subscriptions"
    ON public.admin_push_subscriptions FOR ALL
    TO authenticated
    USING (
        admin_user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
              AND au.is_active = true
              AND au.role IN ('super_admin', 'operations', 'marketing', 'finance')
        )
    )
    WITH CHECK (
        admin_user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
              AND au.is_active = true
              AND au.role IN ('super_admin', 'operations', 'marketing', 'finance')
        )
    );

-- Policy: Service role has full access to query and manage push subscriptions
DROP POLICY IF EXISTS "Service role manages push subscriptions" ON public.admin_push_subscriptions;
CREATE POLICY "Service role manages push subscriptions"
    ON public.admin_push_subscriptions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Active Modern Admins can view delivery logs for their own device subscriptions
DROP POLICY IF EXISTS "Admins view their own push deliveries" ON public.admin_push_deliveries;
CREATE POLICY "Admins view their own push deliveries"
    ON public.admin_push_deliveries FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_push_subscriptions aps
            WHERE aps.id = admin_push_deliveries.subscription_id
              AND aps.admin_user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
              AND au.is_active = true
              AND au.role IN ('super_admin', 'operations', 'marketing', 'finance')
        )
    );

-- Policy: Service role manages all push deliveries
DROP POLICY IF EXISTS "Service role manages push deliveries" ON public.admin_push_deliveries;
CREATE POLICY "Service role manages push deliveries"
    ON public.admin_push_deliveries FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
