'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, Layers, ShieldCheck, MapPin } from 'lucide-react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col selection:bg-[#D4AF37] selection:text-black">
      <StoreHeader />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-16">
        {/* EDITORIAL HERO */}
        <div className="text-center space-y-4 border-b border-[#1F1F1F] pb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#141414] border border-[#2B2B2B] rounded-full text-[10px] font-mono uppercase tracking-[0.25em] text-[#D4AF37]">
            <Sparkles className="w-3 h-3 text-[#D4AF37]" />
            <span>THE VERITAS MANIFESTO</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-white">
            Architectural Precision.<br />
            South African Soul.
          </h1>

          <p className="text-xs sm:text-base text-[#888] font-light max-w-2xl mx-auto leading-relaxed">
            VERITAS was born from a singular conviction: luxury streetwear should not sacrifice structural integrity for seasonal hype.
          </p>
        </div>

        {/* 3 CORE PILLARS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#111] border border-[#222] p-6 sm:p-8 space-y-3 rounded-xs">
            <span className="text-2xl font-light text-[#D4AF37] font-mono">01</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Milled Heavyweight Cotton</h3>
            <p className="text-xs text-[#777] leading-relaxed">
              We exclusively use bespoke-milled 450 GSM French Terry and 280 GSM combed jersey cotton that drapes with mathematical structure.
            </p>
          </div>

          <div className="bg-[#111] border border-[#222] p-6 sm:p-8 space-y-3 rounded-xs">
            <span className="text-2xl font-light text-[#D4AF37] font-mono">02</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">The OTC Standard</h3>
            <p className="text-xs text-[#777] leading-relaxed">
              Every drop goes through our Over-the-Counter (OTC) inspection studio in Johannesburg before being sealed in custom garment bags.
            </p>
          </div>

          <div className="bg-[#111] border border-[#222] p-6 sm:p-8 space-y-3 rounded-xs">
            <span className="text-2xl font-light text-[#D4AF37] font-mono">03</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Numbered Limited Runs</h3>
            <p className="text-xs text-[#777] leading-relaxed">
              We produce in strict, limited numbered batches. Once a drop reaches archival status, the silhouette is never re-manufactured.
            </p>
          </div>
        </div>

        {/* ATELIER DETAILS */}
        <div className="bg-[#0E0E0E] border border-[#1F1F1F] p-8 sm:p-12 rounded-xs flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37]">
              <MapPin className="w-4 h-4" />
              <span>HEADQUARTERS & ATELIER</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold uppercase text-white">
              Engineered & Dispatched Nationwide in South Africa
            </h3>
            <p className="text-xs sm:text-sm text-[#888] leading-relaxed">
              From our studio in Johannesburg to coastal ateliers in Cape Town, our entire production cycle supports master South African patternmakers and textile artisans.
            </p>
          </div>

          <Link
            href="/shop"
            className="px-8 py-4 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-widest transition-colors shrink-0 flex items-center gap-2"
          >
            <span>Explore Garments</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      <StoreFooter />
    </div>
  );
}
