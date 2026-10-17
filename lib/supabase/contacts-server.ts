import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { 
  CustomerContact, 
  RegisterContactInput, 
  UpdatePreferencesInput, 
  ContactFilterOptions, 
  ContactStatistics 
} from '../contacts-types';
import { normalizePhoneNumber, validateEmail } from '../phone-utils';
import { emailMarketingProvider } from '../marketing/email-provider';

// In-memory/file fallback buffer for seamless operation
const FALLBACK_DIR = path.join(process.cwd(), '.data');
const FALLBACK_FILE = path.join(FALLBACK_DIR, 'customer_contacts.json');

function readFallbackContacts(): CustomerContact[] {
  try {
    if (!fs.existsSync(FALLBACK_DIR)) {
      fs.mkdirSync(FALLBACK_DIR, { recursive: true });
    }
    if (!fs.existsSync(FALLBACK_FILE)) {
      fs.writeFileSync(FALLBACK_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(FALLBACK_FILE, 'utf-8');
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

function writeFallbackContacts(contacts: CustomerContact[]): void {
  try {
    if (!fs.existsSync(FALLBACK_DIR)) {
      fs.mkdirSync(FALLBACK_DIR, { recursive: true });
    }
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(contacts, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write fallback contacts:', err);
  }
}

function mapDbRowToCustomerContact(row: any): CustomerContact {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    rawPhoneNumber: row.raw_phone_number || row.phone_number,
    isWhatsApp: Boolean(row.is_whatsapp),
    whatsAppNumber: row.whatsapp_number || undefined,
    email: row.email || null,
    firstName: row.first_name || undefined,
    lastName: row.last_name || undefined,
    emailMarketingConsent: Boolean(row.email_marketing_consent),
    whatsAppMarketingConsent: Boolean(row.whatsapp_marketing_consent),
    emailConsentUpdatedAt: row.email_consent_updated_at || null,
    whatsAppConsentUpdatedAt: row.whatsapp_consent_updated_at || null,
    emailUnsubscribedAt: row.email_unsubscribed_at || null,
    whatsAppUnsubscribedAt: row.whatsapp_unsubscribed_at || null,
    consentSource: row.consent_source || 'web_registration',
    consentIpHash: row.consent_ip_hash || undefined,
    consentUserAgent: row.consent_user_agent || undefined,
    marketingStatus: row.marketing_status || 'active',
    suppressionReason: row.suppression_reason || undefined,
    preferenceToken: row.preference_token,
    emailProviderSynced: Boolean(row.email_provider_synced),
    emailProviderId: row.email_provider_id || undefined,
    emailProviderSyncedAt: row.email_provider_synced_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Register or update a customer contact with strict phone requirement,
 * optional email, and separate, unselected-by-default marketing consents.
 */
export async function serverRegisterContact(
  input: RegisterContactInput,
  client?: SupabaseClient | null
): Promise<{ contact: CustomerContact | null; isExisting: boolean; error: string | null }> {
  // 1. Phone number is REQUIRED: validate & normalize to E.164
  const phoneRes = normalizePhoneNumber(input.phoneNumber);
  if (!phoneRes.isValid) {
    return { contact: null, isExisting: false, error: phoneRes.error || 'Invalid phone number format.' };
  }

  // 2. Email is OPTIONAL: validate only if provided
  const emailRes = validateEmail(input.email);
  if (!emailRes.isValid) {
    return { contact: null, isExisting: false, error: emailRes.error || 'Invalid email address.' };
  }

  const normalizedPhone = phoneRes.e164;
  const normalizedEmail = emailRes.normalized || null;
  const nowIso = new Date().toISOString();

  // Create anonymized IP hash for privacy-preserving POPIA compliance audit
  const ipHash = input.ipAddress 
    ? crypto.createHash('sha256').update(input.ipAddress).digest('hex').substring(0, 16)
    : undefined;

  // 3. Try Supabase Postgres persistence first
  if (client) {
    try {
      // Check if contact already exists by phone_number
      const { data: existing, error: findErr } = await client
        .from('customer_contacts')
        .select('*')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

      if (!findErr && existing) {
        // Idempotent Update on existing contact
        const patch: any = {
          raw_phone_number: input.phoneNumber,
          is_whatsapp: Boolean(input.isWhatsApp),
          whatsapp_number: input.isWhatsApp ? normalizedPhone : null,
          updated_at: nowIso,
        };

        if (normalizedEmail) {
          patch.email = normalizedEmail;
        }
        if (input.firstName) {
          patch.first_name = input.firstName;
        }
        if (input.lastName) {
          patch.last_name = input.lastName;
        }

        // Only update consent if explicitly provided
        if (input.emailMarketingConsent !== undefined) {
          patch.email_marketing_consent = Boolean(input.emailMarketingConsent);
          if (input.emailMarketingConsent) {
            patch.email_consent_updated_at = nowIso;
            patch.email_unsubscribed_at = null;
          }
        }
        if (input.whatsAppMarketingConsent !== undefined) {
          patch.whatsapp_marketing_consent = Boolean(input.whatsAppMarketingConsent);
          if (input.whatsAppMarketingConsent) {
            patch.whatsapp_consent_updated_at = nowIso;
            patch.whatsapp_unsubscribed_at = null;
          }
        }

        const { data: updatedRow, error: updErr } = await client
          .from('customer_contacts')
          .update(patch)
          .eq('id', existing.id)
          .select()
          .single();

        if (updErr) {
          console.error('Supabase contact update error:', updErr);
        } else if (updatedRow) {
          const contact = mapDbRowToCustomerContact(updatedRow);

          // Trigger email marketing provider sync if email consent was granted
          if (contact.email && contact.emailMarketingConsent) {
            void emailMarketingProvider.syncContact({
              email: contact.email,
              phone: contact.phoneNumber,
              firstName: contact.firstName,
              consented: true,
              consentSource: contact.consentSource,
              preferenceToken: contact.preferenceToken
            });
          }

          return { contact, isExisting: true, error: null };
        }
      } else if (!findErr && !existing) {
        // Insert brand new contact record
        const newToken = crypto.randomUUID();
        const insertPayload: any = {
          phone_number: normalizedPhone,
          raw_phone_number: input.phoneNumber,
          is_whatsapp: Boolean(input.isWhatsApp),
          whatsapp_number: input.isWhatsApp ? normalizedPhone : null,
          email: normalizedEmail,
          first_name: input.firstName || null,
          last_name: input.lastName || null,
          // Consents are NEVER true by default
          email_marketing_consent: Boolean(input.emailMarketingConsent),
          whatsapp_marketing_consent: Boolean(input.whatsAppMarketingConsent),
          email_consent_updated_at: input.emailMarketingConsent ? nowIso : null,
          whatsapp_consent_updated_at: input.whatsAppMarketingConsent ? nowIso : null,
          consent_source: input.consentSource || 'web_registration',
          consent_ip_hash: ipHash,
          consent_user_agent: input.userAgent || null,
          marketing_status: 'active',
          preference_token: newToken,
          created_at: nowIso,
          updated_at: nowIso,
        };

        const { data: insertedRow, error: insErr } = await client
          .from('customer_contacts')
          .insert(insertPayload)
          .select()
          .single();

        if (insErr) {
          console.error('Supabase contact insert error:', insErr);
        } else if (insertedRow) {
          const contact = mapDbRowToCustomerContact(insertedRow);

          // Trigger email marketing provider sync if email consent was granted
          if (contact.email && contact.emailMarketingConsent) {
            void emailMarketingProvider.syncContact({
              email: contact.email,
              phone: contact.phoneNumber,
              firstName: contact.firstName,
              consented: true,
              consentSource: contact.consentSource,
              preferenceToken: contact.preferenceToken
            });
          }

          return { contact, isExisting: false, error: null };
        }
      }
    } catch (err: any) {
      console.warn('Supabase contact registration exception, using fallback storage:', err?.message);
    }
  }

  // 4. Resilient Fallback Storage (if database table is pending migration or unconfigured)
  const contacts = readFallbackContacts();
  const existingIndex = contacts.findIndex(c => c.phoneNumber === normalizedPhone);

  if (existingIndex >= 0) {
    const existing = contacts[existingIndex];
    const updated: CustomerContact = {
      ...existing,
      rawPhoneNumber: input.phoneNumber,
      isWhatsApp: Boolean(input.isWhatsApp),
      whatsAppNumber: input.isWhatsApp ? normalizedPhone : existing.whatsAppNumber,
      email: normalizedEmail || existing.email,
      firstName: input.firstName || existing.firstName,
      lastName: input.lastName || existing.lastName,
      emailMarketingConsent: input.emailMarketingConsent !== undefined ? Boolean(input.emailMarketingConsent) : existing.emailMarketingConsent,
      whatsAppMarketingConsent: input.whatsAppMarketingConsent !== undefined ? Boolean(input.whatsAppMarketingConsent) : existing.whatsAppMarketingConsent,
      emailConsentUpdatedAt: input.emailMarketingConsent ? nowIso : existing.emailConsentUpdatedAt,
      whatsAppConsentUpdatedAt: input.whatsAppMarketingConsent ? nowIso : existing.whatsAppConsentUpdatedAt,
      updatedAt: nowIso
    };
    contacts[existingIndex] = updated;
    writeFallbackContacts(contacts);
    return { contact: updated, isExisting: true, error: null };
  }

  const newContact: CustomerContact = {
    id: crypto.randomUUID(),
    phoneNumber: normalizedPhone,
    rawPhoneNumber: input.phoneNumber,
    isWhatsApp: Boolean(input.isWhatsApp),
    whatsAppNumber: input.isWhatsApp ? normalizedPhone : undefined,
    email: normalizedEmail,
    firstName: input.firstName,
    lastName: input.lastName,
    emailMarketingConsent: Boolean(input.emailMarketingConsent),
    whatsAppMarketingConsent: Boolean(input.whatsAppMarketingConsent),
    emailConsentUpdatedAt: input.emailMarketingConsent ? nowIso : null,
    whatsAppConsentUpdatedAt: input.whatsAppMarketingConsent ? nowIso : null,
    emailUnsubscribedAt: null,
    whatsAppUnsubscribedAt: null,
    consentSource: input.consentSource || 'web_registration',
    consentIpHash: ipHash,
    consentUserAgent: input.userAgent,
    marketingStatus: 'active',
    preferenceToken: crypto.randomUUID(),
    createdAt: nowIso,
    updatedAt: nowIso
  };

  contacts.unshift(newContact);
  writeFallbackContacts(contacts);

  if (newContact.email && newContact.emailMarketingConsent) {
    void emailMarketingProvider.syncContact({
      email: newContact.email,
      phone: newContact.phoneNumber,
      firstName: newContact.firstName,
      consented: true,
      consentSource: newContact.consentSource,
      preferenceToken: newContact.preferenceToken
    });
  }

  return { contact: newContact, isExisting: false, error: null };
}

/**
 * Fetch contacts with filtering, search, and aggregate metrics
 */
export async function serverFetchContacts(
  options: ContactFilterOptions = {},
  client?: SupabaseClient | null
): Promise<{ contacts: CustomerContact[]; total: number; stats: ContactStatistics; error: string | null }> {
  let contactsList: CustomerContact[] = [];

  if (client) {
    try {
      let query = client.from('customer_contacts').select('*');

      if (options.status && options.status !== 'all') {
        query = query.eq('marketing_status', options.status);
      }
      if (options.emailConsent && options.emailConsent !== 'all') {
        query = query.eq('email_marketing_consent', options.emailConsent === 'opted_in');
      }
      if (options.whatsAppConsent && options.whatsAppConsent !== 'all') {
        query = query.eq('whatsapp_marketing_consent', options.whatsAppConsent === 'opted_in');
      }
      if (options.whatsAppAvailable && options.whatsAppAvailable !== 'all') {
        query = query.eq('is_whatsapp', options.whatsAppAvailable === 'yes');
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        contactsList = data.map(mapDbRowToCustomerContact);
      }
    } catch {
      // Fallback
    }
  }

  if (contactsList.length === 0) {
    contactsList = readFallbackContacts();
  }

  // Filter in memory for search and granular filters
  let filtered = [...contactsList];

  if (options.search && options.search.trim()) {
    const s = options.search.toLowerCase().trim();
    filtered = filtered.filter(c => 
      c.phoneNumber.toLowerCase().includes(s) ||
      (c.email && c.email.toLowerCase().includes(s)) ||
      (c.firstName && c.firstName.toLowerCase().includes(s)) ||
      (c.lastName && c.lastName.toLowerCase().includes(s))
    );
  }

  if (options.emailConsent && options.emailConsent !== 'all') {
    filtered = filtered.filter(c => c.emailMarketingConsent === (options.emailConsent === 'opted_in'));
  }

  if (options.whatsAppConsent && options.whatsAppConsent !== 'all') {
    filtered = filtered.filter(c => c.whatsAppMarketingConsent === (options.whatsAppConsent === 'opted_in'));
  }

  if (options.whatsAppAvailable && options.whatsAppAvailable !== 'all') {
    filtered = filtered.filter(c => c.isWhatsApp === (options.whatsAppAvailable === 'yes'));
  }

  if (options.status && options.status !== 'all') {
    filtered = filtered.filter(c => c.marketingStatus === options.status);
  }

  // Calculate statistics across total contacts
  const totalContacts = contactsList.length;
  const emailSubscribersCount = contactsList.filter(c => c.emailMarketingConsent).length;
  const whatsAppSubscribersCount = contactsList.filter(c => c.whatsAppMarketingConsent).length;
  const bothChannelsOptedInCount = contactsList.filter(c => c.emailMarketingConsent && c.whatsAppMarketingConsent).length;
  const whatsAppAvailableCount = contactsList.filter(c => c.isWhatsApp).length;
  const unsubscribedCount = contactsList.filter(c => c.marketingStatus === 'unsubscribed').length;
  const suppressedCount = contactsList.filter(c => c.marketingStatus === 'suppressed').length;

  const nowMs = Date.now();
  const sevenDaysAgo = nowMs - (7 * 24 * 60 * 60 * 1000);
  const recentRegistrations7d = contactsList.filter(c => new Date(c.createdAt).getTime() >= sevenDaysAgo).length;

  const stats: ContactStatistics = {
    totalContacts,
    emailSubscribersCount,
    emailOptInRate: totalContacts > 0 ? Math.round((emailSubscribersCount / totalContacts) * 100) : 0,
    whatsAppSubscribersCount,
    whatsAppOptInRate: totalContacts > 0 ? Math.round((whatsAppSubscribersCount / totalContacts) * 100) : 0,
    bothChannelsOptedInCount,
    whatsAppAvailableCount,
    unsubscribedCount,
    suppressedCount,
    recentRegistrations7d
  };

  const offset = options.offset || 0;
  const limit = options.limit || 50;
  const paginated = filtered.slice(offset, offset + limit);

  return {
    contacts: paginated,
    total: filtered.length,
    stats,
    error: null
  };
}

/**
 * Update preferences granularly (without altering the other channel)
 */
export async function serverUpdateContactPreferences(
  input: UpdatePreferencesInput,
  client?: SupabaseClient | null
): Promise<{ contact: CustomerContact | null; error: string | null }> {
  if (!input.token && !input.phoneNumber) {
    return { contact: null, error: 'Preference token or phone number is required.' };
  }

  const nowIso = new Date().toISOString();

  // Try Supabase first
  if (client) {
    try {
      let query = client.from('customer_contacts').select('*');
      if (input.token) {
        query = query.eq('preference_token', input.token);
      } else if (input.phoneNumber) {
        const norm = normalizePhoneNumber(input.phoneNumber);
        query = query.eq('phone_number', norm.e164);
      }

      const { data: existing, error } = await query.maybeSingle();
      if (!error && existing) {
        const patch: any = {
          email_marketing_consent: input.emailMarketingConsent,
          whatsapp_marketing_consent: input.whatsAppMarketingConsent,
          updated_at: nowIso,
        };

        if (input.emailMarketingConsent !== existing.email_marketing_consent) {
          patch.email_consent_updated_at = nowIso;
          if (!input.emailMarketingConsent) {
            patch.email_unsubscribed_at = nowIso;
          }
        }

        if (input.whatsAppMarketingConsent !== existing.whatsapp_marketing_consent) {
          patch.whatsapp_consent_updated_at = nowIso;
          if (!input.whatsAppMarketingConsent) {
            patch.whatsapp_unsubscribed_at = nowIso;
          }
        }

        const { data: updated, error: updErr } = await client
          .from('customer_contacts')
          .update(patch)
          .eq('id', existing.id)
          .select()
          .single();

        if (!updErr && updated) {
          const contact = mapDbRowToCustomerContact(updated);

          // Synchronize with external email marketing provider
          if (contact.email) {
            if (contact.emailMarketingConsent) {
              void emailMarketingProvider.syncContact({
                email: contact.email,
                consented: true,
                preferenceToken: contact.preferenceToken
              });
            } else {
              void emailMarketingProvider.unsubscribeContact(contact.email, 'Preference center opt-out');
            }
          }

          return { contact, error: null };
        }
      }
    } catch {
      // Fallback
    }
  }

  // Fallback
  const contacts = readFallbackContacts();
  const index = contacts.findIndex(c => 
    (input.token && c.preferenceToken === input.token) ||
    (input.phoneNumber && c.phoneNumber === normalizePhoneNumber(input.phoneNumber).e164)
  );

  if (index < 0) {
    return { contact: null, error: 'Contact preference profile not found.' };
  }

  const existing = contacts[index];
  const updated: CustomerContact = {
    ...existing,
    emailMarketingConsent: input.emailMarketingConsent,
    whatsAppMarketingConsent: input.whatsAppMarketingConsent,
    emailConsentUpdatedAt: input.emailMarketingConsent !== existing.emailMarketingConsent ? nowIso : existing.emailConsentUpdatedAt,
    whatsAppConsentUpdatedAt: input.whatsAppMarketingConsent !== existing.whatsAppMarketingConsent ? nowIso : existing.whatsAppConsentUpdatedAt,
    emailUnsubscribedAt: !input.emailMarketingConsent && existing.emailMarketingConsent ? nowIso : (existing.emailUnsubscribedAt || null),
    whatsAppUnsubscribedAt: !input.whatsAppMarketingConsent && existing.whatsAppMarketingConsent ? nowIso : (existing.whatsAppUnsubscribedAt || null),
    updatedAt: nowIso
  };

  contacts[index] = updated;
  writeFallbackContacts(contacts);

  if (updated.email) {
    if (updated.emailMarketingConsent) {
      void emailMarketingProvider.syncContact({
        email: updated.email,
        consented: true,
        preferenceToken: updated.preferenceToken
      });
    } else {
      void emailMarketingProvider.unsubscribeContact(updated.email, 'Preference center opt-out');
    }
  }

  return { contact: updated, error: null };
}

/**
 * Admin correction and suppression management
 */
export async function serverAdminUpdateContact(
  id: string,
  updates: Partial<CustomerContact>,
  client?: SupabaseClient | null
): Promise<{ contact: CustomerContact | null; error: string | null }> {
  const nowIso = new Date().toISOString();

  if (client) {
    try {
      const patch: any = { updated_at: nowIso };
      if (updates.phoneNumber) {
        const norm = normalizePhoneNumber(updates.phoneNumber);
        if (norm.isValid) {
          patch.phone_number = norm.e164;
          patch.raw_phone_number = updates.phoneNumber;
        }
      }
      if (updates.email !== undefined) {
        patch.email = updates.email ? updates.email.trim().toLowerCase() : null;
      }
      if (updates.firstName !== undefined) patch.first_name = updates.firstName;
      if (updates.lastName !== undefined) patch.last_name = updates.lastName;
      if (updates.isWhatsApp !== undefined) patch.is_whatsapp = updates.isWhatsApp;
      if (updates.emailMarketingConsent !== undefined) {
        patch.email_marketing_consent = updates.emailMarketingConsent;
        patch.email_consent_updated_at = nowIso;
        if (!updates.emailMarketingConsent) patch.email_unsubscribed_at = nowIso;
      }
      if (updates.whatsAppMarketingConsent !== undefined) {
        patch.whatsapp_marketing_consent = updates.whatsAppMarketingConsent;
        patch.whatsapp_consent_updated_at = nowIso;
        if (!updates.whatsAppMarketingConsent) patch.whatsapp_unsubscribed_at = nowIso;
      }
      if (updates.marketingStatus !== undefined) {
        patch.marketing_status = updates.marketingStatus;
      }
      if (updates.suppressionReason !== undefined) {
        patch.suppression_reason = updates.suppressionReason;
      }

      const { data, error } = await client
        .from('customer_contacts')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        return { contact: mapDbRowToCustomerContact(data), error: null };
      }
    } catch {
      // Fallback
    }
  }

  const contacts = readFallbackContacts();
  const idx = contacts.findIndex(c => c.id === id);
  if (idx < 0) return { contact: null, error: 'Contact not found' };

  const updated = { ...contacts[idx], ...updates, updatedAt: nowIso };
  contacts[idx] = updated;
  writeFallbackContacts(contacts);
  return { contact: updated, error: null };
}

/**
 * Hard delete contact (POPIA Right to be Forgotten)
 */
export async function serverAdminDeleteContact(
  id: string,
  client?: SupabaseClient | null
): Promise<{ success: boolean; error: string | null }> {
  if (client) {
    try {
      const { error } = await client.from('customer_contacts').delete().eq('id', id);
      if (!error) return { success: true, error: null };
    } catch {
      // Fallback
    }
  }

  const contacts = readFallbackContacts();
  const filtered = contacts.filter(c => c.id !== id);
  writeFallbackContacts(filtered);
  return { success: true, error: null };
}

/**
 * Generate RFC 4180 compliant CSV stream for authorized admins
 */
export async function serverExportContactsCSV(
  options: ContactFilterOptions = {},
  client?: SupabaseClient | null
): Promise<string> {
  const { contacts } = await serverFetchContacts({ ...options, limit: 10000 }, client);

  const headers = [
    'Contact ID',
    'Phone (E.164)',
    'Has WhatsApp',
    'Email Address',
    'First Name',
    'Email Marketing Opt-In',
    'WhatsApp Marketing Opt-In',
    'Consent Source',
    'Consent Date',
    'Email Unsubscribed At',
    'WhatsApp Unsubscribed At',
    'Marketing Status',
    'Created At'
  ];

  const rows = contacts.map(c => [
    `"${c.id}"`,
    `"${c.phoneNumber}"`,
    c.isWhatsApp ? '"YES"' : '"NO"',
    `"${c.email || ''}"`,
    `"${c.firstName || ''}"`,
    c.emailMarketingConsent ? '"OPTED_IN"' : '"OPTED_OUT"',
    c.whatsAppMarketingConsent ? '"OPTED_IN"' : '"OPTED_OUT"',
    `"${c.consentSource}"`,
    `"${c.emailConsentUpdatedAt || c.whatsAppConsentUpdatedAt || c.createdAt}"`,
    `"${c.emailUnsubscribedAt || ''}"`,
    `"${c.whatsappUnsubscribedAt || ''}"`,
    `"${c.marketingStatus.toUpperCase()}"`,
    `"${c.createdAt}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
