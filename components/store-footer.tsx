'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ShieldCheck, Mail, MapPin } from 'lucide-react';

export function StoreFooter() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setSubscribed(true);
    setTimeout(() => {
      setEmail('');
    }, 4000);
  };

  return (
    <footer className="bg-[#080808] border-t border-[#1C1C1C] text-[#AAA] transition-colors">
      {/* NEWSLETTER VIP CLUB SECTION */}
      <div className="border-b border-[#1A1A1A] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#D4AF37] font-bold">
            THE VERITAS ARCHIVE • VIP ACCESS
          </span>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold uppercase tracking-wider text-white">
            Receive Private Invitations to Limited Drops
          </h2>
          <p className="text-xs sm:text-sm text-[#888] font-light max-w-xl mx-auto">
            Early access passwords, private lookbooks, and OTC bespoke release notices. Uncompromising South African craftsmanship.
          </p>

          <form onSubmit={handleSubscribe} className="max-w-md mx-auto mt-6 flex flex-col sm:flex-row gap-2">
            {subscribed ? (
              <div className="w-full py-3 px-4 bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs font-mono rounded flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>You are on the VIP guest list for upcoming drops.</span>
              </div>
            ) : (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="flex-1 bg-[#121212] border border-[#2B2B2B] text-white px-4 py-3 text-xs placeholder:text-[#555] focus:outline-hidden focus:border-[#D4AF37] transition-colors"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-widest transition-colors flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>Join</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </form>
        </div>
      </div>

      {/* FOOTER MAIN CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Info */}
          <div className="space-y-4 sm:col-span-2 md:col-span-1">
            <span className="text-xl font-bold tracking-[0.3em] text-white block">VERITAS</span>
            <p className="text-xs text-[#777] leading-relaxed">
              Architectural silhouettes, heavyweight custom textiles, and uncompromising luxury streetwear constructed in South Africa.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs font-mono text-[#888]">
              <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Johannesburg & Cape Town, South Africa</span>
            </div>
          </div>

          {/* Shop Navigation */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white">Collections</h3>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <Link href="/shop" className="hover:text-[#D4AF37] transition-colors block py-0.5">
                  All Garments
                </Link>
              </li>
              <li>
                <Link href="/drop-001" className="hover:text-[#D4AF37] transition-colors block py-0.5 flex items-center gap-1.5">
                  <span>DROP 001: Genesis</span>
                  <span className="text-[9px] text-[#D4AF37] font-bold">LIMITED</span>
                </Link>
              </li>
              <li>
                <Link href="/shop?category=Hoodies" className="hover:text-[#D4AF37] transition-colors block py-0.5">
                  Heavyweight Hoodies
                </Link>
              </li>
              <li>
                <Link href="/shop?category=Tees" className="hover:text-[#D4AF37] transition-colors block py-0.5">
                  Oversized Tees
                </Link>
              </li>
            </ul>
          </div>

          {/* Concierge & Support */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white">Client Concierge</h3>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <Link href="/about" className="hover:text-[#D4AF37] transition-colors block py-0.5">
                  The Atelier & Craft
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-[#D4AF37] transition-colors block py-0.5">
                  Contact & Inquiries
                </Link>
              </li>
              <li>
                <span className="text-[#666] block py-0.5">
                  Shipping: 3-5 Working Days (Nationwide)
                </span>
              </li>
              <li>
                <span className="text-[#666] block py-0.5">
                  Returns: 14-Day Complimentary Exchange
                </span>
              </li>
            </ul>
          </div>

          {/* Operations & Administration */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white">Administration</h3>
            <p className="text-xs text-[#666]">
              Real-time inventory and OTC order dispatch control system.
            </p>
            <div className="pt-2">
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#141414] hover:bg-[#1A1A1A] border border-[#2B2B2B] text-[#D4AF37] rounded text-xs font-mono font-bold uppercase tracking-wider transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                Admin Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* BOTTOM COPYRIGHT & COMPLIANCE BAR */}
        <div className="mt-12 pt-6 border-t border-[#171717] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#666]">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
            <span>© {new Date().getFullYear()} VERITAS APPAREL GROUP (PTY) LTD.</span>
            <span>•</span>
            <span>ALL RIGHTS RESERVED</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-[#888]">CURRENCY: <strong className="text-white">ZAR (R)</strong></span>
            <span>•</span>
            <span className="text-emerald-500 font-bold">SECURE SSL CHECKOUT</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
