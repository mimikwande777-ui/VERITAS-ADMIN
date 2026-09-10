import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  
  // Safe redirect URL on verification error
  const errorRedirect = new URL('/admin/reset-password?error=invalid', request.url);

  // 1. Reads token_hash and type
  // 2. Only accepts type === "recovery" for this recovery flow
  if (!token_hash || type !== 'recovery') {
    return NextResponse.redirect(errorRedirect);
  }

  // 4 & 9. Normal server Supabase client using anon key (never privileged secret key)
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.redirect(errorRedirect);
  }

  try {
    // 3. Verify the recovery token hash
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: 'recovery',
    });

    if (error || !data?.session) {
      return NextResponse.redirect(errorRedirect);
    }

    const { session } = data;
    const isProd = process.env.NODE_ENV === 'production';
    const maxAge = session.expires_in || 60 * 60 * 24 * 7;

    // 5. Redirect ONLY to /admin/reset-password (blocks open redirects, ignores next param)
    // 6. Final URL completely omits token_hash and auth parameters
    const resetRedirect = new URL('/admin/reset-password', request.url);
    const response = NextResponse.redirect(resetRedirect);

    // 4. Secure HttpOnly cookie persistence
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
  } catch {
    // 8. Safe catch without logging tokens or hashes
    return NextResponse.redirect(errorRedirect);
  }
}
