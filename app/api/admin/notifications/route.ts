import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { getPaymentStatusLabel, getFulfilmentStatusLabel } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface AdminNotification {
  id: string;
  type: 'paid_order' | 'low_stock' | 'out_of_stock' | 'upcoming_release' | 'payment_attention' | 'delivery_failure';
  severity: 'high' | 'medium' | 'info';
  title: string;
  message: string;
  entityType?: 'order' | 'inventory' | 'product' | 'system';
  entityId?: string;
  targetRole?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  isRead: boolean;
  readAt?: string | null;
}

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const adminUserId = authCheck.admin.userId;
  const adminRole = authCheck.admin.role;

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: 'Database service client unavailable' }, { status: 500 })
    );
  }

  const notifications: AdminNotification[] = [];

  try {
    // 1. Fetch read receipts for this specific admin
    const readReceiptsSet = new Set<string>();
    const { data: readRows } = await serviceClient
      .from('admin_notification_reads')
      .select('notification_id, read_at')
      .eq('admin_user_id', adminUserId);

    if (readRows && Array.isArray(readRows)) {
      readRows.forEach(r => readReceiptsSet.add(r.notification_id));
    }

    // 2. Query persistent admin_notifications table if available
    const { data: storedNotifs, error: notifErr } = await serviceClient
      .from('admin_notifications')
      .select('*')
      .or(`target_role.is.null,target_role.eq.${adminRole},target_role.eq.all`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!notifErr && storedNotifs && Array.isArray(storedNotifs)) {
      for (const n of storedNotifs) {
        notifications.push({
          id: n.id,
          type: n.type,
          severity: n.severity || 'info',
          title: n.title,
          message: n.message,
          entityType: n.entity_type,
          entityId: n.entity_id,
          targetRole: n.target_role,
          metadata: n.metadata || {},
          createdAt: n.created_at || new Date().toISOString(),
          isRead: readReceiptsSet.has(n.id),
          readAt: readReceiptsSet.has(n.id) ? new Date().toISOString() : null,
        });
      }
    }

    // 3. Dynamically evaluate real database events to ensure live business alerts are always surfaced
    // 3A. Real Orders requiring attention / verified paid
    const { data: liveOrders } = await serviceClient
      .from('orders')
      .select('id, order_number, total, customer_name, payment_status, fulfilment_status, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (liveOrders) {
      for (const ord of liveOrders) {
        const ordId = ord.id;
        const ordNum = ord.order_number || ord.id;
        const dedupPaid = `paid_order_${ordId}`;

        if (ord.payment_status === 'paid' && !notifications.some(n => n.id === dedupPaid || n.metadata?.dedup_key === dedupPaid)) {
          notifications.push({
            id: dedupPaid,
            type: 'paid_order',
            severity: 'high',
            title: `NEW PAID ORDER: ${ordNum}`,
            message: `Amount: R${Number(ord.total || 0).toFixed(2)} • Fulfilment: ${getFulfilmentStatusLabel(ord.fulfilment_status)}`,
            entityType: 'order',
            entityId: ordId,
            metadata: { dedup_key: dedupPaid, orderNumber: ordNum, total: ord.total },
            createdAt: ord.created_at || new Date().toISOString(),
            isRead: readReceiptsSet.has(dedupPaid),
          });
        } else if (ord.payment_status === 'cancelled' || ord.payment_status === 'refunded') {
          const dedupIssue = `payment_attention_${ordId}_${ord.payment_status}`;
          if (!notifications.some(n => n.id === dedupIssue || n.metadata?.dedup_key === dedupIssue)) {
            notifications.push({
              id: dedupIssue,
              type: 'payment_attention',
              severity: 'medium',
              title: `PAYMENT REQUIRES ATTENTION: ${ordNum}`,
              message: `Order marked as ${getPaymentStatusLabel(ord.payment_status)}. Total: R${Number(ord.total || 0).toFixed(2)}`,
              entityType: 'order',
              entityId: ordId,
              metadata: { dedup_key: dedupIssue, status: ord.payment_status },
              createdAt: ord.created_at || new Date().toISOString(),
              isRead: readReceiptsSet.has(dedupIssue),
            });
          }
        }
      }
    }

    // 3B. Real Variant Inventory alerts (Low stock & Out of stock)
    const { data: variants } = await serviceClient
      .from('product_variants')
      .select('id, product_id, sku, colour, size, stock_quantity, low_stock_threshold, updated_at')
      .order('stock_quantity', { ascending: true })
      .limit(30);

    if (variants && Array.isArray(variants)) {
      const prodIds = Array.from(new Set(variants.map(v => v.product_id)));
      const { data: prods } = await serviceClient
        .from('products')
        .select('id, name')
        .in('id', prodIds);

      const prodMap = new Map((prods || []).map(p => [p.id, p.name]));

      for (const v of variants) {
        const pName = prodMap.get(v.product_id) || 'Bespoke Garment';
        const qty = v.stock_quantity ?? 0;
        const threshold = v.low_stock_threshold ?? 5;

        if (qty === 0) {
          const dedupOut = `out_of_stock_${v.id}`;
          if (!notifications.some(n => n.id === dedupOut || n.metadata?.dedup_key === dedupOut)) {
            notifications.push({
              id: dedupOut,
              type: 'out_of_stock',
              severity: 'high',
              title: `OUT OF STOCK: ${pName}`,
              message: `Variant (${v.colour}/${v.size}) SKU: ${v.sku} has 0 units remaining in inventory.`,
              entityType: 'inventory',
              entityId: v.id,
              metadata: { dedup_key: dedupOut, productId: v.product_id, sku: v.sku },
              createdAt: v.updated_at || new Date().toISOString(),
              isRead: readReceiptsSet.has(dedupOut),
            });
          }
        } else if (qty <= threshold) {
          const dedupLow = `low_stock_${v.id}`;
          if (!notifications.some(n => n.id === dedupLow || n.metadata?.dedup_key === dedupLow)) {
            notifications.push({
              id: dedupLow,
              type: 'low_stock',
              severity: 'medium',
              title: `LOW STOCK ALERT: ${pName}`,
              message: `Variant (${v.colour}/${v.size}) has ${qty} units remaining (threshold: ${threshold}).`,
              entityType: 'inventory',
              entityId: v.id,
              metadata: { dedup_key: dedupLow, productId: v.product_id, sku: v.sku, quantity: qty },
              createdAt: v.updated_at || new Date().toISOString(),
              isRead: readReceiptsSet.has(dedupLow),
            });
          }
        }
      }
    }

    // 3C. Upcoming Product Releases
    const { data: releaseProds } = await serviceClient
      .from('products')
      .select('id, name, sales_mode, release_at, availability_message, updated_at')
      .or('sales_mode.eq.coming_soon,sales_mode.eq.preorder')
      .order('release_at', { ascending: true });

    if (releaseProds) {
      for (const p of releaseProds) {
        const dedupRelease = `upcoming_release_${p.id}`;
        if (!notifications.some(n => n.id === dedupRelease || n.metadata?.dedup_key === dedupRelease)) {
          notifications.push({
            id: dedupRelease,
            type: 'upcoming_release',
            severity: 'info',
            title: `UPCOMING PRODUCT RELEASE: ${p.name}`,
            message: `${p.name} is configured for ${p.sales_mode.replace('_', ' ')}. ${p.availability_message || ''}`,
            entityType: 'product',
            entityId: p.id,
            metadata: { dedup_key: dedupRelease, salesMode: p.sales_mode, releaseAt: p.release_at },
            createdAt: p.updated_at || new Date().toISOString(),
            isRead: readReceiptsSet.has(dedupRelease),
          });
        }
      }
    }

    // Sort all notifications chronologically (most recent first)
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return authCheck.applyCookies(
      NextResponse.json({
        success: true,
        unreadCount,
        count: notifications.length,
        notifications,
      })
    );
  } catch (err: any) {
    console.error('[NOTIFICATIONS] Error loading notifications:', err);
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: err?.message || 'Failed to load notifications' }, { status: 500 })
    );
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const adminUserId = authCheck.admin.userId;

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: 'Database service client unavailable' }, { status: 500 })
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { action, notificationId, notificationIds } = body;

    if (action === 'mark_read') {
      if (!notificationId) {
        return authCheck.applyCookies(
          NextResponse.json({ success: false, error: 'notificationId is required' }, { status: 400 })
        );
      }

      // Record in admin_notification_reads table
      try {
        await serviceClient
          .from('admin_notification_reads')
          .upsert({
            notification_id: notificationId,
            admin_user_id: adminUserId,
            read_at: new Date().toISOString(),
          }, { onConflict: 'notification_id,admin_user_id' });
      } catch (upsertErr) {
        console.warn('[NOTIFICATIONS] Upsert to admin_notification_reads non-blocking error:', upsertErr);
      }

      return authCheck.applyCookies(NextResponse.json({ success: true, markedId: notificationId }));
    }

    if (action === 'mark_all_read') {
      const ids: string[] = Array.isArray(notificationIds) ? notificationIds : [];
      if (ids.length > 0) {
        try {
          const rows = ids.map(id => ({
            notification_id: id,
            admin_user_id: adminUserId,
            read_at: new Date().toISOString(),
          }));

          await serviceClient
            .from('admin_notification_reads')
            .upsert(rows, { onConflict: 'notification_id,admin_user_id' });
        } catch (upsertAllErr) {
          console.warn('[NOTIFICATIONS] Upsert all read receipts error:', upsertAllErr);
        }
      }

      return authCheck.applyCookies(NextResponse.json({ success: true, count: ids.length }));
    }

    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: 'Invalid action. Expected mark_read or mark_all_read' }, { status: 400 })
    );
  } catch (err: any) {
    return authCheck.applyCookies(
      NextResponse.json({ success: false, error: err?.message || 'Error processing notification mutation' }, { status: 500 })
    );
  }
}
