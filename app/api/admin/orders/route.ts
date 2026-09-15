import { NextRequest, NextResponse } from 'next/server';
import { fetchFullOrdersFromSupabase, updateOrderStatusInSupabase } from '@/lib/supabase/orders';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { hasPermission } from '@/lib/auth-types';
import { sanitizeCustomerForRole } from '@/lib/customer-privacy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canViewOrders' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  // Service role execution occurs strictly after requireAdmin() succeeds
  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return NextResponse.json(
      { success: false, error: 'Server database configuration error.' },
      { status: 500 }
    );
  }

  const { orders, records, error } = await fetchFullOrdersFromSupabase(serviceClient);

  if (error) {
    return NextResponse.json({
      success: false,
      error,
      count: 0,
      orders: [],
      records: []
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      }
    });
  }

  // Check if role has access to unmasked customer personal contact info
  const canViewSensitive = hasPermission(authCheck.admin.role, 'canViewSensitiveCustomers');
  const isFulfilment = hasPermission(authCheck.admin.role, 'canUpdateOrderFulfilment');

  const sanitizedOrders = orders.map(ord => 
    sanitizeCustomerForRole(ord, canViewSensitive, isFulfilment)
  );

  const sanitizedRecords = records.map(rec => 
    sanitizeCustomerForRole(rec, canViewSensitive, isFulfilment)
  );

  return NextResponse.json({
    success: true,
    count: sanitizedOrders.length,
    orders: sanitizedOrders,
    records: sanitizedRecords
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
    }
  });
}

export async function PATCH(request: NextRequest) {
  const authCheck = await requireAdmin(request, { requiredPermission: 'canUpdateOrderFulfilment' });
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const userRole = authCheck.admin.role;
  const isSuperAdmin = userRole === 'super_admin';

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return NextResponse.json(
      { success: false, error: 'Server database configuration error.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { 
      orderId, 
      id, 
      payment_status, 
      order_status, 
      fulfilment_status, 
      refund, 
      refund_status, 
      cancel, 
      cancellation_status, 
      payment_provider, 
      payfast_payment_id, 
      paid_at, 
      total, 
      subtotal, 
      shipping_amount
    } = body;

    const targetOrderId = orderId || id;
    if (!targetOrderId) {
      return NextResponse.json({ success: false, error: 'Order ID is required.' }, { status: 400 });
    }

    // Role-based field enforcement: Operations & other non-super-admins can ONLY update fulfilment status
    if (!isSuperAdmin) {
      const forbiddenFields = [
        'order_status',
        'payment_status',
        'payment_provider',
        'payfast_payment_id',
        'paid_at',
        'total',
        'subtotal',
        'shipping_amount',
        'refund',
        'refund_status',
        'cancel',
        'cancellation_status',
      ];

      const attemptedForbidden = forbiddenFields.some(f => body[f] !== undefined);
      if (attemptedForbidden) {
        return NextResponse.json({
          success: false,
          error: 'Forbidden: Restricted role. Operations partners are authorized to update fulfilment status only. Modifying order_status, payment_status, financials, refunds, or cancellations requires Super Admin permissions.'
        }, { status: 403 });
      }

      // Check for any arbitrary non-fulfilment fields
      const allowedOperationsFields = new Set(['orderId', 'id', 'fulfilment_status']);
      const unknownFields = Object.keys(body).filter(k => !allowedOperationsFields.has(k));
      if (unknownFields.length > 0) {
        return NextResponse.json({
          success: false,
          error: `Forbidden: Field '${unknownFields.join(', ')}' cannot be modified by Operations.`
        }, { status: 403 });
      }
    }

    const payload: { payment_status?: string; order_status?: string; fulfilment_status?: string } = {};
    if (fulfilment_status !== undefined) payload.fulfilment_status = fulfilment_status;

    if (isSuperAdmin) {
      if (order_status !== undefined) payload.order_status = order_status;
      if (payment_status !== undefined) payload.payment_status = payment_status;
    }

    const result = await updateOrderStatusInSupabase(
      targetOrderId,
      payload,
      serviceClient
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
