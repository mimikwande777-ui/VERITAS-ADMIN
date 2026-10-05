import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { NextRequest } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';

export const RP_NAME = 'VERITAS Admin';

/**
 * Derives the Relying Party (RP) ID from environment or request
 */
export function getRelyingPartyID(request?: NextRequest): string {
  if (process.env.WEBAUTHN_RP_ID) {
    return process.env.WEBAUTHN_RP_ID;
  }

  if (request) {
    const host = request.headers.get('host') || '';
    const cleanHost = host.split(':')[0]; // strip port
    if (cleanHost && !cleanHost.includes('localhost') && !cleanHost.includes('127.0.0.1')) {
      return cleanHost;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return 'veritas-admin-three.vercel.app';
  }

  return 'localhost';
}

/**
 * Derives the Expected Origin from environment or request
 */
export function getExpectedOrigin(request?: NextRequest): string | string[] {
  if (process.env.WEBAUTHN_ORIGIN) {
    return process.env.WEBAUTHN_ORIGIN;
  }

  const origins: string[] = ['https://veritas-admin-three.vercel.app'];

  if (request) {
    const originHeader = request.headers.get('origin');
    if (originHeader && !origins.includes(originHeader)) {
      origins.push(originHeader);
    }
    const hostHeader = request.headers.get('host');
    if (hostHeader) {
      const proto = request.headers.get('x-forwarded-proto') || 'https';
      const derived = `${proto}://${hostHeader}`;
      if (!origins.includes(derived)) {
        origins.push(derived);
      }
    }
  }

  if (process.env.APP_URL && !origins.includes(process.env.APP_URL)) {
    origins.push(process.env.APP_URL);
  }

  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000');
    origins.push('http://127.0.0.1:3000');
  }

  return origins;
}

/**
 * Stores a cryptographically random single-use WebAuthn challenge with a 5-minute expiry
 */
export async function storeChallenge(
  serviceClient: SupabaseClient,
  challenge: string,
  type: 'registration' | 'authentication',
  adminUserId?: string | null
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

  const { error } = await serviceClient
    .from('admin_webauthn_challenges')
    .insert({
      challenge,
      type,
      admin_user_id: adminUserId || null,
      expires_at: expiresAt,
    });

  if (error) {
    console.error('[WEBAUTHN] Error storing challenge:', error);
    return false;
  }

  return true;
}

/**
 * Validates and consumes a single-use WebAuthn challenge
 */
