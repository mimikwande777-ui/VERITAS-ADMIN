import { SupabaseClient } from '@supabase/supabase-js';
import { ProductItem } from '@/lib/mock-data';
import { DbProductVariant, DbProductMedia } from './types';
import { getProductMediaUrl } from './media';
import { parseSupabaseError } from './products';

/**
 * Validates and resolves an existing category record in public.categories
 * Note: Does NOT auto-create categories. Non-existent categories produce a validation error.
 */
async function resolveCategoryId(client: SupabaseClient, categoryNameOrId?: string): Promise<{ id: string | null; error?: string }> {
  if (!categoryNameOrId) return { id: null };
  const trimmed = categoryNameOrId.trim();
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

  try {
    let query = client.from('categories').select('id, name');
    if (isUuid) {
      query = query.or(`id.eq.${trimmed},name.ilike.${trimmed},slug.eq.${slug}`);
    } else {
      query = query.or(`name.ilike.${trimmed},slug.eq.${slug}`);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing?.id) {
      return { id: existing.id };
    }

    return { 
      id: null, 
      error: `Category "${trimmed}" does not exist. Categories must be created in Category management before being assigned to products.` 
    };
  } catch (err: any) {
    return { id: null, error: `Failed to resolve category: ${err?.message || 'Database error'}` };
  }
}

/**
 * Validates and resolves an existing collection record in public.collections
 * Note: Does NOT auto-create collections. Non-existent collections produce a validation error.
 */
async function resolveCollectionId(client: SupabaseClient, collectionNameOrId?: string): Promise<{ id: string | null; error?: string }> {
  if (!collectionNameOrId) return { id: null };
  const trimmed = collectionNameOrId.trim();
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

  try {
    let query = client.from('collections').select('id, name');
    if (isUuid) {
      query = query.or(`id.eq.${trimmed},name.ilike.${trimmed},slug.eq.${slug}`);
    } else {
      query = query.or(`name.ilike.${trimmed},slug.eq.${slug}`);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing?.id) {
      return { id: existing.id };
    }

    return { 
      id: null, 
      error: `Collection "${trimmed}" does not exist. Collections must be created in Collection management before being assigned to products.` 
    };
  } catch (err: any) {
    return { id: null, error: `Failed to resolve collection: ${err?.message || 'Database error'}` };
  }
}

/**
 * Map raw DB record to ProductItem
 */
export function mapDbProductToProductItemServer(raw: any): ProductItem {
  const variants = (raw.product_variants || []).map((v: DbProductVariant) => ({
    id: v.id,
    productId: v.product_id,
    colourId: v.colour_id,
    sku: v.sku,
    colour: v.colour,
    size: v.size,
    stockQuantity: Number(v.stock_quantity) || 0,
    lowStockThreshold: Number(v.low_stock_threshold) || 5,
    status: (Number(v.stock_quantity) <= 0 ? 'OUT OF STOCK' : Number(v.stock_quantity) <= (Number(v.low_stock_threshold) || 5) ? 'LOW STOCK' : 'IN STOCK') as any,
  }));

  let colours = [];
  if (raw.product_colours && raw.product_colours.length > 0) {
    colours = raw.product_colours
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        code: c.hex_code || '#000000'
      }));
  } else {
    colours = Array.from(new Set(variants.map((v: any) => v.colour)))
      .filter(Boolean)
      .map(c => ({ name: c as string, code: '#000000' }));
  }

  const mediaList = (raw.product_media || [])
    .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((m: DbProductMedia) => ({
      id: m.id,
      url: getProductMediaUrl(m.storage_path),
      role: (m.media_type === 'front' ? 'main' : m.media_type === 'detail' ? 'gallery' : m.media_type) as any,
      isPrimary: m.is_primary,
      alt: m.alt_text || raw.name,
      colourId: m.colour_id
    }));

  const primaryImage = mediaList.find((m: any) => m.isPrimary)?.url || mediaList[0]?.url || '';
  const totalStock = variants.reduce((sum: number, v: any) => sum + v.stockQuantity, 0);

  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    sku: variants[0]?.sku || `VRT-${raw.id.slice(0, 8)}`,
    description: raw.description || '',
    price: Number(raw.selling_price) || 0,
    costPrice: raw.cost_price ? Number(raw.cost_price) : undefined,
    currency: 'ZAR',
    category: raw.categories?.name || raw.product_type || 'T-Shirts',
    collection: raw.collections?.name || 'Core',
    drop: raw.collections?.name || 'DROP 001',
    tags: ['VERITAS', raw.product_type || 'Apparel'],
    status: (raw.status ? raw.status.toUpperCase() : 'DRAFT') as any,
    published: raw.published ?? false,
    featured: raw.featured ?? false,
    active: raw.status === 'active',
    stockStatus: totalStock <= 0 ? 'Out of Stock' : totalStock <= 10 ? 'Low Stock' : 'In Stock',
    image: primaryImage,
    galleryImages: mediaList.map((m: any) => m.url),
    images: mediaList,
    colours: colours.length > 0 ? colours : [{ name: 'Black', code: '#0A0A0A' }],
    sizes: Array.from(new Set(variants.map((v: any) => v.size))),
    variants,
    createdAt: raw.created_at ? raw.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
    updatedAt: raw.updated_at ? raw.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

