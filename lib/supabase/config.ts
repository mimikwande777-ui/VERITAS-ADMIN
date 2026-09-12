/**
 * VERITAS Shared Supabase Configuration Utility
 * 
 * Client-safe configuration for NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */

const DEFAULT_SUPABASE_URL = 'https://cdzvmnixlhjjrpyoaemg.supabase.co';

/**
 * Public Client-Safe Configuration
 * Used by browser storefront, public queries, and client-side Supabase Auth
 */
export function getPublicSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  const isConfigured = Boolean(
    supabaseUrl && 
    supabaseUrl.trim().length > 0 && 
    anonKey && 
    anonKey.trim().length > 0 && 
    !supabaseUrl.includes('YOUR_SUPABASE') &&
    supabaseUrl.startsWith('https://')
  );

  return {
    url: supabaseUrl,
    key: anonKey,
    anonKey,
    isConfigured,
  };
}

/**
 * Server Configuration
 * Checks SUPABASE_URL and SUPABASE_ANON_KEY first, falling back to NEXT_PUBLIC_...
 */
export function getServerSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const isConfigured = Boolean(
    supabaseUrl && 
    supabaseUrl.trim().length > 0 && 
    anonKey && 
    anonKey.trim().length > 0 && 
    !supabaseUrl.includes('YOUR_SUPABASE') &&
    supabaseUrl.startsWith('https://')
  );

  return {
    url: supabaseUrl,
    key: anonKey,
    anonKey,
    serviceRoleKey,
    isConfigured,
  };
}

export function isPublicSupabaseConfigured(): boolean {
  return getPublicSupabaseConfig().isConfigured;
}

// Backward-compatible alias for existing codebase callers
export const getSupabaseEnvConfig = getPublicSupabaseConfig;
export const isSupabaseConfigured = isPublicSupabaseConfigured;

export { testSupabaseConnection } from './client';



