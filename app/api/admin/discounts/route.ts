import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canViewDiscounts' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return NextResponse.json({ success: false, error: 'Database service client not available.' }, { status: 500 });
  }

  try {
    const { data, error } = await serviceClient
      .from('discounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // If table does not exist or has zero rows, return empty list gracefully
      return NextResponse.json({ success: true, discounts: [] });
    }

    return NextResponse.json({ success: true, discounts: data || [] });
  } catch (err: any) {
    return NextResponse.json({ success: true, discounts: [] });
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canCreateDiscounts' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return NextResponse.json({ success: false, error: 'Database service client not available.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { code, discount_type, value, minimum_spend, max_redemptions, expires_at, is_active } = body;

    if (!code) {
      return NextResponse.json({ success: false, error: 'Discount code is required.' }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from('discounts')
      .insert({
        code: code.toUpperCase().trim(),
        discount_type: discount_type || 'percentage',
        value: Number(value) || 0,
        minimum_spend: minimum_spend ? Number(minimum_spend) : null,
        max_redemptions: max_redemptions ? Number(max_redemptions) : null,
        expires_at: expires_at || null,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, discount: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error creating discount' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canEditDiscounts' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return NextResponse.json({ success: false, error: 'Database service client not available.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const id = body.id || request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Discount ID is required.' }, { status: 400 });
    }

    const patch: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.code !== undefined) patch.code = body.code.toUpperCase().trim();
    if (body.discount_type !== undefined) patch.discount_type = body.discount_type;
    if (body.value !== undefined) patch.value = Number(body.value);
    if (body.minimum_spend !== undefined) patch.minimum_spend = body.minimum_spend ? Number(body.minimum_spend) : null;
    if (body.max_redemptions !== undefined) patch.max_redemptions = body.max_redemptions ? Number(body.max_redemptions) : null;
    if (body.expires_at !== undefined) patch.expires_at = body.expires_at;
    if (body.is_active !== undefined) patch.is_active = body.is_active;

    const { data, error } = await serviceClient
      .from('discounts')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, discount: data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error updating discount' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canEditDiscounts' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return NextResponse.json({ success: false, error: 'Database service client not available.' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Discount ID is required.' }, { status: 400 });
    }

    const { error } = await serviceClient.from('discounts').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Discount deleted successfully' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error deleting discount' }, { status: 500 });
  }
}
