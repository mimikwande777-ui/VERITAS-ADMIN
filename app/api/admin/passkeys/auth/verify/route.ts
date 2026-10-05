import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { verifyAdminAuthenticationResponse } from '@/lib/passkey/webauthn-server';
import { normalizeAdminRole } from '@/lib/auth-types';
import { recordAuditLog } from '@/lib/supabase/audit';

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
    const body = await request.json();
    const { response } = body;

    if (!response || !response.id) {
      return NextResponse.json(
        { success: false, error: 'Invalid passkey authentication payload' },
        { status: 400 }
      );
    }

    const credentialId = response.id;

    // 1. Look up stored public key credential
    const { data: passkey, error: passkeyErr } = await serviceClient
      .from('admin_passkeys')
      .select('id, admin_user_id, credential_id, public_key, counter, transports, device_name, revoked_at')
      .eq('credential_id', credentialId)
      .is('revoked_at', null)
      .maybeSingle();

    if (passkeyErr || !passkey) {
      return NextResponse.json(
        { success: false, error: 'Passkey not recognized or has been revoked.' },
        { status: 401 }
      );
    }

    // 2. Look up associated admin user and verify modern active role
    const { data: adminRecord, error: adminErr } = await serviceClient
      .from('admin_users')
      .select('user_id, role, is_active')
      .eq('user_id', passkey.admin_user_id)
      .maybeSingle();

    if (adminErr || !adminRecord) {
      return NextResponse.json(
        { success: false, error: 'Administrator account not found.' },
        { status: 403 }
      );
    }

    if (adminRecord.is_active === false) {
      return NextResponse.json(
        { success: false, error: 'Administrator account disabled. Access revoked.' },
        { status: 403 }
      );
    }

    // Strict role allowlist: only modern canonical roles allowed
    const canonicalRole = normalizeAdminRole(adminRecord.role);
    const allowedRoles = ['super_admin', 'operations', 'marketing', 'finance'];

    if (!allowedRoles.includes(adminRecord.role) && !allowedRoles.includes(canonicalRole)) {
      return NextResponse.json(
        { success: false, error: 'Administrator access denied: legacy or unauthorized role.' },
        { status: 403 }
      );
    }

    // 3. Cryptographically verify the WebAuthn signature assertion
    const verification = await verifyAdminAuthenticationResponse(
      request,
      serviceClient,
      response,
      {
        credential_id: passkey.credential_id,
        public_key: passkey.public_key,
        counter: Number(passkey.counter) || 0,
        transports: passkey.transports,
      }
    );

    if (!verification.verified || !verification.authenticationInfo) {
      return NextResponse.json(
        { success: false, error: 'Passkey biometric verification failed on server.' },
        { status: 401 }
      );
    }

    const { newCounter } = verification.authenticationInfo;

    // 4. Update counter and last_used_at timestamp
    await serviceClient
      .from('admin_passkeys')
      .update({
        counter: newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', passkey.id);

    // 5. Look up user details in auth.users
    const authClient = createServerSupabaseClient();
    const { data: userData } = await serviceClient.auth.admin.getUserById(adminRecord.user_id);
    const authUser = userData?.user;

    const email = authUser?.email || 'admin@veritas.co.za';
    const adminUser = {
      id: adminRecord.user_id,
      name: authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || email.split('@')[0].toUpperCase(),
      email,
      role: canonicalRole,
      isActive: true,
      createdAt: authUser?.created_at || new Date().toISOString(),
      lastActive: 'Just now',
    };

    // 6. Generate standard admin session token
    // If Supabase session is generated or direct admin session token
    const isProd = process.env.NODE_ENV === 'production';
    const maxAge = 60 * 60 * 24 * 7; // 7 days

    const nextResponse = NextResponse.json({
      success: true,
      message: 'Passkey authentication successful',
      user: adminUser,
    });

    // Create session token with user ID and role
    // If we have an auth user, we can generate a session or set the token
    const sessionToken = Buffer.from(JSON.stringify({
      uid: adminRecord.user_id,
      email,
      role: canonicalRole,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + maxAge,
      authMethod: 'passkey',
    })).toString('base64url');

    nextResponse.cookies.set('sb-access-token', sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    nextResponse.cookies.set('veritas_admin_token', sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    // 7. Write Audit Log
    try {
      await recordAuditLog({
        action: 'auth.passkey_login',
        actionLabel: 'Passkey Biometric Sign-In',
        targetType: 'auth',
        targetId: passkey.id,
        actorEmail: email,
        actorRole: canonicalRole,
        details: {
          adminUserId: adminRecord.user_id,
          deviceName: passkey.device_name,
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return nextResponse;
  } catch (err: any) {
    console.error('[PASSKEY AUTH VERIFY] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}
