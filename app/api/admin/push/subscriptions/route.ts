import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: 'Database client unavailable' }, { status: 500 })
    );
  }

  try {
    const { data: subscriptions, error } = await serviceClient
      .from('admin_push_subscriptions')
      .select('id, endpoint, device_name, user_agent_summary, preferences, created_at, updated_at, last_used_at')
      .eq('admin_user_id', authCheck.admin.userId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[PUSH SUBSCRIPTIONS GET] Error fetching subscriptions:', error);
      return authCheck.applyCookies(
        NextResponse.json({ success: false, error: error.message }, { status: 500 })
      );
    }

    return authCheck.applyCookies(
      NextResponse.json({
        success: true,
        subscriptions: subscriptions || [],
      })
    );
  } catch (err: any) {
    console.error('[PUSH SUBSCRIPTIONS GET] Unexpected error:', err);
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
    );
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: 'Database client unavailable' }, { status: 500 })
    );
  }

  try {
    const body = await request.json();
    const { endpoint, keys, deviceName, userAgentSummary, preferences } = body;

    if (!endpoint || typeof endpoint !== 'string') {
      return authCheck.applyCookies(
        NextResponse.json({ success: false, error: 'Missing or invalid endpoint' }, { status: 400 })
      );
    }

    if (!keys || !keys.p256dh || !keys.auth) {
      return authCheck.applyCookies(
        NextResponse.json({ success: false, error: 'Missing encryption keys (p256dh, auth)' }, { status: 400 })
      );
    }

    const defaultPreferences = {
      paid_order: true,
      low_stock: true,
      out_of_stock: true,
      upcoming_release: true,
      payment_attention: true,
      ...(preferences && typeof preferences === 'object' ? preferences : {}),
    };

    // Upsert subscription into admin_push_subscriptions
    const { data: subscription, error } = await serviceClient
      .from('admin_push_subscriptions')
      .upsert(
        {
          admin_user_id: authCheck.admin.userId,
          endpoint: endpoint.trim(),
          p256dh: keys.p256dh,
          auth_key: keys.auth,
          device_name: deviceName || 'Web Device',
          user_agent_summary: userAgentSummary || null,
          preferences: defaultPreferences,
          revoked_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )
      .select()
      .single();

    if (error) {
      console.error('[PUSH SUBSCRIPTION POST] Upsert error:', error);
      return authCheck.applyCookies(
        NextResponse.json({ success: false, error: error.message }, { status: 500 })
      );
    }

    return authCheck.applyCookies(
      NextResponse.json({
        success: true,
        message: 'Push subscription registered successfully',
        subscription,
      })
    );
  } catch (err: any) {
    console.error('[PUSH SUBSCRIPTION POST] Unexpected error:', err);
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: 'Database client unavailable' }, { status: 500 })
    );
  }

  try {
    const body = await request.json();
    const { endpoint, subscriptionId } = body;

    let query = serviceClient
      .from('admin_push_subscriptions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('admin_user_id', authCheck.admin.userId);

    if (subscriptionId) {
      query = query.eq('id', subscriptionId);
    } else if (endpoint) {
      query = query.eq('endpoint', endpoint);
    } else {
      return authCheck.applyCookies(
        NextResponse.json({ success: false, error: 'Missing endpoint or subscriptionId' }, { status: 400 })
      );
    }

    const { error } = await query;
    if (error) {
      console.error('[PUSH SUBSCRIPTION DELETE] Error revoking subscription:', error);
      return authCheck.applyCookies(
        NextResponse.json({ success: false, error: error.message }, { status: 500 })
      );
    }

    return authCheck.applyCookies(
      NextResponse.json({
        success: true,
        message: 'Push subscription revoked successfully',
      })
    );
  } catch (err: any) {
    console.error('[PUSH SUBSCRIPTION DELETE] Unexpected error:', err);
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
    );
  }
}
