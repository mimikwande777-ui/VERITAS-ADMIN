import webpush from 'web-push';
import { SupabaseClient } from '@supabase/supabase-js';
import { CanonicalAdminRole } from '@/lib/auth-types';

export interface AdminPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  type: 'paid_order' | 'low_stock' | 'out_of_stock' | 'upcoming_release' | 'payment_attention' | 'delivery_failure';
  severity?: 'high' | 'medium' | 'info';
  notificationId?: string;
  timestamp?: number;
}

export interface PushSubscriptionRow {
  id: string;
  admin_user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  device_name?: string | null;
  user_agent_summary?: string | null;
  preferences?: Record<string, boolean>;
  created_at: string;
  updated_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
}

/**
 * Returns whether Web Push environment credentials are fully configured
 */
export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY &&
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY &&
    process.env.WEB_PUSH_CONTACT
  );
}

/**
 * Returns the public VAPID key for browser subscription handshake
 */
export function getVapidPublicKey(): string | null {
  return process.env.WEB_PUSH_VAPID_PUBLIC_KEY || null;
}

/**
 * Configures global VAPID details for web-push client
 */
function ensureVapidConfigured(): boolean {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const contact = process.env.WEB_PUSH_CONTACT || 'mailto:admin@veritas.co.za';

  if (!publicKey || !privateKey) {
    return false;
  }

  try {
    webpush.setVapidDetails(contact, publicKey, privateKey);
    return true;
  } catch (err) {
    console.error('[WEB-PUSH] Error configuring VAPID details:', err);
    return false;
  }
}

/**
 * Evaluates whether a role is authorized to receive a specific notification type
 */
export function isRoleAuthorizedForNotificationType(
  role: CanonicalAdminRole | string,
  type: AdminPushPayload['type'],
  targetRole?: string | null
): boolean {
  // If notification specifically targets a role
  if (targetRole && targetRole !== 'all') {
    if (role !== 'super_admin' && role !== targetRole) {
      return false;
    }
  }

  switch (role) {
    case 'super_admin':
      return true; // Super admin receives all notifications
    case 'operations':
      return ['paid_order', 'low_stock', 'out_of_stock', 'upcoming_release', 'delivery_failure'].includes(type);
    case 'marketing':
      return ['upcoming_release', 'low_stock', 'out_of_stock'].includes(type);
    case 'finance':
      return ['paid_order', 'payment_attention'].includes(type);
    default:
      return false; // Unknown role fails closed
  }
}

/**
 * Sanitizes push notification payload to strictly prevent any PII leakage
 */
export function sanitizePushPayload(payload: AdminPushPayload): AdminPushPayload {
  return {
    title: payload.title.slice(0, 100),
    body: payload.body.slice(0, 200),
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/icon-192x192.png',
    tag: payload.tag || `veritas-${payload.type}-${Date.now()}`,
    url: payload.url || '/admin/notifications',
    type: payload.type,
    severity: payload.severity || 'info',
    notificationId: payload.notificationId,
    timestamp: payload.timestamp || Date.now(),
  };
}

/**
 * Dispatches Web Push notification to an individual subscription
 */
export async function sendWebPushToSubscription(
  subscription: PushSubscriptionRow,
  payload: AdminPushPayload,
  serviceClient?: SupabaseClient
): Promise<{ success: boolean; statusCode?: number; error?: string; shouldRevoke?: boolean }> {
  if (!ensureVapidConfigured()) {
    return { success: false, error: 'VAPID credentials not configured on server' };
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth_key,
    },
  };

  const cleanPayload = sanitizePushPayload(payload);
  const payloadString = JSON.stringify(cleanPayload);

  try {
    const response = await webpush.sendNotification(pushSubscription, payloadString, {
      TTL: 60 * 60 * 24, // 24 hours
      urgency: cleanPayload.severity === 'high' ? 'high' : 'normal',
    });

    // Update last_used_at on successful dispatch
    if (serviceClient) {
      await serviceClient
        .from('admin_push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', subscription.id);
    }

    return { success: true, statusCode: response.statusCode };
  } catch (err: any) {
    const statusCode = err.statusCode || err.status;
    const isPermanentFailure = statusCode === 404 || statusCode === 410 || statusCode === 400;

    console.warn(`[WEB-PUSH] Push dispatch failed for subscription ${subscription.id} (HTTP ${statusCode}):`, err.message || err);

    // If subscription has expired or unsubscribed on client, automatically revoke it
    if (isPermanentFailure && serviceClient) {
      console.log(`[WEB-PUSH] Auto-revoking expired subscription ${subscription.id}`);
      await serviceClient
        .from('admin_push_subscriptions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', subscription.id);
    }

    return {
      success: false,
      statusCode,
      error: err.message || 'Push dispatch failed',
      shouldRevoke: isPermanentFailure,
    };
  }
}

