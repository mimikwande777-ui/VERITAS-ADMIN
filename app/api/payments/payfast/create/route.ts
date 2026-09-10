import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { getPayFastServerConfig, isPayFastConfigured } from '@/lib/payfast/config';
import { generatePayFastSignature } from '@/lib/payfast/signature';

const PROD_VERCEL_HOST = 'https://veritas-admin-three.vercel.app';

/**
 * POST /api/payments/payfast/create
 * 
 * Secure server-side payment initialization for PayFast Custom Integration.
 * 
 * Flow:
 * 1. Accepts ONLY { orderId: string } from the caller.
 *    Any amount, subtotal, status, URLs, or merchant details sent by browser are strictly ignored.
 * 2. Fetches authoritative order from public.orders via trusted service role client.
 * 3. Validates order existence, currency === 'ZAR', total > 0, payment_status === 'pending'.
 * 4. Generates PayFast Custom Integration fields following exact documented field order.
 * 5. Computes MD5 signature with server-only passphrase.
 * 6. Returns action URL (processUrl) and signed fields for dynamic browser form POST.
 *    NEVER returns passphrase, Supabase keys, or service role secrets.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = body?.orderId?.trim();

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Valid order ID is required.' },
        { status: 400 }
      );
    }

    // 1. Check PayFast server configuration
    if (!isPayFastConfigured()) {
      return NextResponse.json(
        { success: false, error: 'PayFast gateway is not configured on the server.' },
        { status: 503 }
      );
    }

    const payfastConfig = getPayFastServerConfig();

    // 2. Load authoritative order record from database
    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return NextResponse.json(
        { success: false, error: 'Database service is currently unavailable.' },
        { status: 503 }
      );
    }

    const { data: order, error: orderError } = await serviceClient
      .from('orders')
      .select('id, order_number, customer_name, customer_email, customer_phone, total, currency, payment_status')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      console.error('[PAYFAST CREATE] Order lookup error:', orderError);
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve order record.' },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found.' },
        { status: 404 }
      );
    }

    // 3. Strict business validations
    if ((order.currency || 'ZAR').toUpperCase() !== 'ZAR') {
      return NextResponse.json(
        { success: false, error: 'Only ZAR currency orders can be processed through PayFast.' },
        { status: 400 }
      );
    }

    const authoritativeTotal = Number(order.total || 0);
    if (isNaN(authoritativeTotal) || authoritativeTotal <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid authoritative order total.' },
        { status: 400 }
      );
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json(
        { success: false, error: 'Order has already been paid.' },
        { status: 400 }
      );
    }

    if (order.payment_status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Order cannot be paid in current status (${order.payment_status}).` },
        { status: 400 }
      );
    }

    // 4. Split customer name into first and last name
    const rawName = (order.customer_name || 'Valued Client').trim();
    const nameParts = rawName.split(/\s+/);
    const firstName = nameParts[0] || 'Valued';
    const lastName = nameParts.slice(1).join(' ') || 'Client';

    // 5. Authoritative formatted amount: exactly 2 decimal places (e.g., 550 -> "550.00")
    const formattedAmount = authoritativeTotal.toFixed(2);

    // 6. Return, cancel, and notify URLs (constructed server-side)
    const returnUrl = `${PROD_VERCEL_HOST}/order-confirmation?order=${encodeURIComponent(order.order_number)}&orderId=${encodeURIComponent(order.id)}`;
    const cancelUrl = `${PROD_VERCEL_HOST}/checkout/payment-cancelled?order=${encodeURIComponent(order.order_number)}&orderId=${encodeURIComponent(order.id)}`;
    const notifyUrl = `${PROD_VERCEL_HOST}/api/payments/payfast/itn`;

    const itemName = `VERITAS Order ${order.order_number}`;
    const itemDescription = 'VERITAS bespoke atelier order';

    // 7. Assemble fields in strict PayFast Custom Integration order
    const fieldsToSign: Record<string, string> = {
      merchant_id: payfastConfig.merchantId,
      merchant_key: payfastConfig.merchantKey,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      name_first: firstName,
      name_last: lastName,
      email_address: order.customer_email || '',
      cell_number: order.customer_phone || '',
      m_payment_id: order.id, // Canonical UUID
      amount: formattedAmount,
      item_name: itemName,
      item_description: itemDescription
    };

    // 8. Generate signature
    const signature = generatePayFastSignature(fieldsToSign, payfastConfig.passphrase);

    // Final payload submitted to PayFast
    const fields: Record<string, string> = {
      ...fieldsToSign,
      signature
    };

    return NextResponse.json({
      success: true,
      action: payfastConfig.processUrl,
      fields
    });
  } catch (err: any) {
    console.error('[PAYFAST CREATE] Unexpected exception:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while initializing payment.' },
      { status: 500 }
    );
  }
}
