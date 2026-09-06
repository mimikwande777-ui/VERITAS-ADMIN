import { NextResponse } from 'next/server';
import { fetchSupabaseProducts } from '@/lib/supabase/products';
import { fetchFullOrdersFromSupabase } from '@/lib/supabase/orders';
import { adjustVariantStockInSupabase } from '@/lib/supabase/inventory';
import { getSupabaseClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const report: any = {};
  try {
    // 1. Dashboard & Products
    const products = await fetchSupabaseProducts();
    report.productsCount = products?.length || 0;
    
    // 2. Inventory Test
    let inventoryTest = false;
    if (products && products.length > 0 && products[0].variants?.length > 0) {
      const variant = products[0].variants[0];
      const initialStock = variant.stockQuantity || 0;
      
      const success = await adjustVariantStockInSupabase(variant.id, 3);
      
      if (success) {
        // We added 3 to stock
        const refreshed = await fetchSupabaseProducts();
        const updatedVariant = refreshed?.find(p => p.id === products[0].id)?.variants?.find(v => v.id === variant.id);
        
        if (updatedVariant && updatedVariant.stockQuantity === initialStock + 3) {
          // Revert
          await adjustVariantStockInSupabase(variant.id, -3);
          inventoryTest = true;
        }
      }
    }
    report.inventoryTest = inventoryTest ? 'PASS' : 'FAIL';

    // 3. Orders
    const ordersData = await fetchFullOrdersFromSupabase();
    report.ordersCount = ordersData?.records?.length || 0;
    
    // Check categories/collections tables
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: collections } = await supabase.from('collections').select('*');
      report.collectionsWorking = collections !== null;

      const { error: auditError } = await supabase.from('audit_logs').select('*').limit(1);
      report.auditLogExists = !auditError;

      const { error: discountError } = await supabase.from('discounts').select('*').limit(1);
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
