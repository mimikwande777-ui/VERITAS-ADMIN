'use client';

import { useState, useEffect } from 'react';
import { Search, Shield, RefreshCw, AlertCircle, ShoppingBag, Box, Tag, Layers, Download, FileText } from 'lucide-react';
import { fetchFullOrdersFromSupabase } from '@/lib/supabase/orders';
import { fetchProductsFromSupabase } from '@/lib/supabase/products';
import { fetchCollectionsFromSupabase } from '@/lib/supabase/collections';
import { fetchCategoriesFromSupabase } from '@/lib/supabase/categories';
import { getStoredAuditLogs } from '@/lib/supabase/audit';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ActivityLogItem {
  id: string;
  timestamp: string;
  user: string;
  email: string;
  action: string;
  target: string;
  type: 'order' | 'product' | 'collection' | 'category' | 'system';
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadAuditTrail = async () => {
    setLoading(true);
    try {
      const [ordersRes, prods, cols, cats] = await Promise.all([
        fetchFullOrdersFromSupabase(),
        fetchProductsFromSupabase(),
        fetchCollectionsFromSupabase(),
        fetchCategoriesFromSupabase()
      ]);

      const compiledLogs: ActivityLogItem[] = [];

      // Add order audit entries
      ordersRes.records.forEach((order) => {
        const itemCount = order.products?.length || order.rawItems?.length || 1;
        compiledLogs.push({
          id: `LOG-ORD-${order.id}`,
          timestamp: order.date || '2026-02-28 14:00',
          user: typeof order.customer === 'string' ? order.customer : (order.customer?.name || 'Customer Checkout'),
          email: typeof order.customer === 'string' ? 'checkout@veritas.co.za' : (order.customer?.email || 'checkout@veritas.co.za'),
          action: `Submitted order (${itemCount} items, total ZAR ${order.total.toLocaleString()}). Fulfilment: ${(order.fulfilmentStatus || 'PENDING').toUpperCase()}`,
          target: order.id,
          type: 'order'
        });
      });

      // Add product catalog entries
      (prods || []).forEach((prod) => {
        compiledLogs.push({
          id: `LOG-PRD-${prod.id}`,
          timestamp: prod.createdAt ? new Date(prod.createdAt).toLocaleString() : '2026-02-25 10:00',
          user: 'Store Admin',
          email: 'admin@veritas.co.za',
          action: `Catalog registration for "${prod.name}" (ZAR ${prod.price})`,
          target: prod.sku || prod.id,
          type: 'product'
        });
      });

      // Add collection entries
      cols.forEach((col) => {
        compiledLogs.push({
          id: `LOG-COL-${col.id}`,
          timestamp: col.created_at ? new Date(col.created_at).toLocaleString() : '2026-02-24 09:00',
          user: 'Store Admin',
          email: 'admin@veritas.co.za',
          action: `Drop capsule initialized. Status: ${col.is_active ? 'ACTIVE' : 'INACTIVE'}`,
          target: col.name,
          type: 'collection'
        });
      });

      // Add category entries
      cats.forEach((cat) => {
        compiledLogs.push({
          id: `LOG-CAT-${cat.id}`,
          timestamp: cat.created_at ? new Date(cat.created_at).toLocaleString() : '2026-02-23 08:00',
          user: 'Store Admin',
          email: 'admin@veritas.co.za',
          action: `Apparel taxonomy category indexed: ${cat.name}`,
          target: cat.slug || cat.name,
          type: 'category'
        });
      });

      // Add live recorded audit logs
      const liveLogs = getStoredAuditLogs();
      liveLogs.forEach((l) => {
        compiledLogs.push({
          id: l.id,
          timestamp: new Date(l.timestamp).toLocaleString(),
          user: l.actorRole.replace('_', ' ').toUpperCase(),
          email: l.actorEmail,
          action: l.actionLabel,
          target: l.targetId || l.targetType.toUpperCase(),
          type: (l.targetType === 'order' || l.targetType === 'product' || l.targetType === 'collection' || l.targetType === 'category') 
            ? l.targetType 
            : 'system'
        });
      });

      compiledLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setLogs(compiledLogs);
    } catch (err) {
      console.error('Failed to load audit trail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAuditTrail();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const filteredLogs = logs.filter(l => 
    l.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'order':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase font-mono font-bold bg-emerald-950/50 text-emerald-400 border border-emerald-800/40"><ShoppingBag className="w-2.5 h-2.5" /> Order</span>;
      case 'product':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase font-mono font-bold bg-amber-950/50 text-amber-400 border border-amber-800/40"><Box className="w-2.5 h-2.5" /> Product</span>;
      case 'collection':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase font-mono font-bold bg-blue-950/50 text-blue-400 border border-blue-800/40"><Layers className="w-2.5 h-2.5" /> Drop</span>;
      case 'category':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase font-mono font-bold bg-purple-950/50 text-purple-400 border border-purple-800/40"><Tag className="w-2.5 h-2.5" /> Category</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase font-mono font-bold bg-[#222] text-[#888]"><Shield className="w-2.5 h-2.5" /> System</span>;
    }
  };

  const exportActivityPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
    // Luxury dark header bar
    doc.setFillColor(15, 15, 15);
    doc.rect(0, 0, 297, 24, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(212, 175, 55); // #D4AF37 Gold
    doc.text('VERITAS', 14, 11);
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('ACTIVITY LOG & SYSTEM AUDIT TRAIL REPORT', 14, 18);
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`Generated: ${new Date().toLocaleString()} | Security Classification: RESTRICTED ADMIN AUDIT`, 140, 18);

    // Auto Table
    autoTable(doc, {
      startY: 28,
      head: [['Log ID', 'User / Actor', 'Email', 'Type', 'Action Details', 'Target Entity', 'Timestamp']],
      body: filteredLogs.map(log => [
        log.id,
        log.user,
        log.email,
        log.type.toUpperCase(),
        log.action,
        log.target,
        log.timestamp
      ]),
      headStyles: { 
        fillColor: [20, 20, 20], 
        textColor: [212, 175, 55], 
        fontSize: 8, 
        fontStyle: 'bold' 
      },
      bodyStyles: { 
        fontSize: 7.5, 
        textColor: [40, 40, 40] 
      },
      alternateRowStyles: { 
        fillColor: [248, 248, 248] 
      },
      margin: { top: 28, left: 14, right: 14 }
    });

    doc.save(`VERITAS-Activity-Log-Audit-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* AUDIT NOTICE BANNER */}
      <div className="bg-[#121212] border border-[#262626] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2.5 text-[#D4AF37]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            <strong className="text-white">AUDIT TRAIL:</strong> Real-time compiled transaction logs from Supabase orders, catalog products, drop collections, and taxonomy.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={exportActivityPdf}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-wider rounded transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Export Audit PDF
          </button>
          <button 
            onClick={loadAuditTrail}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A1A] hover:bg-[#262626] text-white rounded border border-[#333] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#D4AF37]' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-white">Activity Log</h1>
          <p className="text-xs text-[#888] font-mono mt-1">
            TIMESTAMPED RECORD OF DATABASE TRANSACTIONS & ADMINISTRATIVE ACTIONS
          </p>
        </div>
        <button 
          onClick={exportActivityPdf}
          disabled={filteredLogs.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-wider rounded transition-colors disabled:opacity-40 shadow-lg min-h-[40px]"
        >
          <FileText className="w-4 h-4" />
          <span>Export Activity Log PDF</span>
        </button>
      </div>

      <div className="bg-[#111] border border-[#1F1F1F] shadow-sm">
        <div className="p-4 border-b border-[#1F1F1F] bg-[#151515] flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search activity logs..."
              className="w-full pl-10 pr-4 py-2 text-xs font-mono bg-[#0A0A0A] text-white border border-[#333] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div className="text-xs font-mono text-[#888]">
            {filteredLogs.length} Logged Action{filteredLogs.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* 1. MOBILE RESPONSIVE STACKED CARDS (< md) */}
        <div className="block md:hidden divide-y divide-[#1F1F1F]">
          {loading ? (
            <div className="p-8 text-center text-xs text-[#888] font-mono">
              <RefreshCw className="w-5 h-5 animate-spin text-[#D4AF37] mx-auto mb-2" />
              Compiling transaction log from Supabase...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#666] font-mono">
              NO LOG ENTRIES MATCH THE SEARCH CRITERIA
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-4 space-y-2 bg-[#111]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white uppercase">{log.user}</span>
                  {getTypeBadge(log.type)}
                </div>
                <div className="text-[11px] text-[#888] font-mono">{log.email}</div>
                <p className="text-xs text-gray-300 leading-relaxed font-mono pt-1 bg-[#161616] p-2 rounded border border-[#222]">
                  {log.action}
                </p>
                <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                  <span className="text-[#D4AF37] font-bold">Target: {log.target}</span>
                  <span className="text-[#888]">{log.timestamp}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 2. DESKTOP TABULAR VIEW (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left font-mono">
            <thead className="text-xs text-[#888] uppercase bg-[#111] tracking-wider border-b border-[#1F1F1F]">
              <tr>
                <th className="px-6 py-4 font-bold">User / Actor</th>
                <th className="px-6 py-4 font-bold">Type</th>
                <th className="px-6 py-4 font-bold">Action Details</th>
                <th className="px-6 py-4 font-bold">Target Entity</th>
                <th className="px-6 py-4 font-bold text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F1F1F]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-xs text-[#888] font-mono">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#D4AF37] mx-auto mb-2" />
                    Compiling transaction log from Supabase...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-xs text-[#666] font-mono">
                    NO LOG ENTRIES MATCH THE SEARCH CRITERIA
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#151515] transition-colors text-xs">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{log.user}</div>
                      <div className="text-[11px] text-[#888]">{log.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getTypeBadge(log.type)}</td>
                    <td className="px-6 py-4 text-gray-300 leading-relaxed max-w-md">{log.action}</td>
                    <td className="px-6 py-4 text-[#D4AF37] font-bold font-mono">{log.target}</td>
                    <td className="px-6 py-4 text-[#888] text-right whitespace-nowrap">{log.timestamp}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

