import { getSupabaseClient } from './client';
import { DbCategory } from './types';

export interface SupabaseCategoryRow {
  id: string;
  title: string;
  name: string;
  slug: string;
  description?: string;
  created_at?: string;
}

export async function fetchCategoriesFromSupabase(): Promise<SupabaseCategoryRow[]> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('CONFIGURATION ERROR: Supabase client is not configured (missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY).');
  }

  try {
    const { data, error } = await client.from('categories').select('*').order('name');
    if (error) {
      const isRLS = error.code === '42501' || error.message?.toLowerCase().includes('permission') || error.message?.toLowerCase().includes('policy');
      const prefix = isRLS ? 'RLS / PERMISSION ERROR' : 'QUERY ERROR';
      throw new Error(`${prefix}: ${error.message} (code: ${error.code || 'unknown'})`);
    }
    if (!data) return [];
    return data.map(d => ({
      id: d.id,
      title: d.name || 'Untitled Category',
      name: d.name || 'Untitled Category',
      slug: d.slug || '',
      description: d.description || '',
      created_at: d.created_at
    }));
  } catch (err: any) {
    if (err?.message?.startsWith('CONFIGURATION ERROR') || err?.message?.startsWith('RLS / PERMISSION ERROR') || err?.message?.startsWith('QUERY ERROR')) {
      throw err;
    }
    throw new Error(`NETWORK ERROR: ${err?.message || 'Failed to connect to Supabase.'}`);
  }
}

export async function createCategoryInSupabase(
  payloadOrName: string | { title?: string; name?: string; slug?: string; description?: string },
  description?: string
): Promise<{ success: boolean; data?: SupabaseCategoryRow | null; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client unconfigured' };

  try {
    const catName = typeof payloadOrName === 'string' ? payloadOrName : (payloadOrName.title || payloadOrName.name || '');
    const catDesc = typeof payloadOrName === 'string' ? description : payloadOrName.description;
    const customSlug = typeof payloadOrName === 'object' && payloadOrName.slug ? payloadOrName.slug : null;

    const slug = customSlug || catName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const { data, error } = await client
      .from('categories')
      .insert({ name: catName, slug, description: catDesc })
      .select()
      .single();

    if (error || !data) return { success: false, error: error?.message || 'Failed to create category' };
    const row: SupabaseCategoryRow = {
      id: data.id,
      title: data.name,
      name: data.name,
      slug: data.slug,
      description: data.description,
      created_at: data.created_at
    };
    return { success: true, data: row };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Create category failed' };
  }
}

export async function updateCategoryInSupabase(id: string, name: string, description?: string): Promise<DbCategory | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const { data, error } = await client
      .from('categories')
      .update({ name, slug, description, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export async function deleteCategoryInSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client unconfigured' };

  try {
    // Check if products reference this category
    const { data: prods } = await client.from('products').select('id').eq('category_id', id).limit(1);
    if (prods && prods.length > 0) {
      return { success: false, error: 'Cannot delete category: products are assigned to this category.' };
    }

    const { error } = await client.from('categories').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Delete failed' };
  }
}
