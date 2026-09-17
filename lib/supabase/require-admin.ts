import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from './server';
import { 
  CanonicalAdminRole, 
  PermissionString, 
  hasPermission, 
  normalizeAdminRole, 
  CANONICAL_ROLE_PERMISSIONS 
} from '../auth-types';

export interface VerifiedAdmin {
  userId: string;
  email?: string;
  role: CanonicalAdminRole;
  isActive: boolean;
}

export type RequireAdminResult = 
  | { 
      authorized: true; 
      admin: VerifiedAdmin; 
      refreshedCookies?: Array<{ name: string; value: string; options: any }>;
      applyCookies: <T extends Response | NextResponse>(res: T) => T;
      errorResponse?: never;
    }
  | { 
      authorized: false; 
      errorResponse: NextResponse; 
      admin?: never; 
      refreshedCookies?: never;
      applyCookies?: never;
    };

export interface AdminSessionInfo {
  user: { id: string; email?: string } | null;
  refreshedCookies: Array<{ name: string; value: string; options: any }>;
}

/**
 * Reads HttpOnly cookies and attempts access token validation or server-side refresh.
 * Priority:
 * 1. HttpOnly access token cookies (`sb-access-token`, `veritas_admin_token`).
 * 2. If access token is missing or expired/invalid, try server-side session refresh using `sb-refresh-token`.
 * 3. Fallback to Authorization Bearer header only if cookie session and refresh token both fail or are missing.
 */
