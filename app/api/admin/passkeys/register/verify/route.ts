import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { verifyAdminRegistrationResponse } from '@/lib/passkey/webauthn-server';
import { recordAuditLog } from '@/lib/supabase/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { response, deviceName } = body;

    if (!response) {
      return authCheck.applyCookies(
        NextResponse.json({ success: false, error: 'Missing registration response' }, { status: 400 })
      );
    }

    // 1. Verify cryptographic registration assertion
    const verification = await verifyAdminRegistrationResponse(
      request,
      serviceClient,
      authCheck.admin.userId,
      response
    );

    if (!verification.verified || !verification.registrationInfo) {
      return authCheck.applyCookies(
        NextResponse.json({ success: false, error: 'Passkey verification failed' }, { status: 400 })
      );
    }

    const {
      credential: {
        id: credentialId,
        publicKey: credentialPublicKey,
        counter,
        transports,
      },
      credentialDeviceType,
      credentialBackedUp,
    } = verification.registrationInfo;

    // Convert public key bytes to Base64URL
    const publicKeyBase64 = Buffer.from(credentialPublicKey).toString('base64url');

    // 2. Save public credential into admin_passkeys
    const { data: newPasskey, error: insertErr } = await serviceClient
      .from('admin_passkeys')
      .insert({
        admin_user_id: authCheck.admin.userId,
        credential_id: credentialId,
        public_key: publicKeyBase64,
        counter,
        transports: transports || [],
        device_type: credentialDeviceType,
        backed_up: credentialBackedUp,
        device_name: (deviceName || 'Passkey Device').trim().slice(0, 60),
      })
      .select('id, device_name, created_at, device_type, backed_up')
      .single();

    if (insertErr) {
      console.error('[PASSKEY REG VERIFY] DB Insert error:', insertErr);
      return authCheck.applyCookies(
        NextResponse.json({ success: false, error: 'Failed to store passkey credential' }, { status: 500 })
      );
    }

    // 3. Record Audit Log
    try {
      await recordAuditLog({
        action: 'auth.passkey_register',
        actionLabel: 'Passkey Enrolled',
        targetType: 'auth',
        targetId: newPasskey.id,
        actorEmail: authCheck.admin.email,
        actorRole: authCheck.admin.role,
        details: {
          deviceName: newPasskey.device_name,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return authCheck.applyCookies(
      NextResponse.json({
        success: true,
        message: 'Passkey registered successfully',
        passkey: newPasskey,
      })
    );
  } catch (err: any) {
    console.error('[PASSKEY REG VERIFY] Unexpected error:', err);
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: err?.message || 'Verification error' }, { status: 500 })
    );
  }
}
