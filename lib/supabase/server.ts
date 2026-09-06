import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, getSupabaseEnvConfig } from './config';

/**
 * Server-side Supabase client initializer (Using public anon key or user JWT)
 */
export function createServerSupabaseClient(token?: string): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { url, key } = getSupabaseEnvConfig();

  return createClient(url, key, {
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

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || !serviceRoleKey.trim()) {
    return null;
  }

  const { url } = getSupabaseEnvConfig();

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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(serviceRoleKey && serviceRoleKey.trim().length > 0);
}

