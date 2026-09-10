import { NextRequest, NextResponse } from 'next/server';
import dns from 'dns';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { getPayFastServerConfig, isPayFastConfigured } from '@/lib/payfast/config';
import { verifyPayFastItnSignature, payfastUrlEncode } from '@/lib/payfast/signature';

const dnsPromises = dns.promises;

/**
 * Official PayFast hostnames documented for source and notification delivery
 */
const VALID_PAYFAST_HOSTS = [
  'www.payfast.co.za',
  'w1w.payfast.co.za',
  'w2w.payfast.co.za',
  'sandbox.payfast.co.za',
];

/**
 * Short-lived in-memory DNS cache for PayFast A/AAAA records (5-minute TTL)
 */
interface PayFastDnsCache {
  ips: Set<string>;
  expiresAt: number;
}

let dnsCache: PayFastDnsCache | null = null;
const DNS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Dynamically resolves current A and AAAA records for all official PayFast hostnames.
 * Does not rely on a permanently hard-coded IP or reverse-DNS-only lookups.
 */
async function getResolvedPayFastIps(): Promise<Set<string>> {
  const now = Date.now();
  if (dnsCache && now < dnsCache.expiresAt && dnsCache.ips.size > 0) {
    return dnsCache.ips;
  }

  const resolved = new Set<string>();

  for (const host of VALID_PAYFAST_HOSTS) {
    try {
      const v4Addresses = await dnsPromises.resolve4(host);
      for (const ip of v4Addresses) {
        if (ip) resolved.add(ip.trim());
      }
    } catch {
      // Host may not have A records or lookup is transient
    }

    try {
      const v6Addresses = await dnsPromises.resolve6(host);
      for (const ip of v6Addresses) {
        if (ip) resolved.add(ip.trim());
      }
    } catch {
      // Host may not have AAAA records
    }
  }

  // Update short-lived cache if resolutions succeeded
  if (resolved.size > 0) {
    dnsCache = {
      ips: resolved,
      expiresAt: now + DNS_CACHE_TTL_MS,
    };
    return resolved;
  }

  // Fallback to existing cache if transient resolution failure occurred
  if (dnsCache && dnsCache.ips.size > 0) {
    return dnsCache.ips;
  }

  return new Set<string>();
}

/**
 * Result structure for Vercel client IP extraction
 */
interface ClientIpExtraction {
  ip: string | null;
  mechanism: 'x-real-ip' | 'x-vercel-forwarded-for' | 'request-ip' | 'unresolved';
  isTrustworthy: boolean;
}

/**
 * Evaluates Vercel-provided request metadata to determine the authentic originating IP.
 * 
 * Vercel Edge Proxy Behavior:
 * - 'x-real-ip': Set by Vercel edge proxy to the connecting client's IP, stripping any prior client-sent value.
 * - 'x-vercel-forwarded-for': Header added specifically by Vercel edge.
 * - 'x-forwarded-for': Not trusted blindly because arbitrary client-controlled values may precede the true IP.
 */
function extractVercelClientIp(request: NextRequest): ClientIpExtraction {
  // 1. Check x-real-ip (Vercel Edge normalizes/overwrites this with the connecting peer IP)
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) {
    return { ip: realIp, mechanism: 'x-real-ip', isTrustworthy: true };
  }

  // 2. Check x-vercel-forwarded-for (Vercel Edge specific header)
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for')?.trim();
  if (vercelForwarded) {
    const firstIp = vercelForwarded.split(',')[0]?.trim();
    if (firstIp) {
      return { ip: firstIp, mechanism: 'x-vercel-forwarded-for', isTrustworthy: true };
    }
  }

  // 3. Check request.ip (NextRequest platform property if populated)
  const nextRequestIp = (request as any).ip?.trim?.();
  if (nextRequestIp) {
    return { ip: nextRequestIp, mechanism: 'request-ip', isTrustworthy: true };
  }

  // Fail-closed: raw x-forwarded-for without Vercel's edge guarantee is untrusted
  return { ip: null, mechanism: 'unresolved', isTrustworthy: false };
}

interface SourceCheckOutcome {
  verified: boolean;
  candidateIpAvailable: boolean;
  mechanism: string;
  matchedResolvedSource: boolean;
}

/**
 * Validates that the notification arrives from an authorized PayFast IP.
 * Fails closed if the client IP cannot be verified with Vercel trustworthiness or does not match.
 */
async function verifyPayFastSource(request: NextRequest): Promise<SourceCheckOutcome> {
  const { ip, mechanism, isTrustworthy } = extractVercelClientIp(request);

  if (!isTrustworthy || !ip) {
    return {
      verified: false,
      candidateIpAvailable: false,
      mechanism,
      matchedResolvedSource: false,
    };
  }

  const resolvedIps = await getResolvedPayFastIps();
  const isMatch = resolvedIps.has(ip);

  return {
    verified: isMatch,
    candidateIpAvailable: true,
    mechanism,
    matchedResolvedSource: isMatch,
  };
}

