-- ==============================================================================
-- VERITAS — MIGRATION 20260907: ATOMIC VERIFIED PAYFAST PAYMENT RPC
-- ==============================================================================
-- Atomically accepts a verified PayFast payment:
-- 1. Checks that order exists in public.orders.
-- 2. Checks if order is already marked 'paid' (returns already_paid: true).
-- 3. Inserts a record into public.payment_events (leveraging unique partial index).
-- 4. Updates public.orders payment fields (payment_status = 'paid', payment_provider = 'payfast',
--    payfast_payment_id, paid_at = now(), updated_at = now()).
-- 5. Does NOT mutate stock, does NOT mutate order items, does NOT mark fulfilment completed.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.process_verified_payfast_payment(
  p_order_id UUID,
  p_provider_payment_id TEXT,
  p_amount NUMERIC(10,2),
  p_currency TEXT,
  p_raw_reference TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_status TEXT;
  v_order_number TEXT;
  v_event_id UUID;
BEGIN
  -- 1. Check if order exists and lock the row for update
  SELECT payment_status, order_number
  INTO v_existing_status, v_order_number
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found',
      'order_id', p_order_id
    );
  END IF;

  -- 2. Idempotency / already paid guard
  IF v_existing_status = 'paid' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_paid', true,
      'order_id', p_order_id,
      'order_number', v_order_number,
      'message', 'Order is already marked paid'
    );
  END IF;

  -- 3. Insert idempotent payment event
  -- Uses ON CONFLICT DO NOTHING against idx_payment_events_provider_payment_unique
  INSERT INTO public.payment_events (
    order_id,
    provider,
    provider_payment_id,
    event_type,
    payment_status,
    amount,
    currency,
    signature_verified,
    source_verified,
    raw_reference,
    created_at
  ) VALUES (
    p_order_id::TEXT,
    'payfast',
    p_provider_payment_id,
    'payment_complete',
    'paid',
    p_amount,
    COALESCE(p_currency, 'ZAR'),
    true,
    true,
    p_raw_reference,
    now()
  )
  ON CONFLICT (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_event_id;

  -- 4. Update the order row atomically
  UPDATE public.orders
  SET payment_status = 'paid',
      payment_provider = 'payfast',
      payfast_payment_id = p_provider_payment_id,
      paid_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_paid', false,
    'order_id', p_order_id,
    'order_number', v_order_number,
    'payment_event_id', v_event_id
  );
END;
$$;

-- CRITICAL SECURITY: REVOKE EXECUTE from public, anon, and authenticated roles; allow ONLY service_role
REVOKE EXECUTE ON FUNCTION public.process_verified_payfast_payment FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_verified_payfast_payment TO service_role;
