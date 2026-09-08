import { getSupabaseClient } from './client';
import { getSupabaseEnvConfig } from './config';
import { recordAuditLog } from './audit';
import { 
  DbOrder, 
  DbOrderItem, 
  DbOrderAddress,
  FulfilmentStatus,
  PaymentStatus,
  OrderStatus,
  VALID_FULFILMENT_STATUSES,
  VALID_PAYMENT_STATUSES,
  VALID_ORDER_STATUSES,
  getFulfilmentStatusLabel,
  getPaymentStatusLabel,
  getOrderStatusLabel
} from './types';
import { OrderRecord, OrderItemProduct } from '@/lib/mock-data';
import { calculateShippingFeeZAR } from '@/lib/shipping';

export interface AdminOrderFull {
  id: string; // Database UUID
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddressFormatted: string;
  addressDetails: DbOrderAddress | null;
  subtotal: number;
  shippingAmount: number;
  total: number;
  currency: string;
  paymentStatus: string;
  orderStatus: string;
  fulfilmentStatus: string;
  createdAt: string;
  items: DbOrderItem[];
}

export function normalizeFulfilmentStatus(status?: string): FulfilmentStatus {
  if (!status) return 'pending';
  const norm = status.toLowerCase().trim().replace(/\s+/g, '_');
  if (VALID_FULFILMENT_STATUSES.includes(norm as FulfilmentStatus)) {
    return norm as FulfilmentStatus;
  }
  return 'pending';
}

export function normalizePaymentStatus(status?: string): PaymentStatus {
  if (!status) return 'pending';
  const norm = status.toLowerCase().trim();
  if (VALID_PAYMENT_STATUSES.includes(norm as PaymentStatus)) {
    return norm as PaymentStatus;
  }
  return 'pending';
}

export function normalizeOrderStatus(status?: string): OrderStatus {
  if (!status) return 'pending';
  const norm = status.toLowerCase().trim();
  if (VALID_ORDER_STATUSES.includes(norm as OrderStatus)) {
    return norm as OrderStatus;
  }
  return 'pending';
}

export function getShippingStatusDescription(fulfilmentStatus: string): string {
  const status = normalizeFulfilmentStatus(fulfilmentStatus);
  if (status === 'shipped') return 'In Transit via Courier';
  if (status === 'delivered') return 'Delivered to Recipient';
  if (status === 'in_production') return 'In Production at OTC Facility';
  if (status === 'sent_to_otc') return 'Sent to OTC Facility';
  return 'Order Created - Pending Processing';
}

/**
 * Converts a database AdminOrderFull into the OrderRecord expected by Admin components
 */
export function mapDbOrderToOrderRecord(order: AdminOrderFull): OrderRecord {
  const products: OrderItemProduct[] = order.items.map(item => ({
    productId: item.product_id || '',
    name: item.product_name_snapshot || 'Unknown Product',
    size: item.size_snapshot || 'N/A',
    color: item.colour_snapshot || 'N/A',
    quantity: item.quantity || 1,
    unitPrice: item.unit_price || 0,
    currency: 'ZAR',
    designInfo: `SKU: ${item.sku_snapshot || 'N/A'}`,
    sku: item.sku_snapshot,
    lineTotal: item.line_total || (item.unit_price * item.quantity),
  }));

  const formattedDate = order.createdAt 
    ? new Date(order.createdAt).toISOString().split('T')[0] 
    : new Date().toISOString().split('T')[0];

  return {
    id: order.orderNumber || order.id,
    uuid: order.id,
    date: formattedDate,
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
      address: order.shippingAddressFormatted,
      addressDetails: order.addressDetails,
    },
    products,
    subtotal: order.subtotal,
    shipping: order.shippingAmount,
    tax: 0,
    total: order.total,
    currency: 'ZAR',
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    fulfilmentStatus: order.fulfilmentStatus,
    shippingStatus: getShippingStatusDescription(order.fulfilmentStatus),
    trackingNumber: `TRK-${(order.orderNumber || order.id).replace(/[^a-zA-Z0-9]/g, '')}`,
    createdAt: order.createdAt,
    rawItems: order.items,
  } as OrderRecord;
}

/**
 * Reads all orders directly from Supabase, including line items and addresses.
 */
