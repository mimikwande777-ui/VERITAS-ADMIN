'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  ShoppingBag, 
  Layers, 
  Download, 
  ArrowUpRight, 
  Sparkles,
  Calendar,
  RefreshCw,
  AlertTriangle,
  Inbox,
  FileText
} from 'lucide-react';
import { OrderRecord } from '@/lib/mock-data';
import { fetchFullOrdersFromSupabase, AdminOrderFull } from '@/lib/supabase/orders';
import { formatZAR, formatNumber } from '@/lib/utils';
import { getAdminAuthHeaders } from '@/lib/auth-context';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SalesPage() {
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | '90D' | '1Y'>('7D');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [notification, setNotification] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadRealSalesData = async () => {
    setLoading(true);
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
          setLoading(false);
          return;
        }
      }
      const { records } = await fetchFullOrdersFromSupabase();
      setOrders(records);
    } catch (err) {
      console.error('Failed to load real sales data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRealSalesData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Real financial calculations based purely on actual Supabase orders
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();

  const getDateNDaysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  const sevenDaysAgoStr = getDateNDaysAgo(7);
  const thirtyDaysAgoStr = getDateNDaysAgo(30);
  const ninetyDaysAgoStr = getDateNDaysAgo(90);
  const oneYearAgoStr = getDateNDaysAgo(365);

  const todayRevenue = orders
    .filter(o => o.date === todayStr)
    .reduce((acc, o) => acc + o.total, 0);

  const sevenDayRevenue = orders
    .filter(o => o.date >= sevenDaysAgoStr)
    .reduce((acc, o) => acc + o.total, 0);

  const thirtyDayRevenue = orders
    .filter(o => o.date >= thirtyDaysAgoStr)
    .reduce((acc, o) => acc + o.total, 0);

  const ninetyDayRevenue = orders
    .filter(o => o.date >= ninetyDaysAgoStr)
    .reduce((acc, o) => acc + o.total, 0);

  const yearRevenue = orders
    .filter(o => o.date >= oneYearAgoStr)
    .reduce((acc, o) => acc + o.total, 0);

  const lifetimeGrossValue = orders.reduce((acc, o) => acc + o.total, 0);
  const paidOrders = orders.filter(o => o.paymentStatus === 'paid');
  const paidRevenue = paidOrders.reduce((acc, o) => acc + o.total, 0);
  const totalOrdersCount = orders.length;
  const aov = totalOrdersCount > 0 ? lifetimeGrossValue / totalOrdersCount : 0;

  // Real Best Sellers compiled from real order snapshots
  const productSalesMap = new Map<string, {
    name: string;
    sku: string;
    unitsSold: number;
    revenue: number;
  }>();

  orders.forEach(o => {
    (o.products || []).forEach(p => {
      const key = p.name || 'Unknown Product';
      const existing = productSalesMap.get(key) || {
        name: p.name,
        sku: p.sku || 'N/A',
        unitsSold: 0,
        revenue: 0,
      };
      existing.unitsSold += p.quantity;
      existing.revenue += (p.unitPrice * p.quantity);
      productSalesMap.set(key, existing);
    });
  });

  const bestSellers = Array.from(productSalesMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .map((item, idx) => ({
      rank: idx + 1,
      name: item.name,
      sku: item.sku,
      unitsSold: item.unitsSold,
      revenue: item.revenue,
      stockStatus: 'Real Sold Item'
    }));

  // Build real dynamic time-series chart data
  const buildTimeSeriesData = (days: number) => {
    const result: { name: string; sales: number; orders: number }[] = [];
    const step = days <= 7 ? 1 : days <= 30 ? 2 : days <= 90 ? 7 : 30;

    for (let i = days; i >= 0; i -= step) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - i);
      const dateStr = targetDate.toISOString().split('T')[0];
      const label = days <= 7 
        ? targetDate.toLocaleDateString('en-ZA', { weekday: 'short' })
        : targetDate.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });

      const matchingOrders = orders.filter(o => {
        if (step === 1) return o.date === dateStr;
        const oDate = new Date(o.date);
        const diffDays = (targetDate.getTime() - oDate.getTime()) / (1000 * 3600 * 24);
        return diffDays >= 0 && diffDays < step;
      });

      const daySales = matchingOrders.reduce((sum, o) => sum + o.total, 0);
      result.push({
        name: label,
        sales: daySales,
        orders: matchingOrders.length
      });
    }
    return result;
  };

  const rangeDays = timeRange === '7D' ? 7 : timeRange === '30D' ? 30 : timeRange === '90D' ? 90 : 365;
  const activeChartData = buildTimeSeriesData(rangeDays);

  const exportSalesPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    // Luxury dark header bar
    doc.setFillColor(15, 15, 15);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(212, 175, 55); // Gold
    doc.text('VERITAS', 14, 12);
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`FINANCIAL INTELLIGENCE REPORT (${timeRange})`, 14, 20);
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 130, 20);

    // Summary Section
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('1. EXECUTIVE FINANCIAL METRIC SUMMARY', 14, 36);

    const summaryData = [
      ['Total Verified Orders', `${totalOrdersCount}`],
      ['Lifetime Gross Volume', formatZAR(lifetimeGrossValue)],
      ['Collected Paid Revenue', formatZAR(paidRevenue)],
      ['Average Order Value (AOV)', formatZAR(aov)],
      ['Today Revenue', formatZAR(todayRevenue)],
      ['7-Day Revenue', formatZAR(sevenDayRevenue)],
      ['30-Day Revenue', formatZAR(thirtyDayRevenue)],
      ['90-Day Revenue', formatZAR(ninetyDayRevenue)],
      ['Year-to-Date Revenue', formatZAR(yearRevenue)],
    ];

    autoTable(doc, {
      startY: 40,
      head: [['Financial Metric', 'Valuation (ZAR)']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [20, 20, 20], textColor: [212, 175, 55], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, textColor: [30, 30, 30] },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 100;

    // Best Sellers Table
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('2. UNIT PERFORMANCE & BEST SELLERS', 14, finalY + 10);

    const bestSellersBody = bestSellers.map(b => [
      `#${b.rank}`,
      b.name,
      b.sku,
      `${b.unitsSold}`,
      formatZAR(b.revenue)
    ]);

    autoTable(doc, {
      startY: finalY + 14,
      head: [['Rank', 'Garment / Item Name', 'SKU', 'Units Sold', 'Total Revenue']],
      body: bestSellersBody.length > 0 ? bestSellersBody : [['-', 'No items sold in current range', '-', '-', 'R 0']],
      theme: 'striped',
      headStyles: { fillColor: [20, 20, 20], textColor: [212, 175, 55], fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
      margin: { left: 14, right: 14 }
    });

    doc.save(`VERITAS-Sales-Report-${timeRange}-${new Date().toISOString().split('T')[0]}.pdf`);
    showToast(`Exported PDF Financial Audit Report (${timeRange})`);
  };

  const handleExport = () => {
    const csvContent = `VERITAS AUTHORITATIVE FINANCIAL INTELLIGENCE REPORT (${timeRange})
Generated on: ${new Date().toISOString()}
Database Source: Connected Supabase Backend
Currency: South African Rand (ZAR)

--- EXECUTIVE FINANCIAL METRIC SUMMARY ---
Live Order Count: ${totalOrdersCount}
Gross Order Volume: ${formatZAR(lifetimeGrossValue)}
Collected Paid Revenue: ${formatZAR(paidRevenue)}
Average Order Value (AOV): ${formatZAR(aov)}
Today Revenue: ${formatZAR(todayRevenue)}
7-Day Revenue: ${formatZAR(sevenDayRevenue)}
30-Day Revenue: ${formatZAR(thirtyDayRevenue)}
90-Day Revenue: ${formatZAR(ninetyDayRevenue)}
Year-to-Date Revenue: ${formatZAR(yearRevenue)}

--- REAL RECORDED ORDER ITEMS (BEST SELLERS) ---
${bestSellers.length > 0 ? bestSellers.map(b => `#${b.rank} - ${b.name} (${b.sku}) | Units: ${b.unitsSold} | Revenue: ${formatZAR(b.revenue)}`).join('\n') : 'No line items recorded yet in database.'}

--- RECENT VERIFIED ORDERS ---
${orders.map(o => `${o.id} | Date: ${o.date} | Total: ${formatZAR(o.total)} | Payment: ${o.paymentStatus} | Fulfilment: ${o.fulfilmentStatus}`).join('\n')}
`;

    const blob = new Blob([csvContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VERITAS_FINANCIAL_REPORT_${timeRange}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    showToast(`Exported ${timeRange} Authoritative Financial Report`);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#161616] border border-[#D4AF37] text-white px-4 py-3 rounded shadow-2xl flex items-center gap-3 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          <span className="text-xs font-medium font-mono">{notification}</span>
        </div>
      )}

      {/* HONESTY BANNER */}
      <div className="bg-[#121212] border border-[#262626] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2.5 text-[#D4AF37]">
          <BarChart3 className="w-4 h-4 shrink-0" />
          <span>
            <strong className="text-white">HONEST TELEMETRY:</strong> Metrics & charts strictly calculated from {totalOrdersCount} verified Supabase order record{totalOrdersCount === 1 ? '' : 's'}.
          </span>
        </div>
        <button 
          onClick={loadRealSalesData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1A1A1A] hover:bg-[#262626] text-white rounded border border-[#333] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-[#D4AF37]' : ''}`} />
          Reload Live Data
        </button>
      </div>

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-white">Sales & Financial Intelligence</h1>
          <p className="text-xs text-[#888] font-mono mt-1">REAL-TIME REVENUE BREAKDOWNS, AOV, VELOCITY & UNIT PERFORMANCE</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-[#111] border border-[#333] rounded p-1 flex items-center gap-1">
            {(['7D', '30D', '90D', '1Y'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-mono font-bold rounded transition-colors ${
                  timeRange === range 
                    ? 'bg-[#D4AF37] text-[#0A0A0A]' 
                    : 'text-[#888] hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <button 
            onClick={exportSalesPdf}
            className="px-4 py-2 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F] transition-colors flex items-center gap-1.5 min-h-[38px]"
          >
            <FileText className="w-3.5 h-3.5" />
            Export PDF Report
          </button>
          <button 
            onClick={handleExport}
            className="px-3 py-2 bg-[#1A1A1A] text-white border border-[#333] text-xs font-bold uppercase tracking-wider hover:bg-[#262626] transition-colors flex items-center gap-1.5 min-h-[38px]"
          >
            <Download className="w-3.5 h-3.5 text-[#888]" />
            TXT Report
          </button>
        </div>
      </div>

      {/* 6 KEY FINANCIAL METRICS BENTO */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#111] border border-[#1F1F1F] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#888] font-mono">Today Revenue</p>
          <h3 className="text-xl font-bold text-white mt-1 font-mono">{formatZAR(todayRevenue)}</h3>
          <p className="text-[10px] text-[#666] mt-1 font-mono">From today&apos;s orders</p>
        </div>

        <div className="bg-[#111] border border-[#1F1F1F] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#888] font-mono">7-Day Revenue</p>
          <h3 className="text-xl font-bold text-white mt-1 font-mono">{formatZAR(sevenDayRevenue)}</h3>
          <p className="text-[10px] text-[#666] mt-1 font-mono">Past 7 days volume</p>
        </div>

        <div className="bg-[#111] border border-[#1F1F1F] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#888] font-mono">30-Day Revenue</p>
          <h3 className="text-xl font-bold text-white mt-1 font-mono">{formatZAR(thirtyDayRevenue)}</h3>
          <p className="text-[10px] text-[#666] mt-1 font-mono">Past 30 days volume</p>
        </div>

        <div className="bg-[#111] border border-[#1F1F1F] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#888] font-mono">90-Day Revenue</p>
          <h3 className="text-xl font-bold text-white mt-1 font-mono">{formatZAR(ninetyDayRevenue)}</h3>
          <p className="text-[10px] text-[#666] mt-1 font-mono">Quarterly volume</p>
        </div>

        <div className="bg-[#111] border border-[#1F1F1F] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#888] font-mono">Year Revenue</p>
          <h3 className="text-xl font-bold text-white mt-1 font-mono">{formatZAR(yearRevenue)}</h3>
          <p className="text-[10px] text-[#666] mt-1 font-mono">Trailing 12-month total</p>
        </div>

        <div className="bg-[#111] border border-[#D4AF37]/30 p-4 bg-gradient-to-br from-[#111] to-[#1a160d]">
          <p className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-mono font-bold">Lifetime Total</p>
          <h3 className="text-xl font-bold text-[#D4AF37] mt-1 font-mono">{formatZAR(lifetimeGrossValue)}</h3>
          <p className="text-[10px] text-[#BBB] mt-1 font-mono">{totalOrdersCount} Orders • AOV {formatZAR(aov)}</p>
        </div>
      </div>

      {/* INTERACTIVE CHART SECTION */}
      <div className="bg-[#111] border border-[#1F1F1F] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-[#1F1F1F] pb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">Revenue Dynamics ({timeRange})</h2>
            <p className="text-[11px] text-[#888] font-mono mt-0.5">TIMELINE REVENUE & ORDER COUNT COMPARISON</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <button 
                onClick={() => setChartType('bar')}
                className={`px-2.5 py-1 rounded text-[11px] uppercase ${chartType === 'bar' ? 'bg-[#222] text-[#D4AF37] font-bold' : 'text-[#666]'}`}
              >
                Bar
              </button>
              <button 
                onClick={() => setChartType('line')}
                className={`px-2.5 py-1 rounded text-[11px] uppercase ${chartType === 'line' ? 'bg-[#222] text-[#D4AF37] font-bold' : 'text-[#666]'}`}
              >
                Line
              </button>
            </div>
          </div>
        </div>

        <div className="h-72 w-full flex items-center justify-center">
          {loading ? (
            <RefreshCw className="w-8 h-8 text-[#D4AF37] animate-spin" />
          ) : totalOrdersCount === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-[#222] w-full rounded bg-[#0D0D0D]">
              <Inbox className="w-8 h-8 text-[#444] mx-auto mb-2" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">NO ORDERS RECORDED</h4>
              <p className="text-[11px] text-[#666] font-mono mt-1">Live customer orders will appear here automatically.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={activeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1A1A1A" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} tickFormatter={(val) => `R${formatNumber(val)}`} />
                  <Tooltip 
                    cursor={{ fill: '#161616' }} 
                    contentStyle={{ backgroundColor: '#0D0D0D', border: '1px solid #262626', borderRadius: '4px', color: '#fff' }}
                    itemStyle={{ color: '#D4AF37', fontSize: '12px' }}
                    labelStyle={{ color: '#888', fontSize: '11px', textTransform: 'uppercase' }}
                    formatter={(value: any) => [formatZAR(Number(value)), 'Revenue']}
                  />
                  <Bar dataKey="sales" fill="#D4AF37" activeBar={{ fill: '#F5D77F' }} radius={[2, 2, 0, 0]} barSize={40} />
                </BarChart>
              ) : (
                <LineChart data={activeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1A1A1A" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} tickFormatter={(val) => `R${formatNumber(val)}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0D0D0D', border: '1px solid #262626', borderRadius: '4px', color: '#fff' }}
                    itemStyle={{ color: '#D4AF37', fontSize: '12px' }}
                    formatter={(value: any) => [formatZAR(Number(value)), 'Revenue']}
                  />
                  <Line type="monotone" dataKey="sales" stroke="#D4AF37" strokeWidth={3} dot={{ fill: '#D4AF37', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* LOWER BENTO: BEST SELLERS & REVENUE CONCENTRATION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* BEST SELLING PRODUCTS (8 Cols) */}
        <div className="lg:col-span-8 bg-[#111] border border-[#1F1F1F] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1F1F1F] flex items-center justify-between bg-[#151515]">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white">Recorded Product Line Sales</h3>
            <span className="text-[10px] font-mono text-[#888]">DERIVED FROM REAL LINE ITEMS</span>
          </div>
          
          {/* 1. MOBILE RESPONSIVE STACKED CARDS (< md) */}
          <div className="block md:hidden divide-y divide-[#1F1F1F]">
            {bestSellers.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-[#666]">
                NO SOLD PRODUCT RECORDS FOUND IN CURRENT DATABASE ORDERS
              </div>
            ) : (
              bestSellers.map((item) => (
                <div key={item.rank} className="p-4 space-y-2 bg-[#111]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[#D4AF37]">RANK #{item.rank}</span>
                    <span className="font-mono font-bold text-sm text-white">{formatZAR(item.revenue)}</span>
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white uppercase">{item.name}</div>
                    <div className="text-[11px] text-[#777] font-mono">SKU: {item.sku}</div>
                  </div>
                  <div className="text-xs font-mono text-[#AAA] pt-1">
                    Units Sold: <strong className="text-white">{item.unitsSold} units</strong>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 2. DESKTOP TABULAR VIEW (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0A0A0A] text-[10px] text-[#666] uppercase tracking-wider border-b border-[#1F1F1F]">
                <tr>
                  <th className="px-6 py-3 font-bold">Rank</th>
                  <th className="px-6 py-3 font-bold">Product Snapshot</th>
                  <th className="px-6 py-3 font-bold text-right">Units Sold</th>
                  <th className="px-6 py-3 font-bold text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F1F1F]">
                {bestSellers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-xs font-mono text-[#666]">
                      NO SOLD PRODUCT RECORDS FOUND IN CURRENT DATABASE ORDERS
                    </td>
                  </tr>
                ) : (
                  bestSellers.map((item) => (
                    <tr key={item.rank} className="hover:bg-[#151515] transition-colors">
                      <td className="px-6 py-3.5 font-mono font-bold text-[#D4AF37]">#{item.rank}</td>
                      <td className="px-6 py-3.5">
                        <div className="font-bold text-white">{item.name}</div>
                        <div className="text-[10px] text-[#666] font-mono">SKU: {item.sku}</div>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-[#BBB]">{item.unitsSold} units</td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold text-white">{formatZAR(item.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ORDER FULFILLMENT BREAKDOWN (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#111] border border-[#1F1F1F] p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-4 border-b border-[#1F1F1F] pb-2">
              Payment & Fulfillment Breakdown
            </h3>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#1A1A1A]">
                <span className="text-[#888]">Total Orders Received:</span>
                <span className="font-bold text-white">{totalOrdersCount}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-[#1A1A1A]">
                <span className="text-[#888]">Paid Orders:</span>
                <span className="font-bold text-emerald-400">{paidOrders.length}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-[#1A1A1A]">
                <span className="text-[#888]">Pending Payment:</span>
                <span className="font-bold text-amber-400">{orders.filter(o => o.paymentStatus === 'pending').length}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-[#1A1A1A]">
                <span className="text-[#888]">In Production (OTC):</span>
                <span className="font-bold text-[#D4AF37]">{orders.filter(o => o.fulfilmentStatus === 'in_production' || o.fulfilmentStatus === 'sent_to_otc').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#888]">Delivered:</span>
                <span className="font-bold text-blue-400">{orders.filter(o => o.fulfilmentStatus === 'delivered').length}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

