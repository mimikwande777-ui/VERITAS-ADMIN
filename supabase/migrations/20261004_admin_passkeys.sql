-- ==============================================================================
-- VERITAS ADMIN PASSKEYS & WEBAUTHN BIOMETRIC AUTHENTICATION MIGRATION
-- Migration file: supabase/migrations/20261004_admin_passkeys.sql
-- ==============================================================================

-- 1. Table: public.admin_passkeys (Stores WebAuthn Public Key Credentials)
-- Note: Raw biometric templates, fingerprints, and face scans are NEVER received or stored.
CREATE TABLE IF NOT EXISTS public.admin_passkeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES public.admin_users(user_id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE, -- Base64URL credential ID
    public_key TEXT NOT NULL, -- Base64URL encoded public key
    counter BIGINT NOT NULL DEFAULT 0,
    transports TEXT[] DEFAULT '{}',
    device_type TEXT, -- e.g. 'singleDevice' | 'multiDevice'
    backed_up BOOLEAN DEFAULT false,
    device_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

-- Indexing for authentication credential lookup
CREATE INDEX IF NOT EXISTS idx_admin_passkeys_user ON public.admin_passkeys (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_passkeys_cred_id ON public.admin_passkeys (credential_id);
CREATE INDEX IF NOT EXISTS idx_admin_passkeys_revoked ON public.admin_passkeys (revoked_at);

-- 2. Table: public.admin_webauthn_challenges (Single-Use Cryptographic Challenges)
CREATE TABLE IF NOT EXISTS public.admin_webauthn_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge TEXT NOT NULL UNIQUE,
    admin_user_id UUID REFERENCES public.admin_users(user_id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for challenge verification and automatic cleanup
CREATE INDEX IF NOT EXISTS idx_admin_webauthn_challenges_token ON public.admin_webauthn_challenges (challenge);
CREATE INDEX IF NOT EXISTS idx_admin_webauthn_challenges_expiry ON public.admin_webauthn_challenges (expires_at);

-- 3. Row Level Security (RLS) Configuration
ALTER TABLE public.admin_passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Policy: Active Modern Admins can view and manage their own passkey metadata
DROP POLICY IF EXISTS "Admins manage their own passkeys" ON public.admin_passkeys;
CREATE POLICY "Admins manage their own passkeys"
    ON public.admin_passkeys FOR ALL
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

-- Policy: Service role has full access for server-side verification and credential lookup
DROP POLICY IF EXISTS "Service role manages passkeys" ON public.admin_passkeys;
CREATE POLICY "Service role manages passkeys"
    ON public.admin_passkeys FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: WebAuthn challenges are strictly service-role managed (no client direct access)
DROP POLICY IF EXISTS "Service role manages webauthn challenges" ON public.admin_webauthn_challenges;
CREATE POLICY "Service role manages webauthn challenges"
    ON public.admin_webauthn_challenges FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
