import React, { useState, useEffect } from 'react';
import { ProductItem, ProductVariant, ProductMediaImage, ProductColour, InventoryItem, calculateStockStatus } from './mock-data';
import { isSupabaseConfigured } from './supabase/config';
import { 
  fetchSupabaseProducts, 
  fetchSupabaseProductById, 
  fetchSupabaseProductBySlug,
  createSupabaseProduct,
  updateSupabaseProduct,
  archiveSupabaseProduct as archiveSupa,
  publishSupabaseProduct as publishSupa,
  unpublishSupabaseProduct as unpublishSupa,
  deleteSupabaseProduct as deleteSupa 
} from './supabase/products';

const STORAGE_KEY = 'veritas_products_store_v3';
const EVENT_NAME = 'veritas_products_updated';

// Helper to check if we are in browser environment
const isBrowser = typeof window !== 'undefined';

/**
 * React hook to safely subscribe to products from Supabase (or Local Sandbox fallback)
 */
export function useProductsStore(): ProductItem[] {
  const [products, setProducts] = useState<ProductItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    const sync = async () => {
      if (isSupabaseConfigured()) {
        const supaProducts = await fetchSupabaseProducts();
        if (isMounted) {
          setProducts(supaProducts || []);
          return;
        }
      }
      if (isMounted) {
        setProducts(getStoredProducts([]));
      }
    };

    queueMicrotask(sync);

    const handleEvent = () => sync();
    window.addEventListener(EVENT_NAME, handleEvent);
    return () => {
      isMounted = false;
      window.removeEventListener(EVENT_NAME, handleEvent);
    };
  }, []);

  return products;
}

/**
 * Synchronous local browser storage fallback reader
 */
export function getStoredProducts(fallback: ProductItem[] = []): ProductItem[] {
  if (isSupabaseConfigured()) {
    // When Supabase is configured, do NOT read from localStorage
    return [];
  }
  if (!isBrowser) return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return fallback;
  } catch (err) {
    console.error('Error reading products from localStorage:', err);
    return fallback;
  }
}

/**
 * Persists products to local sandbox storage when unconfigured
 */
export function persistProducts(products: ProductItem[]): void {
  if (isSupabaseConfigured()) {
    // Single source of truth is Supabase - do not write to localStorage
    if (isBrowser) {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: products }));
    }
    return;
  }

  if (!isBrowser) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: products }));
  } catch (err) {
    console.warn('LocalStorage save limit reached:', err);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: products }));
  }
}

/**
 * Canonical check for whether a product is visible to public customers:
 * 1. Product status must be ACTIVE
 * 2. Product must be explicitly published (published === true)
 * 3. Associated collection must be active (collectionIsActive !== false)
 */
export function isProductPubliclyVisible(p: ProductItem | null | undefined): boolean {
  if (!p) return false;
  const isStatusActive = (p.status || '').toUpperCase() === 'ACTIVE';
  const isPublished = p.published === true;
  const isCollectionActive = p.collectionIsActive !== false;
  return isStatusActive && isPublished && isCollectionActive;
}

/**
 * Centralized Service Layer: Fetch All Products
 */
export function getProducts(): ProductItem[] {
  return getStoredProducts([]);
}

/**
 * Centralized Service Layer: Fetch Product by ID (Async, Supabase-aware)
 */
export async function fetchProductById(idOrSlug: string): Promise<ProductItem | null> {
  if (!idOrSlug || idOrSlug === 'new') return null;
  if (isSupabaseConfigured()) {
    const supaProd = await fetchSupabaseProductById(idOrSlug);
    if (supaProd) return supaProd;
  }
  return getProductById(idOrSlug);
}

/**
 * Centralized Service Layer: Fetch Product by Slug (Async, Supabase-aware)
 */
export async function fetchProductBySlug(slug: string): Promise<ProductItem | null> {
  if (!slug || slug === 'new') return null;
  if (isSupabaseConfigured()) {
    const supaProd = await fetchSupabaseProductBySlug(slug);
    if (supaProd) return supaProd;
  }
  return getProductBySlug(slug);
}

/**
 * Centralized Service Layer: Fetch Product by ID (Sync fallback)
 */
export function getProductById(idOrSlug: string): ProductItem | null {
  if (!idOrSlug || idOrSlug === 'new') return null;
  const products = getStoredProducts([]);
  return products.find(p => p.id === idOrSlug || p.slug === idOrSlug) || null;
}

/**
 * Centralized Service Layer: Fetch Product by Slug (Sync fallback)
 */
