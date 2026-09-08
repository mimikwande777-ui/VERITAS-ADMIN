import { getSupabaseClient } from './client';
import { DbProductVariant, DbProductMedia } from './types';
import { ProductItem } from '@/lib/mock-data';
import { uploadMediaToSupabaseBucket, getProductMediaUrl } from './media';
import { updateVariantStockInSupabase, adjustVariantStockInSupabase, StockUpdateResult } from './inventory';
import { SupabaseClient } from '@supabase/supabase-js';
import { recordAuditLog } from './audit';

/**
 * Safely parses Supabase database & RLS error codes into human-readable messages
 */
export function parseSupabaseError(error: any): string {
  if (!error) return 'An unknown database error occurred.';
  const message = error.message || error.details || String(error);
  const code = error.code || '';

  if (code === '23505') {
    if (message.includes('slug')) {
      return 'Validation Error: A product with this URL slug already exists. Please choose a unique name or slug.';
    }
    if (message.includes('sku')) {
      return 'Validation Error: A product variant with this SKU already exists. Please use unique SKUs.';
    }
    return 'Validation Error: A record with duplicate unique fields already exists.';
  }

  if (code === '42501' || message.includes('policy') || message.includes('RLS')) {
    return 'Permission Error: Database row-level security policy denied write access. Please check development RLS rules.';
  }

  if (code === '23503') {
    return 'Database Error: Referenced category, collection, or product relationship ID does not exist.';
  }

  if (code === '23502') {
    return 'Validation Error: Required database field missing in record payload.';
  }

  return `Database Error: ${message}`;
}

/**
 * Resolves or creates a category record in public.categories
 */
async function resolveCategoryId(client: SupabaseClient, categoryName?: string): Promise<string | null> {
  if (!categoryName) return null;
  const slug = categoryName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  try {
    const { data: existing } = await client
      .from('categories')
      .select('id')
      .or(`name.ilike.${categoryName},slug.eq.${slug}`)
      .maybeSingle();

    if (existing?.id) return existing.id;

    const { data: created } = await client
      .from('categories')
      .insert({ name: categoryName, slug })
      .select('id')
      .single();

    return created?.id || null;
  } catch (err) {
    return null;
  }
}

/**
 * Resolves or creates a collection record in public.collections
 */
async function resolveCollectionId(client: SupabaseClient, collectionName?: string): Promise<string | null> {
  if (!collectionName) return null;
  const slug = collectionName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  try {
    const { data: existing } = await client
      .from('collections')
      .select('id')
      .or(`name.ilike.${collectionName},slug.eq.${slug}`)
      .maybeSingle();

    if (existing?.id) return existing.id;

    const { data: created } = await client
      .from('collections')
      .insert({ name: collectionName, slug, is_active: true })
      .select('id')
      .single();

    return created?.id || null;
  } catch (err) {
    return null;
  }
}

/**
 * Helper to convert data URL to Blob for upload
 */
function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    return null;
  }
}

/**
 * Maps database record hierarchy into canonical ProductItem model
 */
