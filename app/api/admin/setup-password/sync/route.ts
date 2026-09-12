import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { normalizeAdminRole } from '@/lib/auth-types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const accessToken = body.accessToken || body.access_token;
    const refreshToken = body.refreshToken || body.refresh_token;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Access token is required to synchronize session.' },
        { status: 400 }
      );
    }

    const authClient = createServerSupabaseClient(accessToken, refreshToken || undefined);
    if (!authClient) {
      return NextResponse.json(
        { success: false, error: 'Authentication client unavailable.' },
        { status: 500 }
      );
    }

    const { data: { user }, error: userError } = await authClient.auth.getUser(accessToken);
    if (userError || !user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired authentication session.' },
        { status: 401 }
      );
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json(
        { success: false, error: 'Database service client unavailable.' },
        { status: 500 }
      );
    }

    // Verify admin_users record exists and is active
    const { data: adminRecord, error: adminErr } = await serviceClient
      .from('admin_users')
      .select('user_id, role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminErr || !adminRecord || adminRecord.is_active === false) {
      return NextResponse.json(
        { success: false, error: 'User does not possess an active administrator role.' },
        { status: 403 }
      );
    }

    const role = normalizeAdminRole(adminRecord.role);
    const isProd = process.env.NODE_ENV === 'production';
    const maxAge = 60 * 60 * 24 * 7; // 7 days

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role,
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0].toUpperCase(),
      },
    });

    response.cookies.set('sb-access-token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    response.cookies.set('veritas_admin_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    if (refreshToken) {
      response.cookies.set('sb-refresh-token', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: maxAge * 2,
      });
    }

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to sync session.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Check session status from cookies or auth header
  const cookies = request.cookies;
  const token = cookies.get('sb-access-token')?.value || cookies.get('veritas_admin_token')?.value || null;
  const refreshToken = cookies.get('sb-refresh-token')?.value || null;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const authClient = createServerSupabaseClient(token, refreshToken || undefined);
  if (!authClient) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  try {
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user || !user.id) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    const serviceClient = createServiceRoleSupabaseClient();
    let role = 'operations';
    if (serviceClient) {
      const { data: adminRecord } = await serviceClient
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (adminRecord) {
        role = normalizeAdminRole(adminRecord.role);
      }
    }

    return NextResponse.json({
      authenticated: true,
      session: {
        access_token: token,
        refresh_token: refreshToken || '',
      },
      user: {
        id: user.id,
        email: user.email,
        role,
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0].toUpperCase(),
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}
