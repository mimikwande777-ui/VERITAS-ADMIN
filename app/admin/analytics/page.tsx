'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Eye, 
  ShoppingCart, 
  CreditCard, 
  ShoppingBag, 
  Search, 
  Globe, 
  Smartphone, 
  Monitor, 
  Tablet, 
  Sparkles, 
  RefreshCw, 
  AlertTriangle, 
  Download, 
  Calendar,
  Layers,
  ArrowRight,
  Filter,
  Package,
  Activity,
  ChevronRight
} from 'lucide-react';
import { useAdminAuth, getAdminAuthHeaders } from '@/lib/auth-context';
import { AdminAccessGuard } from '@/components/admin-access-guard';
import { formatZAR, formatNumber } from '@/lib/utils';
import { AnalyticsSummary } from '@/app/api/admin/analytics/route';

type DateRangeOption = 'today' | '7d' | '30d' | 'this_month' | 'custom';

const DEVICE_COLORS = ['#D4AF37', '#3B82F6', '#10B981'];

export default function AnalyticsPage() {
  const { isAuthenticated, role, hasAccess } = useAdminAuth();
  const canViewFinancials = hasAccess('canViewFinancialDetails');

  const [range, setRange] = useState<DateRangeOption>('7d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      let url = `/api/admin/analytics?range=${range}&t=${Date.now()}`;
      if (range === 'custom' && customStart) {
        url += `&start=${encodeURIComponent(customStart)}`;
        if (customEnd) url += `&end=${encodeURIComponent(customEnd)}`;
      }

      const res = await fetch(url, { headers, cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to load analytics`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error || 'Failed to aggregate analytics');
      }
    } catch (err: any) {
      console.error('[ANALYTICS UI] Error loading analytics:', err);
      setError(err?.message || 'Error querying analytics pipeline');
    } finally {
      setLoading(false);
    }
  }, [range, customStart, customEnd]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const headers = await getAdminAuthHeaders();
        let url = `/api/admin/analytics?range=${range}&t=${Date.now()}`;
        if (range === 'custom' && customStart) {
          url += `&start=${encodeURIComponent(customStart)}`;
          if (customEnd) url += `&end=${encodeURIComponent(customEnd)}`;
        }

        const res = await fetch(url, { headers, cache: 'no-store' });
        if (res.ok && mounted) {
          const json = await res.json();
          if (json.success && json.data) {
            setData(json.data);
          }
        }
      } catch (err: any) {
        console.error('[ANALYTICS UI] Error loading analytics:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [range, customStart, customEnd]);

  // Export Analytics Summary CSV
  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Value'],
      ['Timeframe', data.timeframe],
      ['Start Date', data.startDate],
      ['End Date', data.endDate],
      ['Total Visitors', String(data.visitorsCount)],
      ['Page Views', String(data.pageViewsCount)],
      ['Product Views', String(data.productViewsCount)],
      ['Add to Carts', String(data.addToCartCount)],
      ['Checkout Starts', String(data.checkoutStartsCount)],
      ['Paid Orders', String(data.paidOrdersCount)],
      ['Total Revenue (ZAR)', String(data.revenue)],
      ['Average Order Value (ZAR)', String(data.averageOrderValue)],
      ['Items Sold', String(data.itemsSoldCount)],
      ['Visitor-to-Purchase Conversion Rate (%)', `${data.funnel.visitorToPurchaseRate}%`],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `veritas_analytics_${data.timeframe}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminAccessGuard requiredPermission="canViewSales" featureLabel="Ecommerce Analytics & Store Telemetry">
      <div className="space-y-6 pb-20 font-mono">
        {/* TOP HEADER & DATE RANGE FILTER BAR */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#111] p-4 sm:p-5 border border-[#1F1F1F]">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#888] mb-1">
              <span>VERITAS</span>
              <span>/</span>
              <span className="text-[#D4AF37] font-bold">ECOMMERCE ANALYTICS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-white">Store Telemetry & Intelligence</h1>
            <p className="text-[11px] text-[#888] mt-0.5">AUTHORITATIVE CONVERSION FUNNEL & CUSTOMER ACQUISITION DATA</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Range Toggle Tabs */}
            <div className="flex items-center bg-[#0A0A0A] p-1 border border-[#222] rounded-xs">
              {(['today', '7d', '30d', 'this_month', 'custom'] as DateRangeOption[]).map((opt) => {
                const label = opt === 'today' ? 'Today' :
                              opt === '7d' ? '7 Days' :
                              opt === '30d' ? '30 Days' :
                              opt === 'this_month' ? 'This Month' : 'Custom';
                const isActive = range === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setRange(opt)}
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

            {/* Custom Date Pickers */}
            {range === 'custom' && (
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

            <button
              onClick={() => void fetchAnalytics()}
              disabled={loading}
              className="min-h-[36px] px-3 py-1.5 bg-[#141414] hover:bg-[#1A1A1A] text-white border border-[#333] flex items-center gap-1.5 font-bold uppercase cursor-pointer disabled:opacity-50"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={!data || loading}
              className="min-h-[36px] px-3 py-1.5 bg-[#141414] hover:bg-[#1A1A1A] text-white border border-[#333] flex items-center gap-1.5 font-bold uppercase cursor-pointer disabled:opacity-50"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#888]" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800/60 rounded text-red-200 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="font-bold uppercase text-red-300">Analytics Telemetry Notice</p>
              <p className="text-[11px] text-[#AAA] mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* 1. EXECUTIVE KPI OVERVIEW (9 METRICS) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Revenue */}
          <div className="bg-[#111] border border-[#1F1F1F] p-3.5 flex flex-col justify-between hover:border-[#333] transition-colors col-span-2 sm:col-span-1">
            <span className="text-[10px] text-[#888] uppercase tracking-wider font-bold flex items-center justify-between">
              <span>TOTAL REVENUE</span>
              <CreditCard className="w-3.5 h-3.5 text-[#D4AF37]" />
            </span>
            <div className="mt-2">
              <h2 className="text-xl sm:text-2xl font-light text-[#D4AF37] truncate">
                {formatZAR(data?.revenue ?? 0)}
              </h2>
              <p className="text-[10px] text-[#666] mt-0.5">Authoritative paid orders</p>
            </div>
          </div>

          {/* Paid Orders */}
          <div className="bg-[#111] border border-[#1F1F1F] p-3.5 flex flex-col justify-between hover:border-[#333] transition-colors">
            <span className="text-[10px] text-[#888] uppercase tracking-wider font-bold">PAID ORDERS</span>
            <div className="mt-2">
              <h2 className="text-xl sm:text-2xl font-light text-emerald-400">
                {data?.paidOrdersCount ?? 0}
              </h2>
              <p className="text-[10px] text-[#666] mt-0.5">{data?.itemsSoldCount ?? 0} items sold</p>
            </div>
          </div>

          {/* Average Order Value */}
          <div className="bg-[#111] border border-[#1F1F1F] p-3.5 flex flex-col justify-between hover:border-[#333] transition-colors">
            <span className="text-[10px] text-[#888] uppercase tracking-wider font-bold">AVG ORDER VALUE</span>
            <div className="mt-2">
              <h2 className="text-xl sm:text-2xl font-light text-white truncate">
                {formatZAR(data?.averageOrderValue ?? 0)}
              </h2>
              <p className="text-[10px] text-[#666] mt-0.5">Per verified order</p>
            </div>
          </div>

          {/* Unique Visitors */}
          <div className="bg-[#111] border border-[#1F1F1F] p-3.5 flex flex-col justify-between hover:border-[#333] transition-colors">
            <span className="text-[10px] text-[#888] uppercase tracking-wider font-bold flex items-center justify-between">
              <span>VISITORS</span>
              <Users className="w-3.5 h-3.5 text-[#888]" />
            </span>
            <div className="mt-2">
              <h2 className="text-xl sm:text-2xl font-light text-white">
                {data?.visitorsCount ?? 0}
              </h2>
              <p className="text-[10px] text-[#666] mt-0.5">{data?.pageViewsCount ?? 0} total pageviews</p>
            </div>
          </div>

          {/* Conversion Rate */}
          <div className="bg-[#111] border border-amber-900/40 p-3.5 flex flex-col justify-between bg-gradient-to-br from-[#111] to-[#1c160c]">
            <span className="text-[10px] text-amber-400 uppercase tracking-wider font-bold flex items-center justify-between">
              <span>CONVERSION RATE</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </span>
            <div className="mt-2">
              <h2 className="text-xl sm:text-2xl font-bold text-amber-400">
                {data?.funnel.visitorToPurchaseRate ?? 0}%
              </h2>
              <p className="text-[10px] text-amber-400/80 mt-0.5">Visitor → Purchase</p>
            </div>
          </div>
        </div>

        {/* 2. CONVERSION FUNNEL PIPELINE */}
        <div className="bg-[#111] border border-[#1F1F1F] p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1F1F1F] pb-3 mb-5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">Conversion Funnel Pipeline</h3>
              <p className="text-[11px] text-[#666] mt-0.5">MEASURING VISITOR PROGRESSION ACROSS STORE ENGAGEMENT MILESTONES</p>
            </div>
            <span className="text-[10px] text-[#D4AF37] font-bold bg-[#181818] px-2.5 py-1 border border-[#262626] rounded">
              Overall Conversion: {data?.funnel.visitorToPurchaseRate ?? 0}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {/* Step 1: Visitors */}
            <div className="bg-[#141414] p-3.5 border border-[#222] rounded-xs space-y-2">
              <div className="flex items-center justify-between text-[10px] text-[#888] uppercase">
                <span className="font-bold">1. Visitors</span>
                <Users className="w-3 h-3 text-[#777]" />
              </div>
              <p className="text-2xl font-light text-white">{data?.funnel.visitors ?? 0}</p>
              <div className="h-1.5 w-full bg-[#222] rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }}></div>
              </div>
              <p className="text-[9px] text-[#666]">100% Top of Funnel</p>
            </div>

            {/* Step 2: Product Views */}
            <div className="bg-[#141414] p-3.5 border border-[#222] rounded-xs space-y-2">
              <div className="flex items-center justify-between text-[10px] text-[#888] uppercase">
                <span className="font-bold">2. Product Views</span>
                <Eye className="w-3 h-3 text-[#777]" />
              </div>
              <p className="text-2xl font-light text-white">{data?.funnel.productViews ?? 0}</p>
              <div className="h-1.5 w-full bg-[#222] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-500 rounded-full transition-all" 
                  style={{ width: `${Math.min(100, data?.funnel.visitors ? ((data.funnel.productViews / data.funnel.visitors) * 100) : 0)}%` }}
                ></div>
              </div>
              <p className="text-[9px] text-[#666]">
                {data?.funnel.viewToCartRate ?? 0}% view → cart
              </p>
            </div>

            {/* Step 3: Add to Cart */}
            <div className="bg-[#141414] p-3.5 border border-[#222] rounded-xs space-y-2">
              <div className="flex items-center justify-between text-[10px] text-[#888] uppercase">
                <span className="font-bold">3. Add to Cart</span>
                <ShoppingCart className="w-3 h-3 text-[#777]" />
              </div>
              <p className="text-2xl font-light text-white">{data?.funnel.addToCart ?? 0}</p>
              <div className="h-1.5 w-full bg-[#222] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all" 
                  style={{ width: `${Math.min(100, data?.funnel.productViews ? ((data.funnel.addToCart / data.funnel.productViews) * 100) : 0)}%` }}
                ></div>
              </div>
              <p className="text-[9px] text-[#666]">
                {data?.funnel.cartToCheckoutRate ?? 0}% cart → checkout
              </p>
            </div>

            {/* Step 4: Checkout Started */}
            <div className="bg-[#141414] p-3.5 border border-[#222] rounded-xs space-y-2">
              <div className="flex items-center justify-between text-[10px] text-[#888] uppercase">
                <span className="font-bold">4. Checkout</span>
                <CreditCard className="w-3 h-3 text-[#777]" />
              </div>
              <p className="text-2xl font-light text-white">{data?.funnel.checkoutStarts ?? 0}</p>
              <div className="h-1.5 w-full bg-[#222] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all" 
                  style={{ width: `${Math.min(100, data?.funnel.addToCart ? ((data.funnel.checkoutStarts / data.funnel.addToCart) * 100) : 0)}%` }}
                ></div>
              </div>
              <p className="text-[9px] text-[#666]">
                {data?.funnel.checkoutToPaidRate ?? 0}% checkout → paid
              </p>
            </div>

            {/* Step 5: Paid Orders */}
            <div className="bg-[#141414] p-3.5 border border-[#D4AF37]/30 rounded-xs space-y-2 bg-gradient-to-br from-[#141414] to-[#1c180f]">
              <div className="flex items-center justify-between text-[10px] text-[#D4AF37] uppercase font-bold">
                <span>5. Paid Orders</span>
                <ShoppingBag className="w-3 h-3 text-[#D4AF37]" />
              </div>
              <p className="text-2xl font-bold text-[#D4AF37]">{data?.funnel.paidOrders ?? 0}</p>
              <div className="h-1.5 w-full bg-[#222] rounded-full overflow-hidden">
                <div className="h-full bg-[#D4AF37] rounded-full" style={{ width: '100%' }}></div>
              </div>
              <p className="text-[9px] text-emerald-400">
                {data?.funnel.visitorToPurchaseRate ?? 0}% overall conversion
              </p>
            </div>
          </div>
        </div>

        {/* 3. REVENUE TIMESERIES CHART */}
        <div className="bg-[#111] border border-[#1F1F1F] p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">Daily Revenue & Orders Timeseries</h3>
              <p className="text-[11px] text-[#666] mt-0.5">AUTHORITATIVE SETTLED SALES CHRONOLOGY (ZAR)</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-[#D4AF37]">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#D4AF37]"></span>
                Revenue (ZAR)
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-xs text-[#888]">
                <RefreshCw className="w-5 h-5 animate-spin text-[#D4AF37] mr-2" />
                Aggregating timeseries data...
              </div>
            ) : data && data.revenueTimeseries && data.revenueTimeseries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.revenueTimeseries} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1A1A1A" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#666' }} 
                    tickFormatter={(v) => v.slice(5)} 
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
                    labelStyle={{ color: '#888', fontSize: '11px' }}
                    formatter={(value: any) => [formatZAR(Number(value)), 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#D4AF37" activeBar={{ fill: '#F5D77F' }} radius={[2, 2, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#222]">
                <TrendingUp className="w-8 h-8 text-[#444] mb-2" />
                <p className="text-xs uppercase text-white font-bold">No Revenue Recorded in Selected Period</p>
                <p className="text-[11px] text-[#666] mt-0.5">Sales will chart here as orders are placed and settled.</p>
              </div>
            )}
          </div>
        </div>

        {/* 4. PRODUCT PERFORMANCE & SIZE/COLOUR INTELLIGENCE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Top Purchased & Revenue Products */}
          <div className="lg:col-span-6 bg-[#111] border border-[#1F1F1F] p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">Top Purchased Products</h3>
              <span className="text-[10px] text-[#888]">SNAPSHOT DATA</span>
            </div>

            {data && data.topPurchasedProducts && data.topPurchasedProducts.length > 0 ? (
              <div className="space-y-2">
                {data.topPurchasedProducts.slice(0, 6).map((p, idx) => (
                  <div key={idx} className="p-3 bg-[#151515] border border-[#222] rounded-xs flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#222] text-[#D4AF37] text-xs flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-white">{p.name}</p>
                        <p className="text-[10px] text-[#777]">{p.quantity} units ordered</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#D4AF37]">
                      {formatZAR(p.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-[#666] border border-dashed border-[#222] rounded-xs">
                No product purchases recorded in this date range.
              </div>
            )}
          </div>

          {/* Top Viewed & Cart Added Products */}
          <div className="lg:col-span-6 bg-[#111] border border-[#1F1F1F] p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">Engagement: Most Viewed & Added</h3>
              <span className="text-[10px] text-[#888]">ANALYTICS PIPELINE</span>
            </div>

            {data && data.topViewedProducts && data.topViewedProducts.length > 0 ? (
              <div className="space-y-2">
                {data.topViewedProducts.slice(0, 6).map((p, idx) => {
                  const matchingCart = data.topAddedToCartProducts?.find(c => c.name === p.name);
                  return (
                    <div key={idx} className="p-3 bg-[#151515] border border-[#222] rounded-xs flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Eye className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-bold text-white truncate">{p.name}</p>
                          <p className="text-[10px] text-[#777]">{p.views} views</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded shrink-0">
                        {matchingCart?.adds ?? 0} carts
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-[#666] border border-dashed border-[#222] rounded-xs">
                No product view events logged in this date range.
              </div>
            )}
          </div>
        </div>

        {/* 5. SIZE, COLOUR, & SEARCH ANALYTICS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Top Sizes & Colours */}
          <div className="lg:col-span-6 bg-[#111] border border-[#1F1F1F] p-4 sm:p-5">
            <div className="border-b border-[#1F1F1F] pb-3 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">Size & Colour Popularity</h3>
              <p className="text-[10px] text-[#666] mt-0.5">BASED ON AUTHORITATIVE PURCHASED GARMENTS</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Sizes */}
              <div>
                <h4 className="text-[10px] uppercase font-bold text-[#D4AF37] mb-2">Sizes Ordered</h4>
                {data && data.topSizes && data.topSizes.length > 0 ? (
                  <div className="space-y-1.5">
                    {data.topSizes.map(s => (
                      <div key={s.size} className="p-2 bg-[#161616] border border-[#222] flex items-center justify-between text-xs">
                        <span className="font-bold text-white">Size {s.size}</span>
                        <span className="text-[#888]">{s.count} units</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-[#666]">No size sales data yet.</p>
                )}
              </div>

              {/* Colours */}
              <div>
                <h4 className="text-[10px] uppercase font-bold text-[#D4AF37] mb-2">Colours Ordered</h4>
                {data && data.topColours && data.topColours.length > 0 ? (
                  <div className="space-y-1.5">
                    {data.topColours.map(c => (
                      <div key={c.colour} className="p-2 bg-[#161616] border border-[#222] flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{c.colour}</span>
                        <span className="text-[#888]">{c.count} units</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-[#666]">No colour sales data yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Search Analytics */}
          <div className="lg:col-span-6 bg-[#111] border border-[#1F1F1F] p-4 sm:p-5">
            <div className="border-b border-[#1F1F1F] pb-3 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">Store Search Intelligence</h3>
              <p className="text-[10px] text-[#666] mt-0.5">ANONYMIZED CUSTOMER SEARCH QUERIES (NO PII EXPOSED)</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-[10px] uppercase font-bold text-emerald-400 mb-2 flex items-center gap-1">
                  <Search className="w-3 h-3" />
                  Top Search Queries
                </h4>
                {data && data.topSearches && data.topSearches.length > 0 ? (
                  <div className="space-y-1.5">
                    {data.topSearches.map(q => (
                      <div key={q.query} className="p-2 bg-[#161616] border border-[#222] flex items-center justify-between text-xs">
                        <span className="text-white truncate max-w-[120px]">&quot;{q.query}&quot;</span>
                        <span className="text-[#888]">{q.count} searches</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-[#666]">No customer searches logged.</p>
                )}
              </div>

              <div>
                <h4 className="text-[10px] uppercase font-bold text-amber-400 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Zero-Result Searches
                </h4>
                {data && data.zeroResultSearches && data.zeroResultSearches.length > 0 ? (
                  <div className="space-y-1.5">
                    {data.zeroResultSearches.map(q => (
                      <div key={q.query} className="p-2 bg-[#161616] border border-amber-900/30 flex items-center justify-between text-xs">
                        <span className="text-amber-200 truncate max-w-[120px]">&quot;{q.query}&quot;</span>
                        <span className="text-amber-400/70">{q.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-[#666]">No zero-result searches reported.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 6. TRAFFIC ACQUISITION & DEVICE ATTRIBUTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Traffic Sources */}
          <div className="lg:col-span-8 bg-[#111] border border-[#1F1F1F] p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3 mb-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-white">Traffic Acquisition & Referrers</h3>
                <p className="text-[10px] text-[#666] mt-0.5">AGGREGATE CAMPAIGN AND REFERRAL CHANNELS</p>
              </div>
              <Globe className="w-4 h-4 text-[#D4AF37]" />
            </div>

            {data && data.trafficSources && data.trafficSources.length > 0 ? (
              <div className="space-y-3">
                {data.trafficSources.map(t => (
                  <div key={t.source} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">{t.source}</span>
                      <span className="text-[#888]">{t.visitors} visits ({t.percentage}%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                      <div className="h-full bg-[#D4AF37] rounded-full" style={{ width: `${t.percentage}%` }}></div>
                    </div>
                  </div>
                ))}

                {data.utmCampaigns && data.utmCampaigns.length > 0 && (
                  <div className="pt-3 border-t border-[#1F1F1F]">
                    <h4 className="text-[10px] uppercase font-bold text-[#888] mb-2">Tracked UTM Campaigns</h4>
                    <div className="space-y-1.5">
                      {data.utmCampaigns.map((utm, idx) => (
                        <div key={idx} className="p-2 bg-[#161616] border border-[#222] flex items-center justify-between text-xs">
                          <span className="text-[#D4AF37] font-bold">{utm.campaign} ({utm.source})</span>
                          <span className="text-[#888]">{utm.visits} visits</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-[#666] border border-dashed border-[#222] rounded-xs">
                No referral traffic events recorded.
              </div>
            )}
          </div>

          {/* Device Breakdown */}
          <div className="lg:col-span-4 bg-[#111] border border-[#1F1F1F] p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#1F1F1F] pb-3 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white">Device Breakdown</h3>
                <Smartphone className="w-4 h-4 text-[#888]" />
              </div>

              {data && data.deviceBreakdown && data.deviceBreakdown.length > 0 ? (
                <div className="space-y-3">
                  {data.deviceBreakdown.map((d, idx) => (
                    <div key={d.device} className="p-3 bg-[#161616] border border-[#222] rounded-xs flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {d.device === 'Mobile' ? (
                          <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                        ) : d.device === 'Tablet' ? (
                          <Tablet className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Monitor className="w-4 h-4 text-blue-400" />
                        )}
                        <span className="text-xs font-bold text-white">{d.device}</span>
                      </div>
                      <span className="text-xs font-bold text-[#D4AF37]">
                        {d.percentage}% ({d.count})
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-[#666] border border-dashed border-[#222] rounded-xs">
                  No device data.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#1F1F1F] text-[10px] text-[#666]">
              Aggregated client-type header telemetry. No browser fingerprinting.
            </div>
          </div>
        </div>
      </div>
    </AdminAccessGuard>
  );
}
