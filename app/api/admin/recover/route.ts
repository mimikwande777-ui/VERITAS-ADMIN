import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body.email || '').trim();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required.' },
        { status: 400 }
      );
    }

    // Initialize normal Supabase client (no service role key)
    const client = createServerSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Server authentication client configuration error.' },
        { status: 500 }
      );
    }

    const adminAppUrl = 
      process.env.ADMIN_APP_URL || 
      process.env.APP_URL || 
      process.env.NEXT_PUBLIC_SITE_URL || 
      'https://veritas-admin-three.vercel.app';
    const cleanBaseUrl = adminAppUrl.split('?')[0].replace(/\/$/, '');
    const redirectTo = `${cleanBaseUrl}/auth/confirm?next=/auth/setup-password`;

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      // Do not reveal email existence to prevent user enumeration
      console.error('[admin-recover] recovery request failed:', error.message || 'Unknown error');
    }

    return NextResponse.json({
      success: true,
      message: 'If an eligible administrator account exists, a recovery email has been sent.'
    });

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Server recovery processing failed.' },
      { status: 500 }
    );
  }
}
