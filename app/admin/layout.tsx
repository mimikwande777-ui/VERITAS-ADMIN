'use client';

/**
 * TEMPORARILY DISABLED ADMIN AUTH
 * RESTORE BEFORE PUBLIC PRODUCTION USE
 * 
 * Authentication gate and login redirect loops are completely disabled.
 * The Admin UI opens directly without sign-in requirements or loading screens.
 * The full original auth layout is preserved in /app/admin/layout.preserved.tsx.
 */

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Search, X } from 'lucide-react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { AdminAuthProvider, useAdminAuth } from '@/lib/auth-context';
import { PWAOfflineBanner } from '@/components/pwa-offline-banner';
import { PWAUpdateBanner } from '@/components/pwa-update-banner';
import { PWAInstallButton } from '@/components/pwa-install-button';
import { AdminMobileBottomNav } from '@/components/admin-mobile-bottom-nav';

function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { user, role } = useAdminAuth();

  // 1. If user navigates to /admin/login directly, redirect immediately to /admin/dashboard
  useEffect(() => {
    if (pathname === '/admin/login') {
      router.replace('/admin/dashboard');
    }
  }, [pathname, router]);

  if (pathname === '/admin/login') {
    return null;
  }

  // Determine current section label for header display
  let sectionLabel = 'Dashboard';
  if (pathname?.startsWith('/admin/settings')) {
    sectionLabel = 'System Settings';
  } else if (pathname?.startsWith('/admin/discounts')) {
    sectionLabel = 'Discounts & Promotions';
  } else if (pathname?.startsWith('/admin/products/new')) {
    sectionLabel = 'Add New Product';
  } else if (pathname?.startsWith('/admin/products')) {
    sectionLabel = 'Product Catalog';
  } else if (pathname?.startsWith('/admin/inventory')) {
    sectionLabel = 'Inventory Control';
  } else if (pathname?.startsWith('/admin/orders')) {
    sectionLabel = 'Order Management';
  } else if (pathname?.startsWith('/admin/sales')) {
    sectionLabel = 'Sales & Revenue';
  } else if (pathname?.startsWith('/admin/collections')) {
    sectionLabel = 'Collections';
  } else if (pathname?.startsWith('/admin/categories')) {
    sectionLabel = 'Categories';
  } else if (pathname?.startsWith('/admin/media')) {
    sectionLabel = 'Media Assets';
  } else if (pathname?.startsWith('/admin/activity')) {
    sectionLabel = 'Audit Activity Log';
  } else if (pathname?.startsWith('/admin/customers')) {
    sectionLabel = 'Customer Profiles';
  } else if (pathname?.startsWith('/admin/install')) {
    sectionLabel = 'PWA App Installation';
  }

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] w-full max-w-full overflow-hidden bg-[#0A0A0A] text-[#E0E0E0] font-sans antialiased">
      {/* Mobile Sidebar Slide-Out Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" 
            onClick={() => setIsMobileMenuOpen(false)} 
            aria-hidden="true" 
          />
          <div className="relative flex-1 flex flex-col max-w-[280px] w-[80vw] bg-[#0F0F0F] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200 pt-safe pb-safe border-r border-[#1F1F1F]">
            <div className="h-14 flex items-center justify-between px-4 border-b border-[#1F1F1F] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-white flex items-center justify-center rounded-xs shadow">
                  <div className="w-3.5 h-3.5 bg-black rotate-45"></div>
                </div>
                <div>
                  <span className="text-xs font-bold tracking-[0.2em] text-white block leading-none">VERITAS</span>
                  <span className="text-[8px] tracking-[0.15em] text-[#D4AF37] font-mono uppercase block mt-0.5">ADMIN</span>
                </div>
              </div>
              <button
                type="button"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-[#888] hover:text-white hover:bg-white/10 focus:outline-none cursor-pointer"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
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
        {/* PWA SYSTEM & CONNECTIVITY BANNERS */}
        <PWAOfflineBanner />
        <PWAUpdateBanner />

        {/* ADMIN TOP HEADER */}
        <header className="relative bg-[#0F0F0F] border-b border-[#1F1F1F] h-14 md:h-16 flex items-center justify-between px-3 sm:px-4 md:px-6 shrink-0 z-10 pt-safe">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button 
              type="button"
              className="text-[#888] hover:text-white focus:outline-none md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-[#1A1A1A] active:bg-[#222] cursor-pointer"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-white font-bold tracking-widest text-xs uppercase shrink-0">VERITAS</span>
              <span className="text-[#555] shrink-0">/</span>
              <span className="text-[#D4AF37] font-mono text-xs uppercase tracking-wider font-bold truncate max-w-[130px] sm:max-w-[200px] md:max-w-none">
                {sectionLabel}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Desktop Search Field */}
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
            <div className="hidden sm:block">
              <PWAInstallButton variant="header" />
            </div>
            
            {/* Authenticated Admin Identity Badge */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-[#141414] border border-[#262626] px-2 sm:px-2.5 py-1 rounded-xs">
              <div className="w-6 h-6 rounded-xs bg-[#222] border border-[#333] flex items-center justify-center text-[10px] font-bold text-[#D4AF37] shrink-0">
                SA
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-[11px] font-bold text-white font-mono leading-tight truncate max-w-[130px]">
                  {user?.email || 'admin@veritas.internal'}
                </div>
                <div className="text-[9px] font-mono uppercase tracking-wider text-[#888]">
                  Super Admin
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase hidden sm:inline bg-amber-950/60 text-[#D4AF37] border border-[#D4AF37]/40">
                {role ? role.replace('_', ' ') : 'Super Admin'}
              </span>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT CANVAS */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden focus:outline-none bg-[#0A0A0A] relative z-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="p-3 sm:p-5 lg:p-8 max-w-[1600px] mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8 w-full min-w-0">
            {children}
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
