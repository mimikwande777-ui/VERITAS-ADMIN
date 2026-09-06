'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ShoppingBag, 
  Menu, 
  X, 
  ShieldCheck, 
  ChevronRight,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useCartStore } from '@/lib/cart-store';
import { useProductsStore, isProductPubliclyVisible } from '@/lib/product-store';

export function StoreHeader() {
  const pathname = usePathname();
  const { itemCount } = useCartStore();
  const products = useProductsStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    queueMicrotask(() => {
      setMobileMenuOpen(false);
    });
  }, [pathname]);

  const hasActiveDrop001 = useMemo(() => {
    return products.some(p => (p.collection === 'DROP 001' || p.drop === 'DROP 001') && isProductPubliclyVisible(p));
  }, [products]);

  const navLinks = [
    { label: 'Shop All', href: '/shop' },
    ...(hasActiveDrop001 ? [{ label: 'DROP 001', href: '/drop-001', badge: 'NEW' }] : []),
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <>
      {/* TOP ANNOUNCEMENT BAR */}
      <div className="bg-[#111] text-[#D4AF37] border-b border-[#222] py-1.5 px-4 text-[10px] sm:text-xs font-mono uppercase tracking-widest text-center flex items-center justify-between">
        <div className="hidden md:flex items-center gap-2 text-[#888]">
          <span>HANDCRAFTED IN SOUTH AFRICA</span>
        </div>
        <div className="flex-1 text-center font-bold">
          <span>COMPLIMENTARY NATIONWIDE COURIER ON ORDERS OVER R1,500</span>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <span className="text-[#888]">CURRENCY: <strong className="text-white">ZAR (R)</strong></span>
          <span className="text-[#333]">|</span>
          <Link 
            href="/admin/dashboard" 
            className="text-[#888] hover:text-[#D4AF37] transition-colors flex items-center gap-1"
          >
            <ShieldCheck className="w-3 h-3 text-[#D4AF37]" />
            Admin Console
          </Link>
        </div>
      </div>

      {/* MAIN NAVIGATION HEADER */}
      <header 
        className={`sticky top-0 z-40 w-full transition-all duration-300 ${
          scrolled 
            ? 'bg-[#0A0A0A]/95 backdrop-blur-md border-b border-[#1F1F1F] py-3.5 shadow-2xl' 
            : 'bg-[#0A0A0A] border-b border-[#1A1A1A] py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Left: Mobile Menu Trigger + Desktop Nav */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open mobile navigation"
              className="md:hidden p-2 text-[#CCC] hover:text-white rounded hover:bg-[#1A1A1A] transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={`text-xs uppercase tracking-[0.2em] font-semibold transition-colors relative py-1 ${
                      isActive 
                        ? 'text-[#D4AF37]' 
                        : 'text-[#999] hover:text-white'
                    }`}
                  >
                    {link.label}
                    {link.badge && (
                      <span className="ml-1.5 px-1.5 py-0.2 text-[8px] font-mono font-bold bg-[#D4AF37] text-black rounded-xs">
                        {link.badge}
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 w-full h-[1.5px] bg-[#D4AF37]" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Center: VERITAS Brand Logo */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <Link href="/" className="flex flex-col items-center group">
              <span className="text-xl sm:text-2xl md:text-3xl font-black tracking-[0.35em] text-white group-hover:text-[#D4AF37] transition-colors leading-none">
                VERITAS
              </span>
              <span className="text-[7px] sm:text-[8px] tracking-[0.4em] text-[#777] uppercase font-mono mt-1">
                ELEVATED STREETWEAR
              </span>
            </Link>
          </div>

          {/* Right: Currency + Admin Link + Bag/Cart Button */}
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden sm:flex items-center text-[10px] font-mono font-bold text-[#888] bg-[#141414] px-2.5 py-1 rounded border border-[#222]">
              <span className="text-white">ZAR (R)</span>
            </div>

            <Link
              href="/admin/dashboard"
              className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-[#888] hover:text-[#D4AF37] px-2.5 py-1 rounded border border-[#222] hover:border-[#D4AF37]/50 transition-colors"
              title="Switch to Admin Dashboard"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Admin</span>
            </Link>

            {/* Shopping Bag Button */}
            <Link
              href="/cart"
              aria-label="View Shopping Bag"
              className="relative p-2.5 text-white hover:text-[#D4AF37] bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] rounded-sm transition-all flex items-center gap-2 group"
            >
              <ShoppingBag className="w-5 h-5 group-hover:scale-105 transition-transform text-[#CCC] group-hover:text-[#D4AF37]" />
              <span className="hidden sm:inline text-xs font-mono font-bold uppercase tracking-wider">
                Bag
              </span>
              {itemCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold font-mono text-black bg-[#D4AF37] rounded-full animate-in zoom-in">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER NAVIGATION OVERLAY */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-out Menu */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#0F0F0F] border-r border-[#222] h-full shadow-2xl z-10 overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-6 border-b border-[#1F1F1F] flex items-center justify-between">
              <div>
                <span className="text-xl font-bold tracking-[0.3em] text-white block">VERITAS</span>
                <span className="text-[9px] font-mono tracking-widest text-[#888] uppercase block mt-0.5">EST. SOUTH AFRICA</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-[#888] hover:text-white rounded hover:bg-[#1A1A1A] transition-colors"
                aria-label="Close menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Navigation Items */}
            <nav className="p-6 space-y-2 flex-1">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#666] mb-3">
                Navigation
              </div>
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-3.5 rounded text-sm uppercase tracking-widest font-bold transition-all ${
                      isActive 
                        ? 'bg-[#181818] text-[#D4AF37] border-l-2 border-[#D4AF37]' 
                        : 'text-[#CCC] hover:text-white hover:bg-[#141414]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {link.label}
                      {link.badge && (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#D4AF37] text-black rounded-xs">
                          {link.badge}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#555]" />
                  </Link>
                );
              })}

              <div className="pt-6 border-t border-[#1F1F1F] mt-6 space-y-3">
                <Link
                  href="/cart"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between p-3.5 bg-[#161616] border border-[#2B2B2B] text-white rounded text-sm uppercase tracking-wider font-bold"
                >
                  <span className="flex items-center gap-2.5">
                    <ShoppingBag className="w-4 h-4 text-[#D4AF37]" />
                    Shopping Bag
                  </span>
                  <span className="font-mono text-xs text-[#D4AF37]">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </span>
                </Link>

                <Link
                  href="/admin/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between p-3.5 bg-[#121212] border border-amber-900/30 text-amber-300 rounded text-xs uppercase font-mono tracking-wider font-bold"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                    Admin Dashboard
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </nav>

            {/* Drawer Footer */}
            <div className="p-6 border-t border-[#1F1F1F] bg-[#0A0A0A] text-xs font-mono text-[#888] space-y-2">
              <div className="flex items-center justify-between">
                <span>CURRENCY</span>
                <span className="font-bold text-white">ZAR (R)</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>NATIONWIDE COURIER</span>
                <span className="text-emerald-400 font-bold">SOUTH AFRICA</span>
              </div>
              <p className="text-[10px] text-[#555] pt-2">
                © {new Date().getFullYear()} VERITAS APPAREL GROUP
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
