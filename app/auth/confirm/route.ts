import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as any;
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');

  // Determine destination path safely (must start with / and not contain protocol)
  let destinationPath = '/auth/setup-password';
  if (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')) {
    // If legacy link sent /admin/reset-password, route to canonical /auth/setup-password
    if (nextParam === '/admin/reset-password' || nextParam.startsWith('/admin/reset-password')) {
      destinationPath = '/auth/setup-password';
    } else {
      destinationPath = nextParam;
    }
  }

  // Safe error redirect URL
  const errorRedirect = new URL('/auth/setup-password?error=invalid', request.url);

  // Verification requires either token_hash or code
  if (!token_hash && !code) {
    return NextResponse.redirect(errorRedirect);
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.redirect(errorRedirect);
  }

  try {
    let session = null;

    if (token_hash) {
      const allowedTypes = ['invite', 'recovery', 'signup', 'magiclink', 'email_change'];
      const verifyType = allowedTypes.includes(type) ? type : 'recovery';

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: verifyType,
      });

      if (error || !data?.session) {
        console.error('[auth/confirm] verifyOtp error:', error?.message || 'No session returned');
        return NextResponse.redirect(errorRedirect);
      }
      session = data.session;
    } else if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data?.session) {
        console.error('[auth/confirm] exchangeCodeForSession error:', error?.message || 'No session returned');
        return NextResponse.redirect(errorRedirect);
      }
      session = data.session;
    }

    if (!session) {
      return NextResponse.redirect(errorRedirect);
    }

    const isProd = process.env.NODE_ENV === 'production';
    const maxAge = session.expires_in || 60 * 60 * 24 * 7;

    // Build clean target redirect URL (omits token_hash, code, or secret parameters)
    const targetRedirect = new URL(destinationPath, request.url);
    const response = NextResponse.redirect(targetRedirect);

    // Secure HttpOnly cookie persistence
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
    console.error('[auth/confirm] exception during auth confirmation:', err?.message);
    return NextResponse.redirect(errorRedirect);
  }
}
