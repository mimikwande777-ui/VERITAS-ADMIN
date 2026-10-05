import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { getVapidPublicKey, isWebPushConfigured } from '@/lib/push/web-push-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const publicKey = getVapidPublicKey();
  const configured = isWebPushConfigured();

  return authCheck.applyCookies(
    NextResponse.json({
      success: true,
      configured,
      publicKey: publicKey || null,
      envDiagnostics: {
        hasPublicKey: Boolean(process.env.WEB_PUSH_VAPID_PUBLIC_KEY),
        hasPrivateKey: Boolean(process.env.WEB_PUSH_VAPID_PRIVATE_KEY),
        hasContact: Boolean(process.env.WEB_PUSH_CONTACT),
      },
    })
  );
}
