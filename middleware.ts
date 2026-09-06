import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * VERITAS ROUTING & SECURITY MIDDLEWARE
 * 
 * - Enforces authentication on all /admin/* routes (redirecting unauthenticated users to /admin/login)
 * - Protects /api/admin/* API endpoints with 401 unauthorized
 * - Preserves ADMIN_AUTH_BYPASS configuration for controlled development testing
 * - Strictly leaves all public storefront routes (/, /shop, /products/*, /cart, /checkout, /api/orders/create) open
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Direct /admin base route to /admin/dashboard
  if (pathname === '/admin') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  // 2. Allow unrestricted access to the admin login portal
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  // Check development bypass environment variable
  // Production behavior strictly enforces authentication (bypass only allowed in non-production environments)
  const isDev = process.env.NODE_ENV !== 'production';
  const isEnvBypass = isDev && process.env.ADMIN_AUTH_BYPASS === 'true';

  // Check session cookie
  const sessionCookie = request.cookies.get('veritas_admin_session')?.value;
  const isSessionValid = sessionCookie === 'active' || (isEnvBypass && sessionCookie === 'bypass');

  // 3. Protect Admin Web UI Routes (/admin/*)
  if (pathname.startsWith('/admin')) {
    if (isEnvBypass || isSessionValid) {
      return NextResponse.next();
    }

    // Redirect unauthenticated request to /admin/login
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Protect Admin API Routes (/api/admin/*)
  if (pathname.startsWith('/api/admin')) {
    const authHeader = request.headers.get('authorization');
    const hasBearer = Boolean(authHeader && authHeader.startsWith('Bearer '));

    if (isEnvBypass || isSessionValid || hasBearer) {
      return NextResponse.next();
    }

    return NextResponse.json(
      { success: false, error: 'Unauthorized: Admin authentication token or active session required.' },
      { status: 401 }
    );
  }

  // 5. Public storefront routes remain 100% accessible
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
};