export async function consumeChallenge(
  serviceClient: SupabaseClient,
  challenge: string,
  type: 'registration' | 'authentication',
  adminUserId?: string | null
): Promise<{ valid: boolean; error?: string }> {
  const now = new Date().toISOString();

  // Find valid unexpired, unused challenge
  let query = serviceClient
    .from('admin_webauthn_challenges')
    .select('id, expires_at, used_at, admin_user_id')
    .eq('challenge', challenge)
    .eq('type', type)
    .is('used_at', null)
    .gt('expires_at', now);

  if (adminUserId) {
    query = query.eq('admin_user_id', adminUserId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return { valid: false, error: 'Challenge invalid, expired, or already used.' };
  }

  // Mark challenge as used immediately (single-use)
  await serviceClient
    .from('admin_webauthn_challenges')
    .update({ used_at: now })
    .eq('id', data.id);

  return { valid: true };
}

/**
 * Generates options for Passkey registration
 */
export async function generateAdminRegistrationOptions(
  request: NextRequest,
  serviceClient: SupabaseClient,
  adminUser: { id: string; email?: string; name?: string },
  existingPasskeys: Array<{ credential_id: string; transports?: string[] }>
) {
  const rpID = getRelyingPartyID(request);

  const excludeCredentials = existingPasskeys.map(pk => ({
    id: pk.credential_id,
    transports: pk.transports as any,
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new TextEncoder().encode(adminUser.id),
    userName: adminUser.email || `admin_${adminUser.id.slice(0, 8)}`,
    userDisplayName: adminUser.name || adminUser.email || 'VERITAS Admin',
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required', // Enforce biometric or device PIN
    },
  });

  // Store single-use challenge
  await storeChallenge(serviceClient, options.challenge, 'registration', adminUser.id);

  return options;
}

/**
 * Verifies Passkey registration response
 */
export async function verifyAdminRegistrationResponse(
  request: NextRequest,
  serviceClient: SupabaseClient,
  adminUserId: string,
  response: any
): Promise<VerifiedRegistrationResponse> {
  const expectedOrigin = getExpectedOrigin(request);
  const rpID = getRelyingPartyID(request);

  // Consume challenge
  const challengeCheck = await consumeChallenge(serviceClient, response.challenge || response.response?.clientDataJSON ? extractChallengeFromClientData(response.response?.clientDataJSON) : '', 'registration', adminUserId);
  if (!challengeCheck.valid) {
    // If challenge was inside response payload, check it
    const clientDataChallenge = extractChallengeFromClientData(response.response?.clientDataJSON);
    if (clientDataChallenge) {
      const retryCheck = await consumeChallenge(serviceClient, clientDataChallenge, 'registration', adminUserId);
      if (!retryCheck.valid) {
        throw new Error('Registration challenge expired or invalid');
      }
    } else {
      throw new Error('Missing or invalid registration challenge');
    }
  }

  const expectedChallenge = extractChallengeFromClientData(response.response?.clientDataJSON);

  return await verifyRegistrationResponse({
    response,
    expectedChallenge: expectedChallenge || '',
    expectedOrigin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });
}

/**
 * Generates options for Passkey login / authentication
 */
export async function generateAdminAuthenticationOptions(
  request: NextRequest,
  serviceClient: SupabaseClient
) {
  const rpID = getRelyingPartyID(request);

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: [], // Allow discoverable credentials / passkeys
  });

  // Store single-use challenge
  await storeChallenge(serviceClient, options.challenge, 'authentication');

  return options;
}

/**
 * Verifies Passkey login / authentication assertion
 */
export async function verifyAdminAuthenticationResponse(
  request: NextRequest,
  serviceClient: SupabaseClient,
  response: any,
  storedPasskey: {
    credential_id: string;
    public_key: string;
    counter: number;
    transports?: string[];
  }
): Promise<VerifiedAuthenticationResponse> {
  const expectedOrigin = getExpectedOrigin(request);
  const rpID = getRelyingPartyID(request);

  const clientChallenge = extractChallengeFromClientData(response.response?.clientDataJSON);
  if (!clientChallenge) {
    throw new Error('Could not extract challenge from client data');
  }

  // Consume challenge
  const challengeCheck = await consumeChallenge(serviceClient, clientChallenge, 'authentication');
  if (!challengeCheck.valid) {
    throw new Error('Authentication challenge invalid or expired');
  }

  // Convert stored base64 public key to Uint8Array
  const publicKeyBytes = Buffer.from(storedPasskey.public_key, 'base64url');

  return await verifyAuthenticationResponse({
    response,
    expectedChallenge: clientChallenge,
    expectedOrigin,
    expectedRPID: rpID,
    credential: {
      id: storedPasskey.credential_id,
      publicKey: publicKeyBytes,
      counter: Number(storedPasskey.counter) || 0,
      transports: storedPasskey.transports as any,
    },
    requireUserVerification: true,
  });
}

/**
 * Extracts challenge string from base64URL clientDataJSON
 */
function extractChallengeFromClientData(clientDataJSON?: string): string {
  if (!clientDataJSON) return '';
  try {
    const jsonString = Buffer.from(clientDataJSON, 'base64url').toString('utf-8');
    const parsed = JSON.parse(jsonString);
    return parsed.challenge || '';
  } catch {
    return '';
  }
}