export function getProductBySlug(slug: string): ProductItem | null {
  if (!slug || slug === 'new') return null;
  const products = getStoredProducts([]);
  return products.find(p => p.slug === slug || p.id === slug) || null;
}

/**
 * Centralized Service Layer: Create Product
 */
export function createProduct(data: Partial<ProductItem>): ProductItem {
  const products = getStoredProducts([]);
  const id = data.id || generateUniqueProductId(products);
  const name = data.name || 'Untitled Product';
  const slug = data.slug || generateSlug(name) || `product-${id.toLowerCase()}`;

  const newProduct: ProductItem = {
    id,
    name,
    slug,
    sku: data.sku || `VRT-${id}`,
    shortDescription: data.shortDescription,
    description: data.description || `${name} by VERITAS.`,
    price: Number(data.price) || 0,
    compareAtPrice: data.compareAtPrice ? Number(data.compareAtPrice) : undefined,
    costPrice: data.costPrice ? Number(data.costPrice) : undefined,
    currency: 'ZAR',
    category: data.category || 'T-Shirts',
    collection: data.collection || 'DROP 001',
    drop: data.drop || 'DROP 001',
    tags: data.tags && data.tags.length > 0 ? data.tags : ['VERITAS'],
    status: data.status || 'DRAFT',
    published: data.published ?? false,
    featured: data.featured ?? false,
    newArrival: data.newArrival ?? false,
    active: data.status === 'ACTIVE' && (data.published ?? false),
    stockStatus: data.stockStatus || 'In Stock',
    image: data.image || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
    galleryImages: data.galleryImages || [],
    images: data.images || [],
    colours: data.colours || [{ name: 'Black', code: '#0A0A0A' }],
    sizes: data.sizes || ['S', 'M', 'L', 'XL'],
    variants: data.variants || [],
    designInfo: data.designInfo || {},
    specifications: data.specifications || '',
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
  };

  // If Supabase is configured, trigger asynchronous creation to Supabase
  if (isSupabaseConfigured()) {
    createSupabaseProduct(newProduct).then(() => {
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    });
  }

  const updatedList = [newProduct, ...products];
  persistProducts(updatedList);
  return newProduct;
}

/**
 * Centralized Service Layer: Update Product
 */
export function updateProduct(id: string, data: Partial<ProductItem>): ProductItem | null {
  const products = getStoredProducts([]);
  const index = products.findIndex(p => p.id === id || p.slug === id);
  
  if (isSupabaseConfigured()) {
    updateSupabaseProduct(id, data).then(() => {
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    });
  }

  if (index === -1) {
    if (data.id && data.name) {
      return createProduct(data);
    }
    return null;
  }

  const current = products[index];
  const updatedProduct: ProductItem = {
    ...current,
    ...data,
    id: current.id,
    active: (data.status ? data.status === 'ACTIVE' : current.status === 'ACTIVE') && (data.published !== undefined ? data.published : current.published),
    updatedAt: new Date().toISOString().split('T')[0],
  };

  const updatedList = [...products];
  updatedList[index] = updatedProduct;
  persistProducts(updatedList);
  return updatedProduct;
}

/**
 * Centralized Service Layer: Publish Product
 */
export function publishProduct(id: string): ProductItem | null {
  if (isSupabaseConfigured()) {
    publishSupa(id).then(() => {
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    });
  }
  return updateProduct(id, {
    status: 'ACTIVE',
    published: true,
    active: true,
  });
}

/**
 * Centralized Service Layer: Unpublish Product
 */
export function unpublishProduct(id: string): ProductItem | null {
  if (isSupabaseConfigured()) {
    unpublishSupa(id).then(() => {
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    });
  }
  return updateProduct(id, {
    published: false,
    active: false,
  });
}

/**
 * Centralized Service Layer: Archive Product
 */
export function archiveProduct(id: string): ProductItem | null {
  if (isSupabaseConfigured()) {
    archiveSupa(id).then(() => {
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    });
  }
  return updateProduct(id, {
    status: 'ARCHIVED',
    published: false,
    active: false,
  });
}

/**
 * Centralized Service Layer: Delete Product
 */
export function deleteProduct(id: string): boolean {
  if (isSupabaseConfigured()) {
    deleteSupa(id).then(() => {
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    });
  }
  const products = getStoredProducts([]);
  const nextList = products.filter(p => p.id !== id && p.slug !== id);
  if (nextList.length === products.length) return false;
  persistProducts(nextList);
  return true;
}

/**
 * Convert real products & variants into InventoryItem list
 */
