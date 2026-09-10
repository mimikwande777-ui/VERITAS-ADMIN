import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body.email || '').trim();
    const password = body.password || '';

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 401 }
      );
    }

    // STEP 1 — AUTHENTICATE CREDENTIALS
    // Use the NORMAL Supabase Auth client only (SUPABASE_URL, SUPABASE_ANON_KEY)
    const authClient = createServerSupabaseClient();
    if (!authClient) {
      return NextResponse.json(
        { success: false, error: 'Server authentication client configuration error.' },
        { status: 500 }
      );
    }

    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user || !data.session) {
      return NextResponse.json(
        { success: false, error: 'Invalid login credentials' },
        { status: 401 }
      );
    }

    // STEP 2 — TRUST ONLY THE AUTHENTICATED UUID
    const authenticatedUserId = data.user.id;

    // STEP 3 — VERIFY admin_users SERVER-SIDE
    // Membership lookup ONLY using server-only privileged Supabase client
    const privilegedClient = createServiceRoleSupabaseClient();
    if (!privilegedClient) {
      return NextResponse.json(
        { success: false, error: 'Server authorization database client error.' },
        { status: 500 }
      );
    }

    const { data: adminRecord, error: adminErr } = await privilegedClient
      .from('admin_users')
      .select('user_id, role')
      .eq('user_id', authenticatedUserId)
      .maybeSingle();

    // STEP 4 — ROLE CHECK
    if (adminErr || !adminRecord) {
      return NextResponse.json(
        { success: false, error: 'Administrator access denied.' },
        { status: 403 }
      );
    }

    const allowedRoles = ['super_admin', 'admin', 'manager'];
    if (!allowedRoles.includes(adminRecord.role)) {
      return NextResponse.json(
        { success: false, error: 'Administrator access denied.' },
        { status: 403 }
      );
    }

    // STEP 5 & 6 — CREATE ADMIN SESSION & SESSION CONSISTENCY
    const user = data.user;
    const session = data.session;

    const adminUser = {
      id: authenticatedUserId,
      name: user.user_metadata?.full_name || email.split('@')[0].toUpperCase(),
      email: user.email || email,
      role: adminRecord.role,
      createdAt: user.created_at || new Date().toISOString(),
      lastActive: 'Just now',
    };

    const response = NextResponse.json({
      success: true,
      user: adminUser,
    });

    const isProd = process.env.NODE_ENV === 'production';
    const maxAge = session.expires_in || 60 * 60 * 24 * 7;

    response.cookies.set('sb-access-token', session.access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    response.cookies.set('veritas_admin_token', session.access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    if (session.refresh_token) {
      response.cookies.set('sb-refresh-token', session.refresh_token, {
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
      { success: false, error: err?.message || 'Server unlock processing failed.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { authenticated: false, error: 'No active admin session.' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: authCheck.admin.userId,
      email: authCheck.admin.email,
      role: authCheck.admin.role,
      name: (authCheck.admin.email || 'ADMIN').split('@')[0].toUpperCase(),
    },
  });
}
