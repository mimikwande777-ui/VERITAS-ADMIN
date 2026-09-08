'use client';

import { useState, useEffect } from 'react';
import { Search, Shield, RefreshCw, ShoppingBag, Box, Tag, Layers, Download, FileText } from 'lucide-react';
import { fetchFullOrdersFromSupabase } from '@/lib/supabase/orders';
import { fetchProductsFromSupabase } from '@/lib/supabase/products';
import { fetchCollectionsFromSupabase } from '@/lib/supabase/collections';
import { fetchCategoriesFromSupabase } from '@/lib/supabase/categories';
import { getStoredAuditLogs } from '@/lib/supabase/audit';
import { getSupabaseClient } from '@/lib/supabase/client';
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
        fetchFullOrdersFromSupabase().catch(() => ({ records: [] })),
        fetchProductsFromSupabase().catch(() => []),
        fetchCollectionsFromSupabase().catch(() => []),
        fetchCategoriesFromSupabase().catch(() => [])
      ]);

      const compiledLogs: ActivityLogItem[] = [];

      // 1. Live recorded audit logs (from local cache and/or Supabase audit_logs table)
      const liveLogs = getStoredAuditLogs();
      liveLogs.forEach((l) => {
        compiledLogs.push({
          id: l.id,
          timestamp: l.timestamp ? new Date(l.timestamp).toLocaleString() : new Date().toLocaleString(),
          user: l.actorRole.replace('_', ' ').toUpperCase(),
          email: l.actorEmail,
          action: l.actionLabel,
          target: l.targetId || l.targetType.toUpperCase(),
          type: (l.targetType === 'order' || l.targetType === 'product' || l.targetType === 'collection' || l.targetType === 'category') 
            ? l.targetType 
            : 'system'
        });
      });

      // Try fetching from database audit_logs table if available
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data: dbLogs } = await client
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

          if (Array.isArray(dbLogs)) {
            dbLogs.forEach((l: any) => {
              // Avoid duplicates with local cache
              if (!compiledLogs.some(c => c.id === l.id)) {
                compiledLogs.push({
                  id: l.id || `DB-LOG-${l.created_at}`,
                  timestamp: l.created_at ? new Date(l.created_at).toLocaleString() : new Date().toLocaleString(),
                  user: (l.actor_role || 'ADMIN').replace('_', ' ').toUpperCase(),
                  email: l.actor_email || 'admin@veritas.internal',
                  action: l.action_label || l.action || 'Administrative action',
                  target: l.target_id || (l.target_type || 'SYSTEM').toUpperCase(),
                  type: (l.target_type === 'order' || l.target_type === 'product' || l.target_type === 'collection' || l.target_type === 'category') 
                    ? l.target_type 
                    : 'system'
                });
              }
            });
          }
        }
      } catch {
        // Table not present or query failed
      }

      // 2. Real order events
      if (ordersRes?.records && ordersRes.records.length > 0) {
        ordersRes.records.forEach((order) => {
          const itemCount = order.products?.length || order.rawItems?.length || 1;
          const dateStr = order.date ? new Date(order.date).toLocaleString() : new Date().toLocaleString();
          compiledLogs.push({
            id: `LOG-ORD-${order.id}`,
            timestamp: dateStr,
            user: typeof order.customer === 'string' ? order.customer : (order.customer?.name || 'Store Customer'),
            email: typeof order.customer === 'string' ? 'customer@veritas.co.za' : (order.customer?.email || 'customer@veritas.co.za'),
            action: `Customer order submitted (${itemCount} item${itemCount === 1 ? '' : 's'}, total ZAR ${order.total.toLocaleString()})`,
            target: order.id,
            type: 'order'
          });
        });
      }

      // 3. Product catalog registrations (only if real createdAt exists)
      (prods || []).forEach((prod) => {
        if (prod.createdAt) {
          compiledLogs.push({
            id: `LOG-PRD-${prod.id}`,
            timestamp: new Date(prod.createdAt).toLocaleString(),
            user: 'Store Admin',
            email: 'admin@veritas.internal',
            action: `Catalog registration for "${prod.name}" (ZAR ${prod.price})`,
            target: prod.sku || prod.id,
            type: 'product'
          });
        }
      });

      // 4. Collection events (only if real created_at exists)
      (cols || []).forEach((col) => {
        if (col.created_at) {
          compiledLogs.push({
            id: `LOG-COL-${col.id}`,
            timestamp: new Date(col.created_at).toLocaleString(),
            user: 'Store Admin',
            email: 'admin@veritas.internal',
            action: `Drop capsule initialized: "${col.name}"`,
            target: col.name,
            type: 'collection'
          });
        }
      });

      // 5. Category events (only if real created_at exists)
      (cats || []).forEach((cat) => {
        if (cat.created_at) {
          compiledLogs.push({
            id: `LOG-CAT-${cat.id}`,
            timestamp: new Date(cat.created_at).toLocaleString(),
            user: 'Store Admin',
            email: 'admin@veritas.internal',
            action: `Apparel category indexed: "${cat.name}"`,
            target: cat.slug || cat.name,
            type: 'category'
          });
        }
      });

      compiledLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setLogs(compiledLogs);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
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
    if (filteredLogs.length === 0) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
    // Header bar
    doc.setFillColor(15, 15, 15);
    doc.rect(0, 0, 297, 24, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(212, 175, 55); // #D4AF37 Gold
    doc.text('VERITAS', 14, 11);
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('ACTIVITY LOG REPORT', 14, 18);
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 180, 18);

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

    doc.save(`VERITAS-Activity-Log-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-white">Activity Log</h1>
          <p className="text-xs text-[#888] font-mono mt-1">
            Timestamped record of administrative actions and store events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={loadAuditTrail}
            disabled={loading}
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 bg-[#1A1A1A] hover:bg-[#262626] text-white text-xs font-mono rounded border border-[#333] transition-colors disabled:opacity-50 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#D4AF37]' : ''}`} />
            Refresh
          </button>
          <button 
            onClick={exportActivityPdf}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-wider rounded transition-colors disabled:opacity-40 gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
        </div>
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
              className="w-full pl-10 pr-4 py-2 text-xs font-mono bg-[#0A0A0A] text-white border border-[#333] focus:outline-none focus:border-[#D4AF37] min-h-[44px]"
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
              Loading activity log...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded bg-[#1A1A1A] border border-[#262626] flex items-center justify-center mx-auto text-[#666]">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">NO ACTIVITY RECORDED</h3>
                <p className="text-xs text-[#777] font-mono">
                  No administrative activity has been recorded yet.
                </p>
              </div>
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
                    Loading activity log...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded bg-[#1A1A1A] border border-[#262626] flex items-center justify-center mx-auto text-[#666]">
                        <FileText className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">NO ACTIVITY RECORDED</h3>
                      <p className="text-xs text-[#777] font-mono">
                        No administrative activity has been recorded yet.
                      </p>
                    </div>
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
