import { getSupabaseClient } from './client';
import { DbProductVariant } from './types';

export interface StockUpdateResult {
  success: boolean;
  variant?: DbProductVariant | null;
  oldStock?: number;
  newStock?: number;
  error?: string;
}

async function getClientAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  try {
    const client = getSupabaseClient();
    if (!client) return {};
    const { data: { session } } = await client.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // ignore
  }
  return {};
}

/**
 * Updates stock quantity for an individual variant in Supabase.
 * Validates integer >= 0, preserves all other fields, logs in development, and re-fetches updated variant.
 */
export async function updateVariantStockInSupabase(
  variantId: string,
  newQuantity: number,
  threshold?: number
): Promise<StockUpdateResult> {
  const safeQuantity = Math.max(0, Math.floor(Number(newQuantity) || 0));

  // 1. Browser environment: Route through authorized admin API
  if (typeof window !== 'undefined') {
    try {
      const authHeaders = await getClientAuthHeaders();
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update',
          variantId,
          quantity: safeQuantity,
          threshold,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: res.status === 401 || res.status === 403 
            ? 'Admin authorization required' 
            : (errData.error || `Server error (${res.status})`),
        };
      }

      const data = await res.json();
      return data;
    } catch (apiErr: any) {
      return { success: false, error: apiErr?.message || 'Network error updating inventory' };
    }
  }

  // 2. Server environment: Use server-only service role functions
  if (typeof window === 'undefined') {
    try {
      const { serverUpdateVariantStockInSupabase } = await import('./inventory-server');
      return await serverUpdateVariantStockInSupabase(variantId, safeQuantity, threshold);
    } catch {
      // Proceed to direct client fallback
    }
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Database connection is not configured.' };
  }

  try {
    // 1. Fetch current variant to check existence and old stock
    const { data: existing, error: fetchErr } = await client
      .from('product_variants')
      .select('*')
      .eq('id', variantId)
      .maybeSingle();

    if (fetchErr || !existing) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Inventory Stock Update Error]', {
          variantId,
          requestedStock: safeQuantity,
          fetchError: fetchErr?.message || 'Variant not found in database',
        });
      }
      return { 
        success: false, 
        error: fetchErr ? `Variant lookup failed: ${fetchErr.message}` : `Variant ID ${variantId} does not exist in Supabase.` 
      };
    }

    const oldStock = existing.stock_quantity;

    // 2. Prepare patch
    const patch: any = {
      stock_quantity: safeQuantity,
      updated_at: new Date().toISOString(),
    };
    if (threshold !== undefined && threshold !== null) {
      patch.low_stock_threshold = Math.max(1, Math.floor(Number(threshold) || 5));
    }

    // 3. Perform update (using select('*') instead of .single() to avoid PGRST116 single-coercion crash on 0 rows)
    const { data: updatedRows, error: updateErr } = await client
      .from('product_variants')
      .update(patch)
      .eq('id', variantId)
      .select('*');

    if (updateErr) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[INVENTORY SAVE DIAGNOSTICS - FAILED]', {
          variantId,
          currentDatabaseQuantity: oldStock,
          requestedQuantity: safeQuantity,
          supabaseUpdateAttempted: true,
          supabaseResponse: 'ERROR',
          supabaseError: updateErr.message,
          refetchedQuantity: null,
        });
      }
      return { 
        success: false, 
        oldStock,
        error: `Supabase update failed: ${updateErr.message}` 
      };
    }

    if (!updatedRows || updatedRows.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[INVENTORY SAVE DIAGNOSTICS - REJECTED (0 ROWS)]', {
          variantId,
          currentDatabaseQuantity: oldStock,
          requestedQuantity: safeQuantity,
          reason: 'RLS policy rejected update or variant row not found',
        });
      }
      return {
        success: false,
        oldStock,
        error: 'Database rejected the update: 0 rows modified. Row-Level Security policy may restrict mutations.',
      };
    }

    const updatedData = updatedRows[0];

    // 4. MANDATORY RE-READ: Immediately query the same variant again to verify persistence
    const { data: verifiedRow, error: reReadErr } = await client
      .from('product_variants')
      .select('*')
      .eq('id', variantId)
      .maybeSingle();

    const verifiedStock = verifiedRow ? Number(verifiedRow.stock_quantity) : null;

    if (process.env.NODE_ENV !== 'production') {
      console.log('[INVENTORY SAVE DIAGNOSTICS]', {
        variantId,
        currentDatabaseQuantity: oldStock,
        requestedQuantity: safeQuantity,
        supabaseUpdateAttempted: true,
        supabaseResponse: updatedData ? 'SUCCESS' : 'EMPTY',
        supabaseError: reReadErr?.message || null,
        refetchedQuantity: verifiedStock,
      });
    }

    if (reReadErr || !verifiedRow) {
      return {
        success: false,
        oldStock,
        error: `Mutation verification failed: Could not re-read variant from Supabase (${reReadErr?.message || 'Empty read'}).`,
      };
    }

    if (verifiedRow.stock_quantity !== safeQuantity) {
      return {
        success: false,
        oldStock,
        error: `Integrity verification error: Database quantity (${verifiedRow.stock_quantity}) does not match requested stock (${safeQuantity}).`,
      };
    }

    return {
      success: true,
      variant: verifiedRow,
      oldStock,
      newStock: verifiedRow.stock_quantity,
    };
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[INVENTORY SAVE EXCEPTION]', {
        variantId,
        requestedStock: safeQuantity,
        exception: err?.message,
      });
    }
    return {
      success: false,
      error: `Unexpected error updating stock: ${err?.message || 'Unknown network error'}`,
    };
  }
}

