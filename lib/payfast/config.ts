/**
 * Server-Only PayFast Configuration
 * 
 * CRITICAL SECURITY:
 * - This module is STRICTLY server-side. Never import into client components.
 * - Never prefix PayFast variables with NEXT_PUBLIC_.
 * - All PayFast secrets are kept in server environment variables.
 * - Mode is sandbox by default. Live mode is not activated yet.
 */

export interface PayFastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase?: string;
  mode: 'sandbox' | 'live';
  processUrl: string;
  validateUrl: string;
  host: string;
}

/**
 * Lazily loads and validates server-only PayFast configuration.
 * Returns default sandbox endpoints without throwing at build time.
 */
export function getPayFastServerConfig(): PayFastConfig {
  // Ensure we are in a server runtime
  if (typeof window !== 'undefined') {
    throw new Error('PayFast configuration cannot be accessed in the browser.');
  }

  const merchantId = process.env.PAYFAST_MERCHANT_ID || '';
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY || '';
  const passphrase = process.env.PAYFAST_PASSPHRASE || '';
  
  // PayFast mode defaults strictly to sandbox until live mode is explicitly activated in future phases
  const rawMode = (process.env.PAYFAST_MODE || '').toLowerCase().trim();
  const mode: 'sandbox' | 'live' = rawMode === 'live' ? 'live' : 'sandbox';

  const host = mode === 'live' ? 'www.payfast.co.za' : 'sandbox.payfast.co.za';
  const processUrl = `https://${host}/eng/process`;
  const validateUrl = `https://${host}/eng/query/validate`;

  return {
    merchantId,
    merchantKey,
    passphrase: passphrase || undefined,
    mode,
    processUrl,
    validateUrl,
    host,
  };
}

/**
 * Helper to verify whether required PayFast credentials exist in server environment.
 */
export function isPayFastConfigured(): boolean {
  try {
    const config = getPayFastServerConfig();
    return Boolean(config.merchantId && config.merchantKey);
  } catch {
    return false;
  }
}