export async function getOrRefreshAdminSession(request: NextRequest): Promise<AdminSessionInfo> {
  const cookies = request.cookies;
  const refreshedCookies: Array<{ name: string; value: string; options: any }> = [];

  const sbAccessToken = cookies.get('sb-access-token')?.value || cookies.get('veritas_admin_token')?.value;
  const refreshTokenCookie = cookies.get('sb-refresh-token')?.value;

  let user: { id: string; email?: string } | null = null;

  // STEP 1 — Check HttpOnly access token cookie
  if (sbAccessToken) {
    const userClient = createServerSupabaseClient(sbAccessToken);
    if (userClient) {
      const { data: { user: fetchedUser }, error } = await userClient.auth.getUser(sbAccessToken);
      if (!error && fetchedUser && fetchedUser.id) {
        user = { id: fetchedUser.id, email: fetchedUser.email };
      }
    }
  }

  // STEP 2 — If access token cookie missing/expired, attempt server-side refresh using sb-refresh-token
  if (!user && refreshTokenCookie) {
    const authClient = createServerSupabaseClient();
    if (authClient) {
      const { data: refreshData, error: refreshError } = await authClient.auth.refreshSession({
        refresh_token: refreshTokenCookie,
      });

      if (!refreshError && refreshData.session && refreshData.user && refreshData.user.id) {
        user = { id: refreshData.user.id, email: refreshData.user.email };
        const newAccessToken = refreshData.session.access_token;
        const newRefreshToken = refreshData.session.refresh_token || refreshTokenCookie;
        const isProd = process.env.NODE_ENV === 'production';
        const maxAge = refreshData.session.expires_in || 60 * 60 * 24 * 7;

        refreshedCookies.push(
          {
            name: 'sb-access-token',
            value: newAccessToken,
            options: { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/', maxAge }
          },
          {
            name: 'veritas_admin_token',
            value: newAccessToken,
            options: { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/', maxAge }
          },
          {
            name: 'sb-refresh-token',
            value: newRefreshToken,
            options: { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/', maxAge: maxAge * 2 }
          }
        );
      }
    }
  }

  // STEP 3 — Fallback to Bearer token header ONLY if cookie session and refresh token failed or were missing
  if (!user) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const bearerToken = authHeader.substring(7).trim();
      if (bearerToken) {
        const userClient = createServerSupabaseClient(bearerToken);
        if (userClient) {
          const { data: { user: bearerUser }, error } = await userClient.auth.getUser(bearerToken);
          if (!error && bearerUser && bearerUser.id) {
            user = { id: bearerUser.id, email: bearerUser.email };
          }
        }
      }
    }
  }

  return { user, refreshedCookies };
}

/**
 * Authoritative server-side admin verification and RBAC engine.
 * 
 * Enforces:
 * 1. Must have valid HttpOnly access token, active refreshed session, or valid Bearer token.
 * 2. User UUID from Supabase Auth must match a row in public.admin_users.
 * 3. User account must be active (is_active === true).
 * 4. Optional role or permission requirement check.
 * 5. Attaches refreshed cookies to response when session was renewed.
 */
export async function requireAdmin(
  request: NextRequest,
  options?: {
    requiredRole?: CanonicalAdminRole | CanonicalAdminRole[];
    requiredPermission?: PermissionString;
  }
): Promise<RequireAdminResult> {
  const sessionResult = await getOrRefreshAdminSession(request);
  const user = sessionResult.user;

  const applyCookies = <T extends Response | NextResponse>(res: T): T => {
    if (sessionResult.refreshedCookies && sessionResult.refreshedCookies.length > 0) {
      if ('cookies' in res && typeof (res as any).cookies?.set === 'function') {
        for (const c of sessionResult.refreshedCookies) {
          (res as NextResponse).cookies.set(c.name, c.value, c.options);
        }
      }
    }
    return res;
  };

  if (!user || !user.id) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized: Valid Supabase authentication token required.' },
        { status: 401 }
      ),
    };
  }

  // Query public.admin_users to verify the authenticated UUID exists with an authorized role and is active
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
    .select('user_id, role, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminQueryError || !adminRecord) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { success: false, error: 'Forbidden: Authenticated user does not possess administrative privileges.' },
        { status: 403 }
      ),
    };
  }

  // ACTIVE ACCOUNT CHECK
  const isActive = adminRecord.is_active !== false;
  if (!isActive) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { success: false, error: 'Forbidden: Administrator account is disabled. Access revoked.' },
        { status: 403 }
      ),
    };
  }

  const canonicalRole = normalizeAdminRole(adminRecord.role);

  // REQUIRED ROLE CHECK (IF SPECIFIED)
  if (options?.requiredRole) {
    const requiredRoles = Array.isArray(options.requiredRole) ? options.requiredRole : [options.requiredRole];
    if (!requiredRoles.includes(canonicalRole) && canonicalRole !== 'super_admin') {
      return {
        authorized: false,
        errorResponse: NextResponse.json(
          { 
            success: false, 
            error: `Forbidden: Requires role [${requiredRoles.join(', ')}]. Current role is '${canonicalRole}'.` 
          },
          { status: 403 }
        ),
      };
    }
  }

  // REQUIRED PERMISSION CHECK (IF SPECIFIED)
  if (options?.requiredPermission) {
    const isGranted = hasPermission(canonicalRole, options.requiredPermission);
    if (!isGranted) {
      return {
        authorized: false,
        errorResponse: NextResponse.json(
          { 
            success: false, 
            error: `Forbidden: Permission '${options.requiredPermission}' is not granted to role '${canonicalRole}'.` 
          },
          { status: 403 }
        ),
      };
    }
  }

  return {
    authorized: true,
    admin: {
      userId: user.id,
      email: user.email,
      role: canonicalRole,
      isActive: true,
    },
    refreshedCookies: sessionResult.refreshedCookies,
    applyCookies,
  };
}

/**
 * Server-side helper to require a specific permission
 */
export async function requirePermission(request: NextRequest, permission: PermissionString): Promise<RequireAdminResult> {
  return requireAdmin(request, { requiredPermission: permission });
}

/**
 * Server-side helper to require a specific role (or list of roles)
 */
export async function requireRole(
  request: NextRequest, 
  requiredRole: CanonicalAdminRole | CanonicalAdminRole[]
): Promise<RequireAdminResult> {
  return requireAdmin(request, { requiredRole });
}

