'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  CheckCircle2, 
  Truck, 
  Package, 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  ShoppingBag,
  ExternalLink
} from 'lucide-react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams?.get('orderNumber') || 'ORD-9482';
  const orderId = searchParams?.get('orderId') || '';
  const customerEmail = searchParams?.get('email') || 'client@veritas-official.com';
  const customerName = searchParams?.get('name') || 'Valued Client';

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* SUCCESS BANNER */}
      <div className="bg-[#0E0E0E] border border-[#1F1F1F] rounded-xs p-6 sm:p-10 space-y-8 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-4 border-b border-[#1A1A1A] pb-8">
          <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-700/60 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#D4AF37] font-bold">
              ORDER CONFIRMED & LOGGED IN SUPABASE
            </span>
            <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white">
              Thank You, {customerName}
            </h1>
            <p className="text-xs sm:text-sm text-[#888] font-mono">
              Confirmation receipt and courier dispatch updates have been dispatched to <strong className="text-white">{customerEmail}</strong>.
            </p>
          </div>
        </div>

        {/* ORDER TELEMETRY SUMMARY */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-4 bg-[#141414] border border-[#222] rounded-xs space-y-1">
            <span className="text-[10px] text-[#777] uppercase">Order Reference</span>
            <p className="text-sm font-bold text-white uppercase">{orderNumber}</p>
          </div>

          <div className="p-4 bg-[#141414] border border-[#222] rounded-xs space-y-1">
            <span className="text-[10px] text-[#777] uppercase">Fulfillment Status</span>
            <p className="text-sm font-bold text-[#D4AF37] uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Pending OTC Dispatch</span>
            </p>
          </div>

          <div className="p-4 bg-[#141414] border border-[#222] rounded-xs space-y-1">
            <span className="text-[10px] text-[#777] uppercase">Nationwide Courier</span>
            <p className="text-sm font-bold text-emerald-400 uppercase flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              <span>3-5 Working Days</span>
            </p>
          </div>
        </div>

        {/* NEXT STEPS CARD */}
        <div className="bg-[#121212] border border-[#262626] p-6 rounded-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-[#D4AF37]" />
            <span>Over-the-Counter (OTC) Production Journey</span>
          </h3>

          <div className="space-y-3 font-mono text-xs text-[#AAA]">
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-emerald-900/60 text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                ✓
              </span>
              <div>
                <strong className="text-white block">Order Encrypted & Authenticated</strong>
                <span className="text-[#777] text-[11px]">Your payment and line items are locked into our central PostgreSQL database.</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-[#222] text-[#D4AF37] border border-[#444] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                2
              </span>
              <div>
                <strong className="text-white block">Johannesburg Studio OTC Inspection</strong>
                <span className="text-[#777] text-[11px]">Quality control verification, security tag seal, and custom garment sleeve preparation.</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-[#222] text-[#888] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                3
              </span>
              <div>
                <strong className="text-white block">Express Courier Handoff</strong>
                <span className="text-[#777] text-[11px]">Waybill generation and live SMS tracking sent directly to your phone.</span>
              </div>
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#1A1A1A]">
          <Link
            href="/shop"
            className="w-full sm:w-auto px-6 py-3 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-widest transition-colors inline-flex items-center justify-center gap-2"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Continue Shopping</span>
          </Link>

          <Link
            href="/admin/orders"
            className="w-full sm:w-auto px-6 py-3 bg-[#161616] hover:bg-[#202020] text-white border border-[#333] font-bold uppercase text-xs font-mono tracking-wider transition-colors inline-flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>View in Admin Orders Queue</span>
            <ExternalLink className="w-3 h-3 text-[#777]" />
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function OrderConfirmationPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col selection:bg-[#D4AF37] selection:text-black">
      <StoreHeader />
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center p-8 text-xs font-mono text-[#888]">
          Loading confirmation...
        </div>
      }>
        <ConfirmationContent />
      </Suspense>
      <StoreFooter />
    </div>
  );
}
