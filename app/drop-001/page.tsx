'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, ArrowLeft, ShieldCheck, Clock, Layers } from 'lucide-react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { ProductCard } from '@/components/product-card';
import { useProductsStore, isProductPubliclyVisible } from '@/lib/product-store';

export default function Drop001Page() {
  const products = useProductsStore();

  const allDropItems = products.filter(p => p.collection === 'DROP 001' || p.drop === 'DROP 001' || p.tags?.includes('DROP 001'));
  const isDropInactive = allDropItems.length > 0 && allDropItems.every(p => p.collectionIsActive === false);

  const dropProducts = products
    .filter(isProductPubliclyVisible)
    .filter(p => p.collection === 'DROP 001' || p.drop === 'DROP 001' || p.tags?.includes('DROP 001'));

  const displayProducts = dropProducts;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col selection:bg-[#D4AF37] selection:text-black">
      <StoreHeader />

      <main className="flex-1">
        {/* DROP 001 EDITORIAL HERO */}
        <section className="border-b border-[#1F1F1F] bg-radial from-[#1A1A1A] via-[#0E0E0E] to-[#0A0A0A] py-16 sm:py-24 px-4 text-center">
          <div className="max-w-4xl mx-auto space-y-4">
            <Link 
              href="/shop"
              className="inline-flex items-center gap-1 text-xs font-mono text-[#888] hover:text-[#D4AF37] mb-2 uppercase tracking-widest"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Catalogue</span>
            </Link>

            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#141414] border border-[#D4AF37]/30 rounded-full text-[10px] font-mono uppercase tracking-[0.25em] text-[#D4AF37]">
              <Sparkles className="w-3 h-3 text-[#D4AF37]" />
              <span>OFFICIAL GENESIS RELEASE</span>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-white">
              DROP 001: GENESIS
            </h1>

            <p className="text-xs sm:text-sm text-[#888] font-light max-w-xl mx-auto leading-relaxed">
              Constructed in limited edition batches. Featuring heavy 450 GSM brushed cotton, custom acid treatments, and numbered Over-the-Counter certificates.
            </p>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-[#AAA]">
              <span className="flex items-center gap-1.5 bg-[#141414] px-3 py-1.5 rounded border border-[#222]">
                <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>LIMITED RUN RELEASE</span>
              </span>
              <span className="flex items-center gap-1.5 bg-[#141414] px-3 py-1.5 rounded border border-[#222]">
                <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>BESPOKE 450 GSM WEAVE</span>
              </span>
            </div>
          </div>
        </section>

        {/* PRODUCTS LISTING */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-4 mb-8">
            <h2 className="text-sm font-mono uppercase tracking-widest text-[#AAA]">
              Available Editions ({displayProducts.length})
            </h2>
            <span className="text-xs font-mono text-[#666]">
              CURRENCY: ZAR (R)
            </span>
          </div>

          {displayProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {displayProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center border border-dashed border-[#222] bg-[#0E0E0E] rounded-xs p-8">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {isDropInactive ? 'Drop 001 Currently Inactive' : 'No Garments In Drop 001'}
              </h3>
              <p className="text-xs text-[#777] font-mono mt-1 max-w-md mx-auto">
                {isDropInactive
                  ? 'This collection release is currently inactive and garments are not available for purchase.'
                  : 'There are no active pieces currently listed under this drop.'}
              </p>
              <Link
                href="/shop"
                className="mt-4 inline-block px-4 py-2 bg-[#D4AF37] text-black text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F] transition-colors"
              >
                Browse All Catalogue
              </Link>
            </div>
          )}
        </section>
      </main>

      <StoreFooter />
    </div>
  );
}
