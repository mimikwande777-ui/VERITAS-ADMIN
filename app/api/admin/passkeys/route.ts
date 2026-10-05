import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/supabase/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: 'Database service client unavailable' }, { status: 500 })
    );
  }

  try {
    const { data: passkeys, error } = await serviceClient
      .from('admin_passkeys')
      .select('id, device_name, device_type, backed_up, created_at, last_used_at')
      .eq('admin_user_id', authCheck.admin.userId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[PASSKEYS GET] Error:', error);
      return authCheck.applyCookies(
        NextResponse.json({ success: false, error: error.message }, { status: 500 })
      );
    }

    return authCheck.applyCookies(
      NextResponse.json({
        success: true,
        passkeys: passkeys || [],
      })
    );
  } catch (err: any) {
    console.error('[PASSKEYS GET] Unexpected error:', err);
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: 'Database service client unavailable' }, { status: 500 })
    );
  }

  try {
    const body = await request.json();
    const { passkeyId, deviceName } = body;

    if (!passkeyId || !deviceName) {
      return authCheck.applyCookies(
        NextResponse.json({ success: false, error: 'passkeyId and deviceName are required' }, { status: 400 })
      );
    }

    const { error } = await serviceClient
      .from('admin_passkeys')
      .update({ device_name: String(deviceName).trim().slice(0, 60) })
      .eq('id', passkeyId)
      .eq('admin_user_id', authCheck.admin.userId);

    if (error) {
      return authCheck.applyCookies(
        NextResponse.json({ success: false, error: error.message }, { status: 500 })
      );
    }

    return authCheck.applyCookies(
      NextResponse.json({
        success: true,
        message: 'Passkey renamed successfully',
      })
    );
  } catch (err: any) {
    console.error('[PASSKEYS PATCH] Unexpected error:', err);
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: 'Database service client unavailable' }, { status: 500 })
    );
  }

  try {
    const body = await request.json();
    const { passkeyId } = body;

    if (!passkeyId) {
      return authCheck.applyCookies(
        NextResponse.json({ success: false, error: 'passkeyId is required' }, { status: 400 })
      );
    }

    // Mark as revoked
    const { error } = await serviceClient
      .from('admin_passkeys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', passkeyId)
      .eq('admin_user_id', authCheck.admin.userId);

    if (error) {
      return authCheck.applyCookies(
        NextResponse.json({ success: false, error: error.message }, { status: 500 })
      );
    }

    // Write audit log
    try {
      await recordAuditLog({
        action: 'auth.passkey_revoke',
        actionLabel: 'Passkey Revoked',
        targetType: 'auth',
        targetId: passkeyId,
        actorEmail: authCheck.admin.email,
        actorRole: authCheck.admin.role,
        details: {
          adminUserId: authCheck.admin.userId,
        },
      });
    } catch {
      // Non-blocking
    }

    return authCheck.applyCookies(
      NextResponse.json({
        success: true,
        message: 'Passkey revoked successfully',
      })
    );
  } catch (err: any) {
    console.error('[PASSKEYS DELETE] Unexpected error:', err);
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
    );
  }
}
