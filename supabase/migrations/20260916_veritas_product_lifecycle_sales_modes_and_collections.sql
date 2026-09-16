-- ==============================================================================
-- VERITAS PRODUCT LIFECYCLE, SALES MODES, ORDER SNAPSHOTS & COLLECTIONS
-- Migration: 20260916_veritas_product_lifecycle_sales_modes_and_collections.sql
-- ==============================================================================

-- 1. ADD SALES MODE AND AVAILABILITY COLUMNS TO PRODUCTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sales_mode text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS release_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS availability_message text NULL,
  ADD COLUMN IF NOT EXISTS preorder_notice text NULL;

-- Enforce valid sales modes on public.products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_sales_mode_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_sales_mode_check
      CHECK (sales_mode IN ('standard', 'coming_soon', 'preorder'));
  END IF;
END $$;

-- 2. ADD SNAPSHOT COLUMNS TO ORDER_ITEMS
-- ------------------------------------------------------------------------------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS sales_mode_snapshot text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS release_at_snapshot timestamptz NULL,
  ADD COLUMN IF NOT EXISTS availability_message_snapshot text NULL;

-- Enforce valid sales modes on public.order_items snapshots
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_sales_mode_snapshot_check'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_sales_mode_snapshot_check
      CHECK (sales_mode_snapshot IN ('standard', 'coming_soon', 'preorder'));
  END IF;
END $$;

-- 3. SEED CANONICAL COLLECTIONS: VERITAS ESSENTIALS & VERITAS PREMIUM
-- ------------------------------------------------------------------------------
INSERT INTO public.collections (name, slug, description, is_active, created_at, updated_at)
VALUES 
  (
    'VERITAS ESSENTIALS',
    'veritas-essentials',
    'Accessible VERITAS pieces designed to deliver strong quality, original design and everyday wearability at approachable prices.',
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.collections (name, slug, description, is_active, created_at, updated_at)
VALUES 
  (
    'VERITAS PREMIUM',
    'veritas-premium',
    'The elevated VERITAS collection featuring premium materials, more advanced construction, distinctive design and higher-end pieces.',
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = NOW();

-- 4. UPDATE RPC FUNCTION FOR CHECKOUT ORDER CREATION IF PRESENT
-- ------------------------------------------------------------------------------
-- Ensure future order creations capture snapshots seamlessly
CREATE OR REPLACE FUNCTION public.process_checkout_order(
  p_order_number text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_address_line1 text,
  p_address_line2 text,
  p_suburb text,
  p_city text,
  p_province text,
  p_postal_code text,
  p_country text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_shipping numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_prod record;
  v_var record;
  v_qty int;
  v_line_total numeric;
  v_sales_mode text;
  v_release_at timestamptz;
  v_avail_msg text;
BEGIN
  -- Insert Order header
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
    0,
    0,
    0,
    'ZAR',
    'pending',
    'pending',
    'pending',
    NOW(),
    NOW()
  ) RETURNING id INTO v_order_id;

  -- Insert Address
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
    NULLIF(p_address_line2, ''),
    NULLIF(p_suburb, ''),
    p_city,
    p_province,
    p_postal_code,
    COALESCE(NULLIF(p_country, ''), 'South Africa'),
    NOW()
  );

  -- Process and Insert Line Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));

    SELECT * INTO v_prod FROM public.products WHERE id = (v_item->>'product_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product with id % not found', (v_item->>'product_id');
    END IF;

    IF v_prod.status != 'active' OR v_prod.published IS NOT TRUE THEN
      RAISE EXCEPTION 'Product % is not published or active', v_prod.name;
    END IF;

    IF v_prod.sales_mode = 'coming_soon' THEN
      RAISE EXCEPTION 'Product % is Coming Soon and cannot be purchased yet', v_prod.name;
    END IF;

    -- Variant lookup
    IF (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') != '' THEN
      SELECT * INTO v_var FROM public.product_variants WHERE id = (v_item->>'variant_id')::uuid;
    ELSE
      SELECT * INTO v_var FROM public.product_variants WHERE product_id = v_prod.id LIMIT 1;
    END IF;

    -- Stock check for standard and preorder
    IF v_var.id IS NOT NULL AND v_var.stock_quantity < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for % (%). Available: %, Requested: %',
        v_prod.name, COALESCE(v_var.size, 'Standard'), v_var.stock_quantity, v_qty;
    END IF;

    v_line_total := v_prod.selling_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    v_sales_mode := COALESCE(v_prod.sales_mode, 'standard');
    v_release_at := v_prod.release_at;
    v_avail_msg := v_prod.availability_message;

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
      sales_mode_snapshot,
      release_at_snapshot,
      availability_message_snapshot,
      created_at
    ) VALUES (
      v_order_id,
      v_prod.id,
      v_var.id,
      v_prod.name,
      COALESCE(v_var.sku, 'VRT-N/A'),
      COALESCE(v_var.colour, 'N/A'),
      COALESCE(v_var.size, 'N/A'),
      v_prod.selling_price,
      v_qty,
      v_line_total,
      v_sales_mode,
      v_release_at,
      v_avail_msg,
      NOW()
    );

    -- Decrement variant stock
    IF v_var.id IS NOT NULL THEN
      UPDATE public.product_variants
      SET stock_quantity = GREATEST(0, stock_quantity - v_qty),
          updated_at = NOW()
      WHERE id = v_var.id;
    END IF;
  END LOOP;

  v_shipping := 0.00;
  v_total := v_subtotal + v_shipping;

  UPDATE public.orders
  SET subtotal = v_subtotal,
      shipping_amount = v_shipping,
      total = v_total
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', p_order_number,
    'subtotal', v_subtotal,
    'shipping_amount', v_shipping,
    'total', v_total
  );
END;
$$;
