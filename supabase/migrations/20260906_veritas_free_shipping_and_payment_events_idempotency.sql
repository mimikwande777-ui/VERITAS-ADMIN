-- ==============================================================================
-- VERITAS — MIGRATION 20260906: FREE SHIPPING & PAYMENT EVENTS IDEMPOTENCY
-- ==============================================================================
-- 1. Updates public.process_checkout_order RPC to enforce VERITAS business rule:
--    FREE SHIPPING ON ALL ORDERS (shipping_amount = 0.00, total = subtotal)
-- 2. Establishes unique idempotency index on public.payment_events (provider, provider_payment_id)
-- 3. Hardens RLS on public.payment_events to prevent unauthorized client access
-- ==============================================================================

-- 1. UPDATE CHECKOUT ORDER RPC WITH AUTHORITATIVE FREE SHIPPING
CREATE OR REPLACE FUNCTION public.process_checkout_order(
  p_order_number TEXT,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_address_line1 TEXT,
  p_address_line2 TEXT,
  p_suburb TEXT,
  p_city TEXT,
  p_province TEXT,
  p_postal_code TEXT,
  p_country TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_variant_id UUID;
  v_product_id UUID;
  v_variant_prod_id UUID;
  v_qty INT;
  v_current_stock INT;
  v_sku TEXT;
  v_colour TEXT;
  v_size TEXT;
  v_product_name TEXT;
  v_authoritative_price NUMERIC(10,2);
  v_product_status TEXT;
  v_product_published BOOLEAN;
  v_line_total NUMERIC(10,2);
  v_calculated_subtotal NUMERIC(10,2) := 0.00;
  v_calculated_shipping NUMERIC(10,2) := 0.00;
  v_calculated_total NUMERIC(10,2) := 0.00;
BEGIN
  -- Validate payload items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order items payload cannot be empty';
  END IF;

  IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;

  IF p_customer_email IS NULL OR trim(p_customer_email) = '' THEN
    RAISE EXCEPTION 'Customer email is required';
  END IF;

  -- 1. Validate & lock inventory for each item, compute authoritative prices
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := (v_item->>'variant_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid order quantity (%) requested', v_qty;
    END IF;

    -- Validate and lock variant row
    SELECT pv.stock_quantity, pv.sku, pv.colour, pv.size, pv.product_id
    INTO v_current_stock, v_sku, v_colour, v_size, v_variant_prod_id
    FROM public.product_variants pv
    WHERE pv.id = v_variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product variant % does not exist', v_variant_id;
    END IF;

    IF v_variant_prod_id != v_product_id THEN
      RAISE EXCEPTION 'Variant % does not belong to product %', v_variant_id, v_product_id;
    END IF;

    IF v_current_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for % (Available: %, Requested: %)', 
        COALESCE(v_sku, v_variant_id::TEXT), v_current_stock, v_qty;
    END IF;

    -- Look up authoritative product price and active/published status from database
    SELECT p.name, p.selling_price, p.status, p.published
    INTO v_product_name, v_authoritative_price, v_product_status, v_product_published
    FROM public.products p
    WHERE p.id = v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % does not exist in catalog', v_product_id;
    END IF;

    IF v_product_status != 'active' OR NOT v_product_published THEN
      RAISE EXCEPTION 'Product % is not available for purchase', v_product_name;
    END IF;

    v_line_total := ROUND(v_authoritative_price * v_qty, 2);
    v_calculated_subtotal := v_calculated_subtotal + v_line_total;
  END LOOP;

  -- 2. Compute authoritative shipping & total according to VERITAS store policy:
  -- FREE NATIONWIDE COURIER DELIVERY ON ALL ORDERS (R0.00 shipping fee)
  v_calculated_shipping := 0.00;
  v_calculated_total := v_calculated_subtotal;

  -- 3. Insert primary Order record with authoritative financial totals
  INSERT INTO public.orders (
    order_number,
    customer_name,
    customer_email,
    customer_phone,
    subtotal,
    shipping_amount,
    total,
    currency,
    payment_status,
    order_status,
    fulfilment_status,
    created_at,
    updated_at
  ) VALUES (
    p_order_number,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    v_calculated_subtotal,
    v_calculated_shipping,
    v_calculated_total,
    'ZAR',
    'pending',
    'confirmed',
    'pending',
    now(),
    now()
  ) RETURNING id INTO v_order_id;

  -- 4. Insert Order Items snapshots & Decrement Stock atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := (v_item->>'variant_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;

    -- Re-fetch variant details for snapshot
    SELECT pv.sku, pv.colour, pv.size
    INTO v_sku, v_colour, v_size
    FROM public.product_variants pv
    WHERE pv.id = v_variant_id;

    -- Fetch authoritative product price
    SELECT p.name, p.selling_price
    INTO v_product_name, v_authoritative_price
    FROM public.products p
    WHERE p.id = v_product_id;

    v_line_total := ROUND(v_authoritative_price * v_qty, 2);

    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      product_name_snapshot,
      sku_snapshot,
      colour_snapshot,
      size_snapshot,
      unit_price,
      quantity,
      line_total,
      created_at
    ) VALUES (
      v_order_id,
      v_product_id,
      v_variant_id,
      v_product_name,
      v_sku,
      v_colour,
      v_size,
      v_authoritative_price,
      v_qty,
      v_line_total,
      now()
    );

    -- Decrement stock safely (decrements once at order creation)
    UPDATE public.product_variants
    SET stock_quantity = stock_quantity - v_qty,
        updated_at = now()
    WHERE id = v_variant_id;
  END LOOP;

  -- 5. Insert Order Address snapshot if address provided
  IF p_address_line1 IS NOT NULL AND trim(p_address_line1) != '' THEN
    INSERT INTO public.order_addresses (
      order_id,
      address_line1,
      address_line2,
      suburb,
      city,
      province,
      postal_code,
      country,
      created_at
    ) VALUES (
      v_order_id,
      p_address_line1,
      p_address_line2,
      p_suburb,
      p_city,
      p_province,
      p_postal_code,
      COALESCE(p_country, 'South Africa'),
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', p_order_number,
    'subtotal', v_calculated_subtotal,
    'shipping_amount', v_calculated_shipping,
    'total', v_calculated_total
  );
END;
$$;

-- CRITICAL SECURITY: REVOKE EXECUTE from public, anon, and authenticated roles; allow ONLY service_role
REVOKE EXECUTE ON FUNCTION public.process_checkout_order FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_checkout_order TO service_role;

-- 2. IDEMPOTENCY PREPARATION FOR PAYMENT EVENTS
-- Partial unique index ensures provider_payment_id (e.g. PayFast pf_payment_id) is unique per provider,
-- while safely allowing rows where provider_payment_id IS NULL (e.g. unauthenticated ping/initiated events).
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_provider_payment_unique
  ON public.payment_events (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- Index on order_id for fast event history lookups
CREATE INDEX IF NOT EXISTS idx_payment_events_order_id
  ON public.payment_events (order_id);

-- 3. RLS SECURITY HARDENING ON PAYMENT_EVENTS
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Revoke all table-level access from client-facing roles
REVOKE ALL ON public.payment_events FROM anon, authenticated, public;
GRANT ALL ON public.payment_events TO service_role;

-- Ensure no open public/anon policies exist
DROP POLICY IF EXISTS "Anon insert payment_events" ON public.payment_events;
DROP POLICY IF EXISTS "Anon select payment_events" ON public.payment_events;
DROP POLICY IF EXISTS "Anon update payment_events" ON public.payment_events;
DROP POLICY IF EXISTS "Anon delete payment_events" ON public.payment_events;
DROP POLICY IF EXISTS "Public insert payment_events" ON public.payment_events;

-- Allow only authenticated admin users to read payment events (for audit purposes)
DROP POLICY IF EXISTS "Admins can access payment_events" ON public.payment_events;
CREATE POLICY "Admins can access payment_events"
  ON public.payment_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE public.admin_users.user_id = auth.uid()
    )
  );
