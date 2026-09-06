/**
 * Database Types for VERITAS Shared Architecture
 */

export type ProductStatus = 'draft' | 'active' | 'archived';
export type MediaType = 'front' | 'back' | 'model' | 'detail' | 'gallery';

// Separate status categories with strict machine values
export type PaymentStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';
export type OrderStatus = 'pending' | 'processing' | 'cancelled' | 'completed';
export type FulfilmentStatus = 'pending' | 'sent_to_otc' | 'in_production' | 'shipped' | 'delivered';

export const VALID_FULFILMENT_STATUSES: FulfilmentStatus[] = [
  'pending',
  'sent_to_otc',
  'in_production',
  'shipped',
  'delivered'
];

export const VALID_PAYMENT_STATUSES: PaymentStatus[] = [
  'pending',
  'paid',
  'cancelled',
  'refunded'
];

export const VALID_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'processing',
  'cancelled',
  'completed'
];

export const FULFILMENT_STATUS_OPTIONS: { value: FulfilmentStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'sent_to_otc', label: 'Sent to OTC' },
  { value: 'in_production', label: 'In Production' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
];

export const FULFILMENT_STATUS_LABELS: Record<FulfilmentStatus, string> = {
  pending: 'Pending',
  sent_to_otc: 'Sent to OTC',
  in_production: 'In Production',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export function getFulfilmentStatusLabel(status?: string): string {
  if (!status) return 'Pending';
  const norm = status.toLowerCase().trim().replace(/\s+/g, '_');
  if (norm in FULFILMENT_STATUS_LABELS) {
    return FULFILMENT_STATUS_LABELS[norm as FulfilmentStatus];
  }
  return status;
}

export function getPaymentStatusLabel(status?: string): string {
  if (!status) return 'Pending';
  const norm = status.toLowerCase().trim();
  if (norm in PAYMENT_STATUS_LABELS) {
    return PAYMENT_STATUS_LABELS[norm as PaymentStatus];
  }
  return status;
}

export function getOrderStatusLabel(status?: string): string {
  if (!status) return 'Pending';
  const norm = status.toLowerCase().trim();
  if (norm in ORDER_STATUS_LABELS) {
    return ORDER_STATUS_LABELS[norm as OrderStatus];
  }
  return status;
}

export interface DbCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  created_at?: string;
}

export interface DbCollection {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_path?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface DbProduct {
  id: string;
  name: string;
  slug: string;
  description?: string;
  product_type?: string;
  category_id?: string;
  collection_id?: string;
  selling_price: number;
  cost_price?: number;
  profit_per_unit?: number;
  profit_margin?: number;
  status: ProductStatus;
  published: boolean;
  featured?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DbProductColour {
  id: string;
  product_id: string;
  name: string;
  slug: string;
  hex_code?: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DbProductVariant {
  id: string;
  product_id: string;
  colour_id?: string;
  sku: string;
  colour: string;
  size: string;
  stock_quantity: number;
  low_stock_threshold: number;
  created_at?: string;
  updated_at?: string;
}

export interface DbProductMedia {
  id: string;
  product_id: string;
  colour_id?: string;
  storage_path: string;
  alt_text?: string;
  media_type?: MediaType;
  sort_order?: number;
  is_primary?: boolean;
  created_at?: string;
}

export interface DbOrder {
  id: string;
  order_number?: string;
  customer_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  subtotal?: number;
  shipping_amount?: number;
  total?: number;
  currency?: string;
  payment_status?: string;
  order_status?: string;
  fulfilment_status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  variant_id?: string;
  product_name_snapshot: string;
  sku_snapshot: string;
  colour_snapshot: string;
  size_snapshot: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at?: string;
}

export interface DbOrderAddress {
  id: string;
  order_id: string;
  address_line1: string;
  address_line2?: string | null;
  suburb?: string | null;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  created_at?: string;
}

export interface DbCustomer {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  total_orders?: number;
  total_spent?: number;
  created_at?: string;
}