export function getInventoryFromProducts(products: ProductItem[]): InventoryItem[] {
  const list: InventoryItem[] = [];
  if (!products || products.length === 0) return list;

  for (const product of products) {
    if (!product.variants || product.variants.length === 0) continue;
    for (const v of product.variants) {
      list.push({
        id: `INV-${v.sku || v.id}`,
        productId: product.id,
        variantId: v.id,
        product: product.name,
        color: v.colour,
        size: v.size,
        quantity: Number(v.stockQuantity) || 0,
        lowStockThreshold: Number(v.lowStockThreshold) || 5,
        status: calculateStockStatus(Number(v.stockQuantity) || 0, Number(v.lowStockThreshold) || 5),
      });
    }
  }
  return list;
}

/**
 * Calculate total stock and summary status across all variants of a product
 */
export function calculateProductTotalStock(variants: ProductVariant[] = []): {
  totalQuantity: number;
  overallStatus: 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK';
  inStockVariantCount: number;
  lowStockVariantCount: number;
  outOfStockVariantCount: number;
} {
  if (!variants || variants.length === 0) {
    return {
      totalQuantity: 0,
      overallStatus: 'OUT OF STOCK',
      inStockVariantCount: 0,
      lowStockVariantCount: 0,
      outOfStockVariantCount: 0,
    };
  }

  let totalQuantity = 0;
  let inStockVariantCount = 0;
  let lowStockVariantCount = 0;
  let outOfStockVariantCount = 0;

  for (const v of variants) {
    const qty = Number(v.stockQuantity) || 0;
    const threshold = Number(v.lowStockThreshold) || 5;
    totalQuantity += qty;
    
    if (qty <= 0) {
      outOfStockVariantCount++;
    } else if (qty <= threshold) {
      lowStockVariantCount++;
    } else {
      inStockVariantCount++;
    }
  }

  let overallStatus: 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK' = 'IN STOCK';
  if (totalQuantity <= 0) {
    overallStatus = 'OUT OF STOCK';
  } else if (lowStockVariantCount > 0 || totalQuantity < 15) {
    overallStatus = 'LOW STOCK';
  }

  return {
    totalQuantity,
    overallStatus,
    inStockVariantCount,
    lowStockVariantCount,
    outOfStockVariantCount,
  };
}

/**
 * Profit margin calculator
 */
export function calculateProfitMetrics(sellingPrice: number, costPrice?: number): {
  profitPerUnit: number;
  profitMarginPercent: number;
  markupPercent: number;
} {
  const price = Number(sellingPrice) || 0;
  const cost = Number(costPrice) || 0;
  
  if (price <= 0) {
    return { profitPerUnit: 0, profitMarginPercent: 0, markupPercent: 0 };
  }

  if (cost <= 0) {
    return { profitPerUnit: price, profitMarginPercent: 100, markupPercent: 100 };
  }

  const profitPerUnit = price - cost;
  const profitMarginPercent = (profitPerUnit / price) * 100;
  const markupPercent = (profitPerUnit / cost) * 100;

  return {
    profitPerUnit: Math.round(profitPerUnit * 100) / 100,
    profitMarginPercent: Math.round(profitMarginPercent * 10) / 10,
    markupPercent: Math.round(markupPercent * 10) / 10,
  };
}

/**
 * Slug generator
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * SKU Generator for variants
 */
export function generateVariantSku(productName: string, colour: string, size: string): string {
  const cleanName = productName
    .replace(/^(THE|A|AN)\s+/i, '')
    .split(' ')
    .slice(0, 2)
    .join('')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase() || 'VRT';
  
  const cleanColor = colour
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase() || 'BLK';
  
  const cleanSize = size.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'M';

  return `VRT-${cleanName}-${cleanColor}-${cleanSize}`;
}

/**
 * Deterministic counter-based ID generator
 */
let deterministicCounter = 100;
export function generateDeterministicId(prefix = 'vrt'): string {
  deterministicCounter += 1;
  return `${prefix}-${deterministicCounter}`;
}

/**
 * Generate a guaranteed unique product ID (e.g., PRD-101, PRD-102)
 */
export function generateUniqueProductId(existingProducts: ProductItem[] = []): string {
  let highestNum = 100;
  for (const p of existingProducts) {
    if (p.id && p.id.startsWith('PRD-')) {
      const numStr = p.id.replace('PRD-', '');
      const parsed = parseInt(numStr, 10);
      if (!isNaN(parsed) && parsed > highestNum) {
        highestNum = parsed;
      }
    }
  }
  return `PRD-${highestNum + 1}`;
}
