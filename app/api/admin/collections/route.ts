import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json({ 
        success: true, 
        collections: [
          { id: 'col_essentials', name: 'VERITAS ESSENTIALS', title: 'VERITAS ESSENTIALS', slug: 'veritas-essentials', is_active: true },
          { id: 'col_premium', name: 'VERITAS PREMIUM', title: 'VERITAS PREMIUM', slug: 'veritas-premium', is_active: true },
          { id: 'col_drop001', name: 'DROP 001', title: 'DROP 001', slug: 'drop-001', is_active: true },
        ] 
      });
    }

    const { data, error } = await serviceClient
      .from('collections')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, collections: data || [] }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to fetch collections' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canEditCollections' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  try {
    const body = await request.json();
    const { name, slug, description, image_url, is_active, featured } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Collection name is required' }, { status: 400 });
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 });
    }

    const collectionSlug = slug?.trim() || name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data, error } = await serviceClient
      .from('collections')
      .insert({
        name: name.trim(),
        slug: collectionSlug,
        description: description?.trim() || null,
        image_url: image_url || null,
        is_active: is_active ?? true,
        featured: featured ?? false,
      })
      .select()
      .single();

    if (error) {
      return authCheck.applyCookies(NextResponse.json({ success: false, error: error.message }, { status: 400 }));
    }

    return authCheck.applyCookies(NextResponse.json({ success: true, collection: data }, { status: 201 }));
  } catch (err: any) {
    return authCheck.applyCookies(NextResponse.json({ success: false, error: err?.message || 'Failed to create collection' }, { status: 500 }));
  }
}

export async function PATCH(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canEditCollections' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  try {
    const body = await request.json();
    const { id, name, slug, description, image_url, is_active, featured } = body;

    if (!id) {
      return authCheck.applyCookies(NextResponse.json({ success: false, error: 'Collection ID is required' }, { status: 400 }));
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return authCheck.applyCookies(NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 }));
    }

    const patch: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) patch.name = name.trim();
    if (slug !== undefined) patch.slug = slug.trim();
    if (description !== undefined) patch.description = description?.trim() || null;
    if (image_url !== undefined) patch.image_url = image_url;
    if (is_active !== undefined) patch.is_active = is_active;
    if (featured !== undefined) patch.featured = featured;

    const { data, error } = await serviceClient
      .from('collections')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return authCheck.applyCookies(NextResponse.json({ success: false, error: error.message }, { status: 400 }));
    }

    return authCheck.applyCookies(NextResponse.json({ success: true, collection: data }, { status: 200 }));
  } catch (err: any) {
    return authCheck.applyCookies(NextResponse.json({ success: false, error: err?.message || 'Failed to update collection' }, { status: 500 }));
  }
}

export async function DELETE(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canEditCollections' });
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
      return authCheck.applyCookies(NextResponse.json({ success: false, error: 'Collection ID is required' }, { status: 400 }));
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return authCheck.applyCookies(NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 }));
    }

    const { error } = await serviceClient.from('collections').delete().eq('id', id);
    if (error) {
      return authCheck.applyCookies(NextResponse.json({ success: false, error: error.message }, { status: 400 }));
    }

    return authCheck.applyCookies(NextResponse.json({ success: true, message: 'Collection deleted successfully' }, { status: 200 }));
  } catch (err: any) {
    return authCheck.applyCookies(NextResponse.json({ success: false, error: err?.message || 'Failed to delete collection' }, { status: 500 }));
  }
}