/**
 * Dispatches a notification to all active, authorized, and subscribed admin devices
 */
export async function dispatchPushToEligibleAdmins(
  serviceClient: SupabaseClient,
  notification: {
    id: string;
    type: AdminPushPayload['type'];
    severity?: 'high' | 'medium' | 'info';
    title: string;
    message?: string;
    entity_type?: string;
    entity_id?: string;
    target_role?: string | null;
  }
): Promise<{ dispatchedCount: number; failedCount: number; results: Array<{ subId: string; success: boolean }> }> {
  if (!isWebPushConfigured()) {
    return { dispatchedCount: 0, failedCount: 0, results: [] };
  }

  // 1. Fetch active admin users with modern roles
  const { data: adminUsers, error: adminErr } = await serviceClient
    .from('admin_users')
    .select('user_id, role, is_active')
    .eq('is_active', true)
    .in('role', ['super_admin', 'operations', 'marketing', 'finance']);

  if (adminErr || !adminUsers || adminUsers.length === 0) {
    return { dispatchedCount: 0, failedCount: 0, results: [] };
  }

  const roleMap = new Map<string, string>();
  adminUsers.forEach(u => roleMap.set(u.user_id, u.role));

  // 2. Fetch active (non-revoked) push subscriptions
  const { data: subscriptions, error: subErr } = await serviceClient
    .from('admin_push_subscriptions')
    .select('*')
    .is('revoked_at', null);

  if (subErr || !subscriptions || subscriptions.length === 0) {
    return { dispatchedCount: 0, failedCount: 0, results: [] };
  }

  // 3. Prepare target link URL based on entity
  let targetUrl = '/admin/notifications';
  if (notification.entity_type === 'order' && notification.entity_id) {
    targetUrl = `/admin/orders?orderId=${encodeURIComponent(notification.entity_id)}`;
  } else if (notification.entity_type === 'inventory') {
    targetUrl = '/admin/inventory';
  } else if (notification.entity_type === 'product' && notification.entity_id) {
    targetUrl = `/admin/products/${encodeURIComponent(notification.entity_id)}/edit`;
  }

  const payload: AdminPushPayload = {
    title: notification.title,
    body: notification.message || 'New VERITAS administrative alert',
    type: notification.type,
    severity: notification.severity || 'info',
    notificationId: notification.id,
    url: targetUrl,
    tag: `veritas-${notification.type}-${notification.id}`,
    timestamp: Date.now(),
  };

  let dispatchedCount = 0;
  let failedCount = 0;
  const results: Array<{ subId: string; success: boolean }> = [];

  for (const sub of subscriptions) {
    const adminRole = roleMap.get(sub.admin_user_id);
    if (!adminRole) continue; // Not an active admin

    // Check role authorization
    if (!isRoleAuthorizedForNotificationType(adminRole, notification.type, notification.target_role)) {
      continue;
    }

    // Check user notification preferences if configured
    if (sub.preferences && typeof sub.preferences === 'object') {
      if (sub.preferences[notification.type] === false) {
        continue; // User opted out of this specific notification type
      }
    }

    // Check delivery idempotency
    const { data: existingDelivery } = await serviceClient
      .from('admin_push_deliveries')
      .select('id, status')
      .eq('notification_id', notification.id)
      .eq('subscription_id', sub.id)
      .maybeSingle();

    if (existingDelivery && existingDelivery.status === 'sent') {
      continue; // Already dispatched idempotently
    }

    const res = await sendWebPushToSubscription(sub, payload, serviceClient);

    // Log delivery state in database
    await serviceClient
      .from('admin_push_deliveries')
      .upsert(
        {
          notification_id: notification.id,
          subscription_id: sub.id,
          status: res.success ? 'sent' : 'failed',
          http_status: res.statusCode || null,
          error_message: res.error || null,
          sent_at: res.success ? new Date().toISOString() : null,
        },
        { onConflict: 'notification_id,subscription_id' }
      );

    if (res.success) {
      dispatchedCount++;
      results.push({ subId: sub.id, success: true });
    } else {
      failedCount++;
      results.push({ subId: sub.id, success: false });
    }
  }

  return { dispatchedCount, failedCount, results };
}
