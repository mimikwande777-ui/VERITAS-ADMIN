import { NextRequest, NextResponse } from 'next/server';
import { createOrderInSupabase, CreateOrderPayload } from '@/lib/supabase/orders';
import { createServiceRoleSupabaseClient, createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body: CreateOrderPayload = await req.json();

    if (!body.customerName || !body.customerEmail || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required order fields or items' },
        { status: 400 }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.customerEmail.trim())) {
      return NextResponse.json(
        { success: false, error: 'Invalid customer email address provided' },
        { status: 400 }
      );
    }

    // Select authoritative server-side client
    // Under hardened RLS boundaries, customer checkout order creation on the server requires the service-role client.
    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      console.warn('[CHECKOUT] Order creation halted: SUPABASE_SERVICE_ROLE_KEY must be configured in the server environment.');
      return NextResponse.json(
        {
          success: false,
          error: 'SUPABASE_SERVICE_ROLE_KEY must be configured in the server environment.',
          code: 'SERVER_CONFIG_MISSING',
        },
        { status: 503 }
      );
    }

    const result = await createOrderInSupabase(body, serviceClient);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to place order in database' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      subtotal: result.subtotal,
      shippingAmount: result.shippingAmount,
      total: result.total,
      currency: 'ZAR',
    });
  } catch (err: any) {
    console.error('API Error in /api/orders/create:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error processing checkout order' },
      { status: 500 }
    );
  }
}