export async function serverFetchSupabaseProductById(id: string, client: SupabaseClient): Promise<ProductItem | null> {
  try {
    const { data, error } = await client
      .from('products')
      .select(`
        *,
        categories(id, name, slug),
        collections(id, name, slug),
        product_colours(*),
        product_variants(*),
        product_media(*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return mapDbProductToProductItemServer(data);
  } catch (err) {
    return null;
  }
}

export async function serverCreateSupabaseProduct(data: Partial<ProductItem>, client: SupabaseClient): Promise<{ product: ProductItem | null; error: string | null }> {
  try {
    const sellingPrice = Number(data.price) || 0;
    const costPrice = Number(data.costPrice) || 0;
    const statusLower = (data.status?.toLowerCase() as any) || 'draft';

    const categoryTarget = (data as any).categoryId || (data as any).category_id || data.category;
    const collectionTarget = (data as any).collectionId || (data as any).collection_id || data.collection;

    const categoryRes = await resolveCategoryId(client, categoryTarget);
    if (categoryRes.error) {
      return { product: null, error: categoryRes.error };
    }

    const collectionRes = await resolveCollectionId(client, collectionTarget);
    if (collectionRes.error) {
      return { product: null, error: collectionRes.error };
    }

    const categoryId = categoryRes.id;
    const collectionId = collectionRes.id;

    const generatedSlug = data.slug || (data.name ? data.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : `product-${Date.now()}`);

    const dbPayload: any = {
      name: data.name || 'Untitled Product',
      slug: generatedSlug,
      description: data.description || '',
      product_type: data.category || 'T-Shirts',
      selling_price: sellingPrice,
      cost_price: costPrice,
      status: statusLower,
      published: data.published ?? false,
      featured: data.featured ?? false,
    };

    if (categoryId) dbPayload.category_id = categoryId;
    if (collectionId) dbPayload.collection_id = collectionId;

    const { data: inserted, error: prodError } = await client
      .from('products')
      .insert(dbPayload)
      .select()
      .single();

    if (prodError || !inserted) {
      return { product: null, error: parseSupabaseError(prodError) };
    }

    const colourMap: Record<string, string> = {};

    if (data.colours && data.colours.length > 0) {
      for (const [index, col] of data.colours.entries()) {
        const { data: insertedCol } = await client.from('product_colours').insert({
          product_id: inserted.id,
          name: col.name,
          slug: col.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          hex_code: col.code,
          sort_order: index
        }).select('id').single();
        if (insertedCol) colourMap[col.name] = insertedCol.id;
      }
    }

    if (data.variants && data.variants.length > 0) {
      const variantPayload = data.variants.map(v => ({
        product_id: inserted.id,
        colour_id: colourMap[v.colour] || undefined,
        sku: v.sku || `VRT-${inserted.id.slice(0, 6)}-${v.colour}-${v.size}`,
        colour: v.colour,
        size: v.size,
        stock_quantity: Number(v.stockQuantity) || 0,
        low_stock_threshold: Number(v.lowStockThreshold) || 5,
      }));

      const { error: varError } = await client.from('product_variants').insert(variantPayload);
      if (varError) {
        await client.from('products').delete().eq('id', inserted.id);
        return { product: null, error: `Failed to create variants: ${parseSupabaseError(varError)}` };
      }
    }

    if (data.images && data.images.length > 0) {
      const mediaRecords = data.images.map((m, idx) => {
        let mediaType = m.role || 'front';
        if (mediaType === 'main') mediaType = 'front';
        if (mediaType === 'gallery') mediaType = 'detail';

        return {
          product_id: inserted.id,
          colour_id: m.colourId || (m.colourName ? colourMap[m.colourName] : undefined),
          storage_path: m.url,
          alt_text: m.alt || inserted.name,
          media_type: mediaType,
          sort_order: idx,
          is_primary: m.isPrimary || idx === 0,
        };
      });

      await client.from('product_media').insert(mediaRecords);
    }

    const created = await serverFetchSupabaseProductById(inserted.id, client);
    return { product: created, error: null };
  } catch (err: any) {
    return { product: null, error: err?.message || 'Product creation failed' };
  }
}

export async function serverUpdateSupabaseProduct(
  id: string,
  updates: Partial<ProductItem>,
  client: SupabaseClient
): Promise<{ product: ProductItem | null; error: string | null }> {
  try {
    const patch: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.slug !== undefined) patch.slug = updates.slug;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.price !== undefined) patch.selling_price = Number(updates.price);
    if (updates.costPrice !== undefined) patch.cost_price = Number(updates.costPrice);
    if (updates.status !== undefined) patch.status = updates.status.toLowerCase();
    if (updates.published !== undefined) patch.published = updates.published;
    if (updates.featured !== undefined) patch.featured = updates.featured;

    const categoryTarget = (updates as any).categoryId || (updates as any).category_id || updates.category;
    if (categoryTarget) {
      const categoryRes = await resolveCategoryId(client, categoryTarget);
      if (categoryRes.error) {
        return { product: null, error: categoryRes.error };
      }
      if (categoryRes.id) patch.category_id = categoryRes.id;
      if (updates.category) patch.product_type = updates.category;
    }

    const collectionTarget = (updates as any).collectionId || (updates as any).collection_id || updates.collection;
    if (collectionTarget) {
      const collectionRes = await resolveCollectionId(client, collectionTarget);
      if (collectionRes.error) {
        return { product: null, error: collectionRes.error };
      }
      if (collectionRes.id) patch.collection_id = collectionRes.id;
    }

    const { error: prodError } = await client.from('products').update(patch).eq('id', id);

    if (prodError) {
      return { product: null, error: parseSupabaseError(prodError) };
    }

    if (updates.variants !== undefined) {
      await client.from('product_variants').delete().eq('product_id', id);
    }
    if (updates.images !== undefined) {
      await client.from('product_media').delete().eq('product_id', id);
    }

    const colourMap: Record<string, string> = {};
    if (updates.colours) {
      const { data: existingColours } = await client.from('product_colours').select('id, name').eq('product_id', id);
      const newColourNames = updates.colours.map(c => c.name);
      const toDelete = (existingColours || []).filter(c => !newColourNames.includes(c.name)).map(c => c.id);

      for (const [index, col] of updates.colours.entries()) {
        const existing = (existingColours || []).find(c => c.name === col.name);
        if (existing) {
          await client.from('product_colours').update({
            name: col.name,
            slug: col.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            hex_code: col.code,
            sort_order: index
          }).eq('id', existing.id);
          colourMap[col.name] = existing.id;
        } else {
          const { data: insertedCol } = await client.from('product_colours').insert({
            product_id: id,
            name: col.name,
            slug: col.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            hex_code: col.code,
            sort_order: index
          }).select('id').single();
          if (insertedCol) colourMap[col.name] = insertedCol.id;
        }
      }

      if (toDelete.length > 0) {
        await client.from('product_colours').delete().in('id', toDelete);
      }
    }

    if (updates.variants && updates.variants.length > 0) {
      const variantPayload = updates.variants.map(v => ({
        product_id: id,
        colour_id: colourMap[v.colour] || undefined,
        sku: v.sku || `VRT-${id.slice(0, 6)}-${v.colour}-${v.size}`,
        colour: v.colour,
        size: v.size,
        stock_quantity: Number(v.stockQuantity) || 0,
        low_stock_threshold: Number(v.lowStockThreshold) || 5,
      }));
      const { error: varError } = await client.from('product_variants').insert(variantPayload);
      if (varError) {
        return { product: null, error: `Failed to update variants: ${parseSupabaseError(varError)}` };
      }
    }

    if (updates.images && updates.images.length > 0) {
      const mediaRecords = updates.images.map((m, idx) => {
        let mediaType = m.role || 'front';
        if (mediaType === 'main') mediaType = 'front';
        if (mediaType === 'gallery') mediaType = 'detail';

        return {
          product_id: id,
          colour_id: m.colourId || (m.colourName ? colourMap[m.colourName] : undefined),
          storage_path: m.url,
          alt_text: m.alt || updates.name || 'Product Media',
          media_type: mediaType,
          sort_order: idx,
          is_primary: m.isPrimary || idx === 0,
        };
      });

      await client.from('product_media').insert(mediaRecords);
    }

    const updated = await serverFetchSupabaseProductById(id, client);
    return { product: updated, error: null };
  } catch (err: any) {
    return { product: null, error: err?.message || 'Product update failed' };
  }
}

export async function serverDeleteSupabaseProduct(id: string, client: SupabaseClient): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await client.from('products').delete().eq('id', id);
    if (error) return { success: false, error: parseSupabaseError(error) };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Delete failed' };
  }
}
