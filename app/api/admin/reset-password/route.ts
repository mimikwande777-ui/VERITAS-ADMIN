import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function extractTokensFromRequest(request: NextRequest): { token: string | null; refreshToken: string | null } {
  // 1. Check Authorization header
  const authHeader = request.headers.get('authorization');
  let token: string | null = null;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Check cookies
  const cookies = request.cookies;
  if (!token) {
    token = cookies.get('sb-access-token')?.value || cookies.get('veritas_admin_token')?.value || null;
  }

  const refreshToken = cookies.get('sb-refresh-token')?.value || null;

  if (!token) {
    for (const cookie of cookies.getAll()) {
      if (cookie.name.includes('auth-token') || cookie.name.includes('access_token')) {
        try {
          const parsed = JSON.parse(cookie.value);
          if (parsed && typeof parsed === 'object' && parsed.access_token) {
            token = parsed.access_token;
            if (parsed.refresh_token && !refreshToken) {
              return { token, refreshToken: parsed.refresh_token };
            }
            break;
          } else if (Array.isArray(parsed) && parsed[0]) {
            token = parsed[0];
            break;
          }
        } catch {
          if (cookie.value.length > 50 && cookie.value.split('.').length === 3) {
            token = cookie.value;
            break;
          }
        }
      }
    }
  }

  return { token, refreshToken };
}

export async function GET(request: NextRequest) {
  const { token, refreshToken } = extractTokensFromRequest(request);

  if (!token) {
    return NextResponse.json({ hasSession: false }, { status: 200 });
  }

  const client = createServerSupabaseClient(token, refreshToken || undefined);
  if (!client) {
    return NextResponse.json({ hasSession: false }, { status: 200 });
  }

  try {
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user || !user.id) {
      return NextResponse.json({ hasSession: false }, { status: 200 });
    }
    return NextResponse.json({ hasSession: true }, { status: 200 });
  } catch {
    return NextResponse.json({ hasSession: false }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const password = body.password;
    const confirmPassword = body.confirmPassword;

    // 4. Validate password server-side
    if (!password || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Password and password confirmation are required.' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Passwords do not match.' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    // 1. Read recovery session token from HttpOnly cookies
    const { token, refreshToken } = extractTokensFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Password recovery session is missing or expired. Request a new recovery email.' },
        { status: 401 }
      );
    }

    // Normal client initialized with user bearer token and anon key
    // DO NOT use SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY for changing user's password
    const client = createServerSupabaseClient(token, refreshToken || undefined);
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Server authentication configuration error.' },
        { status: 500 }
      );
    }

    // 2. Verify the authenticated user via getUser() - DO NOT trust getSession().user
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'Password recovery session is missing or expired. Request a new recovery email.' },
        { status: 401 }
      );
    }

    // 3. Verify Admin Role using authenticated user's UUID from getUser()
    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json(
        { success: false, error: 'Server authorization client error.' },
        { status: 500 }
      );
    }

    const { data: adminRecord, error: adminQueryError } = await serviceClient
      .from('admin_users')
      .select('user_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminQueryError || !adminRecord) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Authenticated user does not possess administrative privileges.' },
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

    // 5. Update password using the authenticated recovery user's own Supabase session
    const { error: updateError } = await client.auth.updateUser({
      password,
    });

    if (updateError) {
      console.error('[admin-reset-password] password update failed:', updateError.message || 'Unknown error');
      return NextResponse.json(
        { success: false, error: updateError.message || 'Failed to update password.' },
        { status: 400 }
      );
    }

    // 8. Sign out the temporary Supabase recovery session server-side
    try {
      await client.auth.signOut();
    } catch {
      // Safe catch
    }

    // Clear any recovery/auth cookies associated with this temporary session
    const response = NextResponse.json({
      success: true,
      message: 'Password updated successfully.',
    });

    const isProd = process.env.NODE_ENV === 'production';

    response.cookies.set('sb-access-token', '', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    response.cookies.set('veritas_admin_token', '', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    response.cookies.set('sb-refresh-token', '', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update password.' },
      { status: 500 }
    );
  }
}
