import { NextRequest, NextResponse } from 'next/server';
import { fetchSupabaseProducts } from '@/lib/supabase/products';
import { serverAdjustVariantStockInSupabase } from '@/lib/supabase/inventory-server';
import { requireAdmin } from '@/lib/supabase/require-admin';

export const dynamic = 'force-dynamic';

/**
 * Explicit, protected inventory roundtrip diagnostic test.
 * Requires Admin authentication. Disabled in production unless explicitly enabled via DIAGNOSTICS_ENABLED=true.
 */
export async function POST(request: NextRequest) {
  // 1. Check if diagnostics are enabled in production
  if (process.env.NODE_ENV === 'production' && process.env.DIAGNOSTICS_ENABLED !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Diagnostics are disabled in production environment.' },
      { status: 403 }
    );
  }

  // 2. Authoritative Admin Authentication
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  // 3. Perform manual non-destructive roundtrip test
  try {
    const products = await fetchSupabaseProducts();
    if (!products || products.length === 0 || !products[0].variants || products[0].variants.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No product variants found to execute diagnostic test.',
      }, { status: 404 });
    }

    const variant = products[0].variants[0];
    const initialStock = Number(variant.stockQuantity) || 0;
    const testDelta = 1;

    // Apply delta (+1)
    const forwardRes = await serverAdjustVariantStockInSupabase(variant.id, testDelta);
    if (!forwardRes.success) {
      return NextResponse.json({
        success: false,
        phase: 'forward_mutation',
        error: forwardRes.error,
      }, { status: 500 });
    }

    // Immediately restore original value (-1)
    const revertRes = await serverAdjustVariantStockInSupabase(variant.id, -testDelta);
    if (!revertRes.success) {
      return NextResponse.json({
        success: false,
        phase: 'revert_mutation',
        warning: 'CRITICAL: Forward mutation succeeded but revert failed!',
        error: revertRes.error,
      }, { status: 500 });
    }

    // Verify restored stock matches initialStock exactly
    const verifiedFinalStock = revertRes.newStock;
    const isRestored = verifiedFinalStock === initialStock;

    return NextResponse.json({
      success: isRestored,
      variantId: variant.id,
      initialStock,
      testedDelta: testDelta,
      finalVerifiedStock: verifiedFinalStock,
      restorationVerified: isRestored,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Unexpected failure during diagnostic execution',
    }, { status: 500 });
  }
}
