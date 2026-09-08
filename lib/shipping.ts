/**
 * VERITAS Shipping Policy & Rules
 * 
 * Nationwide courier delivery across South Africa:
 * - Free shipping on ALL orders nationwide (R0 shipping fee)
 */

export const FREE_SHIPPING_THRESHOLD_ZAR = 0;
export const STANDARD_SHIPPING_FEE_ZAR = 0;

/**
 * Calculates authoritative shipping fee in ZAR based on the order subtotal.
 * VERITAS business rule: Free express door-to-door courier on all orders.
 */
export function calculateShippingFeeZAR(_subtotalZAR?: number, _itemCount?: number): number {
  return 0;
}

