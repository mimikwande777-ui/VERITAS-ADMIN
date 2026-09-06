import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, getSupabaseEnvConfig } from './config';

let clientInstance: SupabaseClient | null = null;

/**
 * Returns an initialized Supabase client if configured, or null if credentials are missing.
 * Does NOT throw errors or crash if env variables are unconfigured.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { url, key } = getSupabaseEnvConfig();

  if (typeof window === 'undefined') {
    return createClient(url, key);
  }

  if (!clientInstance) {
    clientInstance = createClient(url, key);
  }

  return clientInstance;
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is not configured.',
    };
  }

  const client = getSupabaseClient();
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


