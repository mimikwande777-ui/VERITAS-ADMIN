'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Truck, 
  CreditCard, 
  ArrowLeft, 
  Lock, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Building2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { useCartStore } from '@/lib/cart-store';
import { formatZAR } from '@/lib/utils';

const SA_PROVINCES = [
  'Gauteng',
  'Western Cape',
  'KwaZulu-Natal',
  'Eastern Cape',
  'Free State',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape'
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, isLoaded, subtotal, shipping, total, clearCart } = useCartStore();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    suburb: '',
    city: '',
    province: 'Gauteng',
    postalCode: '',
    notes: '',
    paymentMethod: 'card'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summaryOpenOnMobile, setSummaryOpenOnMobile] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const customerFullName = `${formData.firstName} ${formData.lastName}`.trim();

      const orderPayload = {
        customerName: customerFullName,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        subtotal,
        shippingAmount: shipping,
        total,
        paymentMethod: formData.paymentMethod,
        paymentStatus: 'paid' as const,
        address: {
          addressLine1: formData.addressLine1,
          addressLine2: formData.addressLine2,
          suburb: formData.suburb,
          city: formData.city,
          province: formData.province,
          postalCode: formData.postalCode,
          country: 'South Africa'
        },
        items: items.map(item => ({
          productId: item.productId,
          name: item.name,
          color: item.color,
          size: item.size,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.price
        }))
      };

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to place order in Supabase');
      }

      // Clear shopping bag after confirmed order
      clearCart();

      // Redirect to confirmation page with real Supabase order details
      router.push(`/order-confirmation?orderNumber=${encodeURIComponent(data.orderNumber)}&orderId=${encodeURIComponent(data.orderId || '')}&email=${encodeURIComponent(formData.email)}&name=${encodeURIComponent(customerFullName)}`);
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMsg(err?.message || 'There was an error processing your order. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
        <StoreHeader />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-xs font-mono text-[#888]">Loading checkout...</div>
        </main>
        <StoreFooter />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
        <StoreHeader />
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <h2 className="text-xl font-bold uppercase tracking-widest text-white mb-2">No Items In Bag</h2>
          <p className="text-xs text-[#888] font-mono mb-6">Please add garments to your bag before checking out.</p>
          <Link
            href="/shop"
            className="px-6 py-3 bg-[#D4AF37] text-black font-bold uppercase text-xs tracking-widest hover:bg-[#B3932F] transition-colors"
          >
            Go to Shop
          </Link>
        </main>
        <StoreFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col selection:bg-[#D4AF37] selection:text-black">
      <StoreHeader />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Top Header */}
        <div className="border-b border-[#1F1F1F] pb-6 mb-8 flex items-center justify-between">
          <div>
            <Link
              href="/cart"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#888] hover:text-[#D4AF37] mb-2 uppercase tracking-widest"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Bag</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
              Secure Checkout
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/30 px-3 py-1.5 rounded border border-emerald-800/40">
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">256-Bit Encrypted</span>
            <span className="sm:hidden">Secure</span>
          </div>
        </div>

        {/* MOBILE COLLAPSIBLE ORDER SUMMARY */}
        <div className="lg:hidden mb-6 bg-[#111] border border-[#222] rounded-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setSummaryOpenOnMobile(!summaryOpenOnMobile)}
            className="w-full p-4 flex items-center justify-between text-xs font-mono font-bold uppercase text-white"
          >
            <span className="flex items-center gap-2 text-[#D4AF37]">
              <span>Order Summary ({items.length} items)</span>
              {summaryOpenOnMobile ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
            <span>{formatZAR(total)}</span>
          </button>

          {summaryOpenOnMobile && (
            <div className="p-4 pt-0 border-t border-[#1C1C1C] space-y-3 font-mono text-xs">
              <div className="divide-y divide-[#1A1A1A]">
                {items.map((item) => (
                  <div key={item.id} className="py-2 flex justify-between items-center text-[11px]">
                    <div>
                      <p className="font-bold text-white uppercase">{item.name}</p>
                      <p className="text-[#777]">{item.size} • {item.color} • Qty: {item.quantity}</p>
                    </div>
                    <span className="text-white font-bold">{formatZAR(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-[#222] space-y-1 text-xs">
                <div className="flex justify-between text-[#888]">
                  <span>Subtotal:</span>
                  <span>{formatZAR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#888]">
                  <span>Courier (SA):</span>
                  <span>{shipping === 0 ? 'FREE' : formatZAR(shipping)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2-COLUMN CHECKOUT FORM */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* LEFT: CUSTOMER & SHIPPING INPUTS (7-8 cols on lg) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-8">
            {errorMsg && (
              <div className="p-4 bg-red-950/50 border border-red-800/60 rounded-xs text-red-300 text-xs font-mono flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* STEP 1: CONTACT INFO */}
            <div className="bg-[#0E0E0E] border border-[#1F1F1F] p-6 rounded-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2 border-b border-[#1A1A1A] pb-3">
                <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-black flex items-center justify-center font-bold text-[10px]">
                  1
                </span>
                <span>Contact Information</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="First name"
                    className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Last name"
                    className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37] transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                    Email Address * (For Dispatch Tracking)
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="client@domain.co.za"
                    className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                    Mobile Phone * (For Courier SMS Updates)
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="082 123 4567"
                    className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* STEP 2: SOUTH AFRICAN DELIVERY ADDRESS */}
            <div className="bg-[#0E0E0E] border border-[#1F1F1F] p-6 rounded-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2 border-b border-[#1A1A1A] pb-3">
                <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-black flex items-center justify-center font-bold text-[10px]">
                  2
                </span>
                <span>South African Delivery Address</span>
              </h2>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                  Street Address Line 1 *
                </label>
                <input
                  type="text"
                  name="addressLine1"
                  required
                  value={formData.addressLine1}
                  onChange={handleInputChange}
                  placeholder="e.g. 42 Sandton Boulevard / Apartment 4B"
                  className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37] transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                    Complex / Building / Unit (Optional)
                  </label>
                  <input
                    type="text"
                    name="addressLine2"
                    value={formData.addressLine2}
                    onChange={handleInputChange}
                    placeholder="e.g. The Capital Towers"
                    className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                    Suburb *
                  </label>
                  <input
                    type="text"
                    name="suburb"
                    required
                    value={formData.suburb}
                    onChange={handleInputChange}
                    placeholder="e.g. Sandhurst / Camps Bay"
                    className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37] transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                    City / Town *
                  </label>
                  <input
                    type="text"
                    name="city"
                    required
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="e.g. Johannesburg"
                    className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                    Province * (South Africa)
                  </label>
                  <select
                    name="province"
                    required
                    value={formData.province}
                    onChange={handleInputChange}
                    className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37] transition-colors font-mono"
                  >
                    {SA_PROVINCES.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    required
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    placeholder="2196"
                    className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37] transition-colors font-mono"
                  />
                </div>
              </div>
            </div>

            {/* STEP 3: PAYMENT METHOD */}
            <div className="bg-[#0E0E0E] border border-[#1F1F1F] p-6 rounded-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2 border-b border-[#1A1A1A] pb-3">
                <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-black flex items-center justify-center font-bold text-[10px]">
                  3
                </span>
                <span>Payment & Verification (ZAR)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className={`p-4 border rounded-xs cursor-pointer flex flex-col justify-between transition-all ${
                  formData.paymentMethod === 'card' 
                    ? 'border-[#D4AF37] bg-[#1A1A1A]' 
                    : 'border-[#262626] bg-[#121212] hover:border-[#444]'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="card"
                      checked={formData.paymentMethod === 'card'}
                      onChange={handleInputChange}
                      className="accent-[#D4AF37]"
                    />
                    <CreditCard className="w-4 h-4 text-[#D4AF37]" />
                  </div>
                  <span className="text-xs font-bold uppercase text-white">Credit / Debit Card</span>
                  <span className="text-[10px] text-[#777] font-mono mt-0.5">Visa, Mastercard</span>
                </label>

                <label className={`p-4 border rounded-xs cursor-pointer flex flex-col justify-between transition-all ${
                  formData.paymentMethod === 'eft' 
                    ? 'border-[#D4AF37] bg-[#1A1A1A]' 
                    : 'border-[#262626] bg-[#121212] hover:border-[#444]'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="eft"
                      checked={formData.paymentMethod === 'eft'}
                      onChange={handleInputChange}
                      className="accent-[#D4AF37]"
                    />
                    <Building2 className="w-4 h-4 text-[#D4AF37]" />
                  </div>
                  <span className="text-xs font-bold uppercase text-white">Instant EFT</span>
                  <span className="text-[10px] text-[#777] font-mono mt-0.5">All SA Major Banks</span>
                </label>

                <label className={`p-4 border rounded-xs cursor-pointer flex flex-col justify-between transition-all ${
                  formData.paymentMethod === 'payfast' 
                    ? 'border-[#D4AF37] bg-[#1A1A1A]' 
                    : 'border-[#262626] bg-[#121212] hover:border-[#444]'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="payfast"
                      checked={formData.paymentMethod === 'payfast'}
                      onChange={handleInputChange}
                      className="accent-[#D4AF37]"
                    />
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-xs font-bold uppercase text-white">PayFast Gateway</span>
                  <span className="text-[10px] text-[#777] font-mono mt-0.5">Zero-fee processing</span>
                </label>
              </div>
            </div>
          </div>

          {/* RIGHT: DESKTOP ORDER SUMMARY & SUBMISSION (5-4 cols on lg) */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="bg-[#111] border border-[#222] p-6 rounded-xs space-y-6 sticky top-24">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white border-b border-[#222] pb-3">
                Order Review ({items.length})
              </h3>

              {/* Itemized list */}
              <div className="divide-y divide-[#1A1A1A] max-h-60 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-14 bg-[#181818] border border-[#262626] rounded-xs overflow-hidden shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white uppercase truncate">{item.name}</p>
                        <p className="text-[10px] text-[#777]">Size {item.size} • {item.color} (x{item.quantity})</p>
                      </div>
                    </div>
                    <span className="font-bold text-white shrink-0">{formatZAR(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              {/* Cost calculations in ZAR */}
              <div className="border-t border-[#222] pt-4 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-[#888]">
                  <span>Subtotal:</span>
                  <span className="text-white">{formatZAR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#888]">
                  <span>Nationwide Courier:</span>
                  <span>
                    {shipping === 0 ? (
                      <strong className="text-emerald-400 uppercase">COMPLIMENTARY</strong>
                    ) : (
                      formatZAR(shipping)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-[#888]">
                  <span>VAT (15% Included):</span>
                  <span>{formatZAR(total * (15 / 115))}</span>
                </div>

                <div className="pt-3 border-t border-[#222] flex justify-between items-baseline">
                  <span className="text-sm font-bold uppercase text-white">Grand Total:</span>
                  <span className="text-2xl font-light text-[#D4AF37] font-bold font-mono">
                    {formatZAR(total)}
                  </span>
                </div>
              </div>

              {/* Submit Order Button (Touch target min 48px) */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[48px] py-4 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-[0.2em] rounded-xs transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Transmitting to OTC Queue...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Place Order • {formatZAR(total)}</span>
                  </>
                )}
              </button>

              <div className="p-3 bg-[#151515] border border-[#262626] rounded-xs text-[10px] font-mono text-[#777] space-y-1">
                <p className="text-white font-bold uppercase">VERITAS FULFILMENT GUARANTEE</p>
                <p>Order is immediately written to the live Supabase orders ledger and forwarded to our Johannesburg OTC production line.</p>
              </div>
            </div>
          </div>
        </form>
      </main>

      <StoreFooter />
    </div>
  );
}