export async function fetchFullOrdersFromSupabase(customClient?: any): Promise<{ orders: AdminOrderFull[]; records: OrderRecord[]; error: string | null }> {
  const config = getSupabaseEnvConfig();

  const client = customClient || getSupabaseClient();
  if (!client) {
    return { 
      orders: [], 
      records: [], 
      error: 'Supabase client is not configured (missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY).' 
    };
  }

  try {
    const { data: rawOrders, error: ordersErr } = await client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ordersErr) {
      console.error('[SUPABASE] Orders query error:', ordersErr);
      const isRLS = ordersErr.code === '42501' || ordersErr.message?.toLowerCase().includes('permission') || ordersErr.message?.toLowerCase().includes('policy');
      const errType = isRLS ? 'RLS / Permission Error' : 'Database Query Error';
      return { 
        orders: [], 
        records: [], 
        error: `${errType}: ${ordersErr.message || 'Unable to retrieve orders from Supabase.'}` 
      };
    }

    const orderCount = rawOrders?.length || 0;
    const orderNumbers = (rawOrders || []).map((o: any) => o.order_number || o.id);
    console.log('[SUPABASE DEBUG] Orders query returned count:', orderCount);
    console.log('[SUPABASE DEBUG] Order numbers returned:', orderNumbers);

    if (orderCount === 0) {
      console.log('[SUPABASE DEBUG] Query completed successfully with 0 orders');
      return { orders: [], records: [], error: null };
    }

    const orderIds = (rawOrders as any[]).map((o: any) => o.id);

    // Fetch order items
    const { data: rawItems, error: itemsErr } = await client
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    if (itemsErr) {
      console.error('[SUPABASE DEBUG] Order items query error:', itemsErr);
    }
    const totalItemsCount = rawItems?.length || 0;
    console.log('[SUPABASE DEBUG] Order items count:', totalItemsCount);

    // Fetch order addresses
    const { data: rawAddresses, error: addrErr } = await client
      .from('order_addresses')
      .select('*')
      .in('order_id', orderIds);

    if (addrErr) {
      console.error('[SUPABASE DEBUG] Address query error:', addrErr);
    }
    const totalAddrCount = rawAddresses?.length || 0;
    console.log('[SUPABASE DEBUG] Address count:', totalAddrCount);
    console.log('[SUPABASE DEBUG] Query completed successfully');

    const mappedOrders: AdminOrderFull[] = (rawOrders as any[]).map((order: any) => {
      const orderItems = ((rawItems || []) as any[]).filter((item: any) => item.order_id === order.id);
      const address = ((rawAddresses || []) as any[]).find((addr: any) => addr.order_id === order.id) || null;

      let addressStr = 'N/A';
      if (address) {
        addressStr = [
          address.address_line1,
          address.address_line2,
          address.suburb,
          address.city,
          address.province,
          address.postal_code,
          address.country
        ].filter(Boolean).join(', ');
      }

      return {
        id: order.id,
        orderNumber: order.order_number || order.id,
        customerName: order.customer_name || 'Guest Customer',
        customerEmail: order.customer_email || 'N/A',
        customerPhone: order.customer_phone || 'N/A',
        shippingAddressFormatted: addressStr,
        addressDetails: address,
        subtotal: Number(order.subtotal || 0),
        shippingAmount: Number(order.shipping_amount || 0),
        total: Number(order.total || 0),
        currency: order.currency || 'ZAR',
        paymentStatus: normalizePaymentStatus(order.payment_status),
        orderStatus: normalizeOrderStatus(order.order_status),
        fulfilmentStatus: normalizeFulfilmentStatus(order.fulfilment_status || order.order_status),
        createdAt: order.created_at || new Date().toISOString(),
        items: orderItems,
      };
    });

    const records = mappedOrders.map(mapDbOrderToOrderRecord);

    return { orders: mappedOrders, records, error: null };
  } catch (err: any) {
    console.error('[SUPABASE DEBUG] Supabase error:', err);
    return { orders: [], records: [], error: err?.message || 'Unexpected error loading orders' };
  }
}

/**
 * Updates order status in Supabase database with pre-validation and detailed error logging
 */