export function mapDbProductToProductItem(raw: any): ProductItem {
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
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((m: DbProductMedia) => {
      let colourName = undefined;
      if (m.colour_id && colours.length > 0) {
         const col = colours.find((c: any) => c.id === m.colour_id);
         if (col) colourName = col.name;
      }
      const resolvedUrl = getProductMediaUrl(m.storage_path);
      return {
        id: m.id,
        url: resolvedUrl,
        rawStoragePath: m.storage_path,
        role: (m.media_type as any) || 'gallery',
        isPrimary: m.is_primary ?? false,
        alt: m.alt_text || raw.name,
        colourId: m.colour_id,
        colourName: colourName
      };
    });

  const primaryMedia = mediaList.find((m: any) => m.isPrimary) || mediaList[0];
  const mainImage = primaryMedia?.url || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80';

  const statusUpper = (raw.status || 'draft').toUpperCase() as 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

  const sellingPrice = Number(raw.selling_price) || 0;
  const costPrice = raw.cost_price !== null && raw.cost_price !== undefined ? Number(raw.cost_price) : undefined;
  
  // Directly read database-calculated profit columns
  const profitPerUnit = raw.profit_per_unit !== null && raw.profit_per_unit !== undefined ? Number(raw.profit_per_unit) : (costPrice !== undefined ? sellingPrice - costPrice : undefined);
  const profitMargin = raw.profit_margin !== null && raw.profit_margin !== undefined ? Number(raw.profit_margin) : (costPrice !== undefined && sellingPrice > 0 ? ((sellingPrice - costPrice) / sellingPrice) * 100 : undefined);

  // Collection Active state evaluation
  const collectionIsActive = raw.collections ? (raw.collections.is_active ?? true) : true;
  const isPubliclyActive = statusUpper === 'ACTIVE' && raw.published === true && collectionIsActive;

  return {
    id: raw.id,
    name: raw.name || 'Untitled Product',
    slug: raw.slug || '',
    sku: variants[0]?.sku || `VRT-${raw.id.slice(0, 8)}`,
    description: raw.description || '',
    shortDescription: raw.description ? raw.description.slice(0, 120) : '',
    price: sellingPrice,
    compareAtPrice: raw.compare_at_price ? Number(raw.compare_at_price) : undefined,
    costPrice: costPrice,
    profitPerUnit: profitPerUnit,
    profitMargin: profitMargin,
    currency: 'ZAR',
    category: raw.categories?.name || raw.product_type || 'T-Shirts',
    collection: raw.collections?.name || 'DROP 001',
    collectionId: raw.collection_id || raw.collections?.id,
    collectionIsActive: collectionIsActive,
    drop: raw.collections?.name || 'DROP 001',
    tags: ['VERITAS'],
    status: statusUpper,
    published: raw.published ?? false,
    featured: raw.featured ?? false,
    active: isPubliclyActive,
    image: mainImage,
    images: mediaList,
    galleryImages: mediaList.map((m: any) => m.url),
    specifications: raw.description || '',
    designInfo: {},
    variants: variants,
    colours: colours,
    sizes: Array.from(new Set(variants.map((v: any) => v.size))).filter(Boolean) as string[],
    createdAt: raw.created_at ? new Date(raw.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    updatedAt: raw.updated_at ? new Date(raw.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

export type SupabaseStatus = 
  | 'SUCCESS_WITH_DATA'
  | 'SUCCESS_WITH_ZERO_ROWS'
  | 'CONFIGURATION_ERROR'
  | 'NETWORK_ERROR'
  | 'RLS_ERROR'
  | 'QUERY_ERROR';

export interface ProductsQueryResult {
  status: SupabaseStatus;
  products: ProductItem[];
  count: number;
  error: string | null;
}

/**
 * Fetch all products directly from Supabase with granular error classification
 * Strictly distinguishes:
 * - SUCCESS WITH DATA
 * - SUCCESS WITH ZERO ROWS
 * - CONFIGURATION ERROR
 * - NETWORK ERROR
 * - RLS/PERMISSION ERROR
 * - QUERY ERROR
 */
export async function fetchSupabaseProductsWithStatus(): Promise<ProductsQueryResult> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      status: 'CONFIGURATION_ERROR',
      products: [],
      count: 0,
      error: 'CONFIGURATION ERROR: Supabase client is not configured (missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY).'
    };
  }

  try {
    const { data, error } = await client
      .from('products')
      .select(`
        *,
        categories(id, name, slug),
        collections(id, name, slug, is_active),
        product_colours(*),
        product_variants(*),
        product_media(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      const isRLS = error.code === '42501' || error.message?.toLowerCase().includes('permission') || error.message?.toLowerCase().includes('policy');
      const status: SupabaseStatus = isRLS ? 'RLS_ERROR' : 'QUERY_ERROR';
      const prefix = isRLS ? 'RLS / PERMISSION ERROR' : 'QUERY ERROR';
      return {
        status,
        products: [],
        count: 0,
        error: `${prefix}: ${error.message} (code: ${error.code || 'unknown'})`
      };
    }

    const products = (data || []).map(mapDbProductToProductItem);
    return {
      status: products.length > 0 ? 'SUCCESS_WITH_DATA' : 'SUCCESS_WITH_ZERO_ROWS',
      products,
      count: products.length,
      error: null
    };
  } catch (err: any) {
    return {
      status: 'NETWORK_ERROR',
      products: [],
      count: 0,
      error: `NETWORK ERROR: ${err?.message || 'Failed to connect to Supabase'}`
    };
  }
}

/**
 * Fetch all products directly from Supabase
 */
export async function fetchSupabaseProducts(): Promise<ProductItem[]> {
  const result = await fetchSupabaseProductsWithStatus();
  if (result.error) {
    console.error('[SUPABASE PRODUCTS ERROR]', result.error);
    throw new Error(result.error);
  }
  return result.products;
}

/**
 * Strips internal cost and profit metrics before returning product data to the public storefront.
 */
export function sanitizePublicProduct(item: ProductItem): ProductItem {
  const sanitized = { ...item };
  delete (sanitized as any).costPrice;
  delete (sanitized as any).profitPerUnit;
  delete (sanitized as any).profitMargin;
  return sanitized;
}

/**
 * Fetch only publicly active products (status=ACTIVE, published=TRUE, collection.is_active=TRUE)
 * All sensitive cost/profit columns are sanitized.
 */
export async function fetchPublicSupabaseProducts(): Promise<ProductItem[]> {
  const all = await fetchSupabaseProducts();
  if (!all) return [];
  return all
    .filter(p => p.status === 'ACTIVE' && p.published === true && p.collectionIsActive !== false)
    .map(sanitizePublicProduct);
}

export const fetchProductsFromSupabase = fetchSupabaseProducts;
export type SupabaseProductWithDetails = ProductItem;

/**
 * Fetch product by ID or Slug from Supabase
 */
export async function fetchSupabaseProductById(id: string): Promise<ProductItem | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    let { data, error } = await client
      .from('products')
      .select(`
        *,
        categories(id, name, slug),
        collections(id, name, slug, is_active),
        product_colours(*),
        product_variants(*),
        product_media(*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (!data) {
      const slugRes = await client
        .from('products')
        .select(`
          *,
          categories(id, name, slug),
          collections(id, name, slug, is_active),
          product_colours(*),
          product_variants(*),
          product_media(*)
        `)
        .eq('slug', id)
        .maybeSingle();
      data = slugRes.data;
    }

    if (!data) return null;
    return mapDbProductToProductItem(data);
  } catch (err) {
    return null;
  }
}

/**
 * Fetch product by Slug
 */
export async function fetchSupabaseProductBySlug(slug: string): Promise<ProductItem | null> {
  return fetchSupabaseProductById(slug);
}

/**
 * Create product record in Supabase
 * NOTE: profit_per_unit and profit_margin are GENERATED ALWAYS columns and NOT included in payload.
 */
export async function createSupabaseProduct(data: Partial<ProductItem>): Promise<{ product: ProductItem | null; error: string | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { product: null, error: 'Supabase client is not configured.' };
  }

  try {
    const sellingPrice = Number(data.price) || 0;
    const costPrice = Number(data.costPrice) || 0;
    const statusLower = (data.status?.toLowerCase() as any) || 'draft';

    const categoryId = await resolveCategoryId(client, data.category);
    const collectionId = await resolveCollectionId(client, data.collection);

    const generatedSlug = data.slug || (data.name ? data.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : `product-${Date.now()}`);

    // EXCLUDE profit_per_unit and profit_margin from insert payload!
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
      console.error('Supabase createProduct insert error:', prodError);
      return { product: null, error: parseSupabaseError(prodError) };
    }

    const colourMap: Record<string, string> = {};

    if (data.colours && data.colours.length > 0) {
      for (const [index, col] of data.colours.entries()) {
        const { data: insertedCol, error: colError } = await client.from('product_colours').insert({
          product_id: inserted.id,
          name: col.name,
          slug: col.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          hex_code: col.code,
          sort_order: index
        }).select('id').single();
        if (insertedCol) colourMap[col.name] = insertedCol.id;
      }
    }

    // 2. Insert variants into product_variants using product UUID
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
        console.error('Supabase variant insert error:', varError);
        await client.from('products').delete().eq('id', inserted.id);
        return { product: null, error: `Failed to create variants: ${parseSupabaseError(varError)}` };
      }
    }

    // 3. Upload product images to Storage bucket `product-media` & insert metadata into `product_media`
    if (data.images && data.images.length > 0) {
      const mediaRecords = [];

      for (let idx = 0; idx < data.images.length; idx++) {
        const m = data.images[idx];
        let storagePath = m.url;
        
        // Map role to valid database media_type (front, back, model, detail)
        let mediaType = m.role || 'front';
        if (mediaType === 'main') mediaType = 'front';
        if (mediaType === 'gallery') mediaType = 'detail';

        // Check if there is an attached file to upload
        if ((m as any).file instanceof File) {
          const file = (m as any).file as File;
          const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const uploadPath = `products/${inserted.id}/${mediaType}/${safeFileName}`;

          const uploadRes = await uploadMediaToSupabaseBucket(file, uploadPath);
          if (!uploadRes.success || !uploadRes.storagePath) {
            await client.from('products').delete().eq('id', inserted.id);
            return { product: null, error: `Storage upload error: Failed to upload ${file.name} to product-media storage bucket (${uploadRes.error || 'unknown error'}).` };
          }
          storagePath = uploadRes.storagePath;
        } else if (m.url && m.url.startsWith('data:')) {
          const blob = dataUrlToBlob(m.url);
          if (blob) {
            const safeFileName = `${Date.now()}_img_${idx}.png`;
            const uploadPath = `products/${inserted.id}/${mediaType}/${safeFileName}`;
            const file = new File([blob], safeFileName, { type: 'image/png' });
            const uploadRes = await uploadMediaToSupabaseBucket(file, uploadPath);
            if (uploadRes.success && uploadRes.storagePath) {
              storagePath = uploadRes.storagePath;
            }
          }
        }

        mediaRecords.push({
          product_id: inserted.id,
          colour_id: m.colourId || (m.colourName ? colourMap[m.colourName] : undefined),
          storage_path: storagePath,
          alt_text: m.alt || inserted.name,
          media_type: mediaType,
          sort_order: idx,
          is_primary: m.isPrimary || idx === 0,
        });
      }

      const { error: mediaError } = await client.from('product_media').insert(mediaRecords);
      if (mediaError) {
        console.error('Supabase media metadata insert error:', mediaError);
        // Clean up and fail safely if media metadata fails
        await client.from('products').delete().eq('id', inserted.id);
        return { product: null, error: `Failed to save product media metadata: ${parseSupabaseError(mediaError)}` };
      }
    }

    // 4. Return complete created product with authoritative database values
    const created = await fetchSupabaseProductById(inserted.id);
    if (created) {
      void recordAuditLog({
        action: 'product.create',
        actionLabel: `Created product "${created.name}" (ZAR ${created.price})`,
        targetType: 'product',
        targetId: created.id,
        details: { name: created.name, price: created.price, status: created.status }
      });
    }
    return { product: created, error: null };
  } catch (err: any) {
    console.error('Supabase createProduct exception:', err);
    return { product: null, error: `Product creation failed: ${err?.message || 'Unexpected system error'}` };
  }
}

