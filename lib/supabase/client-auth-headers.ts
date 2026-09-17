import { getSupabaseClient } from './client';

export async function getClientAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  try {
    const client = getSupabaseClient();
    if (!client) return {};
    const { data: { session } } = await client.auth.getSession();
    if (session?.access_token) {
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at > now + 30) {
        return { Authorization: `Bearer ${session.access_token}` };
      }
    }
  } catch {
    // ignore
  }
  return {};
}
