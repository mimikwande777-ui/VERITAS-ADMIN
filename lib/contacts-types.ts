/**
 * VERITAS CUSTOMER CONTACTS & MARKETING TYPES
 */

export type ConsentSource = 
  | 'web_registration'
  | 'vip_modal'
  | 'checkout'
  | 'preference_center'
  | 'admin_manual'
  | 'store_concierge';

export type MarketingStatus = 'active' | 'unsubscribed' | 'suppressed' | 'pending';

export interface CustomerContact {
  id: string;
  phoneNumber: string;            // Normalized E.164 (e.g. +27821234567)
  rawPhoneNumber?: string;
  isWhatsApp: boolean;
  whatsAppNumber?: string;
  email?: string | null;
  firstName?: string;
  lastName?: string;

  // Granular Consents (Never true by default)
  emailMarketingConsent: boolean;
  whatsAppMarketingConsent: boolean;

  // Timestamps
  emailConsentUpdatedAt?: string | null;
  whatsAppConsentUpdatedAt?: string | null;
  emailUnsubscribedAt?: string | null;
  whatsAppUnsubscribedAt?: string | null;

  // Audit Evidence
  consentSource: ConsentSource;
  consentIpHash?: string;
  consentUserAgent?: string;

  // Status
  marketingStatus: MarketingStatus;
  suppressionReason?: string;
  preferenceToken: string;

  // External Provider Sync
  emailProviderSynced?: boolean;
  emailProviderId?: string;
  emailProviderSyncedAt?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface RegisterContactInput {
  phoneNumber: string;
  isWhatsApp: boolean;
  email?: string;
  firstName?: string;
  lastName?: string;
  emailMarketingConsent?: boolean;
  whatsAppMarketingConsent?: boolean;
  consentSource?: ConsentSource;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdatePreferencesInput {
  token?: string;
  phoneNumber?: string;
  emailMarketingConsent: boolean;
  whatsAppMarketingConsent: boolean;
  source?: ConsentSource;
}

export interface ContactFilterOptions {
  search?: string;
  emailConsent?: 'all' | 'opted_in' | 'opted_out';
  whatsAppConsent?: 'all' | 'opted_in' | 'opted_out';
  whatsAppAvailable?: 'all' | 'yes' | 'no';
  status?: 'all' | 'active' | 'unsubscribed' | 'suppressed';
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'phone_number' | 'email';
  sortOrder?: 'asc' | 'desc';
}

export interface ContactStatistics {
  totalContacts: number;
  emailSubscribersCount: number;
  emailOptInRate: number;        // Percentage 0-100
  whatsAppSubscribersCount: number;
  whatsAppOptInRate: number;      // Percentage 0-100
  bothChannelsOptedInCount: number;
  whatsAppAvailableCount: number;
  unsubscribedCount: number;
  suppressedCount: number;
  recentRegistrations7d: number;
}