/**
 * Atomically adjusts stock quantity for a variant by delta (e.g. +5 or -2).
 * Reads fresh stock directly from Supabase to prevent stale client state.
 */
export async function adjustVariantStockInSupabase(
  variantId: string,
  delta: number
): Promise<StockUpdateResult> {
  // 1. Browser environment: Route through authorized admin API
  if (typeof window !== 'undefined') {
    try {
      const authHeaders = await getClientAuthHeaders();
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'adjust',
          variantId,
          delta,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: res.status === 401 || res.status === 403
            ? 'Admin authorization required'
            : (errData.error || `Server error (${res.status})`),
        };
      }

      const data = await res.json();
      return data;
    } catch (apiErr: any) {
      return { success: false, error: apiErr?.message || 'Network error adjusting inventory' };
    }
  }

  // 2. Server environment: Use server-only service role functions
  if (typeof window === 'undefined') {
    try {
      const { serverAdjustVariantStockInSupabase } = await import('./inventory-server');
      return await serverAdjustVariantStockInSupabase(variantId, delta);
    } catch {
      // Proceed to direct client fallback
    }
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Database connection is not configured.' };
  }

  try {
    // 1. Read current authoritative state from Supabase
    const { data: existing, error: fetchErr } = await client
      .from('product_variants')
      .select('*')
      .eq('id', variantId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return { 
        success: false, 
        error: fetchErr ? `Variant lookup error: ${fetchErr.message}` : `Variant ID ${variantId} not found.` 
      };
    }

    const oldStock = Number(existing.stock_quantity) || 0;
    const newStock = Math.max(0, oldStock + delta);

    // 2. Perform atomic database update (using select('*') instead of .single() to avoid PGRST116 single-coercion crash on 0 rows)
    const { data: updatedRows, error: updateErr } = await client
      .from('product_variants')
      .update({
        stock_quantity: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', variantId)
      .select('*');

    if (updateErr) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[INVENTORY ADJUST DIAGNOSTICS - FAILED]', {
          variantId,
          currentDatabaseQuantity: oldStock,
          delta,
          requestedQuantity: newStock,
          supabaseUpdateAttempted: true,
          supabaseResponse: 'ERROR',
          supabaseError: updateErr.message,
          refetchedQuantity: null,
        });
      }
      return {
        success: false,
        oldStock,
        error: `Supabase adjust failed: ${updateErr.message}`,
      };
    }

    if (!updatedRows || updatedRows.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[INVENTORY ADJUST DIAGNOSTICS - REJECTED (0 ROWS)]', {
          variantId,
          currentDatabaseQuantity: oldStock,
          delta,
          requestedQuantity: newStock,
          reason: 'RLS policy rejected update or variant row not found',
        });
      }
      return {
        success: false,
        oldStock,
        error: 'Database rejected the adjust: 0 rows modified. Row-Level Security policy may restrict mutations.',
      };
    }

    const updatedData = updatedRows[0];

    // 3. MANDATORY RE-READ: Immediately query the same variant again to verify persistence
    const { data: verifiedRow, error: reReadErr } = await client
      .from('product_variants')
      .select('*')
      .eq('id', variantId)
      .maybeSingle();

    const verifiedStock = verifiedRow ? Number(verifiedRow.stock_quantity) : null;

    if (process.env.NODE_ENV !== 'production') {
      console.log('[INVENTORY ADJUST DIAGNOSTICS]', {
        variantId,
        currentDatabaseQuantity: oldStock,
        delta,
        requestedQuantity: newStock,
        supabaseUpdateAttempted: true,
        supabaseResponse: updatedData ? 'SUCCESS' : 'EMPTY',
        supabaseError: reReadErr?.message || null,
        refetchedQuantity: verifiedStock,
      });
    }

    if (reReadErr || !verifiedRow) {
      return {
        success: false,
        oldStock,
        error: `Adjust verification failed: Could not re-read variant from Supabase (${reReadErr?.message || 'Empty read'}).`,
      };
    }

    if (verifiedRow.stock_quantity !== newStock) {
      return {
        success: false,
        oldStock,
        error: `Integrity verification error: Database quantity (${verifiedRow.stock_quantity}) does not match requested stock (${newStock}).`,
      };
    }

    return {
      success: true,
      variant: verifiedRow,
      oldStock,
      newStock: verifiedRow.stock_quantity,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Exception adjusting stock: ${err?.message || 'Unknown error'}`,
    };
  }
}

/**
 * Batch updates multiple variant stock levels.
 */
export async function batchUpdateVariantStockInSupabase(
  updates: Array<{ variantId: string; quantity: number; threshold?: number }>
): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
  let updatedCount = 0;
  const errors: string[] = [];

  for (const item of updates) {
    const res = await updateVariantStockInSupabase(item.variantId, item.quantity, item.threshold);
    if (res.success) {
      updatedCount++;
    } else {
      errors.push(`Variant ${item.variantId}: ${res.error}`);
    }
  }

  return {
    success: errors.length === 0,
    updatedCount,
    errors,
  };
}

export async function addVariantToSupabase(variant: Partial<DbProductVariant>): Promise<DbProductVariant | null> {
  const client = getSupabaseClient();
  if (!client || !variant.product_id) return null;

  try {
    const { data, error } = await client
      .from('product_variants')
      .insert({
        product_id: variant.product_id,
        sku: variant.sku || `SKU-${Date.now()}`,
        colour: variant.colour || 'Default',
        size: variant.size || 'M',
        stock_quantity: Math.max(0, Math.floor(Number(variant.stock_quantity) || 0)),
        low_stock_threshold: Math.max(1, Math.floor(Number(variant.low_stock_threshold) || 5)),
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error adding variant to Supabase:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Exception adding variant:', err);
    return null;
  }
}

