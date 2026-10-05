'use client';

import { 
  startRegistration, 
  startAuthentication, 
  browserSupportsWebAuthn, 
  browserSupportsWebAuthnAutofill,
  platformAuthenticatorIsAvailable 
} from '@simplewebauthn/browser';
import { getAdminAuthHeaders } from '@/lib/auth-context';

export interface PasskeySupportInfo {
  isSupported: boolean;
  hasPlatformAuthenticator: boolean;
  hasAutofill: boolean;
}

/**
 * Checks browser and device capability for WebAuthn and platform authenticators (Face ID, Touch ID, Windows Hello)
 */
export async function checkPasskeySupport(): Promise<PasskeySupportInfo> {
  if (typeof window === 'undefined') {
    return { isSupported: false, hasPlatformAuthenticator: false, hasAutofill: false };
  }

  const isSupported = browserSupportsWebAuthn();
  let hasPlatformAuthenticator = false;
  let hasAutofill = false;

  if (isSupported) {
    try {
      hasPlatformAuthenticator = await platformAuthenticatorIsAvailable();
      hasAutofill = await browserSupportsWebAuthnAutofill();
    } catch {
      // Non-blocking
    }
  }

  return {
    isSupported,
    hasPlatformAuthenticator,
    hasAutofill,
  };
}

/**
 * Executes the full Passkey registration ceremony for an authenticated admin
 */
export async function registerPasskey(deviceName?: string): Promise<{
  success: boolean;
  passkey?: any;
  error?: string;
}> {
  try {
    const headers = await getAdminAuthHeaders();

    // 1. Fetch registration options from server
    const optionsRes = await fetch('/api/admin/passkeys/register/options', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });

    if (!optionsRes.ok) {
      const errJson = await optionsRes.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to initialize passkey registration' };
    }

    const options = await optionsRes.json();

    // 2. Perform WebAuthn registration on device (Face ID / Touch ID / Windows Hello / Device PIN)
    let registrationResponse;
    try {
      registrationResponse = await startRegistration({ optionsJSON: options });
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        return { success: false, error: 'Passkey registration was cancelled or timed out.' };
      }
      return { success: false, error: err?.message || 'Device biometric registration failed.' };
    }

    // 3. Send response to server for cryptographic verification and public key storage
    const verifyRes = await fetch('/api/admin/passkeys/register/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        response: registrationResponse,
        deviceName: deviceName || 'Personal Device',
      }),
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.success) {
      return { success: false, error: verifyData.error || 'Server failed to verify passkey signature.' };
    }

    return { success: true, passkey: verifyData.passkey };
  } catch (err: any) {
    console.error('[PASSKEY CLIENT] Registration error:', err);
    return { success: false, error: err?.message || 'Unexpected passkey registration error.' };
  }
}

/**
 * Executes Passkey authentication / login ceremony
 */
export async function authenticatePasskey(): Promise<{
  success: boolean;
  user?: any;
  error?: string;
}> {
  try {
    // 1. Request authentication challenge from server
    const optionsRes = await fetch('/api/admin/passkeys/auth/options', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!optionsRes.ok) {
      const errJson = await optionsRes.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to initialize passkey login.' };
    }

    const options = await optionsRes.json();

    // 2. Prompt device authenticator (Face ID / Touch ID / Windows Hello / Device PIN)
    let authResponse;
    try {
      authResponse = await startAuthentication({ optionsJSON: options });
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        return { success: false, error: 'Passkey sign-in was cancelled.' };
      }
      return { success: false, error: err?.message || 'Passkey verification failed on device.' };
    }

    // 3. Verify assertion on server and establish secure session
    const verifyRes = await fetch('/api/admin/passkeys/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        response: authResponse,
      }),
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.success) {
      return { success: false, error: verifyData.error || 'Passkey verification failed on server.' };
    }

    return { success: true, user: verifyData.user };
  } catch (err: any) {
    console.error('[PASSKEY CLIENT] Authentication error:', err);
    return { success: false, error: err?.message || 'Passkey authentication error.' };
  }
}
