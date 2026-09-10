import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/admin/reset-password';
  
  // The URL to redirect to on error
  const errorRedirect = new URL('/admin/reset-password?error=invalid', request.url);

  if (token_hash && type) {
    const supabase = createServerSupabaseClient();
    
    if (!supabase) {
      return NextResponse.redirect(errorRedirect);
    }

    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    
    if (!error && data?.session) {
      const { session } = data;
      const isProd = process.env.NODE_ENV === 'production';
      const maxAge = session.expires_in || 60 * 60 * 24 * 7;
      
      const response = NextResponse.redirect(new URL(next, request.url));
      
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
    }
  }

  // return the user to an error page with some instructions
  return NextResponse.redirect(errorRedirect);
}
