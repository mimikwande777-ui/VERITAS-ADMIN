import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/auth-types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface SearchResultItem {
  id: string;
  type: 'product' | 'order' | 'collection' | 'category';
  title: string;
  subtitle?: string;
  status?: string;
  href: string;
  badgeColor?: string;
}

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  if (!q || q.length < 1) {
    return authCheck.applyCookies(NextResponse.json({ success: true, results: [] }));
  }

  const userRole = authCheck.admin.role;
  const canViewProducts = hasPermission(userRole, 'canViewProducts');
  const canViewOrders = hasPermission(userRole, 'canViewOrders');
  const canViewCollections = hasPermission(userRole, 'canViewCollections');
  const canViewCategories = hasPermission(userRole, 'canViewCategories');

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return authCheck.applyCookies(NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 }));
  }

  const results: SearchResultItem[] = [];
  const queryLower = q.toLowerCase();

  try {
    // 1. PRODUCTS SEARCH
    if (canViewProducts) {
      const { data: products } = await serviceClient
        .from('products')
        .select('id, name, slug, status, published, sku')
        .or(`name.ilike.%${q}%,slug.ilike.%${q}%,sku.ilike.%${q}%`)
        .limit(6);

      if (products) {
        for (const p of products) {
          results.push({
            id: p.id,
            type: 'product',
            title: p.name || 'Untitled Product',
            subtitle: `SKU: ${p.sku || 'N/A'} • Slug: /${p.slug || ''}`,
            status: p.published ? 'Published' : p.status === 'draft' ? 'Draft' : p.status || 'Active',
            href: `/admin/products/${p.id}`,
            badgeColor: p.published ? 'bg-emerald-950/60 text-emerald-400' : 'bg-amber-950/60 text-amber-400',
          });
        }
      }

      // Also search variant SKUs
      const { data: variants } = await serviceClient
        .from('product_variants')
        .select('id, product_id, sku, colour, size, stock_quantity')
        .ilike('sku', `%${q}%`)
        .limit(4);

      if (variants && variants.length > 0) {
        const prodIds = Array.from(new Set(variants.map(v => v.product_id)));
        const { data: vProducts } = await serviceClient
          .from('products')
          .select('id, name')
          .in('id', prodIds);

        const prodMap = new Map((vProducts || []).map(p => [p.id, p.name]));

        for (const v of variants) {
          if (!results.some(r => r.id === v.product_id)) {
            const pName = prodMap.get(v.product_id) || 'Product Variant';
            results.push({
              id: `var-${v.id}`,
              type: 'product',
              title: `${pName} (${v.colour}/${v.size})`,
              subtitle: `SKU: ${v.sku} • Stock: ${v.stock_quantity ?? 0}`,
              status: 'Variant SKU',
              href: `/admin/products/${v.product_id}`,
              badgeColor: 'bg-blue-950/60 text-blue-400',
            });
          }
        }
      }
    }

    // 2. ORDERS SEARCH
    if (canViewOrders) {
      const { data: orders } = await serviceClient
        .from('orders')
        .select('id, order_number, customer_name, total, payment_status, fulfilment_status, order_status')
        .or(`order_number.ilike.%${q}%,customer_name.ilike.%${q}%`)
        .limit(6);

      if (orders) {
        for (const o of orders) {
          const ordNum = o.order_number || o.id;
          results.push({
            id: o.id,
            type: 'order',
            title: `Order ${ordNum}`,
            subtitle: `${o.customer_name || 'Customer'} • R${Number(o.total || 0).toFixed(2)}`,
            status: `${(o.payment_status || 'pending').toUpperCase()} / ${(o.fulfilment_status || 'pending').toUpperCase()}`,
            href: `/admin/orders`,
            badgeColor: o.payment_status === 'paid' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-[#222] text-[#888]',
          });
        }
      }
    }

    // 3. COLLECTIONS SEARCH
    if (canViewCollections) {
      const { data: collections } = await serviceClient
        .from('collections')
        .select('id, name, slug, active')
        .or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
        .limit(4);

      if (collections) {
        for (const c of collections) {
          results.push({
            id: c.id,
            type: 'collection',
            title: c.name || 'Collection',
            subtitle: `Slug: /collections/${c.slug || ''}`,
            status: c.active !== false ? 'Active' : 'Inactive',
            href: `/admin/collections`,
            badgeColor: c.active !== false ? 'bg-purple-950/60 text-purple-300' : 'bg-[#222] text-[#888]',
          });
        }
      }
    }

    // 4. CATEGORIES SEARCH
    if (canViewCategories) {
      const { data: categories } = await serviceClient
        .from('categories')
        .select('id, name, slug, active')
        .or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
        .limit(4);

      if (categories) {
        for (const cat of categories) {
          results.push({
            id: cat.id,
            type: 'category',
            title: cat.name || 'Category',
            subtitle: `Slug: /categories/${cat.slug || ''}`,
            status: cat.active !== false ? 'Active' : 'Inactive',
            href: `/admin/categories`,
            badgeColor: cat.active !== false ? 'bg-cyan-950/60 text-cyan-300' : 'bg-[#222] text-[#888]',
          });
        }
      }
    }

    return authCheck.applyCookies(NextResponse.json({
      success: true,
      query: q,
      count: results.length,
      results,
    }));
  } catch (err: any) {
    return authCheck.applyCookies(NextResponse.json({
      success: false,
      error: err?.message || 'Error executing search',
      results: [],
    }, { status: 500 }));
  }
}
