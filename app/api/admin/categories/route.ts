import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canEditCategories' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  try {
    const body = await request.json();
    const { name, slug, description, image_url } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Category name is required' }, { status: 400 });
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 });
    }

    const categorySlug = slug?.trim() || name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data, error } = await serviceClient
      .from('categories')
      .insert({
        name: name.trim(),
        slug: categorySlug,
        description: description?.trim() || null,
        image_url: image_url || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, category: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to create category' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canEditCategories' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  try {
    const body = await request.json();
    const { id, name, slug, description, image_url } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 });
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 });
    }

    const patch: any = {};
    if (name !== undefined) patch.name = name.trim();
    if (slug !== undefined) patch.slug = slug.trim();
    if (description !== undefined) patch.description = description?.trim() || null;
    if (image_url !== undefined) patch.image_url = image_url;

    const { data, error } = await serviceClient
      .from('categories')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, category: data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canEditCategories' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 });
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 });
    }

    const { error } = await serviceClient.from('categories').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Category deleted successfully' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to delete category' }, { status: 500 });
  }
}
