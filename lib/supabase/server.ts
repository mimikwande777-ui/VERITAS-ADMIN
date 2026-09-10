import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabaseConfig } from './config';

/**
 * Server-side Supabase client initializer (Using anon key or user JWT)
 */
export function createServerSupabaseClient(token?: string): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getServerSupabaseConfig();
  if (!isConfigured) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
  });
}

/**
 * Server-only Service Role Supabase client initializer
 * 
 * CRITICAL SECURITY MANDATES:
 * - NEVER use NEXT_PUBLIC_ prefix
 * - NEVER import or call in client components
 * - NEVER expose in browser JavaScript, UI, or API responses
 * - NEVER log or print secret values
 * - ONLY used on the server for authorized administrative tasks & secure checkout
 */
export function createServiceRoleSupabaseClient(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    throw new Error('SECURITY VIOLATION: createServiceRoleSupabaseClient was invoked on the client!');
  }

  const { url, serviceRoleKey } = getServerSupabaseConfig();
  if (!serviceRoleKey || !serviceRoleKey.trim()) {
    return null;
  }

  return createClient(url, serviceRoleKey.trim(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Checks whether the server environment has SUPABASE_SERVICE_ROLE_KEY configured.
 * Strictly server-side only; never returns or leaks the secret value.
 */
export function isServiceRoleConfigured(): boolean {
  if (typeof window !== 'undefined') {
    return false;
  }
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(secretKey && secretKey.trim().length > 0);
}

