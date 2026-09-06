-- ==============================================================================
-- VERITAS CORRECTIVE STORAGE MIGRATION: PRODUCT-MEDIA SECURITY HARDENING
-- Migration Version: 2026-09-05
-- Purpose: 
--   1. Safely remove any lingering permissive anonymous/public upload/write policies on storage.objects
--   2. Enforce strict public SELECT (read-only) for storefront images
--   3. Restrict INSERT, UPDATE, and DELETE on 'product-media' exclusively to verified Admins via public.is_admin()
--   4. Preserve all existing media files and maintain public bucket URL resolution
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENSURE BUCKET EXISTS AND REMAINS PUBLIC FOR CDN / STOREFRONT READS
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-media', 'product-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ------------------------------------------------------------------------------
-- 2. ENSURE ROW LEVEL SECURITY IS ACTIVE ON STORAGE.OBJECTS
-- ------------------------------------------------------------------------------
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. REMOVE ALL INSECURE OR PERMISSIVE POLICIES AFFECTING PRODUCT-MEDIA
-- ------------------------------------------------------------------------------
-- Explicit drops for standard and previously created policy names
DROP POLICY IF EXISTS "Public can view product media files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload product media files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update product media files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product media files" ON storage.objects;
DROP POLICY IF EXISTS "dev_anon_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload" ON storage.objects;
DROP POLICY IF EXISTS "Public upload" ON storage.objects;
DROP POLICY IF EXISTS "Public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow all uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow all" ON storage.objects;
DROP POLICY IF EXISTS "Allow all operations" ON storage.objects;
DROP POLICY IF EXISTS "product-media public upload" ON storage.objects;
DROP POLICY IF EXISTS "product-media upload" ON storage.objects;
DROP POLICY IF EXISTS "product-media public" ON storage.objects;
DROP POLICY IF EXISTS "product-media all" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert for all" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to product-media" ON storage.objects;
DROP POLICY IF EXISTS "Public can insert product media" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated and anon uploads" ON storage.objects;
DROP POLICY IF EXISTS "Give anon access to product-media" ON storage.objects;
DROP POLICY IF EXISTS "Give public access to product-media" ON storage.objects;
DROP POLICY IF EXISTS "storage_public_upload" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read and write" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Access product-media" ON storage.objects;
DROP POLICY IF EXISTS "product-media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "product-media_admin_all" ON storage.objects;

-- Dynamic safety cleanup for any other existing policies targeting product-media or permissive upload
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects'
    LOOP
        IF pol.policyname ILIKE '%product-media%' 
           OR pol.policyname ILIKE '%upload%'
           OR pol.policyname ILIKE '%anon%'
        THEN
            EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 4. APPLY HARDENED POLICIES FOR PRODUCT-MEDIA BUCKET
-- ------------------------------------------------------------------------------

-- Policy 1: Public Read (Storefront catalog images accessible to anyone)
CREATE POLICY "Public can view product media files"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'product-media');

-- Policy 2: Admin Upload (Only authenticated users verified in public.admin_users)
CREATE POLICY "Admins can upload product media files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'product-media' 
        AND public.is_admin()
    );

-- Policy 3: Admin Update (Only authenticated users verified in public.admin_users)
CREATE POLICY "Admins can update product media files"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'product-media' 
        AND public.is_admin()
    )
    WITH CHECK (
        bucket_id = 'product-media' 
        AND public.is_admin()
    );

-- Policy 4: Admin Delete (Only authenticated users verified in public.admin_users)
CREATE POLICY "Admins can delete product media files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'product-media' 
        AND public.is_admin()
    );

-- ==============================================================================
-- END OF CORRECTIVE STORAGE MIGRATION
-- ==============================================================================
