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

    // 1. Authenticate credentials via server-side Supabase signInWithPassword
    const serverClient = createServerSupabaseClient();
    if (!serverClient) {
      return NextResponse.json(
        { success: false, error: 'Server authentication client configuration error.' },
        { status: 500 }
      );
    }

    const { data: authData, error: authError } = await serverClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      return NextResponse.json(
        { success: false, error: authError?.message || 'Invalid administrator credentials.' },
        { status: 401 }
      );
    }

    const user = authData.user;
    const session = authData.session;

    // 2. Authoritative check: verify user UUID exists in public.admin_users using Service Role
    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json(
        { success: false, error: 'Server authorization database client error.' },
        { status: 500 }
      );
    }

    const { data: adminRecord, error: adminErr } = await serviceClient
      .from('admin_users')
      .select('user_id, role, email')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminErr || !adminRecord) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Authenticated user is not registered in public.admin_users.' },
        { status: 403 }
      );
    }

    const allowedRoles = ['super_admin', 'admin', 'manager'];
    if (!allowedRoles.includes(adminRecord.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient administrative privileges.' },
        { status: 403 }
      );
    }

    // 3. Construct Admin User payload
    const adminUser = {
      id: user.id,
      name: user.user_metadata?.full_name || email.split('@')[0].toUpperCase(),
      email: user.email || email,
      role: adminRecord.role,
      createdAt: user.created_at || new Date().toISOString(),
      lastActive: 'Just now',
    };

    // 4. Return 200 with HttpOnly secure session cookie
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