export async function updateOrderStatusInSupabase(
  dbOrderId: string, 
  updates: { payment_status?: string; order_status?: string; fulfilment_status?: string },
  customClient?: any
): Promise<{ success: boolean; error: string | null }> {
  const client = customClient || getSupabaseClient();
  if (!client) {
    console.error('[STATUS UPDATE ERROR] Supabase client is unconfigured.');
    return { success: false, error: 'Supabase client is not configured' };
  }

  const cleanUpdates: { payment_status?: string; order_status?: string; fulfilment_status?: string; updated_at?: string } = {
    updated_at: new Date().toISOString()
  };

  // Pre-validate enrolment of fulfilment status
  if (updates.fulfilment_status !== undefined) {
    const rawVal = updates.fulfilment_status;
    const normalized = rawVal.toLowerCase().trim().replace(/\s+/g, '_');
    if (!VALID_FULFILMENT_STATUSES.includes(normalized as FulfilmentStatus)) {
      console.error('[STATUS UPDATE ERROR] Validation failure for fulfilment_status:', {
        requestedStatus: rawVal,
        normalizedStatus: normalized,
        databaseColumn: 'fulfilment_status',
        allowedValues: VALID_FULFILMENT_STATUSES
      });
      return { success: false, error: 'Invalid fulfilment status.' };
    }
    cleanUpdates.fulfilment_status = normalized;
  }

  // Pre-validate payment status
  if (updates.payment_status !== undefined) {
    const rawVal = updates.payment_status;
    const normalized = rawVal.toLowerCase().trim();
    if (!VALID_PAYMENT_STATUSES.includes(normalized as PaymentStatus)) {
      console.error('[STATUS UPDATE ERROR] Validation failure for payment_status:', {
        requestedStatus: rawVal,
        normalizedStatus: normalized,
        databaseColumn: 'payment_status',
        allowedValues: VALID_PAYMENT_STATUSES
      });
      return { success: false, error: 'Invalid payment status.' };
    }
    cleanUpdates.payment_status = normalized;
  }

  // Pre-validate order status
  if (updates.order_status !== undefined) {
    const rawVal = updates.order_status;
    const normalized = rawVal.toLowerCase().trim();
    if (!VALID_ORDER_STATUSES.includes(normalized as OrderStatus)) {
      console.error('[STATUS UPDATE ERROR] Validation failure for order_status:', {
        requestedStatus: rawVal,
        normalizedStatus: normalized,
        databaseColumn: 'order_status',
        allowedValues: VALID_ORDER_STATUSES
      });
      return { success: false, error: 'Invalid order status.' };
    }
    cleanUpdates.order_status = normalized;
  }

  try {
    console.log('[STATUS UPDATE DEBUG] Executing update on orders table:', {
      dbOrderId,
      cleanUpdates
    });

    const { data, error } = await client
      .from('orders')
      .update(cleanUpdates)
      .eq('id', dbOrderId)
      .select();

    if (error) {
      console.error('[STATUS UPDATE ERROR] Supabase database error during update:', {
        requestedStatus: updates.fulfilment_status || updates.payment_status || updates.order_status,
        databaseColumn: updates.fulfilment_status ? 'fulfilment_status' : updates.payment_status ? 'payment_status' : 'order_status',
        supabaseErrorCode: error.code,
        supabaseErrorMessage: error.message,
        details: error.details,
        hint: error.hint
      });
      return { success: false, error: `Database error (${error.code || 'UNKNOWN'}): ${error.message}` };
    }

    console.log('[STATUS UPDATE SUCCESS] Order successfully updated in Supabase:', data);
    
    void recordAuditLog({
      action: 'order.status_change',
      actionLabel: `Updated order status for ${dbOrderId}: ${Object.entries(cleanUpdates).filter(([k]) => k !== 'updated_at').map(([k, v]) => `${k}=${v}`).join(', ')}`,
      targetType: 'order',
      targetId: dbOrderId,
      details: cleanUpdates,
    });

    return { success: true, error: null };
  } catch (err: any) {
    console.error('[STATUS UPDATE ERROR] Unexpected error during update execution:', {
      requestedUpdates: updates,
      exceptionMessage: err?.message
    });
    return { success: false, error: err?.message || 'Failed to update order status' };
  }
}

