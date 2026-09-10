import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabaseConfig } from './config';

/**
 * Server-side Supabase client initializer (Using anon key or user JWT)
 */
export function createServerSupabaseClient(token?: string, refreshToken?: string): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getServerSupabaseConfig();
  if (!isConfigured) {
    return null;
  }

  if (token) {
    const storage: Record<string, string> = {};
    const storageKey = 'supabase.auth.token';

    let expiresAt = Math.floor(Date.now() / 1000) + 3600;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (payload && typeof payload.exp === 'number') {
          expiresAt = payload.exp;
        }
      }
    } catch {
      // Keep default 1 hour expiration
    }

    storage[storageKey] = JSON.stringify({
      access_token: token,
      refresh_token: refreshToken || 'recovery-session-refresh',
      expires_at: expiresAt,
    });

    return createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: false,
        storageKey,
        storage: {
          getItem: (key: string) => storage[key] || null,
          setItem: (key: string, value: string) => { storage[key] = value; },
          removeItem: (key: string) => { delete storage[key]; },
        },
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
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

