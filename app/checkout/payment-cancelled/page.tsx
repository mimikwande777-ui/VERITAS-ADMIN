'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  XCircle, 
  ShoppingBag, 
  ArrowLeft, 
  HelpCircle,
  ShieldAlert
} from 'lucide-react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';

function CancelledContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams?.get('order') || searchParams?.get('orderNumber') || '';

  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-20">
      <div className="bg-[#0E0E0E] border border-[#1F1F1F] rounded-xs p-6 sm:p-10 space-y-8 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-950/40 border border-red-800/40 flex items-center justify-center">
          <XCircle className="w-8 h-8 text-red-400" />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] font-bold text-red-400">
            TRANSACTION CANCELLED
          </span>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
            Payment Was Not Completed
          </h1>
          <p className="text-xs sm:text-sm text-[#888] font-mono max-w-md mx-auto">
            Your online card transaction via PayFast was cancelled or could not be finalized. No funds were debited from your card.
          </p>
          {orderNumber && (
            <p className="text-xs font-mono text-[#AAA] pt-2">
              Order Reference: <strong className="text-white font-bold">{orderNumber}</strong>
            </p>
          )}
        </div>

        <div className="p-4 bg-[#141414] border border-[#222] rounded-xs text-left space-y-2 font-mono text-xs">
          <div className="flex items-center gap-2 text-white font-bold">
            <ShieldAlert className="w-4 h-4 text-[#D4AF37]" />
            <span>Need Assistance?</span>
          </div>
          <p className="text-[#888] text-[11px] leading-relaxed">
            If this was unintended, you may return to your cart and restart checkout, or contact our private atelier concierge for direct electronic funds transfer (EFT) details.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-[#1A1A1A]">
          <Link
            href="/cart"
            className="w-full sm:w-auto px-6 py-3 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-widest transition-colors inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Cart</span>
          </Link>

          <Link
            href="/shop"
            className="w-full sm:w-auto px-6 py-3 bg-[#161616] hover:bg-[#202020] text-white border border-[#333] font-bold uppercase text-xs font-mono tracking-wider transition-colors inline-flex items-center justify-center gap-2"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#888]" />
            <span>Return to Shop</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function PaymentCancelledPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col selection:bg-[#D4AF37] selection:text-black">
      <StoreHeader />
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center p-8 text-xs font-mono text-[#888]">
          Loading...
        </div>
      }>
        <CancelledContent />
      </Suspense>
      <StoreFooter />
    </div>
  );
}
