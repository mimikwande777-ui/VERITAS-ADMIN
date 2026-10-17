-- ==============================================================================
-- VERITAS CUSTOMER CONTACTS & MARKETING SYSTEM
-- Migration: supabase/migrations/20261014_customer_contacts_and_marketing.sql
-- ==============================================================================

-- 1. Table: public.customer_contacts
CREATE TABLE IF NOT EXISTS public.customer_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL UNIQUE,                -- Normalized E.164 format (+27821234567)
    raw_phone_number TEXT,                            -- As provided by user
    is_whatsapp BOOLEAN NOT NULL DEFAULT false,       -- User confirms number has active WhatsApp
    whatsapp_number TEXT,                             -- WhatsApp specific E.164 number
    email TEXT,                                       -- Optional normalized lowercase email
    first_name TEXT,                                  -- Optional
    last_name TEXT,                                   -- Optional
    
    -- Explicit Granular Marketing Consents (NEVER TRUE BY DEFAULT)
    email_marketing_consent BOOLEAN NOT NULL DEFAULT false,
    whatsapp_marketing_consent BOOLEAN NOT NULL DEFAULT false,
    
    -- Timestamps of explicit consent actions
    email_consent_updated_at TIMESTAMPTZ,
    whatsapp_consent_updated_at TIMESTAMPTZ,
    
    -- Unsubscribe timestamps
    email_unsubscribed_at TIMESTAMPTZ,
    whatsapp_unsubscribed_at TIMESTAMPTZ,
    
    -- Consent Audit Trail & Evidentiary Metadata
    consent_source TEXT NOT NULL DEFAULT 'web_registration' CHECK (consent_source IN ('web_registration', 'vip_modal', 'checkout', 'preference_center', 'admin_manual', 'store_concierge')),
    consent_ip_hash TEXT,                             -- Anonymized / hashed IP for POPIA/GDPR privacy compliance
    consent_user_agent TEXT,
    
    -- Lifecycle and Suppression Status
    marketing_status TEXT NOT NULL DEFAULT 'active' CHECK (marketing_status IN ('active', 'unsubscribed', 'suppressed', 'pending')),
    suppression_reason TEXT,
    
    -- Secret token for secure one-click preference management without password login
    preference_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    
    -- Provider Synchronization tracking
    email_provider_synced BOOLEAN NOT NULL DEFAULT false,
    email_provider_id TEXT,
    email_provider_synced_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for Query Performance and Deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_contacts_phone ON public.customer_contacts (phone_number);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_email ON public.customer_contacts (email);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_email_consent ON public.customer_contacts (email_marketing_consent);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_whatsapp_consent ON public.customer_contacts (whatsapp_marketing_consent);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_status ON public.customer_contacts (marketing_status);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_token ON public.customer_contacts (preference_token);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_created_at ON public.customer_contacts (created_at DESC);

-- 3. Row Level Security (RLS) Configuration
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

-- Restrict all public/anon direct access (prevent harvesting or scraping)
DROP POLICY IF EXISTS "Public contacts read denied" ON public.customer_contacts;
-- (No SELECT policy for anon = zero anon read access)

-- Admin Read Policy (Authenticated modern partners)
DROP POLICY IF EXISTS "Admins can view customer contacts" ON public.customer_contacts;
CREATE POLICY "Admins can view customer contacts"
    ON public.customer_contacts FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
              AND au.is_active = true
              AND au.role IN ('super_admin', 'operations', 'marketing', 'finance')
        )
    );

-- Admin Mutation Policy (Super Admin and Marketing partners)
DROP POLICY IF EXISTS "Admins can manage customer contacts" ON public.customer_contacts;
CREATE POLICY "Admins can manage customer contacts"
    ON public.customer_contacts FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
              AND au.is_active = true
              AND au.role IN ('super_admin', 'marketing')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
              AND au.is_active = true
              AND au.role IN ('super_admin', 'marketing')
        )
    );

-- 4. Trigger for Auto-Updating updated_at
DROP TRIGGER IF EXISTS trg_customer_contacts_updated_at ON public.customer_contacts;
CREATE TRIGGER trg_customer_contacts_updated_at
    BEFORE UPDATE ON public.customer_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
