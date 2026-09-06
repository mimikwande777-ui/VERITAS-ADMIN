import { getSupabaseClient } from './client';
import { getSupabaseEnvConfig } from './config';
import { DbProductMedia } from './types';

/**
 * Universal VERITAS Media URL Resolver
 * Resolves Supabase storage paths (e.g. 'be-real-tee-front.jpg') to valid public CDN URLs
 * from the 'product-media' Supabase Storage bucket.
 * Leaves absolute URLs (http://, https://, data:) untouched.
 * Avoids duplicate path prefixing.
 */
export function getProductMediaUrl(storagePath?: string | null): string {
  if (!storagePath || typeof storagePath !== 'string') return '';
  const trimmed = storagePath.trim();
  if (!trimmed) return '';

  // Already a full absolute URL or base64 data URI
  if (
    trimmed.startsWith('http://') || 
    trimmed.startsWith('https://') || 
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Strip leading slashes and redundant bucket name prefixes
  let cleanPath = trimmed.replace(/^\/+/, '');
  if (cleanPath.startsWith('product-media/')) {
    cleanPath = cleanPath.substring('product-media/'.length);
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data } = client.storage.from('product-media').getPublicUrl(cleanPath);
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    } catch {
      // fallback to manual URL construction
    }
  }

  const { url } = getSupabaseEnvConfig();
  const baseUrl = url || 'https://cdzvmnixlhjjrpyoaemg.supabase.co';
  return `${baseUrl.replace(/\/+$/, '')}/storage/v1/object/public/product-media/${cleanPath}`;
}

export async function uploadMediaToSupabaseBucket(
  file: File, 
  targetIdentifier: string
): Promise<{ success: boolean; storagePath?: string; publicUrl?: string; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client is unconfigured.' };

  try {
    const cleanFileName = file.name.toLowerCase().replace(/[^a-z0-9.-]/g, '_');
    const storagePath = `${targetIdentifier.replace(/^\/+/, '')}/${Date.now()}-${cleanFileName}`;
    
    const { data, error } = await client.storage
      .from('product-media')
      .upload(storagePath, file, { upsert: true });

    if (error || !data) {
      console.error('Supabase Storage upload error:', error);
      return { success: false, error: error?.message || 'Storage upload rejected' };
    }

    const { data: publicUrlData } = client.storage
      .from('product-media')
      .getPublicUrl(data.path);

    const publicUrl = publicUrlData.publicUrl || getProductMediaUrl(data.path);
    return {
      success: true,
      storagePath: data.path,
      publicUrl
    };
  } catch (err: any) {
    console.error('Supabase Storage upload exception:', err);
    return { success: false, error: err?.message || 'Upload failed' };
  }
}

export interface AdminMediaAsset {
  id: string;
  product_id: string;
  product_name: string;
  product_slug?: string;
  colour_id?: string | null;
  colour_name?: string | null;
  colour_hex?: string | null;
  storage_path: string;
  public_url: string;
  alt_text: string | null;
  media_type: string;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

export async function fetchAllMediaFromSupabase(): Promise<AdminMediaAsset[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('product_media')
      .select('*, products(id, name, slug), product_colours(id, name, hex_code)')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error('Failed to fetch media from Supabase:', error);
      return [];
    }

    return data.map((m: any) => {
      const publicUrl = getProductMediaUrl(m.storage_path);
      return {
        id: m.id,
        product_id: m.product_id,
        product_name: m.products?.name || 'Unassigned Product',
        product_slug: m.products?.slug,
        colour_id: m.colour_id || null,
        colour_name: m.product_colours?.name || null,
        colour_hex: m.product_colours?.hex_code || null,
        storage_path: m.storage_path,
        public_url: publicUrl,
        alt_text: m.alt_text,
        media_type: m.media_type || 'gallery',
        is_primary: Boolean(m.is_primary),
        sort_order: m.sort_order || 0,
        created_at: m.created_at || new Date().toISOString(),
      };
    });
  } catch (err) {
    console.error('Exception fetching media:', err);
    return [];
  }
}

export async function createProductMediaInSupabase(
  productId: string,
  storagePath: string,
  mediaType: string = 'front',
  altText: string = '',
  isPrimary: boolean = false,
  colourId?: string | null
): Promise<{ success: boolean; data?: any; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client unconfigured' };

  try {
    const payload: any = {
      product_id: productId,
      storage_path: storagePath.trim(),
      media_type: mediaType,
      alt_text: altText || null,
      is_primary: isPrimary,
    };
    if (colourId) {
      payload.colour_id = colourId;
    }

    const { data, error } = await client
      .from('product_media')
      .insert(payload)
      .select('*, products(name)')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to attach media' };
  }
}

export async function deleteMediaFromSupabase(mediaId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client unconfigured' };

  try {
    const { error } = await client.from('product_media').delete().eq('id', mediaId);
    if (error) {
      console.error('Error deleting media:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting media:', err);
    return { success: false, error: err?.message || 'Failed to delete' };
  }
}



