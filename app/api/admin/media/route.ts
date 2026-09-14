import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canUploadMedia' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  try {
    const body = await request.json();
    const { productId, storagePath, altText, mediaType, isPrimary, colourId } = body;

    if (!productId || !storagePath) {
      return NextResponse.json({ success: false, error: 'productId and storagePath are required' }, { status: 400 });
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 });
    }

    let type = mediaType || 'front';
    if (type === 'main') type = 'front';
    if (type === 'gallery') type = 'detail';

    const { data, error } = await serviceClient
      .from('product_media')
      .insert({
        product_id: productId,
        storage_path: storagePath,
        alt_text: altText || null,
        media_type: type,
        is_primary: isPrimary ?? false,
        colour_id: colourId || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, media: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to attach media' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canDeleteMedia' });
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
      return NextResponse.json({ success: false, error: 'Media ID is required' }, { status: 400 });
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json({ success: false, error: 'Database service unavailable' }, { status: 500 });
    }

    const { error } = await serviceClient.from('product_media').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Media deleted successfully' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to delete media' }, { status: 500 });
  }
}
