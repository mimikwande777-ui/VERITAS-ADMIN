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
  if (!client) return [];

  try {
    const { data, error } = await client.from('categories').select('*').order('name');
    if (error || !data) return [];
    return data.map(d => ({
      id: d.id,
      title: d.name || 'Untitled Category',
      name: d.name || 'Untitled Category',
      slug: d.slug || '',
      description: d.description || '',
      created_at: d.created_at
    }));
  } catch (err) {
    return [];
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
