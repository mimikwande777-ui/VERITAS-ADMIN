import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token =
    request.cookies.get('sb-access-token')?.value ||
    request.cookies.get('veritas_admin_token')?.value;

  if (!token) {
    return NextResponse.json({ hasSession: false }, { status: 200 });
  }

  const client = createServerSupabaseClient(token);
  if (!client) {
    return NextResponse.json({ hasSession: false }, { status: 200 });
  }

  try {
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) {
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

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const token =
      request.cookies.get('sb-access-token')?.value ||
      request.cookies.get('veritas_admin_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Password recovery session is invalid or has expired. Request a new recovery email.' },
        { status: 401 }
      );
    }

    // Normal client initialized with user bearer token and anon key
    // Never uses privileged secret key
    const client = createServerSupabaseClient(token);
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Server authentication configuration error.' },
        { status: 500 }
      );
    }

    const { error: updateError } = await client.auth.updateUser({
      password,
    });

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message || 'Failed to update password.' },
        { status: 400 }
      );
    }

    // After password change, expire recovery session cookies so user must unlock normally with new password
    const response = NextResponse.json({
      success: true,
      message: 'Password updated successfully.',
    });

    response.cookies.set('sb-access-token', '', { path: '/', maxAge: 0 });
    response.cookies.set('veritas_admin_token', '', { path: '/', maxAge: 0 });
    response.cookies.set('sb-refresh-token', '', { path: '/', maxAge: 0 });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update password.' },
      { status: 500 }
    );
  }
}