/**
 * Update product record in Supabase
 * NOTE: profit_per_unit and profit_margin are GENERATED ALWAYS columns and NOT included in payload.
 */
export async function updateSupabaseProduct(id: string, updates: Partial<ProductItem>): Promise<{ product: ProductItem | null; error: string | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { product: null, error: 'Supabase client is not configured.' };
  }

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

    if (updates.category) {
      const categoryId = await resolveCategoryId(client, updates.category);
      if (categoryId) patch.category_id = categoryId;
      patch.product_type = updates.category;
    }
    if (updates.collection) {
      const collectionId = await resolveCollectionId(client, updates.collection);
      if (collectionId) patch.collection_id = collectionId;
    }

    // Update product core record
    const { error: prodError } = await client.from('products').update(patch).eq('id', id);

    if (prodError) {
      console.error('Supabase updateProduct error:', prodError);
      return { product: null, error: parseSupabaseError(prodError) };
    }

    // 1. Delete existing variants & media first to prevent any foreign key conflict if colours are removed
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

    // 2. Insert new product variants
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

    // 3. Insert new product media
    if (updates.images && updates.images.length > 0) {
      const mediaRecords = [];

      for (let idx = 0; idx < updates.images.length; idx++) {
        const m = updates.images[idx];
        let storagePath = m.url;
        let mediaType = m.role || 'front';
        if (mediaType === 'main') mediaType = 'front';
        if (mediaType === 'gallery') mediaType = 'detail';

        if ((m as any).file instanceof File) {
          const file = (m as any).file as File;
          const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const uploadPath = `products/${id}/${mediaType}/${safeFileName}`;

          const uploadRes = await uploadMediaToSupabaseBucket(file, uploadPath);
          if (uploadRes.success && uploadRes.storagePath) {
            storagePath = uploadRes.storagePath;
          }
        } else if (m.url && m.url.startsWith('data:')) {
          const blob = dataUrlToBlob(m.url);
          if (blob) {
            const safeFileName = `${Date.now()}_img_${idx}.png`;
            const uploadPath = `products/${id}/${mediaType}/${safeFileName}`;
            const file = new File([blob], safeFileName, { type: 'image/png' });
            const uploadRes = await uploadMediaToSupabaseBucket(file, uploadPath);
            if (uploadRes.success && uploadRes.storagePath) {
              storagePath = uploadRes.storagePath;
            }
          }
        }

        let mColourId = m.colourId || (m.colourName ? colourMap[m.colourName] : undefined);
        
        mediaRecords.push({
          product_id: id,
          colour_id: mColourId,
          storage_path: storagePath,
          alt_text: m.alt || updates.name || 'Product Media',
          media_type: mediaType,
          sort_order: idx,
          is_primary: m.isPrimary || idx === 0,
        });
      }

      await client.from('product_media').insert(mediaRecords);
    }

    // Re-fetch updated product from Supabase
    const updated = await fetchSupabaseProductById(id);
    if (updated) {
      void recordAuditLog({
        action: 'product.update',
        actionLabel: `Updated product "${updated.name}" (${id})`,
        targetType: 'product',
        targetId: id,
        details: { name: updated.name, status: updated.status, price: updated.price }
      });
    }
    return { product: updated, error: null };
  } catch (err: any) {
    console.error('Supabase updateProduct exception:', err);
    return { product: null, error: `Product update failed: ${err?.message || 'Unexpected error'}` };
  }
}