/**
 * POST /api/payments/payfast/itn
 * 
 * Server-to-server Instant Transaction Notification (ITN) webhook from PayFast.
 * 
 * Strict Security Checks Implemented:
 * 1. Read application/x-www-form-urlencoded body.
 * 2. Check #1: Verify ITN MD5 signature against received parameters.
 * 3. Check #2: Verify request source matches PayFast domains / IPs.
 * 4. Check #3: Verify authoritative order exists in public.orders using m_payment_id.
 * 5. Check #4: Verify amount_gross matches orders.total within R0.01 tolerance.
 * 6. Check #5: Verify merchant_id matches server PAYFAST_MERCHANT_ID.
 * 7. Check #6: Server-to-server POST verification to PayFast validate URL (returns 'VALID').
 * 8. Status Verification: Process paid status ONLY IF payment_status === 'COMPLETE'.
 * 9. Atomically record payment_events and update orders.payment_status = 'paid'.
 * 10. Idempotent: If identical pf_payment_id arrives again, return 200 OK without re-mutating.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Parse raw urlencoded body preserving field order
    const rawBody = await request.text();
    if (!rawBody || rawBody.trim().length === 0) {
      console.warn('[PAYFAST ITN] Empty request body received');
      return new NextResponse('Empty request body', { status: 400 });
    }

    const searchParams = new URLSearchParams(rawBody);
    const receivedEntries: [string, string][] = [];
    const receivedMap: Record<string, string> = {};

    searchParams.forEach((val, key) => {
      receivedEntries.push([key, val]);
      receivedMap[key] = val;
    });

    const pfPaymentId = receivedMap['pf_payment_id']?.trim();
    const paymentStatus = receivedMap['payment_status']?.trim().toUpperCase();
    const mPaymentId = receivedMap['m_payment_id']?.trim();
    const amountGrossStr = receivedMap['amount_gross']?.trim();
    const receivedMerchantId = receivedMap['merchant_id']?.trim();
    const receivedSignature = receivedMap['signature']?.trim();

    console.log('[PAYFAST ITN] Received notification for reference:', mPaymentId, 'Status:', paymentStatus);

    if (!isPayFastConfigured()) {
      console.error('[PAYFAST ITN] PayFast is not configured on server');
      return new NextResponse('Server payment configuration missing', { status: 500 });
    }

    const payfastConfig = getPayFastServerConfig();

    // 2. CHECK #1: SIGNATURE VERIFICATION
    const isSignatureValid = verifyPayFastItnSignature(
      receivedEntries,
      receivedSignature || '',
      payfastConfig.passphrase
    );

    if (!isSignatureValid) {
      console.error('[PAYFAST ITN] Security Check #1 Failed: Invalid signature');
      return new NextResponse('Invalid signature', { status: 400 });
    }

    // 3. CHECK #2: SOURCE VERIFICATION
    const sourceOutcome = await verifyPayFastSource(request);

    if (payfastConfig.mode === 'sandbox') {
      console.log('[PAYFAST ITN DIAGNOSTIC] Source check:', {
        candidateIpAvailable: sourceOutcome.candidateIpAvailable,
        mechanism: sourceOutcome.mechanism,
        matchedResolvedSource: sourceOutcome.matchedResolvedSource,
      });
    }

    if (!sourceOutcome.verified) {
      console.error('[PAYFAST ITN] Security Check #2 Failed: Source IP untrusted or unresolved. Mechanism:', sourceOutcome.mechanism);
      return new NextResponse('VERCEL_SOURCE_IP_UNRESOLVED', { status: 403 });
    }

    // 4. CHECK #5: MERCHANT ID VERIFICATION
    if (receivedMerchantId !== payfastConfig.merchantId) {
      console.error('[PAYFAST ITN] Security Check #5 Failed: Merchant ID mismatch');
      return new NextResponse('Merchant ID mismatch', { status: 400 });
    }

    // 5. CHECK #3: ORDER LOOKUP VIA TRUSTED SERVER CLIENT
    if (!mPaymentId) {
      console.error('[PAYFAST ITN] Security Check #3 Failed: Missing m_payment_id');
      return new NextResponse('Missing m_payment_id', { status: 400 });
    }

    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      console.error('[PAYFAST ITN] Database client unavailable');
      return new NextResponse('Database connection error', { status: 503 });
    }

    // Query order strictly by canonical UUID (mPaymentId)
    const { data: order, error: orderErr } = await serviceClient
      .from('orders')
      .select('id, order_number, total, currency, payment_status')
      .eq('id', mPaymentId)
      .maybeSingle();

    if (orderErr) {
      console.error('[PAYFAST ITN] Database error during order lookup:', orderErr);
      return new NextResponse('Database error', { status: 500 });
    }

    if (!order) {
      console.error('[PAYFAST ITN] Security Check #3 Failed: Order not found in ledger');
      return new NextResponse('Order not found', { status: 404 });
    }

    // 6. CHECK #4: AMOUNT VERIFICATION (±0.01 tolerance)
    const receivedAmountGross = parseFloat(amountGrossStr || '0');
    const orderTotal = Number(order.total || 0);

    if (isNaN(receivedAmountGross) || Math.abs(orderTotal - receivedAmountGross) > 0.01) {
      console.error('[PAYFAST ITN] Security Check #4 Failed: Amount mismatch. Order Total:', orderTotal, 'Gross:', receivedAmountGross);
      return new NextResponse('Amount mismatch', { status: 400 });
    }

    // 7. CHECK #6: SERVER-TO-SERVER VALIDATION WITH PAYFAST
    // Reconstruct param string as required by PayFast validate URL
    const validateParamPairs: string[] = [];
    for (const [key, value] of receivedEntries) {
      validateParamPairs.push(`${key}=${payfastUrlEncode(value)}`);
    }
    const validatePayload = validateParamPairs.join('&');

    try {
      const validateRes = await fetch(payfastConfig.validateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: validatePayload,
      });

      if (!validateRes.ok) {
        console.error('[PAYFAST ITN] Security Check #6 Failed: Server validate HTTP error:', validateRes.status);
        return new NextResponse('PayFast validation server error', { status: 502 });
      }

      const validateText = (await validateRes.text()).trim().toUpperCase();
      const isServerValid = validateText === 'VALID';

      if (payfastConfig.mode === 'sandbox') {
        console.log('[PAYFAST ITN DIAGNOSTIC] Server validation:', {
          candidateIpAvailable: sourceOutcome.candidateIpAvailable,
          mechanism: sourceOutcome.mechanism,
          matchedResolvedSource: sourceOutcome.matchedResolvedSource,
          serverValidationStatus: isServerValid ? 'VALID' : 'INVALID',
        });
      }

      if (!isServerValid) {
        console.error('[PAYFAST ITN] Security Check #6 Failed: PayFast validate endpoint returned non-VALID response');
        return new NextResponse('PayFast validation rejected', { status: 400 });
      }
    } catch (networkErr: any) {
      console.error('[PAYFAST ITN] Security Check #6 Failed: Network timeout/error validating with PayFast:', networkErr?.message);
      return new NextResponse('Validation network error', { status: 502 });
    }

    // 8. IDEMPOTENCY CHECK
    // Check if this pf_payment_id was already recorded in payment_events
    if (pfPaymentId) {
      const { data: existingEvent } = await serviceClient
        .from('payment_events')
        .select('id, payment_status')
        .eq('provider', 'payfast')
        .eq('provider_payment_id', pfPaymentId)
        .maybeSingle();

      if (existingEvent) {
        console.log('[PAYFAST ITN] Duplicate event detected for provider_payment_id:', pfPaymentId);
        return new NextResponse('OK', { status: 200 });
      }
    }

    // 9. STATUS VERIFICATION: COMPLETE STATUS ONLY
    if (paymentStatus !== 'COMPLETE') {
      console.log('[PAYFAST ITN] Non-complete payment status received:', paymentStatus, '- order remains unchanged.');
      
      // Log event into payment_events with its status without marking order paid
      await serviceClient.from('payment_events').insert({
        order_id: order.id,
        provider: 'payfast',
        provider_payment_id: pfPaymentId || null,
        event_type: 'payment_status_update',
        payment_status: paymentStatus.toLowerCase(),
        amount: receivedAmountGross,
        currency: 'ZAR',
        signature_verified: true,
        source_verified: true,
        raw_reference: order.order_number,
      });

      return new NextResponse('OK', { status: 200 });
    }

    // 10. ATOMIC UPDATE VIA process_verified_payfast_payment RPC
    const rpcRes = await serviceClient.rpc('process_verified_payfast_payment', {
      p_order_id: order.id,
      p_provider_payment_id: pfPaymentId || null,
      p_amount: receivedAmountGross,
      p_currency: 'ZAR',
      p_raw_reference: order.order_number,
    });

    if (rpcRes.error) {
      console.error('[PAYFAST ITN] Payment RPC execution error:', rpcRes.error.message);
      return new NextResponse('Payment processing failed', { status: 500 });
    }

    if (!rpcRes.data?.success) {
      console.error('[PAYFAST ITN] Payment RPC returned unsuccess status:', rpcRes.data?.error);
      return new NextResponse(rpcRes.data?.error || 'Payment failed', { status: 400 });
    }

    console.log('[PAYFAST ITN] Payment successfully confirmed and settled for order:', order.order_number);
    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    console.error('[PAYFAST ITN] Unexpected internal error processing ITN:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}
