'use client';

import Link from 'next/link';
import { 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Package, 
  RefreshCw, 
  Truck,
  CheckCircle2,
  Layers,
  ShoppingBag
} from 'lucide-react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { ProductCard } from '@/components/product-card';
import { useProductsStore, isProductPubliclyVisible } from '@/lib/product-store';
import { formatZAR } from '@/lib/utils';

export default function HomePage() {
  const products = useProductsStore();
  const publishedProducts = products.filter(isProductPubliclyVisible);
  const dropProducts = publishedProducts.filter(p => p.collection === 'DROP 001' || p.drop === 'DROP 001');
  const featuredProducts = publishedProducts.slice(0, 4);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col selection:bg-[#D4AF37] selection:text-black">
      <StoreHeader />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden border-b border-[#1A1A1A] px-4 py-20">
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#222_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-[#0A0A0A]/80 pointer-events-none" />

          <div className="relative z-10 max-w-5xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#141414] border border-[#2B2B2B] rounded-full text-[10px] sm:text-xs font-mono uppercase tracking-[0.25em] text-[#D4AF37]">
              <Sparkles className="w-3 h-3 text-[#D4AF37]" />
              <span>DROP 001: GENESIS ARCHIVE • NOW LIVE</span>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight text-white leading-none">
              ELEVATED <br className="hidden sm:inline" />
              <span className="text-[#D4AF37]">STREETWEAR</span>
            </h1>

            <p className="text-xs sm:text-sm md:text-base text-[#888] font-light max-w-2xl mx-auto tracking-wide leading-relaxed">
              Architectural silhouettes crafted with heavyweight custom textiles. Designed, engineered, and dispatched from South Africa.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
              <Link
                href="/shop"
                className="w-full sm:w-auto px-8 py-4 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Shop Collection</span>
              </Link>
              <Link
                href="/drop-001"
                className="w-full sm:w-auto px-8 py-4 bg-[#141414] hover:bg-[#1C1C1C] text-white border border-[#2B2B2B] hover:border-[#444] font-bold uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-2"
              >
                <span>View DROP 001</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* TRUST PILLARS BAR */}
        <section className="border-b border-[#1A1A1A] bg-[#0E0E0E] py-6 px-4">
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-3">
              <div className="w-10 h-10 rounded bg-[#161616] border border-[#262626] flex items-center justify-center text-[#D4AF37] shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase text-white tracking-wider">Nationwide Courier</h4>
                <p className="text-[11px] text-[#777] font-mono">Free over R1,500 across SA</p>
              </div>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-3">
              <div className="w-10 h-10 rounded bg-[#161616] border border-[#262626] flex items-center justify-center text-[#D4AF37] shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase text-white tracking-wider">450 GSM Heavy Cotton</h4>
                <p className="text-[11px] text-[#777] font-mono">Bespoke milled textiles</p>
              </div>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-3">
              <div className="w-10 h-10 rounded bg-[#161616] border border-[#262626] flex items-center justify-center text-[#D4AF37] shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase text-white tracking-wider">OTC Studio Queue</h4>
                <p className="text-[11px] text-[#777] font-mono">Live fulfilment tracking</p>
              </div>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-3">
              <div className="w-10 h-10 rounded bg-[#161616] border border-[#262626] flex items-center justify-center text-[#D4AF37] shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase text-white tracking-wider">14-Day Exchanges</h4>
                <p className="text-[11px] text-[#777] font-mono">Guaranteed satisfaction</p>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURED / NEW ARRIVALS SECTION */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 border-b border-[#1F1F1F] pb-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#D4AF37] font-bold">
                CURATED SELECTION
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-wider text-white mt-1">
                New Arrivals
              </h2>
            </div>
            <Link
              href="/shop"
              className="text-xs font-mono uppercase tracking-widest text-[#AAA] hover:text-[#D4AF37] flex items-center gap-1.5 transition-colors"
            >
              <span>View Full Archive ({publishedProducts.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Product Grid: 1 col on 320px, 2 col on 375px+, 4 col on lg */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {featuredProducts.map((product, idx) => (
              <ProductCard key={product.id} product={product} priority={idx === 0} />
            ))}
          </div>
        </section>

        {/* DROP 001 BANNER FEATURE */}
        <section className="border-t border-b border-[#1F1F1F] bg-gradient-to-b from-[#111] to-[#0A0A0A] py-16 sm:py-24 px-4">
          <div className="max-w-5xl mx-auto text-center space-y-6">
            <span className="text-[10px] font-mono uppercase tracking-[0.35em] text-[#D4AF37] font-bold">
              LIMITED RUN ARCHIVE
            </span>
            <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
              DROP 001: GENESIS
            </h2>
            <p className="text-xs sm:text-sm text-[#888] font-light max-w-xl mx-auto leading-relaxed">
              Strictly numbered production units. Once an edition is marked archived, it will never be re-issued. Every piece includes individual verification tags.
            </p>
            <div className="pt-2">
              <Link
                href="/drop-001"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white hover:bg-[#D4AF37] text-black font-bold uppercase text-xs tracking-widest transition-colors"
              >
                <span>Explore DROP 001</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* BRAND STATEMENT & SOUTH AFRICAN ATELIER */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#D4AF37] font-bold">
                THE VERITAS ATELIER
              </span>
              <h3 className="text-2xl sm:text-4xl font-bold uppercase tracking-wider text-white leading-tight">
                Precision Streetwear Crafted for Longevity
              </h3>
              <p className="text-xs sm:text-sm text-[#888] leading-relaxed">
                VERITAS rejects disposable fast-fashion cycles. Each garment begins with high-density cotton yarns, reactive pigment dye baths, and structured drop-shoulder patterns that hold their form through endless wears.
              </p>
              <div className="space-y-3 pt-2 font-mono text-xs text-[#AAA]">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                  <span>450 GSM Loopback French Terry & 280 GSM Combed Jersey</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                  <span>Over-the-Counter (OTC) bespoke packaging & tracking</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                  <span>Real-time cloud inventory synchronization</span>
                </div>
              </div>
              <div className="pt-2">
                <Link
                  href="/about"
                  className="text-xs font-mono uppercase tracking-widest text-[#D4AF37] hover:underline flex items-center gap-1.5"
                >
                  <span>Read The Full Story</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="bg-[#111] border border-[#222] p-8 sm:p-12 space-y-6 relative">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#888] border-b border-[#222] pb-3">
                GARMENT ENGINEERING STANDARDS
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <span className="text-3xl font-light text-[#D4AF37] font-mono">450</span>
                  <p className="text-[11px] font-mono text-[#888] uppercase mt-1">GSM Hoodie Weight</p>
                </div>
                <div>
                  <span className="text-3xl font-light text-white font-mono">100%</span>
                  <p className="text-[11px] font-mono text-[#888] uppercase mt-1">Combed Cotton</p>
                </div>
                <div>
                  <span className="text-3xl font-light text-white font-mono">ZAR</span>
                  <p className="text-[11px] font-mono text-[#888] uppercase mt-1">South African Rand</p>
                </div>
                <div>
                  <span className="text-3xl font-light text-emerald-400 font-mono">24/7</span>
                  <p className="text-[11px] font-mono text-[#888] uppercase mt-1">Admin Telemetry</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <StoreFooter />
    </div>
  );
}