/**
 * Update stock quantity for a single product variant in Supabase
 */
export async function updateSupabaseVariantStock(variantId: string, quantity: number, threshold?: number): Promise<boolean> {
  const res = await updateVariantStockInSupabase(variantId, quantity, threshold);
  if (res.success) {
    void recordAuditLog({
      action: 'inventory.stock_change',
      actionLabel: `Adjusted inventory stock to ${quantity} units (variant: ${variantId})`,
      targetType: 'inventory',
      targetId: variantId,
      details: { newStock: quantity, threshold }
    });
  }
  return res.success;
}

/**
 * Archive product
 */
export async function archiveSupabaseProduct(id: string): Promise<ProductItem | null> {
  const res = await updateSupabaseProduct(id, {
    status: 'ARCHIVED',
    published: false,
    active: false,
  });
  if (res.product) {
    void recordAuditLog({
      action: 'product.unpublish',
      actionLabel: `Unpublished and archived product "${res.product.name}" (${id})`,
      targetType: 'product',
      targetId: id,
    });
  }
  return res.product;
}

/**
 * Publish product
 */
export async function publishSupabaseProduct(id: string): Promise<ProductItem | null> {
  const res = await updateSupabaseProduct(id, {
    status: 'ACTIVE',
    published: true,
    active: true,
  });
  if (res.product) {
    void recordAuditLog({
      action: 'product.publish',
      actionLabel: `Published product to live storefront: "${res.product.name}" (${id})`,
      targetType: 'product',
      targetId: id,
    });
  }
  return res.product;
}

/**
 * Unpublish product
 */
export async function unpublishSupabaseProduct(id: string): Promise<ProductItem | null> {
  const res = await updateSupabaseProduct(id, {
    published: false,
    active: false,
  });
  return res.product;
}

/**
 * Delete product from Supabase
 */
export async function deleteSupabaseProduct(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('products').delete().eq('id', id);
    return !error;
  } catch (err) {
    return false;
  }
}
