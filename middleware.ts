import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * TEMPORARILY DISABLED ADMIN AUTH
 * RESTORE BEFORE PUBLIC PRODUCTION USE
 * 
 * VERITAS ROUTING & SECURITY MIDDLEWARE
 * - /admin routes directly to /admin/dashboard
 * - /admin/login routes directly to /admin/dashboard (no login form rendered)
 * - All admin views (/admin/*) are accessible directly without auth gate
 * - Admin API routes (/api/admin/*) pass through without requiring cookies
 * - Public storefront routes (/, /shop, /products/*, /cart, /checkout, etc.) remain open
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Direct /admin base route immediately to /admin/dashboard
  if (pathname === '/admin') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  // 2. Direct /admin/login immediately to /admin/dashboard
  if (pathname === '/admin/login') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  // 3. Admin Web UI Routes (/admin/*)
  // TEMPORARILY DISABLED ADMIN AUTH: Allow all admin routes to open directly without login
  if (pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // 4. Admin API Routes (/api/admin/*)
  // Direct access permitted while auth is temporarily disabled
  if (pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }

  // 5. Public storefront routes remain 100% accessible
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
};
