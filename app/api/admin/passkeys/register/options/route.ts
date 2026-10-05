import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { generateAdminRegistrationOptions } from '@/lib/passkey/webauthn-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  // 1. Ensure authenticated admin
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: 'Database service client unavailable' }, { status: 500 })
    );
  }

  try {
    // 2. Fetch existing passkeys for this admin to exclude duplicate registrations
    const { data: existingPasskeys } = await serviceClient
      .from('admin_passkeys')
      .select('credential_id, transports')
      .eq('admin_user_id', authCheck.admin.userId)
      .is('revoked_at', null);

    // 3. Generate registration options
    const options = await generateAdminRegistrationOptions(
      request,
      serviceClient,
      {
        id: authCheck.admin.userId,
        email: authCheck.admin.email,
        name: (authCheck.admin.email || 'Admin').split('@')[0].toUpperCase(),
      },
      existingPasskeys || []
    );

    return authCheck.applyCookies(NextResponse.json(options));
  } catch (err: any) {
    console.error('[PASSKEY REG OPTIONS] Error:', err);
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: err?.message || 'Failed to generate registration options' }, { status: 500 })
    );
  }
}
