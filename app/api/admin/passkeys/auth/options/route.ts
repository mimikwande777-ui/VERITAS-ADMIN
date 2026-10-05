import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { generateAdminAuthenticationOptions } from '@/lib/passkey/webauthn-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return NextResponse.json(
      { success: false, error: 'Database service client unavailable' },
      { status: 500 }
    );
  }

  try {
    const options = await generateAdminAuthenticationOptions(request, serviceClient);
    return NextResponse.json(options);
  } catch (err: any) {
    console.error('[PASSKEY AUTH OPTIONS] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}
