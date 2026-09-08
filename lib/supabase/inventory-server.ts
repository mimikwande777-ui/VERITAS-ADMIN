import { createServiceRoleSupabaseClient, createServerSupabaseClient } from './server';
import { DbProductVariant } from './types';
import { StockUpdateResult } from './inventory';

/**
 * Server-only authoritative variant stock update with service-role privileges.
 */
export async function serverUpdateVariantStockInSupabase(
  variantId: string,
  newQuantity: number,
  threshold?: number
): Promise<StockUpdateResult> {
  const client = createServiceRoleSupabaseClient() || createServerSupabaseClient();
  if (!client) {
    return { success: false, error: 'Database service client is not configured.' };
  }

  const safeQuantity = Math.max(0, Math.floor(Number(newQuantity) || 0));

  try {
    const { data: existing, error: fetchErr } = await client
      .from('product_variants')
      .select('*')
      .eq('id', variantId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return {
        success: false,
        error: fetchErr ? `Variant lookup failed: ${fetchErr.message}` : `Variant ID ${variantId} does not exist in Supabase.`,
      };
    }

    const oldStock = existing.stock_quantity;

    const patch: any = {
      stock_quantity: safeQuantity,
      updated_at: new Date().toISOString(),
    };
    if (threshold !== undefined && threshold !== null) {
      patch.low_stock_threshold = Math.max(1, Math.floor(Number(threshold) || 5));
    }

    const { data: updatedRows, error: updateErr } = await client
      .from('product_variants')
      .update(patch)
      .eq('id', variantId)
      .select('*');

    if (updateErr) {
      return {
        success: false,
        oldStock,
        error: `Supabase update failed: ${updateErr.message}`,
      };
    }

    if (!updatedRows || updatedRows.length === 0) {
      return {
        success: false,
        oldStock,
        error: 'Database rejected the update: 0 rows affected.',
      };
    }

    // MANDATORY RE-READ to verify persistence
    const { data: verifiedRow, error: reReadErr } = await client
      .from('product_variants')
      .select('*')
      .eq('id', variantId)
      .maybeSingle();

    if (reReadErr || !verifiedRow) {
      return {
        success: false,
        oldStock,
        error: `Mutation verification failed: Could not re-read variant (${reReadErr?.message || 'Empty read'}).`,
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
    return {
      success: false,
      error: `Unexpected error updating stock: ${err?.message || 'Unknown server error'}`,
    };
  }
}

/**
 * Server-only authoritative variant stock delta adjustment (+/- delta) with service-role privileges.
 */
export async function serverAdjustVariantStockInSupabase(
  variantId: string,
  delta: number
): Promise<StockUpdateResult> {
  const client = createServiceRoleSupabaseClient() || createServerSupabaseClient();
  if (!client) {
    return { success: false, error: 'Database service client is not configured.' };
  }

  try {
    const { data: existing, error: fetchErr } = await client
      .from('product_variants')
      .select('*')
      .eq('id', variantId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return {
        success: false,
        error: fetchErr ? `Variant lookup error: ${fetchErr.message}` : `Variant ID ${variantId} not found.`,
      };
    }

    const oldStock = Number(existing.stock_quantity) || 0;
    const newStock = Math.max(0, oldStock + delta);

    const { data: updatedRows, error: updateErr } = await client
      .from('product_variants')
      .update({
        stock_quantity: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', variantId)
      .select('*');

    if (updateErr) {
      return {
        success: false,
        oldStock,
        error: `Supabase adjust failed: ${updateErr.message}`,
      };
    }

    if (!updatedRows || updatedRows.length === 0) {
      return {
        success: false,
        oldStock,
        error: 'Database rejected the adjust: 0 rows affected.',
      };
    }

    // MANDATORY RE-READ: Immediately query the same variant again to verify persistence
    const { data: verifiedRow, error: reReadErr } = await client
      .from('product_variants')
      .select('*')
      .eq('id', variantId)
      .maybeSingle();

    if (reReadErr || !verifiedRow) {
      return {
        success: false,
        oldStock,
        error: `Adjust verification failed: Could not re-read variant (${reReadErr?.message || 'Empty read'}).`,
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
