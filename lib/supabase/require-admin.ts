import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from './server';

export interface VerifiedAdmin {
  userId: string;
  email?: string;
  role: 'super_admin' | 'admin' | 'manager';
}

export type RequireAdminResult = 
  | { authorized: true; admin: VerifiedAdmin; errorResponse?: never }
  | { authorized: false; errorResponse: NextResponse; admin?: never };

/**
 * Authoritative server-side admin verification.
 * 
 * Enforces:
 * 1. Must have valid Supabase JWT Bearer token in request headers or auth cookie.
 * 2. Token must be verified cryptographically by Supabase Auth (serverClient.auth.getUser(token)).
 * 3. User UUID from Supabase Auth must match a row in public.admin_users.
 * 4. User role in public.admin_users must be one of: 'super_admin' | 'admin' | 'manager'.
 * 
 * ZERO authorization power is granted to arbitrary cookies (e.g. veritas_admin_session=active),
 * client-sent roles, localStorage, or hardcoded email lists.
 */
export async function requireAdmin(request: NextRequest): Promise<RequireAdminResult> {
  // 1. Extract Bearer token
  const authHeader = request.headers.get('authorization');
  let token: string | null = null;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // Also check standard Supabase auth cookies if present (sb-access-token or sb-<project>-auth-token)
  if (!token) {
    const cookies = request.cookies;
    // Look for common Supabase access token cookie patterns
    const sbAccessToken = cookies.get('sb-access-token')?.value;
    if (sbAccessToken) {
      token = sbAccessToken;
    } else {
      // Find any cookie ending with -auth-token or containing access_token
      for (const cookie of cookies.getAll()) {
        if (cookie.name.includes('auth-token') || cookie.name.includes('access_token')) {
          try {
            const parsed = JSON.parse(cookie.value);
            if (parsed && typeof parsed === 'object' && parsed.access_token) {
              token = parsed.access_token;
              break;
            } else if (Array.isArray(parsed) && parsed[0]) {
              token = parsed[0];
              break;
            }
          } catch {
            if (cookie.value.length > 50 && cookie.value.split('.').length === 3) {
              token = cookie.value;
              break;
            }
          }
        }
      }
    }
  }

  if (!token) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized: Valid Supabase authentication token required.' },
        { status: 401 }
      ),
    };
  }

  // 2. Validate token using Supabase Auth (verifies cryptographic signature & expiration)
  const userClient = createServerSupabaseClient(token);
  if (!userClient) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { success: false, error: 'Supabase server configuration missing.' },
        { status: 500 }
      ),
    };
  }

  const { data: { user }, error: authError } = await userClient.auth.getUser(token);

  if (authError || !user || !user.id) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid or expired Supabase authentication session.' },
        { status: 401 }
      ),
    };
  }

  // 3. Query public.admin_users to verify the authenticated UUID exists with an authorized role
  const serviceClient = createServiceRoleSupabaseClient();
  if (!serviceClient) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { success: false, error: 'Server authorization client unavailable.' },
        { status: 500 }
      ),
    };
  }

  const { data: adminRecord, error: adminQueryError } = await serviceClient
    .from('admin_users')
    .select('user_id, role')
    .eq('user_id', user.id)
    .single();

  if (adminQueryError || !adminRecord) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { success: false, error: 'Forbidden: Authenticated user does not possess administrative privileges.' },
        { status: 403 }
      ),
    };
  }

  const allowedRoles = ['super_admin', 'admin', 'manager'];
  if (!allowedRoles.includes(adminRecord.role)) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient administrative role.' },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    admin: {
      userId: user.id,
      email: user.email,
      role: adminRecord.role as 'super_admin' | 'admin' | 'manager',
    },
  };
}
