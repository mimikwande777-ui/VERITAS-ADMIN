/**
 * VERITAS PHONE NUMBER VALIDATION & NORMALIZATION UTILITY
 * 
 * Standardizes customer phone numbers to E.164 international format
 * Supports South Africa (+27) local conventions (082, 071, 060, etc.)
 * and global international prefixes (+1, +44, etc.).
 */

export interface PhoneValidationResult {
  isValid: boolean;
  e164: string;           // Normalized international standard: +27821234567
  formatted: string;      // Human-readable: +27 82 123 4567
  countryCode: string;    // 'ZA', 'US', 'GB', 'OTHER'
  error?: string;
}

/**
 * Normalizes and validates any incoming phone number
 */
export function normalizePhoneNumber(rawInput?: string | null): PhoneValidationResult {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      isValid: false,
      e164: '',
      formatted: '',
      countryCode: 'UNKNOWN',
      error: 'Phone number is required.'
    };
  }

  const trimmed = rawInput.trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      e164: '',
      formatted: '',
      countryCode: 'UNKNOWN',
      error: 'Phone number cannot be empty.'
    };
  }

  // Remove whitespace, dashes, dots, brackets
  let cleaned = trimmed.replace(/[\s\-\.\(\)]/g, '');

  // Handle South African international prefix without plus: 27821234567 -> +27821234567
  if (cleaned.startsWith('27') && cleaned.length === 11 && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  // Handle South African local format: 082 123 4567 (10 digits starting with 0) -> +27821234567
  else if (cleaned.startsWith('0') && cleaned.length === 10 && !cleaned.startsWith('+')) {
    cleaned = '+27' + cleaned.substring(1);
  }
  // Handle local 9 digits without leading zero: 821234567 -> +27821234567
  else if (/^[678][0-9]{8}$/.test(cleaned) && !cleaned.startsWith('+')) {
    cleaned = '+27' + cleaned;
  }
  // Ensure plus prefix for international numbers
  else if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  // E.164 regex: + followed by 1 to 3 digit country code and 7 to 14 subscriber digits (max 15 total digits)
  const e164Regex = /^\+[1-9]\d{7,14}$/;

  if (!e164Regex.test(cleaned)) {
    return {
      isValid: false,
      e164: '',
      formatted: trimmed,
      countryCode: 'UNKNOWN',
      error: 'Please enter a valid phone number (e.g. 082 123 4567 or +27 82 123 4567).'
    };
  }

  // Identify Country and format nicely
  let countryCode = 'OTHER';
  let formatted = cleaned;

  if (cleaned.startsWith('+27')) {
    countryCode = 'ZA';
    // +27821234567 -> +27 82 123 4567
    const rest = cleaned.substring(3);
    if (rest.length === 9) {
      formatted = `+27 ${rest.substring(0, 2)} ${rest.substring(2, 5)} ${rest.substring(5)}`;
    }
  } else if (cleaned.startsWith('+1')) {
    countryCode = 'US';
    const rest = cleaned.substring(2);
    if (rest.length === 10) {
      formatted = `+1 (${rest.substring(0, 3)}) ${rest.substring(3, 6)}-${rest.substring(6)}`;
    }
  } else if (cleaned.startsWith('+44')) {
    countryCode = 'GB';
  }

  return {
    isValid: true,
    e164: cleaned,
    formatted,
    countryCode
  };
}

/**
 * Generates direct WhatsApp chat URL for a normalized E.164 phone number
 */
export function getWhatsAppChatUrl(phoneNumber: string, message?: string): string {
  const digitsOnly = phoneNumber.replace(/[^0-9]/g, '');
  const baseUrl = `https://wa.me/${digitsOnly}`;
  if (message) {
    return `${baseUrl}?text=${encodeURIComponent(message)}`;
  }
  return baseUrl;
}

/**
 * Validates an optional email address
 */
export function validateEmail(email?: string | null): { isValid: boolean; normalized?: string; error?: string } {
  if (!email || !email.trim()) {
    return { isValid: true, normalized: undefined }; // Email is optional
  }

  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (!emailRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Please provide a valid email address or leave it blank.'
    };
  }

  return {
    isValid: true,
    normalized: trimmed
  };
}
