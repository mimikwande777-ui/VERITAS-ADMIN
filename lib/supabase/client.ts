import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;

/**
 * Checks whether the public client Supabase environment variables are configured.
 */
export function isPublicSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(
    url && 
    key && 
    url.length > 0 && 
    key.length > 0 && 
    url.startsWith('https://') && 
    !url.includes('YOUR_SUPABASE')
  );
}

export const isSupabaseConfigured = isPublicSupabaseConfigured;

/**
 * Creates or retrieves the singleton Supabase browser client.
 * Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Returns null if credentials are not configured.
 */
export function createSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  if (typeof window === 'undefined') {
    return createBrowserClient(url, anonKey);
  }

  if (!clientInstance) {
    clientInstance = createBrowserClient(url, anonKey);
  }

  return clientInstance;
}

/**
 * Returns an initialized Supabase client if configured, or null if credentials are missing.
 * Backward-compatible alias for existing codebase callers.
 */
export const getSupabaseClient = createSupabaseBrowserClient;
export const getSupabaseBrowserClient = createSupabaseBrowserClient;

/**
 * Safe configuration diagnostic helper reporting only boolean indicators & public hostname.
 * Never leaks keys or secrets.
 */
export function getBrowserSupabaseClientDiagnostic(): {
  hasPublicSupabaseUrl: boolean;
  hasPublicAnonKey: boolean;
  browserClientCreated: boolean;
  hostname?: string;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  let hostname: string | undefined;

  try {
    if (url) {
      hostname = new URL(url).hostname;
    }
  } catch {
    hostname = undefined;
  }

  const hasPublicSupabaseUrl = Boolean(url && url.length > 0);
  const hasPublicAnonKey = Boolean(anonKey && anonKey.length > 0);
  const browserClientCreated = Boolean(hasPublicSupabaseUrl && hasPublicAnonKey);

  return {
    hasPublicSupabaseUrl,
    hasPublicAnonKey,
    browserClientCreated,
    ...(hostname ? { hostname } : {}),
  };
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  if (!isPublicSupabaseConfigured()) {
    return {
      success: false,
      message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is not configured.',
    };
  }

  const client = createSupabaseBrowserClient();
  if (!client) {
    return {
      success: false,
      message: 'Unable to initialize Supabase client with current credentials.',
    };
  }

  try {
    const { count, error } = await client.from('products').select('*', { count: 'exact', head: true });
    if (error) {
      const { error: catError } = await client.from('categories').select('id').limit(1);
      if (catError) {
        return {
          success: false,
          message: `Connection Error: ${error.message || catError.message}`,
          details: error || catError,
        };
      }
      return {
        success: true,
        message: 'Supabase database is connected and operational.',
        details: { productCount: 0 },
      };
    }
    return {
      success: true,
      message: 'Supabase database is connected and operational.',
      details: { productCount: count ?? 0 },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to establish database connection.',
      details: err,
    };
  }
}



