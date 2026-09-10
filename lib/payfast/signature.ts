import crypto from 'crypto';

/**
 * PayFast Custom Integration Field Order
 * 
 * According to official PayFast Custom Integration guidelines:
 * - Do NOT alphabetically sort Custom Integration fields.
 * - Form field order MUST match the documented sequence.
 * - Empty fields are omitted from both payload and signature string.
 * - Passphrase is appended as &passphrase=... ONLY for signature calculation,
 *   and NEVER included as a submitted form field.
 */

export const PAYFAST_CUSTOM_INTEGRATION_FIELD_ORDER = [
  'merchant_id',
  'merchant_key',
  'return_url',
  'cancel_url',
  'notify_url',
  'name_first',
  'name_last',
  'email_address',
  'cell_number',
  'm_payment_id',
  'amount',
  'item_name',
  'item_description',
] as const;

export type PayFastCustomIntegrationField = typeof PAYFAST_CUSTOM_INTEGRATION_FIELD_ORDER[number];

/**
 * Encodes a value for PayFast signature strings according to official specification:
 * - trim values
 * - URL/form encode
 * - replace %20 with +
 */
export function payfastUrlEncode(val: string): string {
  return encodeURIComponent(val.trim()).replace(/%20/g, '+');
}

/**
 * Generates an MD5 signature for PayFast Custom Integration checkout payload.
 *
 * @param fields Record of field name to field string value
 * @param passphrase Optional secret passphrase (server-only)
 */
export function generatePayFastSignature(
  fields: Partial<Record<string, string>>,
  passphrase?: string
): string {
  // Construct parameter pairs following exact documented PayFast Custom Integration order
  const pairs: string[] = [];

  for (const field of PAYFAST_CUSTOM_INTEGRATION_FIELD_ORDER) {
    const rawVal = fields[field];
    if (rawVal !== undefined && rawVal !== null) {
      const trimmed = String(rawVal).trim();
      if (trimmed.length > 0) {
        pairs.push(`${field}=${payfastUrlEncode(trimmed)}`);
      }
    }
  }

  let paramString = pairs.join('&');

  // Append passphrase only if present and non-empty
  if (passphrase && passphrase.trim().length > 0) {
    paramString += `&passphrase=${payfastUrlEncode(passphrase.trim())}`;
  }

  return crypto.createHash('md5').update(paramString).digest('hex').toLowerCase();
}

/**
 * Verifies an ITN signature received from PayFast.
 * 
 * PayFast ITN requests provide parameters in a specific received sequence.
 * Per PayFast documentation, for ITN verification:
 * - Exclude the incoming 'signature' key.
 * - Reconstruct the parameter string in the exact received order (or iterate received entries).
 * - Append &passphrase=... if a passphrase is configured.
 * - Hash with MD5 and compare with timing-safe comparison.
 */
export function verifyPayFastItnSignature(
  receivedEntries: [string, string][],
  receivedSignature: string,
  passphrase?: string
): boolean {
  if (!receivedSignature) return false;

  const pairs: string[] = [];

  for (const [key, value] of receivedEntries) {
    if (key.toLowerCase() === 'signature') continue;
    if (value !== undefined && value !== null) {
      const trimmed = String(value).trim();
      pairs.push(`${key}=${payfastUrlEncode(trimmed)}`);
    }
  }

  let paramString = pairs.join('&');

  if (passphrase && passphrase.trim().length > 0) {
    paramString += `&passphrase=${payfastUrlEncode(passphrase.trim())}`;
  }

  const calculatedSignature = crypto.createHash('md5').update(paramString).digest('hex').toLowerCase();
  const normalizedIncoming = receivedSignature.trim().toLowerCase();

  if (calculatedSignature.length !== normalizedIncoming.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature, 'utf8'),
      Buffer.from(normalizedIncoming, 'utf8')
    );
  } catch {
    return false;
  }
}
