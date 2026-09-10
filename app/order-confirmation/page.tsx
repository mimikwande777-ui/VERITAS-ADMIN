'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  CheckCircle2, 
  Truck, 
  Package, 
  ShieldCheck, 
  Clock, 
  AlertCircle,
  RotateCcw,
  ShoppingBag,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { PaymentStatus } from '@/lib/supabase/types';

interface OrderLookupResult {
  paymentStatus: PaymentStatus;
  orderStatus: string;
  fulfilmentStatus: string;
  customerName?: string;
  total?: number;
  currency?: string;
}

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams?.get('order') || searchParams?.get('orderNumber') || '';
  const orderId = searchParams?.get('orderId') || '';
  const customerEmail = searchParams?.get('email') || '';
  const customerNameFallback = searchParams?.get('name') || 'Valued Client';

  const [isLoading, setIsLoading] = useState(true);
  const [orderData, setOrderData] = useState<OrderLookupResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Authoritative server-side database lookup with bounded polling (every 2.5s for up to 30s)
  // Note: Status is NEVER accepted from searchParams or modified from this client page
  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;
    let attempts = 0;
    const maxAttempts = 12; // 12 * 2.5s = 30 seconds

    async function fetchAuthoritativeStatus() {
      if (!orderNumber) {
        setIsLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set('orderNumber', orderNumber);
        if (orderId) params.set('orderId', orderId);
        if (customerEmail) params.set('email', customerEmail);

        const res = await fetch(`/api/orders/status?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Unable to verify order in database.');
        }

        const data = await res.json();
        if (isMounted) {
          if (data.success) {
            setOrderData({
              paymentStatus: data.paymentStatus,
              orderStatus: data.orderStatus,
              fulfilmentStatus: data.fulfilmentStatus,
              customerName: data.customerName,
              total: data.total,
              currency: data.currency
            });

            // Stop polling immediately once terminal status is reached
            if (data.paymentStatus === 'paid' || data.paymentStatus === 'cancelled' || data.paymentStatus === 'refunded') {
              if (pollInterval) clearInterval(pollInterval);
            }
          } else {
            setFetchError(data.error || 'Order lookup failed.');
          }
        }
      } catch (err: any) {
        console.warn('[ORDER CONFIRMATION] Status lookup notice:', err.message);
        if (isMounted) {
          setFetchError(err?.message || 'Database status lookup unavailable');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchAuthoritativeStatus();

    // Set up bounded polling for pending state
    pollInterval = setInterval(() => {
      attempts++;
      if (attempts >= maxAttempts) {
        if (pollInterval) clearInterval(pollInterval);
        return;
      }
      fetchAuthoritativeStatus();
    }, 2500);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [orderNumber, orderId, customerEmail]);

  // Current authoritative payment status strictly resolved from database (default 'pending')
  const currentPaymentStatus: PaymentStatus = orderData?.paymentStatus || 'pending';
  const resolvedCustomerName = orderData?.customerName || customerNameFallback;

  // Render state mapping according to VERITAS business requirements
  const renderStatusConfig = () => {
    switch (currentPaymentStatus) {
      case 'paid':
        return {
          bannerTag: 'PAYMENT CONFIRMED',
          tagColor: 'text-emerald-400',
          borderColor: 'border-emerald-700/50',
          bgColor: 'bg-emerald-950/40',
          icon: <CheckCircle2 className="w-8 h-8 text-emerald-400" />,
          statusBadgeText: 'Payment confirmed.',
          statusBadgeClass: 'text-emerald-400',
          descriptionText: `Your payment has been successfully settled and verified. Your garments have entered priority OTC inspection.`,
        };
      case 'cancelled':
        return {
          bannerTag: 'PAYMENT CANCELLED',
          tagColor: 'text-red-400',
          borderColor: 'border-red-700/50',
          bgColor: 'bg-red-950/40',
          icon: <AlertCircle className="w-8 h-8 text-red-400" />,
          statusBadgeText: 'Payment was cancelled.',
          statusBadgeClass: 'text-red-400',
          descriptionText: `Payment was cancelled. If this was unintended, please place a new order or contact concierge.`,
        };
      case 'refunded':
        return {
          bannerTag: 'PAYMENT REFUNDED',
          tagColor: 'text-neutral-400',
          borderColor: 'border-neutral-700/50',
          bgColor: 'bg-neutral-900/60',
          icon: <RotateCcw className="w-8 h-8 text-neutral-400" />,
          statusBadgeText: 'Payment refunded.',
          statusBadgeClass: 'text-neutral-400',
          descriptionText: `Payment refunded. Credit has been processed back to the original funding account.`,
        };
      case 'pending':
      default:
        return {
          bannerTag: 'PAYMENT PENDING',
          tagColor: 'text-[#D4AF37]',
          borderColor: 'border-amber-700/60',
          bgColor: 'bg-amber-950/60',
          icon: <Clock className="w-8 h-8 text-[#D4AF37]" />,
          statusBadgeText: 'Payment confirmation is being processed.',
          statusBadgeClass: 'text-[#D4AF37]',
          descriptionText: `Payment confirmation is being processed. Awaiting settlement verification before dispatch.`,
        };
    }
  };

  const statusConfig = renderStatusConfig();

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* SUCCESS / STATUS BANNER */}
      <div className="bg-[#0E0E0E] border border-[#1F1F1F] rounded-xs p-6 sm:p-10 space-y-8 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-4 border-b border-[#1A1A1A] pb-8">
          <div className={`w-16 h-16 rounded-full ${statusConfig.bgColor} border ${statusConfig.borderColor} flex items-center justify-center shrink-0`}>
            {statusConfig.icon}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono uppercase tracking-[0.3em] font-bold ${statusConfig.tagColor}`}>
                {statusConfig.bannerTag}
              </span>
              {isLoading && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-[#777]">
                  <Loader2 className="w-3 h-3 animate-spin text-[#D4AF37]" />
                  <span>Verifying ledger...</span>
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white">
              Thank You, {resolvedCustomerName}
            </h1>
            <p className="text-xs sm:text-sm text-[#888] font-mono">
              {statusConfig.descriptionText}
              {customerEmail && (
                <> Recorded for <strong className="text-white">{customerEmail}</strong>.</>
              )}
            </p>
          </div>
        </div>

        {/* ORDER TELEMETRY SUMMARY */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-4 bg-[#141414] border border-[#222] rounded-xs space-y-1">
            <span className="text-[10px] text-[#777] uppercase">Order Reference</span>
            <p className="text-sm font-bold text-white uppercase">{orderNumber || 'N/A'}</p>
          </div>

          <div className="p-4 bg-[#141414] border border-[#222] rounded-xs space-y-1">
            <span className="text-[10px] text-[#777] uppercase">Authoritative Payment Status</span>
            <p className={`text-sm font-bold uppercase flex items-center gap-1.5 ${statusConfig.statusBadgeClass}`}>
              {statusConfig.statusBadgeText}
            </p>
          </div>

          <div className="p-4 bg-[#141414] border border-[#222] rounded-xs space-y-1">
            <span className="text-[10px] text-[#777] uppercase">Nationwide Delivery</span>
            <p className="text-sm font-bold text-emerald-400 uppercase flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              <span>Complimentary (3-5 Days)</span>
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
              <span className={`w-5 h-5 rounded-full ${currentPaymentStatus === 'paid' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-amber-950/60 text-[#D4AF37] border border-amber-800/40'} flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5`}>
                {currentPaymentStatus === 'paid' ? '✓' : '1'}
              </span>
              <div>
                <strong className="text-white block">Order Encrypted & Authenticated</strong>
                <span className="text-[#777] text-[11px]">
                  {currentPaymentStatus === 'paid' 
                    ? 'Payment settled. Line items validated in central Supabase ledger.' 
                    : 'Your order details and line items are logged into our central database. Awaiting payment settlement before dispatch.'}
                </span>
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
