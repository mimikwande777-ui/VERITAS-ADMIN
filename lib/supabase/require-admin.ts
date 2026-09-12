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
  | { authorized: true; admin: VerifiedAdmin; errorResponse?: never }
  | { authorized: false; errorResponse: NextResponse; admin?: never };

/**
 * Authoritative server-side admin verification and RBAC engine.
 * 
 * Enforces:
 * 1. Must have valid Supabase JWT Bearer token in request headers or auth cookie.
 * 2. Token must be verified cryptographically by Supabase Auth (serverClient.auth.getUser(token)).
 * 3. User UUID from Supabase Auth must match a row in public.admin_users.
 * 4. User account must be active (is_active === true).
 * 5. Optional role or permission requirement check.
 */
export async function requireAdmin(
  request: NextRequest,
  options?: {
    requiredRole?: CanonicalAdminRole | CanonicalAdminRole[];
    requiredPermission?: PermissionString;
  }
): Promise<RequireAdminResult> {
  // 1. Extract Bearer token
  const authHeader = request.headers.get('authorization');
  let token: string | null = null;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // Also check standard Supabase auth cookies if present (sb-access-token, veritas_admin_token, or sb-<project>-auth-token)
  if (!token) {
    const cookies = request.cookies;
    const sbAccessToken = cookies.get('sb-access-token')?.value || cookies.get('veritas_admin_token')?.value;
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

  // 3. Query public.admin_users to verify the authenticated UUID exists with an authorized role and is active
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

  // 4. ACTIVE ACCOUNT CHECK
  // If is_active is explicitly false, reject immediately
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

  // 5. REQUIRED ROLE CHECK (IF SPECIFIED)
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

  // 6. REQUIRED PERMISSION CHECK (IF SPECIFIED)
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
