import { NextRequest, NextResponse } from 'next/server';
import { fetchSupabaseProducts } from '@/lib/supabase/products';
import { fetchFullOrdersFromSupabase } from '@/lib/supabase/orders';
import { getSupabaseClient } from '@/lib/supabase/client';
import { requireAdmin } from '@/lib/supabase/require-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const report: any = {};
  try {
    // 1. Dashboard & Products (Read-Only)
    const products = await fetchSupabaseProducts();
    report.productsCount = products?.length || 0;
    
    // 2. Inventory Read-Only Verification (No mutations)
    let totalTrackedVariants = 0;
    let totalStockQuantity = 0;
    if (products && products.length > 0) {
      for (const prod of products) {
        if (prod.variants && Array.isArray(prod.variants)) {
          totalTrackedVariants += prod.variants.length;
          for (const v of prod.variants) {
            totalStockQuantity += Number(v.stockQuantity) || 0;
          }
        }
      }
    }
    report.inventoryStatus = 'READ_ONLY_AUDIT';
    report.totalTrackedVariants = totalTrackedVariants;
    report.totalStockQuantity = totalStockQuantity;

    // 3. Orders (Read-Only)
    const ordersData = await fetchFullOrdersFromSupabase();
    report.ordersCount = ordersData?.records?.length || 0;
    
    // 4. Check collections, audit_logs, discounts tables (Read-Only)
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: collections } = await supabase.from('collections').select('id').limit(1);
      report.collectionsWorking = collections !== null;

      const { error: auditError } = await supabase.from('audit_logs').select('id').limit(1);
      report.auditLogExists = !auditError;

      const { error: discountError } = await supabase.from('discounts').select('id').limit(1);
      report.discountsExists = !discountError;
    } else {
      report.collectionsWorking = false;
      report.auditLogExists = false;
      report.discountsExists = false;
    }

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
