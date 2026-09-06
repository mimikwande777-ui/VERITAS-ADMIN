'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Copy, 
  Check, 
  SendHorizontal, 
  Download, 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Package, 
  Sparkles, 
  X,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Clock,
  ShieldCheck,
  Truck,
  CheckCircle2
} from 'lucide-react';
import { OrderRecord } from '@/lib/mock-data';
import { 
  fetchFullOrdersFromSupabase, 
  updateOrderStatusInSupabase, 
  AdminOrderFull,
  getShippingStatusDescription
} from '@/lib/supabase/orders';
import { 
  FulfilmentStatus,
  VALID_FULFILMENT_STATUSES,
  getFulfilmentStatusLabel,
  getPaymentStatusLabel,
  getOrderStatusLabel
} from '@/lib/supabase/types';
import { formatZAR, formatShippingZAR } from '@/lib/utils';
import { getAdminAuthHeaders } from '@/lib/auth-context';

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [fullOrders, setFullOrders] = useState<AdminOrderFull[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrderForOTC, setSelectedOrderForOTC] = useState<OrderRecord | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<OrderRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // First attempt: fetch from API endpoint with authenticated session headers
      const authHeaders = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/orders?t=${Date.now()}`, { 
        headers: authHeaders,
        cache: 'no-store' 
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.records)) {
          setOrders(data.records);
          setFullOrders(data.orders || []);
          setLoading(false);
          return;
        }
      }

      // Fallback direct Supabase fetch
      const { orders: dbOrders, records, error: fetchErr } = await fetchFullOrdersFromSupabase();
      if (fetchErr) {
        setError(fetchErr);
        setOrders([]);
        setFullOrders([]);
      } else {
        setFullOrders(dbOrders);
        setOrders(records);
      }
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err?.message || 'Could not load orders.');
      setOrders([]);
      setFullOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const fetchOrders = async () => {
      if (active) {
        await loadOrders();
      }
    };
    fetchOrders();
    return () => {
      active = false;
    };
  }, [loadOrders]);

  // Generate standardized OTC Fulfillment Payload String
  const generateOTCPayloadString = (order: OrderRecord) => {
    const customerInfo = order.customer;
    const customerName = customerInfo.name || 'N/A';
    const customerEmail = customerInfo.email || 'N/A';
    const customerPhone = customerInfo.phone || 'N/A';
    const customerAddress = customerInfo.address || 'N/A';

    const itemsSummary = order.products.map((p, index) => (
      `ITEM ${index + 1}:
  Product Snapshot: ${p.name}
  Colorway: ${p.color}
  Size: ${p.size}
  SKU: ${p.sku || 'N/A'}
  Quantity: ${p.quantity}
  Unit Price: R${p.unitPrice}`
    )).join('\n\n');

    return `=====================================================
VERITAS OTC PRODUCTION & FULFILLMENT MANIFEST
=====================================================
ORDER NUMBER:   ${order.id}
ORDER DATE:     ${order.date}
DISPATCH STATE: READY FOR PRODUCTION

--- CUSTOMER INFORMATION ---
NAME:    ${customerName}
EMAIL:   ${customerEmail}
PHONE:   ${customerPhone}
ADDRESS: ${customerAddress}

--- REQUIRED GARMENTS & SNAPSHOT SPECS ---
${itemsSummary}

