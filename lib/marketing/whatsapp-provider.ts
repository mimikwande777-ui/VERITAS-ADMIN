/**
 * VERITAS WHATSAPP MARKETING & SUPPRESSION ENGINE
 * 
 * Manages explicit WhatsApp opt-in state, promotional broadcast eligibility,
 * incoming keyword unsubscription ("STOP", "UNSUBSCRIBE"), and suppression list enforcement.
 * 
 * Guarantees:
 * 1. WhatsApp marketing consent is kept strictly separate from email consent.
 * 2. Unsubscribing from WhatsApp NEVER touches email consent.
 * 3. Never sends promotional messages to contacts without explicit WhatsApp opt-in.
 */

export interface WhatsAppBroadcastTarget {
  phoneNumber: string;       // Normalized E.164 (+27821234567)
  isWhatsApp: boolean;
  whatsAppMarketingConsent: boolean;
  marketingStatus: string;
}

export interface WhatsAppUnsubscribeResult {
  unsubscribed: boolean;
  phoneNumber: string;
  keywordMatched?: string;
  source: 'incoming_keyword' | 'preference_center' | 'admin_action';
  message: string;
}

const STOP_KEYWORDS = new Set([
  'stop',
  'unsubscribe',
  'optout',
  'opt out',
  'cancel',
  'halt',
  'end',
  'quit'
]);

/**
 * Checks whether an incoming message text represents an explicit unsubscription request
 */
export function isWhatsAppUnsubscribeKeyword(messageText?: string | null): boolean {
  if (!messageText || typeof messageText !== 'string') return false;
  const clean = messageText.trim().toLowerCase();
  return STOP_KEYWORDS.has(clean);
}

/**
 * Validates whether a contact is strictly eligible to receive a WhatsApp promotional alert
 */
export function canReceiveWhatsAppPromotionalMessage(contact: WhatsAppBroadcastTarget): {
  eligible: boolean;
  reason?: string;
} {
  if (!contact.isWhatsApp) {
    return {
      eligible: false,
      reason: 'Contact phone number is not registered as active on WhatsApp.'
    };
  }

  if (!contact.whatsAppMarketingConsent) {
    return {
      eligible: false,
      reason: 'Contact has not granted explicit opt-in consent for WhatsApp marketing.'
    };
  }

  if (contact.marketingStatus === 'unsubscribed' || contact.marketingStatus === 'suppressed') {
    return {
      eligible: false,
      reason: `Contact is currently in '${contact.marketingStatus}' status on suppression list.`
    };
  }

  return { eligible: true };
}
