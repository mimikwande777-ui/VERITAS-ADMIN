/**
 * VERITAS CUSTOMER DATA PRIVACY & MASKING ENGINE
 * 
 * Enforces role-based data protection:
 * - Super Admin: Unmasked full data access
 * - Operations: Delivery address and contact details revealed ONLY where required for order fulfilment
 * - Marketing / Finance / Others: Strict PII masking (emails, phone numbers, delivery addresses)
 */

export function maskEmail(email?: string | null): string {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) return '***@***.***';

  const localPart = trimmed.substring(0, atIndex);
  const domainPart = trimmed.substring(atIndex + 1);

  if (localPart.length <= 2) {
    return `${localPart.charAt(0)}***@${domainPart}`;
  }

  const visiblePrefix = localPart.substring(0, 2);
  return `${visiblePrefix}***@${domainPart}`;
}

export function maskPhone(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return '';
  const clean = phone.trim().replace(/[\s\-()]/g, '');
  if (clean.length < 5) return '***-***';

  const prefix = clean.substring(0, 2);
  const suffix = clean.substring(clean.length - 3);
  return `${prefix}*****${suffix}`;
}

export function maskAddress(address?: string | null): string {
  if (!address || typeof address !== 'string') return '';
  // Mask full street address, only disclose general region indicator if present
  return '[Redacted for Privacy]';
}

export interface CustomerProfileData {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  orderCount?: number;
  totalSpend?: number;
  lastOrderDate?: string;
}

export function sanitizeCustomerForRole<T extends Record<string, any>>(
  customer: T,
  canViewSensitive: boolean,
  isFulfilmentContext: boolean = false
): T {
  if (canViewSensitive || isFulfilmentContext) {
    return customer;
  }

  const sanitized: any = { ...customer };

  if ('email' in sanitized && sanitized.email) {
    sanitized.email = maskEmail(sanitized.email);
  }

  if ('phone' in sanitized && sanitized.phone) {
    sanitized.phone = maskPhone(sanitized.phone);
  }

  if ('address' in sanitized && sanitized.address) {
    sanitized.address = maskAddress(sanitized.address);
  }

  if ('streetAddress' in sanitized && sanitized.streetAddress) {
    sanitized.streetAddress = maskAddress(sanitized.streetAddress);
  }

  if ('customer' in sanitized && sanitized.customer && typeof sanitized.customer === 'object') {
    sanitized.customer = {
      ...sanitized.customer,
      email: sanitized.customer.email ? maskEmail(sanitized.customer.email) : undefined,
      phone: sanitized.customer.phone ? maskPhone(sanitized.customer.phone) : undefined,
    };
  }

  if ('shippingAddress' in sanitized && sanitized.shippingAddress && typeof sanitized.shippingAddress === 'object') {
    sanitized.shippingAddress = {
      ...sanitized.shippingAddress,
      address1: maskAddress(sanitized.shippingAddress.address1),
      address2: sanitized.shippingAddress.address2 ? maskAddress(sanitized.shippingAddress.address2) : undefined,
      phone: sanitized.shippingAddress.phone ? maskPhone(sanitized.shippingAddress.phone) : undefined,
    };
  }

  return sanitized;
}
