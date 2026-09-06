export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface ProductColour {
  id?: string;
  name: string;
  code: string;
  images?: string[];
}

export interface ProductMediaImage {
  id: string;
  url: string;
  role: 'main' | 'front' | 'back' | 'model' | 'gallery' | 'detail';
  isPrimary: boolean;
  alt?: string;
  file?: File;
  colourId?: string;
  colourName?: string;
}

export interface ProductVariant {
  id: string;
  colour: string;
  colourId?: string;
  size: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
  status: 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK';
  priceOverride?: number;
}

export interface VeritasDesignInfo {
  designName?: string;
  designNotes?: string;
  printPlacement?: string;
  printSize?: string;
}

export interface ProductItem {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description: string;
  
  price: number;
  compareAtPrice?: number;
  costPrice?: number; // PRIVATE — NOT VISIBLE TO CUSTOMERS
  profitPerUnit?: number; // Database generated column
  profitMargin?: number; // Database generated column
  currency: 'ZAR';
  
  category: string;
  collection: string;
  collectionId?: string;
  collectionIsActive?: boolean;
  drop?: string;
  tags: string[];
  
  status: ProductStatus;
  published: boolean; // Must be true + status === 'ACTIVE' to be publicly visible
  featured: boolean;
  
  images: ProductMediaImage[];
  image: string; // primary image convenience
  galleryImages: string[];
  
  colours: ProductColour[];
  sizes: string[];
  variants: ProductVariant[];
  
  designInfo?: VeritasDesignInfo;
  
  specifications?: string;
  newArrival?: boolean;
  active?: boolean;
  stockStatus?: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Pre-Order';
  sku: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  variantId?: string;
  product: string;
  color: string;
  size: string;
  quantity: number;
  lowStockThreshold: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

export interface OrderItemProduct {
  productId: string;
  name: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  currency: 'ZAR';
  designInfo: string;
  sku?: string;
  lineTotal?: number;
}

export interface OrderRecord {
  id: string;
  uuid?: string;
  date: string;
  createdAt?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    addressDetails?: any;
  };
  products: OrderItemProduct[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: 'ZAR' | string;
  paymentStatus: string;
  orderStatus?: string;
  fulfilmentStatus: string;
  shippingStatus: string;
  trackingNumber: string;
  rawItems?: any[];
}

export const dashboardStats = {
  todaySales: 0.00,
  sevenDaySales: 0.00,
  monthlySales: 0.00,
  ninetyDaySales: 0.00,
  yearSales: 0.00,
  totalSales: 0.00,
  totalOrders: 0,
  averageOrderValue: 0.00,
  pendingOrders: 0,
  products: 0,
  lowStockItems: 0,
  outOfStockItems: 0
};

export const salesChartData: { name: string; sales: number; orders: number }[] = [];

export const salesPeriodData: Record<'7D' | '30D' | '90D' | '1Y', { name: string; sales: number; orders: number }[]> = {
  '7D': [],
  '30D': [],
  '90D': [],
  '1Y': [],
};

export const mockOrders: OrderRecord[] = [];

export const mockProducts: ProductItem[] = [];

export const mockInventory: InventoryItem[] = [];

/**
 * Calculates stock status automatically based on quantity and threshold
 */
export function calculateStockStatus(quantity: number, threshold: number = 5): 'In Stock' | 'Low Stock' | 'Out of Stock' {
  if (quantity <= 0) return 'Out of Stock';
  if (quantity <= threshold) return 'Low Stock';
  return 'In Stock';
}