--- FINANCIAL & LOGISTICS ---
TOTAL AMOUNT:     ${formatZAR(order.total)}
PAYMENT STATUS:   ${getPaymentStatusLabel(order.paymentStatus)}
FULFILMENT STATE: ${getFulfilmentStatusLabel(order.fulfilmentStatus)}
SHIPPING CARRIER: DHL / UPS Standard
INTERNAL TRACK:   ${order.trackingNumber}
=====================================================`;
  };

  // 1-Click Copy to Clipboard
  const handleCopyOTC = (order: OrderRecord) => {
    const text = generateOTCPayloadString(order);
    navigator.clipboard.writeText(text);
    setCopiedId(order.id);
    showToast(`OTC Production Manifest copied to clipboard for ${order.id}`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Update order fulfilment status directly in Supabase with subtle transition animation
  const handleUpdateStatus = async (order: OrderRecord, rawStatus: string) => {
    setUpdatingOrderId(order.id);
    const dbId = order.uuid || order.id;
    const normalizedStatus = rawStatus.toLowerCase().trim().replace(/\s+/g, '_');

    // Pre-validate status against allowed list
    if (!VALID_FULFILMENT_STATUSES.includes(normalizedStatus as FulfilmentStatus)) {
      showToast('Invalid fulfilment status.');
      setUpdatingOrderId(null);
      return;
    }

    const { success, error: updateErr } = await updateOrderStatusInSupabase(dbId, {
      fulfilment_status: normalizedStatus
    });

    if (success) {
      setOrders(prev => prev.map(o => {
        if (o.id === order.id || o.uuid === dbId) {
          return { 
            ...o, 
            fulfilmentStatus: normalizedStatus,
            shippingStatus: getShippingStatusDescription(normalizedStatus) 
          };
        }
        return o;
      }));
      setRecentlyUpdatedId(order.id);
      showToast(`Order ${order.id} fulfilment updated to '${getFulfilmentStatusLabel(normalizedStatus)}'`);
      setTimeout(() => setRecentlyUpdatedId(null), 2000);
    } else {
      showToast(updateErr || 'Invalid fulfilment status.');
    }
    setUpdatingOrderId(null);
  };

  const handleMarkSentToOTC = async (order: OrderRecord) => {
    await handleUpdateStatus(order, 'sent_to_otc');
    if (selectedOrderForOTC?.id === order.id) {
      setSelectedOrderForOTC(null);
    }
  };

  // Export OTC JSON
  const handleDownloadOTCJson = (order: OrderRecord) => {
    const fullOrderMatch = fullOrders.find(f => f.orderNumber === order.id || f.id === order.uuid);
    const jsonStr = JSON.stringify({
      manifest: 'VERITAS_OTC_DISPATCH_V2',
      orderNumber: order.id,
      date: order.date,
      customer: order.customer,
      products: order.products,
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      paymentStatus: order.paymentStatus,
      fulfilmentStatus: order.fulfilmentStatus,
      rawDbRecord: fullOrderMatch || null,
      exportedAt: new Date().toISOString()
    }, null, 2);

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OTC_MANIFEST_${order.id}.json`;
    a.click();
    showToast(`Downloaded OTC JSON Manifest for ${order.id}`);
  };

  // Filtered orders
  const filteredOrders = orders.filter(order => {
    const customerName = order.customer.name || '';
    const customerEmail = order.customer.email || '';
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      matchesStatus = order.fulfilmentStatus === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#161616] border border-[#D4AF37] text-white px-4 py-3 rounded-xs shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
          <span className="text-xs font-medium font-mono">{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F1F1F] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold uppercase tracking-wider text-white">Orders & OTC Pipeline</h1>
            <span className="bg-[#141414] text-[#D4AF37] border border-[#D4AF37]/30 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
              POSTGRESQL LIVE
            </span>
          </div>
          <p className="text-xs text-[#888] font-mono mt-1">
            Over-the-Counter (OTC) dispatch management, custom garment specs & automated waybill routing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadOrders}
            disabled={loading}
            className="px-3 py-2 bg-[#161616] hover:bg-[#222] border border-[#333] rounded-xs text-xs font-mono text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#D4AF37]' : 'text-[#888]'}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0F0F0F] p-4 rounded-xs border border-[#1F1F1F]">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#666] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search order #, client name, email, waybill..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#161616] border border-[#2B2B2B] pl-9 pr-4 py-2.5 text-xs rounded-xs text-white placeholder-[#555] focus:outline-hidden focus:border-[#D4AF37] font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#161616] border border-[#2B2B2B] text-white px-3 py-2.5 text-xs rounded-xs font-mono focus:outline-hidden focus:border-[#D4AF37] w-full sm:w-auto"
          >
            <option value="all">All Stages ({orders.length})</option>
            <option value="pending">Pending</option>
            <option value="sent_to_otc">Sent to OTC</option>
            <option value="in_production">In Production</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
      </div>

      {/* ORDERS LIST CONTAINER */}
      <div className="bg-[#0F0F0F] rounded-xs border border-[#1F1F1F] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs font-mono text-[#888] flex items-center justify-center gap-3">
            <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
            <span>Fetching live orders from Supabase...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-red-950/20 border-b border-red-900/30 text-red-400 text-xs font-mono">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-500" />
            <p className="font-bold">Supabase Query Notice</p>
            <p className="text-[#888] mt-1">{error}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#161616] border border-[#262626] text-[#D4AF37] flex items-center justify-center mx-auto">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">NO ORDERS YET</h3>
              <p className="text-xs text-[#888] font-mono">
                Customer orders placed on the public VERITAS storefront will appear here in real-time.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 1. MOBILE RESPONSIVE STACKED CARDS (< md) */}
            <div className="block md:hidden divide-y divide-[#1A1A1A]">
              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#666] font-mono">
                  NO ORDERS MATCH SELECTED SEARCH / FILTER
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const isUpdating = updatingOrderId === order.id;
                  const isRecentlyUpdated = recentlyUpdatedId === order.id;
                  const totalItems = order.products.reduce((acc, p) => acc + p.quantity, 0);

                  return (
                    <div 
                      key={order.id} 
                      className={`p-4 space-y-3.5 transition-all duration-700 ${
                        isRecentlyUpdated 
                          ? 'bg-[#D4AF37]/15 ring-1 ring-[#D4AF37]' 
                          : 'hover:bg-[#141414] bg-[#0E0E0E]'
                      }`}
                    >
                      {/* Top row: Order Number & Date */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-white tracking-wider">
                            {order.id}
                          </span>
                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                            order.paymentStatus === 'paid' 
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' 
                              : 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                          }`}>
                            {getPaymentStatusLabel(order.paymentStatus)}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-[#888]">{order.date}</span>
                      </div>

                      {/* Customer Info */}
                      <div className="p-2.5 bg-[#141414] rounded-xs border border-[#222] text-xs font-mono space-y-1">
                        <div className="font-bold text-white uppercase">{order.customer.name}</div>
                        <div className="text-[11px] text-[#888] truncate">{order.customer.email}</div>
                        {order.customer.address && (
                          <div className="text-[10px] text-[#666] truncate">{order.customer.address}</div>
                        )}
                      </div>

                      {/* Items & Total */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#1C1C1C] text-xs font-mono">
                        <div>
                          <span className="text-[#888]">{totalItems} {totalItems === 1 ? 'item' : 'items'} • </span>
                          <span className="font-bold text-[#D4AF37]">{formatZAR(order.total)}</span>
                        </div>
                        <div className="text-[10px] text-[#666] font-mono">
                          TRACK: {order.trackingNumber}
                        </div>
                      </div>

                      {/* Fulfilment Status Selector with Animation Feedback */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <label className="text-[10px] font-mono uppercase text-[#777] shrink-0">
                          Fulfilment:
                        </label>
                        <div className="relative flex-1 max-w-[200px]">
                          <select 
                            value={order.fulfilmentStatus}
                            disabled={isUpdating}
                            onChange={(e) => handleUpdateStatus(order, e.target.value)}
                            className={`w-full text-[10px] font-mono font-bold uppercase rounded px-2.5 py-1.5 border transition-all duration-300 cursor-pointer ${
                              isUpdating ? 'opacity-50 cursor-wait' : ''
                            } ${
                              order.fulfilmentStatus === 'pending' ? 'bg-amber-950/50 text-amber-400 border-amber-800/40' :
                              order.fulfilmentStatus === 'sent_to_otc' ? 'bg-purple-950/50 text-purple-300 border-purple-800/40' :
                              order.fulfilmentStatus === 'in_production' ? 'bg-indigo-950/50 text-indigo-300 border-indigo-800/40' :
                              order.fulfilmentStatus === 'shipped' ? 'bg-blue-950/50 text-blue-300 border-blue-800/40' :
                              order.fulfilmentStatus === 'delivered' ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/40' :
                              'bg-[#1A1A1A] text-[#AAA] border-[#333]'
                            }`}
                          >
                            <option value="pending">Pending</option>
                            <option value="sent_to_otc">Sent to OTC</option>
                            <option value="in_production">In Production</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                          </select>
                          {isUpdating && (
                            <RefreshCw className="w-3 h-3 animate-spin text-[#D4AF37] absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none" />
                          )}
                        </div>
                      </div>

                      {/* Mobile Action Buttons (Min 44px touch friendly) */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1C1C1C]">
                        <button
                          onClick={() => handleCopyOTC(order)}
                          className={`min-h-[40px] px-3 py-2 text-xs font-mono font-bold uppercase rounded transition-colors border flex items-center justify-center gap-1.5 ${
                            copiedId === order.id 
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600' 
                              : 'bg-[#181818] text-white border-[#333] hover:border-[#D4AF37]'
                          }`}
                        >
                          {copiedId === order.id ? (
                            <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
                          ) : (
                            <><Copy className="w-3.5 h-3.5 text-[#888]" /> Copy OTC</>
                          )}
                        </button>

                        <button
                          onClick={() => setSelectedOrderDetails(order)}
                          className="min-h-[40px] px-3 py-2 text-xs font-mono font-bold uppercase rounded bg-[#181818] text-[#D4AF37] hover:text-white border border-[#333] hover:border-[#555] transition-colors flex items-center justify-center gap-1"
                        >
                          <span>Full Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 2. DESKTOP TABULAR VIEW (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] text-[#666] uppercase bg-[#0A0A0A] tracking-wider border-b border-[#1F1F1F]">
                  <tr>
                    <th className="px-6 py-4 font-bold">Order Number</th>
                    <th className="px-6 py-4 font-bold">Date</th>
                    <th className="px-6 py-4 font-bold">Customer Details</th>
                    <th className="px-6 py-4 font-bold text-right">Items & Total</th>
                    <th className="px-6 py-4 font-bold">Payment</th>
                    <th className="px-6 py-4 font-bold">Fulfilment Stage</th>
                    <th className="px-6 py-4 font-bold text-center">OTC Action</th>
                    <th className="px-6 py-4 font-bold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F1F1F]">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-xs text-[#666] font-mono">
                        NO ORDERS MATCH SELECTED SEARCH / FILTER
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const totalItems = order.products.reduce((acc, p) => acc + p.quantity, 0);
                      const isUpdating = updatingOrderId === order.id;
                      const isRecentlyUpdated = recentlyUpdatedId === order.id;

                      return (
                        <tr 
                          key={order.id} 
                          className={`transition-all duration-700 ${
                            isRecentlyUpdated 
                              ? 'bg-[#D4AF37]/15 ring-1 ring-[#D4AF37]' 
                              : 'hover:bg-[#151515]'
                          }`}
                        >
                          <td className="px-6 py-4 font-mono font-bold text-white tracking-wider">
                            {order.id}
                          </td>
                          
                          <td className="px-6 py-4 text-xs font-mono text-[#888]">
                            {order.date}
                          </td>

                          <td className="px-6 py-4">
                            <div className="font-bold text-white tracking-wide">{order.customer.name}</div>
                            <div className="text-[11px] text-[#888] font-mono">{order.customer.email}</div>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="font-mono font-bold text-[#D4AF37]">{formatZAR(order.total)}</div>
                            <div className="text-[10px] text-[#666] font-mono">{totalItems} {totalItems === 1 ? 'item' : 'items'}</div>
                          </td>

                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              order.paymentStatus === 'paid' 
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' 
                                : 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                            }`}>
                              {getPaymentStatusLabel(order.paymentStatus)}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <div className="relative inline-flex items-center">
                              <select 
                                value={order.fulfilmentStatus}
                                disabled={isUpdating}
                                onChange={(e) => handleUpdateStatus(order, e.target.value)}
                                className={`text-[10px] font-mono font-bold uppercase rounded px-2.5 py-1 border transition-all duration-300 cursor-pointer ${
                                  isUpdating ? 'opacity-50 cursor-wait' : ''
                                } ${
                                  order.fulfilmentStatus === 'pending' ? 'bg-amber-950/50 text-amber-400 border-amber-800/40' :
                                  order.fulfilmentStatus === 'sent_to_otc' ? 'bg-purple-950/50 text-purple-300 border-purple-800/40' :
                                  order.fulfilmentStatus === 'in_production' ? 'bg-indigo-950/50 text-indigo-300 border-indigo-800/40' :
                                  order.fulfilmentStatus === 'shipped' ? 'bg-blue-950/50 text-blue-300 border-blue-800/40' :
                                  order.fulfilmentStatus === 'delivered' ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/40' :
                                  'bg-[#1A1A1A] text-[#AAA] border-[#333]'
                                }`}
                              >
                                <option value="pending">Pending</option>
                                <option value="sent_to_otc">Sent to OTC</option>
                                <option value="in_production">In Production</option>
                                <option value="shipped">Shipped</option>
                                <option value="delivered">Delivered</option>
                              </select>
                              {isUpdating && (
                                <RefreshCw className="w-3 h-3 animate-spin text-[#D4AF37] ml-1.5" />
                              )}
                            </div>
                          </td>

                          {/* OTC Manifest Action */}
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button 
                                onClick={() => handleCopyOTC(order)}
                                title="Copy OTC Manifest to Clipboard"
                                className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase rounded transition-colors border flex items-center gap-1 ${
                                  copiedId === order.id 
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600' 
                                    : 'bg-[#1C1C1C] text-white border-[#333] hover:border-[#D4AF37] hover:text-[#D4AF37]'
                                }`}
                              >
                                {copiedId === order.id ? (
                                  <><Check className="w-3 h-3 text-emerald-400" /> Copied</>
                                ) : (
                                  <><Copy className="w-3 h-3" /> Quick Copy</>
                                )}
                              </button>

                              <button
                                onClick={() => setSelectedOrderForOTC(order)}
                                title="Open OTC Dispatch Modal"
                                className="p-1 text-[#888] hover:text-[#D4AF37] hover:bg-[#222] rounded transition-colors"
                              >
                                <SendHorizontal className="w-4 h-4" />
                              </button>
                            </div>
                          </td>

                          {/* View details */}
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => setSelectedOrderDetails(order)}
                              className="text-[11px] font-mono font-bold text-[#D4AF37] hover:text-white uppercase tracking-wider"
                            >
                              Details →
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="p-4 border-t border-[#1F1F1F] flex flex-col sm:flex-row justify-between items-center gap-2 bg-[#151515] text-xs font-mono text-[#888]">
          <span>Showing {filteredOrders.length} of {orders.length} real Supabase orders</span>
          <span className="text-[10px] text-[#D4AF37]">SHARED SUPABASE DATABASE LIVE CONNECTED</span>
        </div>
      </div>

      {/* OTC MANIFEST MODAL (Mobile Responsive) */}
      {selectedOrderForOTC && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#111] border border-[#2B2B2B] rounded-xs max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222] pb-4">
              <div className="flex items-center gap-2">
                <SendHorizontal className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="text-base font-bold uppercase tracking-wider text-white">OTC Production Manifest</h3>
              </div>
              <button 
                onClick={() => setSelectedOrderForOTC(null)}
                className="text-[#888] hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-[#0A0A0A] p-4 rounded-xs border border-[#1F1F1F] font-mono text-[11px] text-[#AAA] whitespace-pre-wrap overflow-x-auto max-h-80">
                {generateOTCPayloadString(selectedOrderForOTC)}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleCopyOTC(selectedOrderForOTC)}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs font-mono tracking-wider rounded-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Full Manifest</span>
                  </button>

                  <button
                    onClick={() => handleDownloadOTCJson(selectedOrderForOTC)}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-[#1C1C1C] hover:bg-[#282828] text-white border border-[#333] font-bold uppercase text-xs font-mono tracking-wider rounded-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON</span>
                  </button>
                </div>

                <button
                  onClick={() => handleMarkSentToOTC(selectedOrderForOTC)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-700 font-bold uppercase text-xs font-mono tracking-wider rounded-xs transition-colors"
                >
                  Mark as &apos;Sent to OTC&apos;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDER DETAILS MODAL (Mobile Responsive) */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#111] border border-[#2B2B2B] rounded-xs max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222] pb-4">
              <div>
                <span className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-widest block">SUPABASE ORDER LEDGER</span>
                <h3 className="text-lg font-bold uppercase tracking-wider text-white">Order {selectedOrderDetails.id}</h3>
              </div>
              <button 
                onClick={() => setSelectedOrderDetails(null)}
                className="text-[#888] hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer info card */}
            <div className="bg-[#141414] border border-[#222] p-4 rounded-xs space-y-3 font-mono text-xs">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#888] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Customer & Destination</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[#AAA]">
                <div>
                  <span className="text-[#666] block text-[10px]">NAME</span>
                  <strong className="text-white text-sm">{selectedOrderDetails.customer.name}</strong>
                </div>
                <div>
                  <span className="text-[#666] block text-[10px]">EMAIL</span>
                  <span className="text-white">{selectedOrderDetails.customer.email}</span>
                </div>
                <div>
                  <span className="text-[#666] block text-[10px]">PHONE</span>
                  <span className="text-white">{selectedOrderDetails.customer.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#666] block text-[10px]">DELIVERY ADDRESS</span>
                  <span className="text-white">{selectedOrderDetails.customer.address || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Ordered Items Table */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#888] font-mono">
                Order Line Items ({selectedOrderDetails.products.length})
              </h4>
              <div className="divide-y divide-[#1F1F1F] border border-[#222] rounded-xs bg-[#141414]">
                {selectedOrderDetails.products.map((item, idx) => (
                  <div key={idx} className="p-3.5 flex items-center justify-between gap-3 text-xs font-mono">
                    <div className="space-y-0.5">
                      <p className="font-bold text-white uppercase">{item.name}</p>
                      <p className="text-[11px] text-[#888]">Size {item.size} • {item.color} • SKU: {item.sku || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold">{formatZAR(item.unitPrice * item.quantity)}</div>
                      <div className="text-[10px] text-[#666]">Qty: {item.quantity} × {formatZAR(item.unitPrice)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financials & Status */}
            <div className="border-t border-[#222] pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs font-mono">
              <div className="space-y-1">
                <div>Subtotal: <span className="text-white">{formatZAR(selectedOrderDetails.subtotal)}</span></div>
                <div>Shipping: <span className="text-white">{formatShippingZAR(selectedOrderDetails.shipping)}</span></div>
                <div className="text-sm font-bold text-[#D4AF37] pt-1">
                  Grand Total: {formatZAR(selectedOrderDetails.total)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleCopyOTC(selectedOrderDetails);
                  }}
                  className="px-4 py-2.5 bg-[#D4AF37] text-black font-bold uppercase text-xs font-mono tracking-wider rounded-xs hover:bg-[#B3932F] transition-colors flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy OTC Manifest</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
