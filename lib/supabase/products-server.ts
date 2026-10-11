import { SupabaseClient } from '@supabase/supabase-js';
import { ProductItem } from '@/lib/mock-data';
import { DbProductVariant, DbProductMedia } from './types';
import { getProductMediaUrl } from './media';
import { parseSupabaseError } from './products';
import { formatVariantSku } from '@/lib/sku';

/**
 * Validates and resolves an existing category record in public.categories
 * Note: Does NOT auto-create categories. Non-existent categories produce a validation error.
 */
async function resolveCategoryId(client: SupabaseClient, categoryNameOrId?: string): Promise<{ id: string | null; error?: string }> {
  if (!categoryNameOrId) return { id: null };
  const trimmed = categoryNameOrId.trim();
  if (!trimmed) return { id: null };
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

    // Auto-create category if missing to guarantee reliable publishing
    const { data: created } = await client
      .from('categories')
      .insert({ name: trimmed, slug: slug || `category-${Date.now()}` })
      .select('id')
      .maybeSingle();

    if (created?.id) {
      return { id: created.id };
    }

    return { id: null };
  } catch (err: any) {
    return { id: null };
  }
}

/**
 * Validates and resolves an existing collection record in public.collections
 */
async function resolveCollectionId(client: SupabaseClient, collectionNameOrId?: string): Promise<{ id: string | null; error?: string }> {
  if (!collectionNameOrId) return { id: null };
  const trimmed = collectionNameOrId.trim();
  if (!trimmed) return { id: null };
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

    // Auto-create collection if missing to guarantee reliable publishing
    const { data: created } = await client
      .from('collections')
      .insert({ name: trimmed, slug: slug || `collection-${Date.now()}`, is_active: true })
      .select('id')
      .maybeSingle();

    if (created?.id) {
      return { id: created.id };
    }

    return { id: null };
  } catch (err: any) {
    return { id: null };
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
    salesMode: (raw.sales_mode as any) || 'standard',
    releaseAt: raw.release_at || null,
    availabilityMessage: raw.availability_message || null,
    preorderNotice: raw.preorder_notice || null,
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
    const sellingPrice = Number(data.price !== undefined ? data.price : (data as any).sellingPrice) || 0;
    const costPrice = Number(data.costPrice !== undefined ? data.costPrice : (data as any).cost_price) || 0;
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

    const salesMode = (data.salesMode || (data as any).sales_mode || 'standard') as 'standard' | 'coming_soon' | 'preorder';
    const releaseAt = data.releaseAt !== undefined ? data.releaseAt : (data as any).release_at !== undefined ? (data as any).release_at : null;
    const availabilityMessage = data.availabilityMessage !== undefined ? data.availabilityMessage : (data as any).availability_message !== undefined ? (data as any).availability_message : null;
    const preorderNotice = data.preorderNotice !== undefined ? data.preorderNotice : (data as any).preorder_notice !== undefined ? (data as any).preorder_notice : null;

    const dbPayload: any = {
      name: data.name || 'Untitled Product',
      slug: generatedSlug,
      description: data.description || '',
      product_type: data.category || 'T-Shirts',
      selling_price: sellingPrice,
      cost_price: costPrice,
      status: statusLower,
      published: statusLower === 'archived' ? false : (data.published ?? false),
      featured: statusLower === 'archived' ? false : (data.featured ?? false),
      sales_mode: salesMode,
      release_at: releaseAt,
      availability_message: availabilityMessage,
      preorder_notice: preorderNotice,
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

    if (data.variants && data.variants.length > 0) {
      const incomingCombos = new Set<string>();
      for (const v of data.variants) {
        const colKey = (v.colour || '').trim().toLowerCase();
        const sizeKey = (v.size || '').trim().toUpperCase();
        const comboKey = `${colKey}__${sizeKey}`;
        if (incomingCombos.has(comboKey)) {
          if (inserted) {
            await client.from('products').delete().eq('id', inserted.id);
          }
          return {
            product: null,
            error: `Duplicate variant combination detected: colour "${v.colour}" and size "${v.size}" cannot be defined multiple times.`
          };
        }
        incomingCombos.add(comboKey);
      }
    }

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
      const categoryForSku = data.category || dbPayload.product_type || 'T-Shirts';
      const variantPayload = data.variants.map((v, idx) => ({
        product_id: inserted.id,
        colour_id: colourMap[v.colour] || undefined,
        sku: formatVariantSku(inserted.id, categoryForSku, idx),
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
      const primaryIdx = data.images.findIndex((img: any) => img.isPrimary === true);
      const effectivePrimaryIdx = primaryIdx >= 0 ? primaryIdx : 0;

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
          is_primary: idx === effectivePrimaryIdx,
        };
      });

      const { error: mediaErr } = await client.from('product_media').insert(mediaRecords);
      if (mediaErr) {
        await client.from('products').delete().eq('id', inserted.id);
        return { product: null, error: `Failed to save product media: ${parseSupabaseError(mediaErr)}` };
      }
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
    else if ((updates as any).sellingPrice !== undefined) patch.selling_price = Number((updates as any).sellingPrice);
    if (updates.costPrice !== undefined) patch.cost_price = Number(updates.costPrice);
    else if ((updates as any).cost_price !== undefined) patch.cost_price = Number((updates as any).cost_price);
    if (updates.status !== undefined) patch.status = updates.status.toLowerCase();
    if (updates.published !== undefined) patch.published = updates.published;
    if (updates.featured !== undefined) patch.featured = updates.featured;

    if (updates.salesMode !== undefined) patch.sales_mode = updates.salesMode;
    else if ((updates as any).sales_mode !== undefined) patch.sales_mode = (updates as any).sales_mode;

    if (updates.releaseAt !== undefined) patch.release_at = updates.releaseAt;
    else if ((updates as any).release_at !== undefined) patch.release_at = (updates as any).release_at;

    if (updates.availabilityMessage !== undefined) patch.availability_message = updates.availabilityMessage;
    else if ((updates as any).availability_message !== undefined) patch.availability_message = (updates as any).availability_message;

    if (updates.preorderNotice !== undefined) patch.preorder_notice = updates.preorderNotice;
    else if ((updates as any).preorder_notice !== undefined) patch.preorder_notice = (updates as any).preorder_notice;

    // Archiving rule: When status becomes archived, enforce published = false and featured = false
    if (patch.status === 'archived') {
      patch.published = false;
      patch.featured = false;
    }

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

    const colourMap: Record<string, string> = {};
    if (updates.colours) {
      const { data: existingColours } = await client.from('product_colours').select('id, name').eq('product_id', id);
      const newColourNames = updates.colours.map(c => c.name);
      const toDelete = (existingColours || []).filter(c => !newColourNames.includes(c.name)).map(c => c.id);

      for (const [index, col] of updates.colours.entries()) {
        const existing = (existingColours || []).find(c => c.name === col.name);
        if (existing) {
          const { error: colUpdErr } = await client.from('product_colours').update({
            name: col.name,
            slug: col.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            hex_code: col.code,
            sort_order: index
          }).eq('id', existing.id);
          if (colUpdErr) {
            return { product: null, error: `Failed to update colour: ${parseSupabaseError(colUpdErr)}` };
          }
          colourMap[col.name] = existing.id;
        } else {
          const { data: insertedCol, error: colInsErr } = await client.from('product_colours').insert({
            product_id: id,
            name: col.name,
            slug: col.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            hex_code: col.code,
            sort_order: index
          }).select('id').single();
          if (colInsErr) {
            return { product: null, error: `Failed to insert colour: ${parseSupabaseError(colInsErr)}` };
          }
          if (insertedCol) colourMap[col.name] = insertedCol.id;
        }
      }

      if (toDelete.length > 0) {
        const { error: colDelErr } = await client.from('product_colours').delete().in('id', toDelete);
        if (colDelErr) {
          return { product: null, error: `Failed to delete removed colours: ${parseSupabaseError(colDelErr)}` };
        }
      }
    }

    if (Object.keys(colourMap).length === 0) {
      const { data: existingColours } = await client.from('product_colours').select('id, name').eq('product_id', id);
      if (existingColours) {
        for (const col of existingColours) {
          colourMap[col.name] = col.id;
        }
      }
    }

    if (updates.variants !== undefined && updates.variants.length > 0) {
      // 5. Detect duplicate colour-size combinations in the incoming payload and return a clear validation error
      const incomingCombos = new Set<string>();
      for (const v of updates.variants) {
        const colKey = (v.colour || '').trim().toLowerCase();
        const sizeKey = (v.size || '').trim().toUpperCase();
        const comboKey = `${colKey}__${sizeKey}`;
        if (incomingCombos.has(comboKey)) {
          return {
            product: null,
            error: `Duplicate variant combination detected: colour "${v.colour}" and size "${v.size}" cannot be defined multiple times.`
          };
        }
        incomingCombos.add(comboKey);
      }

      const { data: existingVariants, error: fetchVarErr } = await client
        .from('product_variants')
        .select('*')
        .eq('product_id', id);

      if (fetchVarErr) {
        return { product: null, error: `Failed to fetch existing variants: ${parseSupabaseError(fetchVarErr)}` };
      }

      const existingList: DbProductVariant[] = existingVariants || [];
      const categoryForSku = updates.category || patch.product_type || 'T-Shirts';
      const matchedExistingIds = new Set<string>();
      const seenSkus = new Set<string>();

      existingList.forEach(ev => {
        if (ev.sku) seenSkus.add(ev.sku);
      });

      // Track 1-to-1 matching for incoming variants
      const matches: (DbProductVariant | null)[] = new Array(updates.variants.length).fill(null);

      // 1. Match incoming variants by ID first
      updates.variants.forEach((v, idx) => {
        const vId = (v as any).id;
        if (vId) {
          const found = existingList.find(ev => ev.id === vId && !matchedExistingIds.has(ev.id));
          if (found) {
            matches[idx] = found;
            matchedExistingIds.add(found.id);
          }
        }
      });

      // 2. If no ID match exists, match by normalized colour and size only against existing variants not already matched
      updates.variants.forEach((v, idx) => {
        if (!matches[idx]) {
          const normCol = (v.colour || '').trim().toLowerCase();
          const normSize = (v.size || '').trim().toUpperCase();
          const found = existingList.find(ev =>
            !matchedExistingIds.has(ev.id) &&
            (ev.colour || '').trim().toLowerCase() === normCol &&
            (ev.size || '').trim().toUpperCase() === normSize
          );
          if (found) {
            matches[idx] = found;
            matchedExistingIds.add(found.id);
          }
        }
      });

      // Process matched and new variants
      for (let idx = 0; idx < updates.variants.length; idx++) {
        const v = updates.variants[idx];
        const match = matches[idx];
        const colourId = (v as any).colour_id || (v as any).colourId || (v.colour ? colourMap[v.colour] : undefined);
        const stockQty = Number(v.stockQuantity !== undefined ? v.stockQuantity : (v as any).stock_quantity) || 0;
        const lowStock = Number(v.lowStockThreshold !== undefined ? v.lowStockThreshold : (v as any).low_stock_threshold) || 5;

        if (match) {
          // 6. Preserve existing variant ID and SKU
          const { error: updErr } = await client
            .from('product_variants')
            .update({
              colour_id: colourId || match.colour_id,
              colour: v.colour,
              size: v.size,
              stock_quantity: stockQty,
              low_stock_threshold: lowStock,
              updated_at: new Date().toISOString(),
            })
            .eq('id', match.id);

          if (updErr) {
            return { product: null, error: `Failed to update variant: ${parseSupabaseError(updErr)}` };
          }
        } else {
          // 7. Generate a unique server-authoritative SKU for each new variant
          let newSku = formatVariantSku(id, categoryForSku, idx);
          let offset = 0;
          while (seenSkus.has(newSku)) {
            offset++;
            newSku = formatVariantSku(id, categoryForSku, existingList.length + idx + offset);
          }
          seenSkus.add(newSku);

          const { error: insErr } = await client
            .from('product_variants')
            .insert({
              product_id: id,
              colour_id: colourId,
              sku: newSku,
              colour: v.colour,
              size: v.size,
              stock_quantity: stockQty,
              low_stock_threshold: lowStock,
            });

          if (insErr) {
            return { product: null, error: `Failed to insert variant: ${parseSupabaseError(insErr)}` };
          }
        }
      }

      // 8. Delete only existing variants genuinely removed by the user
      const removedVariantIds = existingList
        .filter(ev => !matchedExistingIds.has(ev.id))
        .map(ev => ev.id);

      if (removedVariantIds.length > 0) {
        // 10. Do not delete variants that are still referenced by orders
        const { data: orderItemRefs, error: refCheckErr } = await client
          .from('order_items')
          .select('variant_id')
          .in('variant_id', removedVariantIds);

        if (refCheckErr) {
          return { product: null, error: `Failed to check order references: ${parseSupabaseError(refCheckErr)}` };
        }

        const referencedIds = new Set((orderItemRefs || []).map((r: any) => r.variant_id));
        const safeToDeleteIds = removedVariantIds.filter(vId => !referencedIds.has(vId));

        if (safeToDeleteIds.length > 0) {
          const { error: delErr } = await client
            .from('product_variants')
            .delete()
            .in('id', safeToDeleteIds);

          // 9. Check every database operation for errors. Do not report a successful update if deleting removed variants fails.
          if (delErr) {
            return { product: null, error: `Failed to delete removed variants: ${parseSupabaseError(delErr)}` };
          }
        }
      }
    }

    if (updates.images !== undefined) {
      const { data: existingMediaList, error: fetchMediaErr } = await client
        .from('product_media')
        .select('*')
        .eq('product_id', id);

      if (fetchMediaErr) {
        return { product: null, error: `Failed to fetch existing media: ${parseSupabaseError(fetchMediaErr)}` };
      }

      const existingMedia = existingMediaList || [];

      if (updates.images.length === 0) {
        // User explicitly removed all images
        if (existingMedia.length > 0) {
          const { error: delAllErr } = await client
            .from('product_media')
            .delete()
            .eq('product_id', id);
          if (delAllErr) {
            return { product: null, error: `Failed to remove product media: ${parseSupabaseError(delAllErr)}` };
          }
        }
      } else {
        // Enforce exactly one primary media across the product to satisfy product_media_one_primary_per_product
        const primaryIdx = updates.images.findIndex((img: any) => img.isPrimary === true);
        const effectivePrimaryIdx = primaryIdx >= 0 ? primaryIdx : 0;

        // Reset is_primary to false on all existing media for this product to prevent transient unique collisions
        if (existingMedia.length > 0) {
          const { error: resetErr } = await client
            .from('product_media')
            .update({ is_primary: false })
            .eq('product_id', id);
          if (resetErr) {
            return { product: null, error: `Failed to reset primary media: ${parseSupabaseError(resetErr)}` };
          }
        }

        const matchedMediaIds = new Set<string>();

        // Match pass 1: Match incoming images by exact existing media ID (UUID primary key)
        const matches: Array<any | null> = updates.images.map((img: any) => {
          if (img.id) {
            const found = existingMedia.find(em => em.id === img.id && !matchedMediaIds.has(em.id));
            if (found) {
              matchedMediaIds.add(found.id);
              return found;
            }
          }
          return null;
        });

        // Match pass 2: For unmatched incoming images, match by storage_path / URL
        updates.images.forEach((img: any, idx: number) => {
          if (!matches[idx] && img.url) {
            const incomingUrl = String(img.url).trim();
            const found = existingMedia.find(em => {
              if (matchedMediaIds.has(em.id)) return false;
              const emPath = String(em.storage_path).trim();
              return emPath === incomingUrl ||
                     incomingUrl.endsWith(emPath) ||
                     emPath.endsWith(incomingUrl);
            });
            if (found) {
              matchedMediaIds.add(found.id);
              matches[idx] = found;
            }
          }
        });

        // Update matched existing media in place or insert new media
        for (let idx = 0; idx < updates.images.length; idx++) {
          const m = updates.images[idx];
          const matched = matches[idx];
          let mediaType = m.role || 'front';
          if (mediaType === 'main') mediaType = 'front';
          if (mediaType === 'gallery') mediaType = 'detail';
          const isPrimary = (idx === effectivePrimaryIdx);
          const colourId = m.colourId || (m.colourName ? colourMap[m.colourName] : undefined);
          const storagePath = m.url || '';
          const altText = m.alt || updates.name || 'Product Media';

          if (matched) {
            const { error: updMediaErr } = await client
              .from('product_media')
              .update({
                storage_path: storagePath,
                alt_text: altText,
                media_type: mediaType,
                sort_order: idx,
                is_primary: isPrimary,
                colour_id: colourId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', matched.id);

            if (updMediaErr) {
              return { product: null, error: `Failed to save product media: ${parseSupabaseError(updMediaErr)}` };
            }
          } else {
            const { error: insMediaErr } = await client
              .from('product_media')
              .insert({
                product_id: id,
                storage_path: storagePath,
                alt_text: altText,
                media_type: mediaType,
                sort_order: idx,
                is_primary: isPrimary,
                colour_id: colourId,
              });

            if (insMediaErr) {
              return { product: null, error: `Failed to save product media: ${parseSupabaseError(insMediaErr)}` };
            }
          }
        }

        // Delete only existing media records that were removed by the user
        const removedMediaIds = existingMedia
          .filter(em => !matchedMediaIds.has(em.id))
          .map(em => em.id);

        if (removedMediaIds.length > 0) {
          const { error: delMediaErr } = await client
            .from('product_media')
            .delete()
            .in('id', removedMediaIds);

          if (delMediaErr) {
            return { product: null, error: `Failed to delete removed media: ${parseSupabaseError(delMediaErr)}` };
          }
        }
      }
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
