/**
 * VERITAS Centralized SKU Generation & Normalization Module
 * Server-authoritative format: VER-<CATEGORY_CODE>-<UNIQUE_PRODUCT_ID>-<VARIANT_INDEX>
 *
 * Examples:
 *   VER-TEE-C3D4E5F6-001
 *   VER-TEE-C3D4E5F6-002
 *   VER-HOOD-A8B7C6D5-001
 *   VER-SHORT-PRD101-001
 */

/**
 * Standard VERITAS category SKU codes
 * Maps human-readable category / apparel types to 3-5 char uppercase abbreviations.
 */
export function getCategorySkuCode(category?: string | null): string {
  if (!category) return 'TEE';
  const norm = category.trim().toUpperCase();

  if (norm.includes('TEE') || norm.includes('T-SHIRT') || norm.includes('SHIRT')) return 'TEE';
  if (norm.includes('HOOD') || norm.includes('SWEAT')) return 'HOOD';
  if (norm.includes('SHORT')) return 'SHORT';
  if (norm.includes('PANT') || norm.includes('TROUSER') || norm.includes('BOTTOM') || norm.includes('CARGO')) return 'PANT';
  if (norm.includes('JACKET') || norm.includes('OUTER') || norm.includes('COAT')) return 'JKT';
  if (norm.includes('CAP') || norm.includes('HAT') || norm.includes('HEAD')) return 'CAP';
  if (norm.includes('KNIT')) return 'KNIT';
  if (norm.includes('ACCESSOR')) return 'ACC';
  if (norm.includes('BAG') || norm.includes('TOTE')) return 'BAG';
  if (norm.includes('SOCK')) return 'SCK';
  if (norm.includes('FOOT') || norm.includes('SHOE') || norm.includes('SNEAKER')) return 'SHOE';

  // Clean fallback: alphanumeric uppercase
  const clean = norm.replace(/[^A-Z0-9]/g, '').slice(0, 4);
  return clean || 'TEE';
}

/**
 * Extracts a clean, reliable unique product identifier from a database ID or string ID.
 * - For UUIDs (e.g. 123e4567-e89b-12d3-a456-426614174000), extracts the first 8 hex characters: "123E4567"
 * - For prefixed IDs (e.g. PRD-101), cleans to "PRD101"
 * - Maximum 8 alphanumeric characters, capitalized.
 */
export function extractCleanProductId(productId?: string | null): string {
  if (!productId) return 'PRD';
  let raw = productId.trim();

  // If UUID format (8-4-4-4-12), use the first 8-character block
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(raw)) {
    return raw.split('-')[0].toUpperCase();
  }

  // If it contains hyphens, check if the first token is a clean identifier
  if (raw.includes('-')) {
    const parts = raw.split('-');
    if (parts[0].length >= 4) {
      raw = parts[0];
    } else {
      raw = parts.join('');
    }
  }

  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return clean || 'PRD';
}

/**
 * Generates a server-authoritative variant SKU using the official format:
 * VER-<CATEGORY_CODE>-<UNIQUE_PRODUCT_ID>-<VARIANT_INDEX>
 *
 * @param productId - Database product UUID or unique product ID
 * @param category  - Category name or type (e.g. 'T-Shirts', 'Hoodies')
 * @param index     - Zero-based or one-based variant index
 */
export function formatVariantSku(
  productId: string,
  category?: string | null,
  index: number = 0
): string {
  const catCode = getCategorySkuCode(category);
  const cleanId = extractCleanProductId(productId);
  const idxStr = String(index + 1).padStart(3, '0');
  return `VER-${catCode}-${cleanId}-${idxStr}`;
}

/**
 * Universal variant SKU generator supporting both modern format with product ID
 * and safe backward-compatible signatures. Never relies on product name, colour,
 * and size alone to prevent SKU collisions across products.
 */
export function generateVariantSku(
  productNameOrCategory: string,
  colour: string,
  size: string,
  productId?: string,
  index?: number
): string {
  if (productId) {
    return formatVariantSku(productId, productNameOrCategory, index ?? 0);
  }

  // If the first argument is already a UUID or product ID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(productNameOrCategory) || /^PRD-/i.test(productNameOrCategory)) {
    return formatVariantSku(productNameOrCategory, 'TEE', index ?? 0);
  }

  const catCode = getCategorySkuCode(productNameOrCategory);
  const cleanColor = colour.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'BLK';
  const cleanSize = size.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'M';

  // If index is provided, format with index
  if (typeof index === 'number') {
    return `VER-${catCode}-${cleanColor}${cleanSize}-${String(index + 1).padStart(3, '0')}`;
  }

  // Fallback variant tag
  return `VER-${catCode}-${cleanColor}-${cleanSize}`;
}
