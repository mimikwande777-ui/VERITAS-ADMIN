import { NextRequest, NextResponse } from 'next/server';
import { serverUpdateVariantStockInSupabase, serverAdjustVariantStockInSupabase } from '@/lib/supabase/inventory-server';
import { requireAdmin } from '@/lib/supabase/require-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  // Authoritative admin verification: valid Supabase JWT + verified matching admin_users record with canManageInventory
  const authCheck = await requireAdmin(request, { requiredPermission: 'canEditInventory' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  try {
    const body = await request.json();
    const { action, variantId, quantity, delta, threshold } = body;

    if (!variantId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: variantId' },
        { status: 400 }
      );
    }

    if (action === 'adjust') {
      if (typeof delta !== 'number') {
        return NextResponse.json(
          { success: false, error: 'Missing or invalid delta for adjust action' },
          { status: 400 }
        );
      }
      const result = await serverAdjustVariantStockInSupabase(variantId, delta);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (action === 'update' || action === 'set') {
      if (typeof quantity !== 'number' && typeof quantity !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Missing or invalid quantity for update action' },
          { status: 400 }
        );
      }
      const result = await serverUpdateVariantStockInSupabase(variantId, Number(quantity), threshold);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    return NextResponse.json(
      { success: false, error: `Invalid action '${action}'. Expected 'adjust' or 'update'.` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process inventory update' },
      { status: 500 }
    );
  }
}
