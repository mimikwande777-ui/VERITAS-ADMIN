import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { sendWebPushToSubscription, isWebPushConfigured, AdminPushPayload } from '@/lib/push/web-push-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  if (!isWebPushConfigured()) {
    return authCheck.applyCookies(
      NextResponse.json({
        success: false,
        error: 'Web Push VAPID keys are not configured in environment settings (WEB_PUSH_VAPID_PUBLIC_KEY / WEB_PUSH_VAPID_PRIVATE_KEY).',
      }, { status: 503 })
    );
  }

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: 'Database service client unavailable' }, { status: 500 })
    );
  }

  try {
    const { data: subscriptions, error } = await serviceClient
      .from('admin_push_subscriptions')
      .select('*')
      .eq('admin_user_id', authCheck.admin.userId)
      .is('revoked_at', null);

    if (error || !subscriptions || subscriptions.length === 0) {
      return authCheck.applyCookies(
        NextResponse.json({
          success: false,
          error: 'No active push subscriptions found for this admin user. Enable notifications on your device first.',
        }, { status: 404 })
      );
    }

    const testPayload: AdminPushPayload = {
      title: 'VERITAS Admin — Push Test',
      body: `Test notification sent successfully to ${subscriptions.length} active device(s).`,
      type: 'upcoming_release',
      severity: 'info',
      url: '/admin/notifications',
      tag: `veritas-test-${Date.now()}`,
      timestamp: Date.now(),
    };

    const results = [];
    for (const sub of subscriptions) {
      const res = await sendWebPushToSubscription(sub, testPayload, serviceClient);
      results.push({
        id: sub.id,
        device: sub.device_name,
        success: res.success,
        statusCode: res.statusCode,
        error: res.error,
      });
    }

    return authCheck.applyCookies(
      NextResponse.json({
        success: true,
        message: 'Test push notification dispatched',
        devicesDispatched: results.filter(r => r.success).length,
        totalDevices: subscriptions.length,
        results,
      })
    );
  } catch (err: any) {
    console.error('[PUSH TEST] Unexpected error:', err);
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
    );
  }
}
