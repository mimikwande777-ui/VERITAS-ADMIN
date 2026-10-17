import { NextRequest, NextResponse } from 'next/server';
import { serverUpdateContactPreferences, serverFetchContacts } from '@/lib/supabase/contacts-server';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { normalizePhoneNumber } from '@/lib/phone-utils';
import { maskEmail, maskPhone } from '@/lib/customer-privacy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const phone = searchParams.get('phone');

  if (!token && !phone) {
    return NextResponse.json(
      { success: false, error: 'Preference token or phone number query parameter is required.' },
      { status: 400 }
    );
  }

  try {
    const serviceClient = createServiceRoleSupabaseClient();
    let query = serviceClient ? serviceClient.from('customer_contacts').select('*') : null;

    if (query) {
      if (token) {
        query = query.eq('preference_token', token);
      } else if (phone) {
        const norm = normalizePhoneNumber(phone);
        query = query.eq('phone_number', norm.e164);
      }
      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        return NextResponse.json({
          success: true,
          data: {
            phoneNumber: maskPhone(data.phone_number),
            rawPhone: data.phone_number,
            email: data.email ? maskEmail(data.email) : null,
            rawEmail: data.email,
            isWhatsApp: Boolean(data.is_whatsapp),
            emailMarketingConsent: Boolean(data.email_marketing_consent),
            whatsAppMarketingConsent: Boolean(data.whatsapp_marketing_consent),
            emailConsentUpdatedAt: data.email_consent_updated_at,
            whatsAppConsentUpdatedAt: data.whatsapp_consent_updated_at,
            marketingStatus: data.marketing_status,
            preferenceToken: data.preference_token
          }
        });
      }
    }

    // Fallback lookup
    const { contacts } = await serverFetchContacts({ limit: 1000 }, serviceClient);
    const targetNorm = phone ? normalizePhoneNumber(phone).e164 : '';
    const match = contacts.find(c => (token && c.preferenceToken === token) || (phone && c.phoneNumber === targetNorm));

    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Contact preference record not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        phoneNumber: maskPhone(match.phoneNumber),
        rawPhone: match.phoneNumber,
        email: match.email ? maskEmail(match.email) : null,
        rawEmail: match.email,
        isWhatsApp: match.isWhatsApp,
        emailMarketingConsent: match.emailMarketingConsent,
        whatsAppMarketingConsent: match.whatsAppMarketingConsent,
        emailConsentUpdatedAt: match.emailConsentUpdatedAt,
        whatsAppConsentUpdatedAt: match.whatsAppConsentUpdatedAt,
        marketingStatus: match.marketingStatus,
        preferenceToken: match.preferenceToken
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error looking up preferences.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { token, phoneNumber, emailMarketingConsent, whatsAppMarketingConsent } = body;

  if (!token && !phoneNumber) {
    return NextResponse.json(
      { success: false, error: 'Preference token or phone number is required.' },
      { status: 400 }
    );
  }

  if (typeof emailMarketingConsent !== 'boolean' || typeof whatsAppMarketingConsent !== 'boolean') {
    return NextResponse.json(
      { success: false, error: 'Consent values must be explicit booleans.' },
      { status: 400 }
    );
  }

  try {
    const serviceClient = createServiceRoleSupabaseClient();
    const result = await serverUpdateContactPreferences(
      {
        token,
        phoneNumber,
        emailMarketingConsent,
        whatsAppMarketingConsent,
        source: 'preference_center'
      },
      serviceClient
    );

    if (result.error || !result.contact) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to update preferences.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Marketing preferences updated successfully.',
      data: {
        emailMarketingConsent: result.contact.emailMarketingConsent,
        whatsAppMarketingConsent: result.contact.whatsAppMarketingConsent,
        emailConsentUpdatedAt: result.contact.emailConsentUpdatedAt,
        whatsAppConsentUpdatedAt: result.contact.whatsAppConsentUpdatedAt,
        updatedAt: result.contact.updatedAt
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save preference updates.' },
      { status: 500 }
    );
  }
}
