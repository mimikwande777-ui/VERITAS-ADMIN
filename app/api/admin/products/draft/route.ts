import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Ensures the public.product_drafts table exists in Supabase
 */
async function ensureDraftTableExists(serviceClient: any) {
  try {
    const { error } = await serviceClient.from('product_drafts').select('id').limit(1);
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      // Table does not exist - attempt to create via RPC or raw query if supported
      await serviceClient.rpc('exec_sql', {
        sql_query: `
          CREATE TABLE IF NOT EXISTS public.product_drafts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id UUID UNIQUE NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
            draft_data JSONB NOT NULL,
            created_by TEXT DEFAULT 'admin',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
        `
      }).catch(() => {});
    }
  } catch {
    // Ignore error
  }
}

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canViewProducts' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');

  if (!productId) {
    return authCheck.applyCookies(NextResponse.json({ success: false, error: 'productId is required' }, { status: 400 }));
  }

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return authCheck.applyCookies(NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 }));
  }

  try {
    await ensureDraftTableExists(serviceClient);

    const { data, error } = await serviceClient
      .from('product_drafts')
      .select('*')
      .eq('product_id', productId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      return authCheck.applyCookies(NextResponse.json({ success: false, error: error.message }, { status: 400 }));
    }

    if (!data) {
      return authCheck.applyCookies(NextResponse.json({ success: true, hasDraft: false, draft: null }));
    }

    return authCheck.applyCookies(NextResponse.json({
      success: true,
      hasDraft: true,
      draft: {
        id: data.id,
        productId: data.product_id,
        draftData: data.draft_data,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    }));
  } catch (err: any) {
    return authCheck.applyCookies(NextResponse.json({ success: false, error: err?.message || 'Failed to fetch draft' }, { status: 500 }));
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canEditProducts' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return authCheck.applyCookies(NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 }));
  }

  try {
    const body = await request.json();
    const { productId, draftData } = body;

    if (!productId || !draftData) {
      return authCheck.applyCookies(NextResponse.json({ success: false, error: 'productId and draftData are required' }, { status: 400 }));
    }

    await ensureDraftTableExists(serviceClient);

    const { data, error } = await serviceClient
      .from('product_drafts')
      .upsert({
        product_id: productId,
        draft_data: draftData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'product_id' })
      .select()
      .single();

    if (error) {
      return authCheck.applyCookies(NextResponse.json({ success: false, error: error.message }, { status: 400 }));
    }

    return authCheck.applyCookies(NextResponse.json({
      success: true,
      draft: {
        id: data.id,
        productId: data.product_id,
        draftData: data.draft_data,
        updatedAt: data.updated_at,
      }
    }));
  } catch (err: any) {
    return authCheck.applyCookies(NextResponse.json({ success: false, error: err?.message || 'Failed to save product draft' }, { status: 500 }));
  }
}

export async function DELETE(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canEditProducts' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');

  if (!productId) {
    return authCheck.applyCookies(NextResponse.json({ success: false, error: 'productId is required' }, { status: 400 }));
  }

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return authCheck.applyCookies(NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 }));
  }

  try {
    await ensureDraftTableExists(serviceClient);

    const { error } = await serviceClient
      .from('product_drafts')
      .delete()
      .eq('product_id', productId);

    if (error) {
      return authCheck.applyCookies(NextResponse.json({ success: false, error: error.message }, { status: 400 }));
    }

    return authCheck.applyCookies(NextResponse.json({ success: true, message: 'Product draft discarded' }));
  } catch (err: any) {
    return authCheck.applyCookies(NextResponse.json({ success: false, error: err?.message || 'Failed to delete product draft' }, { status: 500 }));
  }
}
