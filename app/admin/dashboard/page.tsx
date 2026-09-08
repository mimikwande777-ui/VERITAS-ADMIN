'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import { OrderRecord } from '@/lib/mock-data';
import { fetchFullOrdersFromSupabase } from '@/lib/supabase/orders';
import { getPaymentStatusLabel, getFulfilmentStatusLabel } from '@/lib/supabase/types';
import { useProductsStore, getInventoryFromProducts } from '@/lib/product-store';
import { formatZAR, formatNumber } from '@/lib/utils';
import { getAdminAuthHeaders, useAdminAuth } from '@/lib/auth-context';

export default function Dashboard() {
  const { isAuthenticated, openUnlockModal } = useAdminAuth();
  const products = useProductsStore();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);

  const inventoryItems = getInventoryFromProducts(products);
  const lowStockItems = inventoryItems.filter(item => item.status === 'Low Stock' || item.status === 'Out of Stock');
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
    initFetch();

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

  // Real calculations derived from Supabase
  const totalProductsCount = products.length;
  const publishedProductsCount = products.filter(p => p.published).length;
  const totalInventoryUnits = inventoryItems.reduce((acc, item) => acc + item.quantity, 0);
  const lowStockCount = lowStockItems.length;
  const totalOrdersCount = orders.length;
  const paidRevenue = orders
    .filter(o => o.paymentStatus === 'paid')
    .reduce((acc, o) => acc + o.total, 0);
  const totalGrossRevenue = orders.reduce((acc, o) => acc + o.total, 0);
  
  const pendingOrdersCount = orders.filter(o => 
    o.fulfilmentStatus === 'pending'
  ).length;

  // Sales chart data based on live orders
  const chartData = orders.map(o => ({
    name: o.id,
    sales: o.total,
  }));

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#888] mb-1">
            <span>VERITAS</span>
            <span>/</span>
            <span className="text-[#D4AF37] font-bold">DASHBOARD</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-white">Administrative Overview</h1>
          <p className="text-[11px] sm:text-xs text-[#888] font-mono mt-0.5">REAL-TIME STORE TELEMETRY & OPERATIONS</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
          <Link 
            href="/admin/products/new" 
            className="min-h-[44px] px-4 py-2 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F] transition-colors flex items-center justify-center gap-1.5 active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            Add Product
          </Link>
          <Link 
            href="/admin/orders" 
            className="min-h-[44px] px-4 py-2 border border-[#333] bg-[#111] text-xs font-bold uppercase tracking-wider hover:bg-[#181818] text-white transition-colors flex items-center justify-center gap-1.5 active:scale-95"
          >
            <SendHorizontal className="w-4 h-4 text-[#D4AF37]" />
            Orders ({orders.length})
          </Link>
        </div>
      </div>

      {/* 6 TOP ADMINISTRATIVE METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
        {/* 1. TOTAL PRODUCTS */}
        <div className="bg-[#111] border border-[#1F1F1F] p-3 sm:p-4 flex flex-col justify-between hover:border-[#333] transition-colors">
          <span className="text-[9px] sm:text-[10px] text-[#888] uppercase tracking-wider font-mono font-bold">TOTAL PRODUCTS</span>
          <div className="mt-2 sm:mt-3">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-light text-white font-mono">{totalProductsCount}</h2>
            <p className="text-[9px] sm:text-[10px] text-[#666] mt-0.5 sm:mt-1 font-mono">In master catalog</p>
          </div>
        </div>

        {/* 2. PUBLISHED PRODUCTS */}
        <div className="bg-[#111] border border-[#1F1F1F] p-3 sm:p-4 flex flex-col justify-between hover:border-[#333] transition-colors">
          <span className="text-[9px] sm:text-[10px] text-[#888] uppercase tracking-wider font-mono font-bold">PUBLISHED</span>
          <div className="mt-2 sm:mt-3">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-light text-emerald-400 font-mono">{publishedProductsCount}</h2>
            <p className="text-[9px] sm:text-[10px] text-[#666] mt-0.5 sm:mt-1 font-mono">Live on store</p>
          </div>
        </div>

        {/* 3. TOTAL INVENTORY */}
        <div className="bg-[#111] border border-[#1F1F1F] p-3 sm:p-4 flex flex-col justify-between hover:border-[#333] transition-colors">
          <span className="text-[9px] sm:text-[10px] text-[#888] uppercase tracking-wider font-mono font-bold">TOTAL STOCK</span>
          <div className="mt-2 sm:mt-3">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-light text-white font-mono">{totalInventoryUnits}</h2>
            <p className="text-[9px] sm:text-[10px] text-[#666] mt-0.5 sm:mt-1 font-mono">Units on hand</p>
          </div>
        </div>

        {/* 4. LOW STOCK */}
        <div className="bg-[#111] border border-[#1F1F1F] p-3 sm:p-4 flex flex-col justify-between hover:border-[#333] transition-colors">
          <span className="text-[9px] sm:text-[10px] text-[#888] uppercase tracking-wider font-mono font-bold">STOCK ALERTS</span>
          <div className="mt-2 sm:mt-3">
            <h2 className={`text-xl sm:text-2xl lg:text-3xl font-light font-mono ${lowStockCount > 0 ? 'text-amber-400' : 'text-white'}`}>
              {lowStockCount}
            </h2>
            <p className="text-[9px] sm:text-[10px] text-[#666] mt-0.5 sm:mt-1 font-mono">{outOfStockItems.length} out of stock</p>
          </div>
        </div>

        {/* 5. TOTAL ORDERS */}
        <div className="bg-[#111] border border-[#1F1F1F] p-3 sm:p-4 flex flex-col justify-between hover:border-[#333] transition-colors">
          <span className="text-[9px] sm:text-[10px] text-[#888] uppercase tracking-wider font-mono font-bold">TOTAL ORDERS</span>
          <div className="mt-2 sm:mt-3">
            {isAuthenticated ? (
              <>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-light text-white font-mono">{totalOrdersCount}</h2>
                <p className="text-[9px] sm:text-[10px] text-[#666] mt-0.5 sm:mt-1 font-mono">{pendingOrdersCount} pending OTC</p>
              </>
            ) : (
              <div>
                <span className="text-sm font-bold text-amber-500 font-mono block">PROTECTED</span>
                <button
                  type="button"
                  onClick={openUnlockModal}
                  className="text-[10px] text-[#D4AF37] hover:underline font-mono mt-0.5 cursor-pointer flex items-center gap-1"
                >
                  <Lock className="w-2.5 h-2.5" /> Unlock to view
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 6. PAID REVENUE */}
        <div className="bg-[#111] border border-[#1F1F1F] p-3 sm:p-4 flex flex-col justify-between hover:border-[#333] transition-colors">
          <span className="text-[9px] sm:text-[10px] text-[#888] uppercase tracking-wider font-mono font-bold">REVENUE</span>
          <div className="mt-2 sm:mt-3">
            {isAuthenticated ? (
              <>
                <h2 className="text-lg sm:text-xl lg:text-2xl font-light text-[#D4AF37] font-mono truncate">
                  {formatZAR(paidRevenue > 0 ? paidRevenue : totalGrossRevenue)}
                </h2>
                <p className="text-[9px] sm:text-[10px] text-[#666] mt-0.5 sm:mt-1 font-mono truncate">Gross: {formatZAR(totalGrossRevenue)}</p>
              </>
            ) : (
              <div>
                <span className="text-sm font-bold text-amber-500 font-mono block">PROTECTED</span>
                <button
                  type="button"
                  onClick={openUnlockModal}
                  className="text-[10px] text-[#D4AF37] hover:underline font-mono mt-0.5 cursor-pointer flex items-center gap-1"
                >
                  <Lock className="w-2.5 h-2.5" /> Unlock to view
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MIDDLE ROW: SALES VELOCITY CHART & INVENTORY RADAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
        {/* Sales Velocity Chart */}
        <div className="lg:col-span-8 bg-[#111] border border-[#1F1F1F] p-4 sm:p-6 relative min-w-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">Sales Volume & Orders</h3>
              <p className="text-[11px] text-[#666] font-mono mt-0.5">REVENUE VOLUME OVERVIEW</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-[#D4AF37]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#D4AF37]"></span>
                Revenue (ZAR)
              </span>
            </div>
          </div>
          
          <div className="h-56 sm:h-64 w-full flex items-center justify-center min-w-0">
            {!isAuthenticated ? (
              <div className="text-center py-8 px-4 border border-dashed border-[#222] w-full rounded bg-[#0D0D0D]">
                <ShieldCheck className="w-8 h-8 text-[#D4AF37] mx-auto mb-2" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">ADMIN AUTHORIZATION REQUIRED</h4>
                <p className="text-[11px] text-[#777] font-mono mt-1 max-w-sm mx-auto">
                  Authenticate to view real-time sales telemetry, order volume, and revenue metrics.
                </p>
                <button
                  type="button"
                  onClick={openUnlockModal}
                  className="mt-3 px-4 py-1.5 min-h-[36px] bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs rounded-xs font-mono inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Unlock className="w-3.5 h-3.5 text-black" />
                  <span>Unlock Admin</span>
                </button>
              </div>
            ) : loadingOrders ? (
              <RefreshCw className="w-6 h-6 text-[#D4AF37] animate-spin" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1A1A1A" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#666', fontWeight: 600 }} 
                    dy={10} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#666' }} 
                    tickFormatter={(val) => `R${formatNumber(val)}`} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#161616' }} 
                    contentStyle={{ backgroundColor: '#0D0D0D', border: '1px solid #262626', borderRadius: '4px', color: '#fff' }}
                    itemStyle={{ color: '#D4AF37', fontSize: '12px' }}
                    labelStyle={{ color: '#888', fontSize: '11px', textTransform: 'uppercase' }}
                    formatter={(value: any) => [formatZAR(Number(value)), 'Revenue']}
                  />
                  <Bar dataKey="sales" fill="#D4AF37" activeBar={{ fill: '#F5D77F' }} radius={[2, 2, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 px-4 border border-dashed border-[#222] w-full rounded bg-[#0D0D0D]">
                <TrendingUp className="w-8 h-8 text-[#444] mx-auto mb-2" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">NO ORDERS RECORDED YET</h4>
                <p className="text-[11px] text-[#666] font-mono mt-1">Orders placed on the store will display here.</p>
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Monitor */}
        <div className="lg:col-span-4 bg-[#111] border border-[#1F1F1F] p-4 sm:p-6 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-[#1F1F1F] pb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">Stock Alerts</h3>
              <Link href="/admin/inventory" className="min-h-[44px] flex items-center text-xs font-mono text-[#D4AF37] hover:underline uppercase gap-1">
                Manage <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            
            {lowStockItems.length > 0 ? (
              <div className="space-y-2.5">
                {lowStockItems.slice(0, 4).map((item) => (
                  <div key={item.id} className="p-3 bg-[#151515] border border-[#222] rounded flex items-center justify-between gap-2">
                    <div className="overflow-hidden min-w-0">
                      <p className="text-xs font-bold text-white truncate">{item.product}</p>
                      <p className="text-[11px] text-[#888] font-mono truncate">{item.color} • Size {item.size}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        item.quantity === 0 
                          ? 'bg-red-950/60 text-red-400 border border-red-800/40' 
                          : 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                      }`}>
                        {item.quantity} LEFT
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 px-4 border border-dashed border-[#222] rounded bg-[#0D0D0D]">
                <CheckCircle2 className="w-7 h-7 text-[#444] mx-auto mb-2" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">NO STOCK ALERTS</h4>
                <p className="text-[11px] text-[#666] font-mono mt-1">All variant inventory levels are healthy.</p>
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-3 border-t border-[#1F1F1F]">
            <Link 
              href="/admin/inventory"
              className="min-h-[44px] flex items-center justify-center w-full py-2 bg-[#1A1A1A] hover:bg-[#222] text-xs font-bold uppercase tracking-wider text-[#BBB] transition-colors active:scale-98"
            >
              View All Variants
            </Link>
          </div>
        </div>
      </div>

      {/* RECENT ORDERS TABLE & MOBILE CARDS */}
      <div className="bg-[#111] border border-[#1F1F1F] overflow-hidden">
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#1F1F1F] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#151515]">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white">Recent Orders & OTC Dispatch</h3>
            <p className="text-[11px] text-[#666] font-mono">STORE ORDERS QUEUE</p>
          </div>
          <Link 
            href="/admin/orders" 
            className="min-h-[44px] sm:min-h-0 flex items-center justify-center text-xs text-[#D4AF37] border border-[#D4AF37]/40 px-3 py-1.5 rounded hover:bg-[#D4AF37]/10 uppercase font-bold tracking-wider text-center transition-colors"
          >
            Manage All Orders ({orders.length})
          </Link>
        </div>
        
        {!isAuthenticated ? (
          <div className="py-12 text-center px-4">
            <ShieldCheck className="w-8 h-8 text-[#D4AF37] mx-auto mb-2" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">ADMIN AUTHORIZATION REQUIRED</h4>
            <p className="text-[11px] text-[#777] font-mono mt-1 max-w-sm mx-auto">
              Customer orders, recipient contact info, and OTC dispatch controls are protected.
            </p>
            <button
              type="button"
              onClick={openUnlockModal}
              className="mt-3 px-4 py-1.5 min-h-[36px] bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs rounded-xs font-mono inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Unlock className="w-3.5 h-3.5 text-black" />
              <span>Unlock Admin</span>
            </button>
          </div>
        ) : loadingOrders ? (
          <div className="py-12 text-center text-xs font-mono text-[#888]">
            <RefreshCw className="w-5 h-5 text-[#D4AF37] animate-spin mx-auto mb-2" />
            Loading orders...
          </div>
        ) : orders.length > 0 ? (
          <>
            {/* Mobile View: Order Cards (< md) */}
            <div className="md:hidden divide-y divide-[#1F1F1F]">
              {orders.map((order) => {
                const customerName = order.customer.name;
                const itemsCount = order.products ? order.products.reduce((acc, p) => acc + p.quantity, 0) : 1;

                return (
                  <div key={order.id} className="p-3.5 sm:p-4 bg-[#111] space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sm text-white">{order.id}</span>
                      <span className="font-bold text-[#D4AF37] font-mono text-sm">{formatZAR(order.total)}</span>
                    </div>

                    <div className="text-xs">
                      <div className="font-medium text-white">{customerName}</div>
                      <div className="text-[11px] text-[#777] font-mono truncate">{order.customer.email}</div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/40 text-amber-400 border border-amber-800/40 uppercase">
                          {getPaymentStatusLabel(order.paymentStatus)}
                        </span>
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#1A1A1A] text-[#D4AF37] border border-[#333] uppercase">
                          {getFulfilmentStatusLabel(order.fulfilmentStatus)}
                        </span>
                        <span className="text-[10px] font-mono text-[#888]">
                          {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      <Link
                        href="/admin/orders"
                        className="min-h-[44px] flex items-center gap-1 text-xs font-bold text-[#D4AF37] hover:text-white uppercase tracking-wider active:scale-95"
                      >
                        Details <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Full Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-[#0A0A0A] text-[10px] text-[#666] uppercase tracking-wider border-b border-[#1F1F1F]">
                  <tr>
                    <th className="px-6 py-3 font-bold">Order Number</th>
                    <th className="px-6 py-3 font-bold">Customer</th>
                    <th className="px-6 py-3 font-bold">Items</th>
                    <th className="px-6 py-3 font-bold text-right">Total</th>
                    <th className="px-6 py-3 font-bold">Payment</th>
                    <th className="px-6 py-3 font-bold">Status</th>
                    <th className="px-6 py-3 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-[#1F1F1F]">
                  {orders.map((order) => {
                    const customerName = order.customer.name;
                    const itemsCount = order.products ? order.products.reduce((acc, p) => acc + p.quantity, 0) : 1;
                    
                    return (
                      <tr key={order.id} className="hover:bg-[#151515] transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-white">{order.id}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-white">{customerName}</div>
                          <div className="text-[11px] text-[#666] font-mono">{order.customer.email}</div>
                        </td>
                        <td className="px-6 py-4 text-[#888] font-mono">
                          {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-[#D4AF37] font-mono">
                          {formatZAR(order.total)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/40 text-amber-400 border border-amber-800/40 uppercase">
                            {getPaymentStatusLabel(order.paymentStatus)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#1A1A1A] text-[#D4AF37] border border-[#333] uppercase">
                            {getFulfilmentStatusLabel(order.fulfilmentStatus)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href="/admin/orders"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#D4AF37] hover:text-white uppercase tracking-wider"
                          >
                            DISPATCH / DETAILS <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="py-14 text-center px-4">
            <Inbox className="w-10 h-10 text-[#444] mx-auto mb-3" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">NO ORDERS YET</h4>
            <p className="text-xs text-[#666] font-mono mt-1 max-w-md mx-auto">
              Customer orders will appear here once the VERITAS store receives an order.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
