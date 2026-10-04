'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  ArrowUpRight, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  ShoppingBag, 
  ExternalLink,
  SendHorizontal,
  Inbox,
  CheckCircle2,
  RefreshCw,
  Lock,
  Unlock,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  Package,
  Activity,
  CreditCard,
  Kanban
} from 'lucide-react';
import { OrderRecord } from '@/lib/mock-data';
import { fetchFullOrdersFromSupabase } from '@/lib/supabase/orders';
import { getPaymentStatusLabel, getFulfilmentStatusLabel } from '@/lib/supabase/types';
import { useProductsStore, getInventoryFromProducts } from '@/lib/product-store';
import { formatZAR, formatNumber } from '@/lib/utils';
import { getAdminAuthHeaders, useAdminAuth } from '@/lib/auth-context';

type DateFilterMode = 'today' | '7days' | '30days' | 'this_month' | 'custom';

export default function Dashboard() {
  const { isAuthenticated, openUnlockModal, role } = useAdminAuth();
  const products = useProductsStore();
  
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [dateFilter, setDateFilter] = useState<DateFilterMode>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const inventoryItems = getInventoryFromProducts(products);
  const lowStockItems = inventoryItems.filter(item => item.status === 'Low Stock');
  const outOfStockItems = inventoryItems.filter(item => item.status === 'Out of Stock');

  const loadRealOrders = useCallback(async () => {
    try {
      const authHeaders = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/orders?t=${Date.now()}`, { 
        headers: authHeaders,
        cache: 'no-store' 
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.records)) {
          setOrders(data.records);
          setLoadingOrders(false);
          return;
        }
      }
      const { records } = await fetchFullOrdersFromSupabase();
      setOrders(records);
    } catch (err) {
      console.error('Failed to load real orders for dashboard:', err);
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initFetch = async () => {
      if (active) {
        await loadRealOrders();
      }
    };
    void initFetch();

    const handleAuthChange = () => {
      if (active) {
        setLoadingOrders(true);
        void loadRealOrders();
      }
    };

    window.addEventListener('veritas_admin_auth_changed', handleAuthChange);
    return () => {
      active = false;
      window.removeEventListener('veritas_admin_auth_changed', handleAuthChange);
    };
  }, [loadRealOrders]);

  // Date Filter logic using real database timestamps
  const filteredOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return orders.filter(o => {
      const orderDate = o.createdAt ? new Date(o.createdAt) : o.date ? new Date(o.date) : new Date();

      if (dateFilter === 'today') {
        return orderDate >= startOfToday;
      }
      if (dateFilter === '7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return orderDate >= sevenDaysAgo;
      }
      if (dateFilter === '30days') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return orderDate >= thirtyDaysAgo;
      }
      if (dateFilter === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return orderDate >= startOfMonth;
      }
      if (dateFilter === 'custom') {
        if (customStart) {
          const s = new Date(customStart);
          if (orderDate < s) return false;
        }
        if (customEnd) {
          const e = new Date(customEnd);
          e.setHours(23, 59, 59, 999);
          if (orderDate > e) return false;
        }
        return true;
      }
      return true;
    });
  }, [orders, dateFilter, customStart, customEnd]);

  // Calculated Real Operational Metrics
  const ordersTodayCount = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return orders.filter(o => {
      const d = o.createdAt ? new Date(o.createdAt) : new Date();
      return d >= startOfToday;
    }).length;
  }, [orders]);

  const revenueTodayVal = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return orders
      .filter(o => {
        const d = o.createdAt ? new Date(o.createdAt) : new Date();
        return d >= startOfToday && o.paymentStatus === 'paid';
      })
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [orders]);

  const filteredPaidOrders = filteredOrders.filter(o => o.paymentStatus === 'paid');
  const filteredPaidRevenue = filteredPaidOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  const ordersNeedingFulfilment = orders.filter(o => 
    o.paymentStatus === 'paid' && 
    (o.fulfilmentStatus === 'pending' || o.fulfilmentStatus === 'sent_to_otc' || o.fulfilmentStatus === 'in_production')
  );

  const pendingPaymentsCount = orders.filter(o => o.paymentStatus === 'pending').length;

  const comingSoonProducts = products.filter(p => p.salesMode === 'coming_soon');
  const preorderProducts = products.filter(p => p.salesMode === 'preorder');

  // Chart Data based on filtered orders
  const chartData = filteredOrders.map(o => ({
    name: o.id,
    sales: o.total,
  }));

  // Top Products calculation from real order line items
  const topProductsList = useMemo(() => {
    const productCounts: Record<string, { name: string; salesCount: number; totalRevenue: number }> = {};

    orders.forEach(o => {
      if (o.paymentStatus === 'paid' && Array.isArray(o.products)) {
        o.products.forEach(p => {
          const key = p.productId || p.name;
          if (!productCounts[key]) {
            productCounts[key] = { name: p.name, salesCount: 0, totalRevenue: 0 };
          }
          productCounts[key].salesCount += p.quantity || 1;
          productCounts[key].totalRevenue += p.lineTotal || ((p.unitPrice || 0) * (p.quantity || 1));
        });
      }
    });

    return Object.values(productCounts)
      .sort((a, b) => b.salesCount - a.salesCount)
      .slice(0, 5);
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Top Header & Date Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#111] p-4 sm:p-5 border border-[#1F1F1F]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#888] mb-1">
            <span>VERITAS</span>
            <span>/</span>
            <span className="text-[#D4AF37] font-bold">TODAY DASHBOARD</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-white">Operations & Store Telemetry</h1>
          <p className="text-[11px] text-[#888] font-mono mt-0.5">AUTHORITATIVE REAL-TIME METRICS & FULFILMENT QUEUE</p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="flex items-center bg-[#0A0A0A] p-1 border border-[#222] rounded-xs">
            {(['today', '7days', '30days', 'this_month', 'custom'] as DateFilterMode[]).map((mode) => {
              const label = mode === 'today' ? 'Today' :
                            mode === '7days' ? '7 Days' :
                            mode === '30days' ? '30 Days' :
                            mode === 'this_month' ? 'This Month' : 'Custom';
              const isActive = dateFilter === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setDateFilter(mode)}
                  className={`px-3 py-1.5 min-h-[36px] text-xs font-bold uppercase transition-colors cursor-pointer ${
                    isActive 
                      ? 'bg-[#D4AF37] text-black shadow-xs' 
                      : 'text-[#888] hover:text-white hover:bg-[#181818]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 bg-[#0A0A0A] p-1.5 border border-[#222] rounded-xs">
              <input 
                type="date" 
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-[#141414] text-white text-xs p-1 border border-[#333] focus:outline-none focus:border-[#D4AF37]"
              />
              <span className="text-[#666]">-</span>
              <input 
                type="date" 
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-[#141414] text-white text-xs p-1 border border-[#333] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          )}
        </div>
      </div>

      {/* 10 OPERATIONAL METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {/* 1. ORDERS TODAY */}
        <div className="bg-[#111] border border-[#1F1F1F] p-3.5 flex flex-col justify-between hover:border-[#333] transition-colors">
          <span className="text-[10px] text-[#888] uppercase tracking-wider font-mono font-bold">ORDERS TODAY</span>
          <div className="mt-2">
            <h2 className="text-2xl font-light text-white font-mono">{ordersTodayCount}</h2>
            <p className="text-[10px] text-[#666] mt-0.5 font-mono">Placed since midnight</p>
          </div>
        </div>

        {/* 2. REVENUE TODAY */}
        <div className="bg-[#111] border border-[#1F1F1F] p-3.5 flex flex-col justify-between hover:border-[#333] transition-colors">
          <span className="text-[10px] text-[#888] uppercase tracking-wider font-mono font-bold">REVENUE TODAY</span>
          <div className="mt-2">
            <h2 className="text-xl font-light text-[#D4AF37] font-mono truncate">{formatZAR(revenueTodayVal)}</h2>
            <p className="text-[10px] text-[#666] mt-0.5 font-mono">Paid transactions</p>
          </div>
        </div>

        {/* 3. PAID ORDERS */}
        <div className="bg-[#111] border border-[#1F1F1F] p-3.5 flex flex-col justify-between hover:border-[#333] transition-colors">
          <span className="text-[10px] text-[#888] uppercase tracking-wider font-mono font-bold">PAID ORDERS</span>
          <div className="mt-2">
            <h2 className="text-2xl font-light text-emerald-400 font-mono">{filteredPaidOrders.length}</h2>
            <p className="text-[10px] text-[#666] mt-0.5 font-mono">{formatZAR(filteredPaidRevenue)}</p>
          </div>
        </div>

        {/* 4. ORDERS NEEDING FULFILMENT */}
        <div className="bg-[#111] border border-amber-900/40 p-3.5 flex flex-col justify-between bg-gradient-to-br from-[#111] to-[#1c160c]">
          <span className="text-[10px] text-amber-400 uppercase tracking-wider font-mono font-bold flex items-center justify-between">
            <span>NEEDS DISPATCH</span>
            <AlertTriangle className="w-3 h-3 text-amber-400" />
          </span>
          <div className="mt-2">
            <h2 className="text-2xl font-bold text-amber-400 font-mono">{ordersNeedingFulfilment.length}</h2>
            <Link href="/admin/orders/kanban" className="text-[10px] text-amber-400/80 hover:underline mt-0.5 font-mono block">
              Open Kanban Workflow ↗
            </Link>
          </div>
        </div>

        {/* 5. PENDING PAYMENTS */}
        <div className="bg-[#111] border border-[#1F1F1F] p-3.5 flex flex-col justify-between hover:border-[#333] transition-colors">
          <span className="text-[10px] text-[#888] uppercase tracking-wider font-mono font-bold">PENDING PAYMENTS</span>
          <div className="mt-2">
            <h2 className="text-2xl font-light text-white font-mono">{pendingPaymentsCount}</h2>
            <p className="text-[10px] text-[#666] mt-0.5 font-mono">Awaiting PayFast / EFT</p>
          </div>
        </div>

        {/* 6. LOW-STOCK VARIANTS */}
        <div className="bg-[#111] border border-[#1F1F1F] p-3.5 flex flex-col justify-between hover:border-[#333] transition-colors">
          <span className="text-[10px] text-[#888] uppercase tracking-wider font-mono font-bold">LOW STOCK VARIANTS</span>
          <div className="mt-2">
            <h2 className="text-2xl font-light text-amber-400 font-mono">{lowStockItems.length}</h2>
            <p className="text-[10px] text-[#666] mt-0.5 font-mono">At or below threshold</p>
          </div>
        </div>

        {/* 7. OUT-OF-STOCK VARIANTS */}
        <div className="bg-[#111] border border-[#1F1F1F] p-3.5 flex flex-col justify-between hover:border-[#333] transition-colors">
          <span className="text-[10px] text-[#888] uppercase tracking-wider font-mono font-bold">OUT OF STOCK</span>
          <div className="mt-2">
            <h2 className="text-2xl font-light text-red-400 font-mono">{outOfStockItems.length}</h2>
            <p className="text-[10px] text-[#666] mt-0.5 font-mono">0 units on hand</p>
          </div>
        </div>

        {/* 8. COMING SOON PRODUCTS */}
        <div className="bg-[#111] border border-[#1F1F1F] p-3.5 flex flex-col justify-between hover:border-[#333] transition-colors">
          <span className="text-[10px] text-[#888] uppercase tracking-wider font-mono font-bold">COMING SOON</span>
          <div className="mt-2">
            <h2 className="text-2xl font-light text-cyan-400 font-mono">{comingSoonProducts.length}</h2>
            <p className="text-[10px] text-[#666] mt-0.5 font-mono">Teaser items</p>
          </div>
        </div>

        {/* 9. PREORDERS */}
        <div className="bg-[#111] border border-[#1F1F1F] p-3.5 flex flex-col justify-between hover:border-[#333] transition-colors">
          <span className="text-[10px] text-[#888] uppercase tracking-wider font-mono font-bold">PREORDERS</span>
          <div className="mt-2">
            <h2 className="text-2xl font-light text-purple-400 font-mono">{preorderProducts.length}</h2>
            <p className="text-[10px] text-[#666] mt-0.5 font-mono">Advance reservation</p>
          </div>
        </div>

        {/* 10. RECENT ACTIVITY */}
        <div className="bg-[#111] border border-[#1F1F1F] p-3.5 flex flex-col justify-between hover:border-[#333] transition-colors">
          <span className="text-[10px] text-[#888] uppercase tracking-wider font-mono font-bold">RECENT ACTIVITY</span>
          <div className="mt-2">
            <h2 className="text-2xl font-light text-white font-mono">{orders.length}</h2>
            <Link href="/admin/activity" className="text-[10px] text-[#D4AF37] hover:underline font-mono block mt-0.5">
              Audit Logs ↗
            </Link>
          </div>
        </div>
      </div>

      {/* SECTION 1: ORDERS REQUIRING ATTENTION */}
      <div className="bg-[#111] border border-[#1F1F1F] p-4 sm:p-5">
        <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-white">Orders Requiring Operational Attention</h3>
          </div>
          <Link href="/admin/orders/kanban" className="text-xs text-[#D4AF37] hover:underline font-mono font-bold uppercase flex items-center gap-1">
            <Kanban className="w-3.5 h-3.5" />
            <span>Open Kanban Workflow</span>
          </Link>
        </div>

        {ordersNeedingFulfilment.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ordersNeedingFulfilment.map(ord => (
              <div key={ord.id} className="p-3.5 bg-[#151515] border border-amber-900/30 rounded-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-white">{ord.id}</span>
                  <span className="font-bold text-[#D4AF37] font-mono text-xs">{formatZAR(ord.total)}</span>
                </div>
                <div className="text-xs">
                  <p className="text-white font-medium">{ord.customer?.name || 'Guest'}</p>
                  <p className="text-[11px] text-[#888] font-mono">{ord.customer?.email}</p>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#222]">
                  <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40 uppercase">
                    PAID • {getFulfilmentStatusLabel(ord.fulfilmentStatus)}
                  </span>
                  <Link href="/admin/orders/kanban" className="text-xs text-[#D4AF37] font-bold hover:underline">
                    Dispatch ↗
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 px-4 border border-dashed border-[#222] rounded-xs bg-[#0D0D0D]">
            <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">NO PENDING DISPATCHES</h4>
            <p className="text-[11px] text-[#666] font-mono mt-1">All paid orders have been processed and fulfilled.</p>
          </div>
        )}
      </div>

      {/* SECTION 2 & 3: LOW STOCK + RECENT PAYMENTS / ORDERS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SECTION 2: LOW STOCK ALERTS */}
        <div className="lg:col-span-5 bg-[#111] border border-[#1F1F1F] p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">Inventory Alerts</h3>
              <Link href="/admin/inventory" className="text-xs text-[#D4AF37] hover:underline font-mono font-bold uppercase flex items-center gap-1">
                <span>Manage Inventory</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {lowStockItems.length > 0 || outOfStockItems.length > 0 ? (
              <div className="space-y-2">
                {[...outOfStockItems, ...lowStockItems].slice(0, 5).map(item => (
                  <div key={item.id} className="p-3 bg-[#151515] border border-[#222] rounded flex items-center justify-between gap-2">
                    <div className="overflow-hidden min-w-0">
                      <p className="text-xs font-bold text-white truncate">{item.product}</p>
                      <p className="text-[11px] text-[#888] font-mono truncate">{item.color} • Size {item.size}</p>
                    </div>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                      item.quantity === 0 
                        ? 'bg-red-950/60 text-red-400 border border-red-800/40' 
                        : 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                    }`}>
                      {item.quantity === 0 ? 'OUT OF STOCK' : `${item.quantity} LEFT`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 px-4 border border-dashed border-[#222] rounded bg-[#0D0D0D]">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">ALL STOCK LEVELS HEALTHY</h4>
                <p className="text-[11px] text-[#666] font-mono mt-1">No variant inventory threshold warnings.</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#1F1F1F]">
            <Link 
              href="/admin/inventory"
              className="min-h-[44px] flex items-center justify-center w-full py-2 bg-[#1A1A1A] hover:bg-[#222] text-xs font-bold uppercase tracking-wider text-[#BBB] transition-colors"
            >
              View All Variants & Thresholds
            </Link>
          </div>
        </div>

        {/* SECTION 3: RECENT PAYMENTS / ORDERS FEED */}
        <div className="lg:col-span-7 bg-[#111] border border-[#1F1F1F] p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white">Recent Payments & Live Orders</h3>
            <Link href="/admin/orders" className="text-xs text-[#D4AF37] hover:underline font-mono font-bold uppercase">
              View All ({orders.length})
            </Link>
          </div>

          {filteredOrders.length > 0 ? (
            <div className="space-y-2">
              {filteredOrders.slice(0, 5).map(ord => (
                <div key={ord.id} className="p-3 bg-[#151515] border border-[#222] rounded flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-white">{ord.id}</span>
                      <span className="text-[10px] font-mono text-[#888]">
                        {ord.createdAt ? new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ord.date}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#BBB] truncate">{ord.customer?.name} ({ord.customer?.email})</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-[#D4AF37] font-mono">{formatZAR(ord.total)}</p>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                      ord.paymentStatus === 'paid' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-amber-950/60 text-amber-400'
                    }`}>
                      {getPaymentStatusLabel(ord.paymentStatus)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 px-4 border border-dashed border-[#222] rounded bg-[#0D0D0D]">
              <Inbox className="w-8 h-8 text-[#444] mx-auto mb-2" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">NO ORDERS IN SELECTED TIMEFRAME</h4>
              <p className="text-[11px] text-[#666] font-mono mt-1">Try switching the date filter tab above.</p>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4 & 5: UPCOMING RELEASES + TOP PRODUCTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SECTION 4: UPCOMING RELEASES */}
        <div className="lg:col-span-6 bg-[#111] border border-[#1F1F1F] p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white">Upcoming Releases & Preorders</h3>
            <Link href="/admin/products" className="text-xs text-[#D4AF37] hover:underline font-mono uppercase">
              Products Catalog
            </Link>
          </div>

          {(comingSoonProducts.length > 0 || preorderProducts.length > 0) ? (
            <div className="space-y-2">
              {[...comingSoonProducts, ...preorderProducts].map(p => (
                <div key={p.id} className="p-3 bg-[#151515] border border-[#222] rounded flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-white">{p.name}</p>
                    <p className="text-[11px] text-[#888] font-mono">
                      {p.availabilityMessage || `Sales Mode: ${p.salesMode}`}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    p.salesMode === 'coming_soon' ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/40' : 'bg-purple-950/60 text-purple-300 border border-purple-800/40'
                  }`}>
                    {(p.salesMode || 'standard').replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 px-4 border border-dashed border-[#222] rounded bg-[#0D0D0D]">
              <Sparkles className="w-6 h-6 text-[#555] mx-auto mb-2" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">NO UPCOMING TEASERS SET</h4>
              <p className="text-[11px] text-[#666] font-mono mt-1">Set product Sales Mode to Coming Soon or Preorder in the catalog.</p>
            </div>
          )}
        </div>

        {/* SECTION 5: TOP PRODUCTS */}
        <div className="lg:col-span-6 bg-[#111] border border-[#1F1F1F] p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white">Top Products (Real Sales Data)</h3>
            <span className="text-[10px] text-[#888] font-mono">PAID ORDERS ONLY</span>
          </div>

          {topProductsList.length > 0 ? (
            <div className="space-y-2">
              {topProductsList.map((item, idx) => (
                <div key={item.name} className="p-3 bg-[#151515] border border-[#222] rounded flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#222] text-[#D4AF37] font-mono text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white">{item.name}</p>
                      <p className="text-[11px] text-[#888] font-mono">{item.salesCount} units sold</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#D4AF37] font-mono">
                    {formatZAR(item.totalRevenue)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 px-4 border border-dashed border-[#222] rounded bg-[#0D0D0D]">
              <ShoppingBag className="w-6 h-6 text-[#555] mx-auto mb-2" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">NO PRODUCT SALES RECORDED YET</h4>
              <p className="text-[11px] text-[#666] font-mono mt-1">Top products will appear automatically once paid orders are completed.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
