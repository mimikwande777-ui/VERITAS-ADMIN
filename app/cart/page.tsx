'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ShoppingBag, 
  Trash2, 
  Minus, 
  Plus, 
  ArrowRight, 
  ShieldCheck, 
  Truck, 
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { useCartStore } from '@/lib/cart-store';
import { formatZAR } from '@/lib/utils';

export default function CartPage() {
  const { 
    items, 
    isLoaded, 
    subtotal, 
    shipping, 
    total, 
    freeShippingThreshold, 
    amountNeededForFreeShipping, 
    updateQuantity, 
    removeItem, 
    clearCart 
  } = useCartStore();

  const progressPercent = Math.min(100, (subtotal / freeShippingThreshold) * 100);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
        <StoreHeader />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-xs font-mono text-[#888]">Loading bag...</div>
        </main>
        <StoreFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col selection:bg-[#D4AF37] selection:text-black">
      <StoreHeader />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="border-b border-[#1F1F1F] pb-6 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#D4AF37] font-bold">
              SHOPPING BAG
            </span>
            <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white mt-1">
              Your Selection ({items.length})
            </h1>
          </div>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs font-mono text-[#777] hover:text-red-400 uppercase tracking-wider transition-colors self-start sm:self-auto"
            >
              Clear Bag
            </button>
          )}
        </div>

        {items.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* LEFT: CART ITEMS LIST (7-8 cols on lg) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-4">
              {/* Free Shipping Progress Indicator */}
              <div className="p-4 bg-[#121212] border border-[#222] rounded-xs space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-2 text-white">
                    <Truck className="w-4 h-4 text-[#D4AF37]" />
                    {amountNeededForFreeShipping > 0 ? (
                      <span>
                        Add <strong className="text-[#D4AF37]">{formatZAR(amountNeededForFreeShipping)}</strong> for Free Nationwide Courier!
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-bold">
                        You qualify for Complimentary Nationwide Courier in SA!
                      </span>
                    )}
                  </span>
                  <span className="text-[#777]">{Math.round(progressPercent)}%</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-[#222] h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-[#D4AF37] h-full transition-all duration-500" 
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="divide-y divide-[#1A1A1A] border border-[#1F1F1F] rounded-xs bg-[#0E0E0E]">
                {items.map((item) => (
                  <div key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Item Thumbnail */}
                    <div className="w-20 h-24 sm:w-24 sm:h-28 bg-[#161616] border border-[#262626] rounded-xs overflow-hidden shrink-0">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-[#555] font-mono">NO IMG</div>
                      )}
                    </div>

                    {/* Item Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <Link 
                        href={`/products/${item.slug}`} 
                        className="text-sm font-bold uppercase text-white hover:text-[#D4AF37] transition-colors block truncate"
                      >
                        {item.name}
                      </Link>
                      <div className="text-xs font-mono text-[#888] space-x-2">
                        <span>Size: <strong className="text-white">{item.size}</strong></span>
                        <span>•</span>
                        <span>Colour: <strong className="text-white">{item.color}</strong></span>
                      </div>
                      <div className="text-xs font-mono font-bold text-white pt-1">
                        {formatZAR(item.price)} each
                      </div>
                    </div>

                    {/* Quantity Stepper & Line Total (Responsive layout) */}
                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1F1F1F]">
                      {/* Stepper */}
                      <div className="flex items-center bg-[#141414] border border-[#2B2B2B] rounded-xs">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label="Decrease quantity"
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#AAA] hover:text-white disabled:text-[#444]"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="min-w-[32px] text-center font-mono text-xs font-bold text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= (item.maxStock || 99)}
                          aria-label="Increase quantity"
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#AAA] hover:text-white disabled:text-[#444]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Line Total */}
                      <div className="text-right font-mono font-bold text-sm text-[#D4AF37] min-w-[80px]">
                        {formatZAR(item.price * item.quantity)}
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove ${item.name} from bag`}
                        className="p-2 text-[#666] hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-[#888] hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Continue Shopping</span>
                </Link>
              </div>
            </div>

            {/* RIGHT: ORDER SUMMARY (5-4 cols on lg) */}
            <div className="lg:col-span-5 xl:col-span-4">
              <div className="bg-[#111] border border-[#222] p-6 rounded-xs space-y-6 sticky top-24">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white border-b border-[#222] pb-3">
                  Summary
                </h3>

                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between text-[#888]">
                    <span>Subtotal:</span>
                    <span className="text-white font-bold">{formatZAR(subtotal)}</span>
                  </div>

                  <div className="flex justify-between text-[#888]">
                    <span>Nationwide Courier (SA):</span>
                    <span>
                      {shipping === 0 ? (
                        <strong className="text-emerald-400 font-bold uppercase">COMPLIMENTARY</strong>
                      ) : (
                        <strong className="text-white">{formatZAR(shipping)}</strong>
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between text-[#888]">
                    <span>VAT (15% Included):</span>
                    <span className="text-[#666] font-bold">{formatZAR(total * (15 / 115))}</span>
                  </div>

                  <div className="pt-4 border-t border-[#222] flex justify-between items-baseline">
                    <span className="text-sm font-bold uppercase text-white">Estimated Total:</span>
                    <span className="text-2xl font-light text-[#D4AF37] font-mono font-bold">
                      {formatZAR(total)}
                    </span>
                  </div>
                </div>

                {/* Checkout CTA Button */}
                <Link
                  href="/checkout"
                  className="w-full min-h-[48px] py-4 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-[0.2em] rounded-xs transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <div className="p-3 bg-[#151515] border border-[#262626] rounded-xs text-[10px] font-mono text-[#777] space-y-1.5">
                  <div className="flex items-center gap-2 text-[#AAA]">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Direct encrypted OTC order pipeline</span>
                  </div>
                  <div>
                    • Orders dispatched from Johannesburg atelier
                  </div>
                  <div>
                    • South African courier tracking provided via SMS/Email
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center border border-dashed border-[#222] bg-[#0E0E0E] rounded-xs p-8 max-w-lg mx-auto">
            <ShoppingBag className="w-12 h-12 text-[#444] mx-auto mb-3" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Your Bag is Empty</h3>
            <p className="text-xs text-[#777] font-mono mt-1 mb-6">
              Explore the VERITAS collection to add handcrafted architectural garments to your order.
            </p>
            <Link
              href="/shop"
              className="px-6 py-3 bg-[#D4AF37] text-black text-xs font-bold uppercase tracking-widest hover:bg-[#B3932F] transition-colors inline-flex items-center gap-2"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Explore Collection</span>
            </Link>
          </div>
        )}
      </main>

      <StoreFooter />
    </div>
  );
}