/**
 * Backward compatible fetch function
 */
export async function fetchOrdersFromSupabase(): Promise<DbOrder[]> {
  const { orders } = await fetchFullOrdersFromSupabase();
  return orders.map(o => ({
    id: o.id,
    order_number: o.orderNumber,
    customer_name: o.customerName,
    customer_email: o.customerEmail,
    customer_phone: o.customerPhone,
    subtotal: o.subtotal,
    shipping_amount: o.shippingAmount,
    total: o.total,
    currency: o.currency,
    payment_status: o.paymentStatus,
    order_status: o.orderStatus,
    fulfilment_status: o.fulfilmentStatus,
    created_at: o.createdAt
  }));
}

export interface CreateOrderPayload {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subtotal: number;
  shippingAmount: number;
  total: number;
  paymentMethod?: string;
  address: {
    addressLine1: string;
    addressLine2?: string;
    suburb?: string;
    city: string;
    province: string;
    postalCode: string;
    country?: string;
  };
  items: Array<{
    productId: string;
    name: string;
    color: string;
    size: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
  }>;
}

/**
 * Creates a real order in Supabase with authoritative pricing, stock validation, line items, and address records
 */
export async function createOrderInSupabase(
  payload: CreateOrderPayload,
  customClient?: any
): Promise<{ success: boolean; orderId?: string; orderNumber?: string; subtotal?: number; shippingAmount?: number; total?: number; error?: string }> {
  const client = customClient || getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    // 1. Authoritative Database Validation
    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: 'No items in order payload' };
    }

    const productIds = Array.from(new Set(payload.items.map(i => i.productId)));
    const { data: dbProducts, error: prodErr } = await client
      .from('products')
      .select('id, name, selling_price, status, published')
      .in('id', productIds);

    if (prodErr || !dbProducts || dbProducts.length === 0) {
      return { success: false, error: 'Failed to retrieve authoritative product information' };
    }

    const productMap = new Map((dbProducts as any[]).map((p: any) => [p.id, p]));

    // Fetch variants to validate stock
    const { data: dbVariants, error: varErr } = await client
      .from('product_variants')
      .select('id, product_id, sku, colour, size, stock_quantity')
      .in('product_id', productIds);

    if (varErr) {
      console.warn('Could not verify variant inventory:', varErr);
    }

    const validatedItems: Array<{
      productId: string;
      variantId?: string;
      name: string;
      color: string;
      size: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }> = [];

    let calculatedSubtotal = 0;

    for (const item of payload.items) {
      const dbProd = productMap.get(item.productId);
      if (!dbProd) {
        return { success: false, error: `Product ${item.name || item.productId} not found in catalog` };
      }
      if (dbProd.status !== 'active' || !dbProd.published) {
        return { success: false, error: `Product ${dbProd.name} is not available for purchase` };
      }

      // Find matching variant
      const matchingVariant = ((dbVariants || []) as any[]).find((v: any) => 
        v.product_id === item.productId &&
        (v.sku === item.sku || (v.size === item.size && v.colour?.toLowerCase() === item.color?.toLowerCase()))
      );

      const qty = Math.max(1, Number(item.quantity) || 1);
      if (matchingVariant && matchingVariant.stock_quantity !== undefined) {
        if (matchingVariant.stock_quantity < qty) {
          return {
            success: false,
            error: `Insufficient stock for ${dbProd.name} (${item.size || ''} ${item.color || ''}). Available: ${matchingVariant.stock_quantity}, Requested: ${qty}`
          };
        }
      }

      const authoritativePrice = Number(dbProd.selling_price) || Number(item.unitPrice) || 0;
      const lineTotal = authoritativePrice * qty;
      calculatedSubtotal += lineTotal;

      validatedItems.push({
        productId: item.productId,
        variantId: matchingVariant?.id,
        name: dbProd.name || item.name,
        color: item.color,
        size: item.size,
        sku: matchingVariant?.sku || item.sku || 'N/A',
        quantity: qty,
        unitPrice: authoritativePrice,
        lineTotal
      });
    }

    // Authoritative totals calculation
    const calculatedShipping = calculateShippingFeeZAR(calculatedSubtotal, validatedItems.length);
    const calculatedTotal = calculatedSubtotal + calculatedShipping;

    // Generate canonical Veritas order number: VER-YYYY-XXXXXX
    const currentYear = new Date().getFullYear();
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderNumber = `VER-${currentYear}-${randomSuffix}`;

    try {
      const rpcItems = validatedItems.map(i => ({
        product_id: i.productId,
        variant_id: i.variantId,
        quantity: i.quantity
      }));

      const { data: rpcData, error: rpcErr } = await client.rpc('process_checkout_order', {
        p_order_number: orderNumber,
        p_customer_name: payload.customerName,
        p_customer_email: payload.customerEmail,
        p_customer_phone: payload.customerPhone || '+27000000000',
        p_address_line1: payload.address?.addressLine1 || '',
        p_address_line2: payload.address?.addressLine2 || '',
        p_suburb: payload.address?.suburb || '',
        p_city: payload.address?.city || '',
        p_province: payload.address?.province || '',
        p_postal_code: payload.address?.postalCode || '',
        p_country: payload.address?.country || 'South Africa',
        p_items: rpcItems
      });

      if (!rpcErr && rpcData && rpcData.success) {
        return {
          success: true,
          orderId: rpcData.order_id,
          orderNumber: rpcData.order_number || orderNumber,
          subtotal: Number(rpcData.subtotal ?? calculatedSubtotal),
          shippingAmount: Number(rpcData.shipping_amount ?? calculatedShipping),
          total: Number(rpcData.total ?? calculatedTotal)
        };
      }
    } catch (rpcEx) {
      console.warn('process_checkout_order RPC not available or constraint error, using server transaction pipeline:', rpcEx);
    }

    // Standard authoritative server-side pipeline
    const { data: orderData, error: orderErr } = await client
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_name: payload.customerName,
        customer_email: payload.customerEmail,
        customer_phone: payload.customerPhone || '+27000000000',
        subtotal: calculatedSubtotal,
        shipping_amount: calculatedShipping,
        total: calculatedTotal,
        currency: 'ZAR',
        payment_status: 'pending',
        order_status: 'pending',
        fulfilment_status: 'pending',
        created_at: new Date().toISOString()
      })
      .select('id, order_number')
      .single();

    if (orderErr || !orderData) {
      console.error('Error creating order in Supabase:', orderErr);
      return { success: false, error: orderErr?.message || 'Failed to insert order' };
    }

    const orderId = orderData.id;

    // Insert line items
    const itemsToInsert = validatedItems.map(item => ({
      order_id: orderId,
      product_id: item.productId,
      variant_id: item.variantId,
      product_name_snapshot: item.name,
      size_snapshot: item.size,
      colour_snapshot: item.color,
      sku_snapshot: item.sku,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal
    }));

    const { error: itemsErr } = await client.from('order_items').insert(itemsToInsert);
    if (itemsErr) {
      console.error('Error creating order items in Supabase:', itemsErr);
    }

    // Insert address
    if (payload.address) {
      const { error: addrErr } = await client.from('order_addresses').insert({
        order_id: orderId,
        address_line1: payload.address.addressLine1,
        address_line2: payload.address.addressLine2 || null,
        suburb: payload.address.suburb || null,
        city: payload.address.city,
        province: payload.address.province,
        postal_code: payload.address.postalCode,
        country: payload.address.country || 'South Africa'
      });

      if (addrErr) {
        console.error('Error creating order address in Supabase:', addrErr);
      }
    }

    // Decrement stock for purchased variants
    for (const item of validatedItems) {
      if (item.variantId) {
        const matching = ((dbVariants || []) as any[]).find((v: any) => v.id === item.variantId);
        if (matching && matching.stock_quantity !== undefined) {
          const newStock = Math.max(0, matching.stock_quantity - item.quantity);
          await client
            .from('product_variants')
            .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
            .eq('id', item.variantId);
        }
      }
    }

    return {
      success: true,
      orderId,
      orderNumber: orderData.order_number,
      subtotal: calculatedSubtotal,
      shippingAmount: calculatedShipping,
      total: calculatedTotal
    };
  } catch (err: any) {
    console.error('Exception during order creation:', err);
    return { success: false, error: err?.message || 'Order creation failed' };
  }
}

