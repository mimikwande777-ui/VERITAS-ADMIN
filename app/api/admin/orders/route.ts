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

  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return NextResponse.json(
      { success: false, error: 'Server database configuration error.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { orderId, payment_status, order_status, fulfilment_status } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Order ID is required.' }, { status: 400 });
    }

    const result = await updateOrderStatusInSupabase(
      orderId,
      { payment_status, order_status, fulfilment_status },
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
