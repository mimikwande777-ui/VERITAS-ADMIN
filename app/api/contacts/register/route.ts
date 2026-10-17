import { NextRequest, NextResponse } from 'next/server';
import { serverRegisterContact } from '@/lib/supabase/contacts-server';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { RegisterContactInput } from '@/lib/contacts-types';

export const dynamic = 'force-dynamic';

// Rate limiting in-memory window: Max 10 registrations per 10 minutes per IP
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitBucket>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 10;

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const bucket = rateLimitMap.get(ip);

  if (!bucket || now > bucket.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (bucket.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  bucket.count++;
  return { allowed: true };
}

export async function POST(request: NextRequest) {
  // 1. Client IP detection and Rate Limiting
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const clientIp = (forwardedFor ? forwardedFor.split(',')[0].trim() : realIp) || '127.0.0.1';

  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many registration requests. Please wait a few moments before trying again.',
        retryAfter: rateCheck.retryAfter
      },
      { 
        status: 429,
        headers: { 'Retry-After': String(rateCheck.retryAfter || 60) }
      }
    );
  }

  // 2. Body parsing and payload validation
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  const { 
    phoneNumber, 
    isWhatsApp, 
    email, 
    firstName, 
    lastName, 
    emailMarketingConsent, 
    whatsAppMarketingConsent,
    consentSource
  } = body;

  if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
    return NextResponse.json(
      { success: false, error: 'Phone number is required for registration.' },
      { status: 400 }
    );
  }

  // Note: Consents are NEVER true by default
  const registrationPayload: RegisterContactInput = {
    phoneNumber: phoneNumber.trim(),
    isWhatsApp: Boolean(isWhatsApp),
    email: email && typeof email === 'string' && email.trim() ? email.trim() : undefined,
    firstName: firstName && typeof firstName === 'string' ? firstName.trim() : undefined,
    lastName: lastName && typeof lastName === 'string' ? lastName.trim() : undefined,
    emailMarketingConsent: emailMarketingConsent === true,
    whatsAppMarketingConsent: whatsAppMarketingConsent === true,
    consentSource: consentSource || 'web_registration',
    ipAddress: clientIp,
    userAgent: request.headers.get('user-agent') || undefined
  };

  try {
    const serviceClient = createServiceRoleSupabaseClient();
    const result = await serverRegisterContact(registrationPayload, serviceClient);

    if (result.error || !result.contact) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to register contact.' },
        { status: 422 }
      );
    }

    const { contact, isExisting } = result;

    return NextResponse.json({
      success: true,
      message: isExisting 
        ? 'Your contact details and preferences have been updated.'
        : 'Your contact has been registered successfully with VERITAS.',
      isExisting,
      data: {
        id: contact.id,
        phoneNumber: contact.phoneNumber,
        isWhatsApp: contact.isWhatsApp,
        email: contact.email,
        firstName: contact.firstName,
        emailMarketingConsent: contact.emailMarketingConsent,
        whatsAppMarketingConsent: contact.whatsAppMarketingConsent,
        preferenceToken: contact.preferenceToken,
        consentSource: contact.consentSource,
        createdAt: contact.createdAt
      }
    });
  } catch (err: any) {
    console.error('Customer contact registration API exception:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while saving contact registration.' },
      { status: 500 }
    );
  }
}
