'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Search, Bell, X, ShieldAlert, ShieldCheck, LogOut, Lock, UserCheck } from 'lucide-react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { SupabaseStatusBanner } from '@/components/supabase-status-banner';
import { AdminAuthProvider, useAdminAuth } from '@/lib/auth-context';
import { AdminAccessDenied } from '@/components/admin-access-denied';
import { PWAOfflineBanner } from '@/components/pwa-offline-banner';
import { PWAUpdateBanner } from '@/components/pwa-update-banner';
import { PWAInstallButton } from '@/components/pwa-install-button';
import { AdminMobileBottomNav } from '@/components/admin-mobile-bottom-nav';

function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { 
    user, 
    role, 
    isLoading, 
    isAuthenticated, 
    isDevBypass, 
    toggleDevBypass, 
    signOut, 
    hasAccess 
  } = useAdminAuth();

  // 1. If viewing the login page, render cleanly without the admin chrome
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // 2. Loading state while checking Supabase session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070707] flex flex-col items-center justify-center text-[#888] font-mono space-y-4">
        <div className="w-10 h-10 bg-white flex items-center justify-center rounded-xs shadow-2xl">
          <div className="w-5 h-5 bg-black rotate-45 animate-spin"></div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white">VERITAS SECURITY GATEWAY</p>
          <p className="text-[10px] text-[#666] uppercase tracking-widest">Validating Administrative Clearance...</p>
        </div>
      </div>
    );
  }

  // 3. Authentication Enforcement
  // If not authenticated and dev bypass is not active, redirect to /admin/login
  if (!isAuthenticated && !isDevBypass) {
    if (typeof window !== 'undefined') {
      const redirectTarget = pathname ? `/admin/login?redirect=${encodeURIComponent(pathname)}` : '/admin/login';
      router.replace(redirectTarget);
    }
    return (
      <div className="min-h-screen bg-[#070707] flex flex-col items-center justify-center text-[#888] font-mono space-y-2">
        <Lock className="w-8 h-8 text-[#D4AF37] animate-pulse" />
        <p className="text-xs font-bold uppercase tracking-wider text-white">AUTHENTICATION REQUIRED</p>
        <p className="text-[10px] text-[#666]">Redirecting to secure login portal...</p>
      </div>
    );
  }

  // 4. RBAC Route Clearance Check
  let hasRouteAccess = true;
  let requiredRole = 'manager';
  let sectionLabel = 'Dashboard';

  if (pathname?.startsWith('/admin/settings')) {
    sectionLabel = 'System Settings';
    requiredRole = 'super_admin';
    hasRouteAccess = hasAccess('canManageSettings');
  } else if (pathname?.startsWith('/admin/discounts')) {
    sectionLabel = 'Discounts & Promotions';
    requiredRole = 'admin';
    hasRouteAccess = hasAccess('canManageDiscounts');
  } else if (pathname?.startsWith('/admin/products')) {
    sectionLabel = 'Product Catalog';
    requiredRole = 'manager';
    hasRouteAccess = hasAccess('canManageProducts');
  } else if (pathname?.startsWith('/admin/inventory')) {
    sectionLabel = 'Inventory Control';
    requiredRole = 'manager';
    hasRouteAccess = hasAccess('canManageInventory');
  } else if (pathname?.startsWith('/admin/orders')) {
    sectionLabel = 'Order Management';
    requiredRole = 'manager';
    hasRouteAccess = hasAccess('canManageOrders');
  } else if (pathname?.startsWith('/admin/sales')) {
    sectionLabel = 'Sales & Revenue';
    requiredRole = 'manager';
    hasRouteAccess = hasAccess('canViewSalesAnalytics');
  } else if (pathname?.startsWith('/admin/collections')) {
    sectionLabel = 'Collections';
    requiredRole = 'manager';
    hasRouteAccess = hasAccess('canManageCollections');
  } else if (pathname?.startsWith('/admin/categories')) {
    sectionLabel = 'Categories';
    requiredRole = 'manager';
    hasRouteAccess = hasAccess('canManageCategories');
  } else if (pathname?.startsWith('/admin/media')) {
    sectionLabel = 'Media Assets';
    requiredRole = 'manager';
    hasRouteAccess = hasAccess('canManageMedia');
  } else if (pathname?.startsWith('/admin/activity')) {
    sectionLabel = 'Audit Activity Log';
    requiredRole = 'manager';
    hasRouteAccess = hasAccess('canViewActivityLog');
  } else if (pathname?.startsWith('/admin/customers')) {
    sectionLabel = 'Customer Profiles';
    requiredRole = 'manager';
    hasRouteAccess = hasAccess('canViewCustomers');
  }

  const currentSection = (pathname || '')
    .replace('/admin/', '')
    .replace('/admin', 'dashboard')
    .toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-[#0A0A0A] text-[#E0E0E0] font-sans antialiased">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsMobileMenuOpen(false)} 
            aria-hidden="true" 
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#0F0F0F] h-full shadow-2xl">
            <div className="absolute top-0 right-0 -mr-12 pt-4">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full text-white hover:bg-white/10 focus:outline-none"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 h-0 overflow-y-auto">
              <AdminSidebar 
                currentPath={pathname || ''} 
                onNavigate={() => setIsMobileMenuOpen(false)} 
              />
            </div>
          </div>
        </div>
      )}

      {/* LEFT: DESKTOP SIDEBAR */}
      <aside className="hidden md:flex md:w-64 md:flex-col shrink-0 h-full border-r border-[#1F1F1F] bg-[#0F0F0F] z-20">
        <AdminSidebar currentPath={pathname || ''} />
      </aside>

      {/* RIGHT: TOP HEADER + MAIN CONTENT CANVAS */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0A0A0A]">
        {/* TOP MODE & SECURITY BANNER */}
        {isDevBypass ? (
          <div className="bg-amber-950/40 border-b border-amber-800/40 px-4 py-1.5 flex items-center justify-between text-xs text-amber-200/90 font-mono shrink-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-900/60 text-amber-200 border border-amber-700/60 uppercase tracking-wider">
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                Development Bypass Active
              </span>
              <span className="text-[11px] text-amber-200/80 hidden sm:inline">
                Admin authentication is currently bypassed for testing (<code className="text-white bg-black/40 px-1 py-0.2 rounded font-mono">ADMIN_AUTH_BYPASS=true</code>).
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleDevBypass(false)}
                className="text-[10px] uppercase font-bold text-amber-300 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
                title="Test strict login requirement"
              >
                Simulate Production Lock
              </button>
              <div className="text-[10px] font-mono text-[#888] uppercase tracking-wider hidden md:block">
                RBAC ACTIVE: {role.toUpperCase()}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#0B1510] border-b border-emerald-900/40 px-4 py-1.5 flex items-center justify-between text-xs text-emerald-300/90 font-mono shrink-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Production Security Active
              </span>
              <span className="text-[11px] text-emerald-200/80 hidden sm:inline">
                Authenticated session via Supabase Auth. Route authorization strictly verified.
              </span>
            </div>
            <div className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-wider hidden md:block">
              ROLE: {role.toUpperCase()} • RLS ENFORCED
            </div>
          </div>
        )}

        {/* SUPABASE STATUS & CONFIGURATION BANNER */}
        <SupabaseStatusBanner />

        {/* PWA SYSTEM & CONNECTIVITY BANNERS */}
        <PWAOfflineBanner />
        <PWAUpdateBanner />

        {/* ADMIN TOP HEADER */}
        <header className="relative bg-[#0F0F0F] border-b border-[#1F1F1F] h-16 flex items-center justify-between px-4 md:px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              className="text-[#888] hover:text-white focus:outline-none md:hidden p-1.5 rounded hover:bg-[#1A1A1A]"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            
            <div className="flex items-center gap-2">
              <span className="text-white font-bold tracking-widest text-sm uppercase hidden sm:inline md:hidden">VERITAS ADMIN</span>
              <span className="text-[#444] mx-1 hidden sm:inline md:hidden">/</span>
              <span className="text-[#D4AF37] font-mono text-xs uppercase tracking-wider font-bold">{sectionLabel}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="bg-[#151515] px-3 py-1.5 rounded border border-[#262626] text-xs text-[#888] w-40 sm:w-56 hidden md:flex items-center gap-2 focus-within:border-[#D4AF37] focus-within:ring-1 focus-within:ring-[#D4AF37]/50 transition-all">
              <Search className="w-3.5 h-3.5 text-[#666]" />
              <input
                id="search-field"
                className="w-full bg-transparent border-none focus:outline-none text-white placeholder-[#555] text-xs"
                placeholder="Search orders, SKU..."
                type="search"
                name="search"
              />
            </div>

            {/* PWA Header Install Trigger */}
            <PWAInstallButton variant="header" />
            
            {/* Authenticated Admin Identity Badge */}
            <div className="flex items-center gap-2 bg-[#141414] border border-[#262626] px-2.5 py-1 rounded-xs">
              <div className="w-6 h-6 rounded-xs bg-[#222] border border-[#333] flex items-center justify-center text-[10px] font-bold text-[#D4AF37] shrink-0">
                {role === 'super_admin' ? 'SA' : role === 'admin' ? 'AD' : 'MG'}
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-[11px] font-bold text-white font-mono leading-tight truncate max-w-[130px]">
                  {user?.email || 'admin@veritas.internal'}
                </div>
                <div className="text-[9px] font-mono uppercase tracking-wider text-[#888]">
                  {role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Admin' : 'Manager'}
                </div>
              </div>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                role === 'super_admin' 
                  ? 'bg-amber-950/60 text-[#D4AF37] border border-[#D4AF37]/40' 
                  : role === 'admin'
                  ? 'bg-blue-950/60 text-blue-300 border border-blue-700/40'
                  : 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/40'
              }`}>
                {role.replace('_', ' ')}
              </span>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => { void signOut(); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#181818] hover:bg-red-950/40 border border-[#2B2B2B] hover:border-red-800/60 text-[#888] hover:text-red-300 text-xs font-mono uppercase tracking-wider rounded-xs transition-colors cursor-pointer"
              title="Sign out of Admin"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Logout</span>
            </button>
          </div>
        </header>

        {/* MAIN CONTENT CANVAS */}
        <main className="flex-1 overflow-y-auto focus:outline-none bg-[#0A0A0A] relative z-0">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto pb-20 md:pb-8">
            {hasRouteAccess ? children : (
              <AdminAccessDenied sectionName={sectionLabel} requiredRole={requiredRole} />
            )}
          </div>
        </main>

        {/* MOBILE BOTTOM NAVIGATION BAR */}
        <AdminMobileBottomNav onOpenMenu={() => setIsMobileMenuOpen(true)} />
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminLayoutShell>
        {children}
      </AdminLayoutShell>
    </AdminAuthProvider>
  );
}
