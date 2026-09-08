import { NextRequest, NextResponse } from 'next/server';
import { fetchFullOrdersFromSupabase, updateOrderStatusInSupabase } from '@/lib/supabase/orders';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request);
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

  return NextResponse.json({
    success: true,
    count: orders.length,
    orders,
    records
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
    }
  });
}

export async function PATCH(request: NextRequest) {
  const authCheck = await requireAdmin(request);
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
