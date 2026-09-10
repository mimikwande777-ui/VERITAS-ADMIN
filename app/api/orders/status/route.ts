import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { normalizePaymentStatus } from '@/lib/supabase/orders';

/**
 * Safe read-only lookup endpoint for order payment status.
 * Used exclusively by client views (such as /order-confirmation) to fetch
 * authoritative payment status directly from the database ledger.
 *
 * Security:
 * - Does NOT accept status from the caller
 * - Does NOT perform any writes or status mutations
 * - Requires orderNumber and either orderId or customer email for verification
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('orderNumber')?.trim();
    const orderId = searchParams.get('orderId')?.trim();
    const email = searchParams.get('email')?.trim();

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: 'Order number is required.' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json(
        { success: false, error: 'Server database connection unavailable.' },
        { status: 503 }
      );
    }

    let query = serviceClient
      .from('orders')
      .select('id, order_number, customer_name, customer_email, subtotal, shipping_amount, total, currency, payment_status, order_status, fulfilment_status, created_at')
      .eq('order_number', orderNumber);

    if (orderId) {
      query = query.eq('id', orderId);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error) {
      console.error('[ORDER STATUS LOOKUP] Database query error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve order status from database.' },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found.' },
        { status: 404 }
      );
    }

    // Optional email verification if email was provided
    if (email && order.customer_email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Order verification mismatch.' },
        { status: 403 }
      );
    }

    const normalizedPayment = normalizePaymentStatus(order.payment_status);

    return NextResponse.json({
      success: true,
      orderNumber: order.order_number,
      orderId: order.id,
      customerName: order.customer_name,
      paymentStatus: normalizedPayment,
      orderStatus: order.order_status || 'pending',
      fulfilmentStatus: order.fulfilment_status || 'pending',
      subtotal: Number(order.subtotal || 0),
      shippingAmount: Number(order.shipping_amount || 0),
      total: Number(order.total || 0),
      currency: order.currency || 'ZAR',
      createdAt: order.created_at
    });
  } catch (err: any) {
    console.error('[ORDER STATUS LOOKUP] Unexpected exception:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while resolving order status.' },
      { status: 500 }
    );
  }
}
