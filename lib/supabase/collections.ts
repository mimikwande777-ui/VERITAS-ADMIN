import { getSupabaseClient } from './client';
import { DbCollection } from './types';
import { recordAuditLog } from './audit';

export interface SupabaseCollectionRow {
  id: string;
  title: string;
  name: string;
  slug: string;
  handle: string;
  description?: string;
  image_path?: string;
  is_active: boolean;
  created_at?: string;
}

export async function fetchCollectionsFromSupabase(): Promise<SupabaseCollectionRow[]> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('CONFIGURATION ERROR: Supabase client is not configured (missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY).');
  }

  try {
    const { data, error } = await client.from('collections').select('*').order('name');
    if (error) {
      const isRLS = error.code === '42501' || error.message?.toLowerCase().includes('permission') || error.message?.toLowerCase().includes('policy');
      const prefix = isRLS ? 'RLS / PERMISSION ERROR' : 'QUERY ERROR';
      throw new Error(`${prefix}: ${error.message} (code: ${error.code || 'unknown'})`);
    }
    if (!data) return [];
    return data.map(d => ({
      id: d.id,
      title: d.name || 'Untitled Collection',
      name: d.name || 'Untitled Collection',
      slug: d.slug || '',
      handle: d.slug || '',
      description: d.description || '',
      image_path: d.image_path || '',
      is_active: d.is_active ?? true,
      created_at: d.created_at
    }));
  } catch (err: any) {
    if (err?.message?.startsWith('CONFIGURATION ERROR') || err?.message?.startsWith('RLS / PERMISSION ERROR') || err?.message?.startsWith('QUERY ERROR')) {
      throw err;
    }
    throw new Error(`NETWORK ERROR: ${err?.message || 'Failed to connect to Supabase.'}`);
  }
}

export async function createCollectionInSupabase(
  payloadOrName: string | { title?: string; name?: string; slug?: string; handle?: string; description?: string; is_active?: boolean },
  description?: string
): Promise<{ success: boolean; data?: SupabaseCollectionRow | null; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client unconfigured' };

  try {
    const colName = typeof payloadOrName === 'string' ? payloadOrName : (payloadOrName.title || payloadOrName.name || '');
    const colDesc = typeof payloadOrName === 'string' ? description : payloadOrName.description;
    const customSlug = typeof payloadOrName === 'object' ? (payloadOrName.slug || payloadOrName.handle) : null;
    const isActive = typeof payloadOrName === 'object' && payloadOrName.is_active !== undefined ? payloadOrName.is_active : true;

    const slug = customSlug || colName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const { data, error } = await client
      .from('collections')
      .insert({ name: colName, slug, description: colDesc, is_active: isActive })
      .select()
      .single();

    if (error || !data) return { success: false, error: error?.message || 'Failed to create collection' };
    const row: SupabaseCollectionRow = {
      id: data.id,
      title: data.name,
      name: data.name,
      slug: data.slug,
      handle: data.slug,
      description: data.description,
      image_path: data.image_path,
      is_active: data.is_active ?? true,
      created_at: data.created_at
    };
    return { success: true, data: row };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Create collection failed' };
  }
}

export async function updateCollectionInSupabase(id: string, name: string, description?: string, isActive?: boolean): Promise<DbCollection | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const patch: any = { name, slug, description, updated_at: new Date().toISOString() };
    if (isActive !== undefined) patch.is_active = isActive;

    const { data, error } = await client
      .from('collections')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export async function toggleCollectionStatusInSupabase(
  id: string, 
  nextStatus: boolean
): Promise<{ success: boolean; collection?: any; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client unconfigured' };

  try {
    const { error: updateErr } = await client
      .from('collections')
      .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateErr) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[COLLECTION STATUS TOGGLE ERROR]', {
          collectionId: id,
          requestedStatus: nextStatus,
          error: updateErr.message,
        });
      }
      return { success: false, error: updateErr.message };
    }

    // MANDATORY RE-READ: Immediately fetch from Supabase to verify persistence
    const { data: refetched, error: readErr } = await client
      .from('collections')
      .select('*')
      .eq('id', id)
      .single();

    if (readErr || !refetched) {
      return { 
        success: false, 
        error: `Failed to verify collection status change: ${readErr?.message || 'Record not found on re-read'}` 
      };
    }

    if (refetched.is_active !== nextStatus) {
      return { 
        success: false, 
        error: `Integrity verification error: Database is_active is (${refetched.is_active}), expected (${nextStatus}).` 
      };
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[COLLECTION STATUS TOGGLE DIAGNOSTICS]', {
        collectionId: id,
        requestedStatus: nextStatus,
        refetchedStatus: refetched.is_active,
        verified: true,
      });
    }

    void recordAuditLog({
      action: 'collection.toggle',
      actionLabel: `${nextStatus ? 'Activated' : 'Deactivated'} collection "${refetched.name}" (${id})`,
      targetType: 'collection',
      targetId: id,
      details: { isActive: nextStatus, slug: refetched.slug }
    });

    return { success: true, collection: refetched };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to toggle status' };
  }
}

export async function deleteCollectionInSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client unconfigured' };

  try {
    const { data: prods } = await client.from('products').select('id').eq('collection_id', id).limit(1);
    if (prods && prods.length > 0) {
      return { success: false, error: 'Cannot delete collection: products are assigned to this collection.' };
    }

    const { error } = await client.from('collections').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Delete failed' };
  }
}
