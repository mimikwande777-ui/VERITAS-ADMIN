import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;

/**
 * Returns a singleton browser Supabase client.
 * Strictly uses process.env.NEXT_PUBLIC_SUPABASE_URL and process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function getBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

export const createSupabaseBrowserClient = getBrowserClient;

/**
 * Safe client diagnostic helper returning only booleans.
 */
export function getBrowserDiagnostic() {
  const hasPublicUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL.trim().length > 0);
  const hasPublicAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim().length > 0);
  const browserClientCreated = Boolean(hasPublicUrl && hasPublicAnonKey);

  return {
    hasPublicUrl,
    hasPublicAnonKey,
    browserClientCreated,
  };
}
