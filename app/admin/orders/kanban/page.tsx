'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Kanban, 
  Tags, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Package,
  X
} from 'lucide-react';
import { OrderRecord } from '@/lib/mock-data';
import { fetchFullOrdersFromSupabase } from '@/lib/supabase/orders';
import { getPaymentStatusLabel, getFulfilmentStatusLabel, FulfilmentStatus } from '@/lib/supabase/types';
import { formatZAR } from '@/lib/utils';
import { getAdminAuthHeaders, useAdminAuth } from '@/lib/auth-context';
import { AdminAccessGuard } from '@/components/admin-access-guard';

const KANBAN_COLUMNS: Array<{
  id: FulfilmentStatus;
  title: string;
  badgeColor: string;
}> = [
  { id: 'pending', title: 'New Order', badgeColor: 'bg-amber-950/60 text-amber-400 border-amber-800/40' },
  { id: 'sent_to_otc', title: 'Sent to OTC', badgeColor: 'bg-blue-950/60 text-blue-300 border-blue-800/40' },
  { id: 'in_production', title: 'In Production', badgeColor: 'bg-purple-950/60 text-purple-300 border-purple-800/40' },
  { id: 'shipped', title: 'Ready / Shipped', badgeColor: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/40' },
  { id: 'delivered', title: 'Fulfilled', badgeColor: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40' },
];

export default function OrderKanbanPage() {
  const { isAuthenticated, role, hasAccess, openUnlockModal } = useAdminAuth();
  const canUpdateFulfilment = hasAccess('canUpdateOrderFulfilment');

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingOrderId, setMovingOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadOrders = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/orders?t=${Date.now()}`, { 
        headers, 
        cache: 'no-store' 
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.records)) {
          setOrders(data.records);
          return;
        }
      }
      const { records } = await fetchFullOrdersFromSupabase();
      setOrders(records);
    } catch (err: any) {
      console.error('Failed to load orders for Kanban:', err);
      showToast('Failed to load orders from database', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const headers = await getAdminAuthHeaders();
        const res = await fetch(`/api/admin/orders?t=${Date.now()}`, { 
          headers, 
          cache: 'no-store' 
        });
        if (res.ok && mounted) {
          const data = await res.json();
          if (data.success && Array.isArray(data.records)) {
            setOrders(data.records);
            return;
          }
        }
        if (mounted) {
          const { records } = await fetchFullOrdersFromSupabase();
          setOrders(records);
        }
      } catch (err: any) {
        console.error('Failed to load orders for Kanban:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void init();
    return () => {
      mounted = false;
    };
  }, []);

  // Server-Authoritative Fulfilment Status Transition
  const handleMoveStatus = async (order: OrderRecord, targetStatus: FulfilmentStatus) => {
    if (!canUpdateFulfilment) {
      showToast('Forbidden: Operations or Super Admin role required to change fulfilment status.', 'error');
      return;
    }

    if (order.fulfilmentStatus === targetStatus) return;

    setMovingOrderId(order.uuid || order.id);

    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          orderId: order.uuid || order.id,
          fulfilment_status: targetStatus,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        showToast(json.error || 'Failed to update order fulfilment status on server', 'error');
      } else {
        showToast(`Order ${order.id} moved to ${getFulfilmentStatusLabel(targetStatus)}`);
        // Optimistically update state
        setOrders(prev => prev.map(o => {
          if (o.id === order.id || o.uuid === order.uuid) {
            return { ...o, fulfilmentStatus: targetStatus };
          }
          return o;
        }));
      }
    } catch (err: any) {
      showToast(err?.message || 'Network error updating order status', 'error');
    } finally {
      setMovingOrderId(null);
    }
  };

  return (
    <AdminAccessGuard requiredPermission="canViewOrders" featureLabel="Order Kanban & Workflow Management">
      <div className="space-y-6 pb-20">
        {/* Toast Notification */}
        {notification && (
          <div className={`fixed bottom-6 right-6 z-50 border px-4 py-3 rounded shadow-2xl flex items-center gap-3 animate-in fade-in ${
            notification.type === 'error'
              ? 'bg-[#200A0A] border-red-500/60 text-red-200'
              : 'bg-[#161616] border-[#D4AF37] text-white'
          }`}>
            <span className="text-xs font-medium font-mono">{notification.message}</span>
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111] p-4 sm:p-5 border border-[#1F1F1F]">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#888] mb-1">
              <span>VERITAS</span>
              <span>/</span>
              <span className="text-[#D4AF37] font-bold">ORDER KANBAN</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-white">Visual Orders Workflow</h1>
            <p className="text-[11px] text-[#888] font-mono mt-0.5">SERVER-AUTHORITATIVE STATUS TRANSITIONS & DISPATCH</p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              onClick={() => void loadOrders()}
              disabled={loading}
              className="min-h-[44px] px-3 py-2 border border-[#333] bg-[#141414] hover:bg-[#1C1C1C] text-white flex items-center gap-1.5 font-bold uppercase"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <Link
              href="/admin/orders"
              className="min-h-[44px] px-4 py-2 border border-[#333] bg-[#111] hover:bg-[#181818] text-white font-bold uppercase flex items-center gap-1.5"
            >
              <Tags className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Table View</span>
            </Link>
          </div>
        </div>

        {/* KANBAN COLUMNS BOARD */}
        {loading ? (
          <div className="py-20 text-center font-mono text-xs text-[#888]">
            <RefreshCw className="w-6 h-6 animate-spin text-[#D4AF37] mx-auto mb-2" />
            Loading Kanban order cards...
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-[#333]">
            {KANBAN_COLUMNS.map(col => {
              const colOrders = orders.filter(o => (o.fulfilmentStatus || 'pending') === col.id);

              return (
                <div 
                  key={col.id} 
                  className="w-80 shrink-0 bg-[#0F0F0F] border border-[#1F1F1F] rounded-xs flex flex-col max-h-[calc(100vh-220px)]"
                >
                  {/* Column Header */}
                  <div className="p-3 bg-[#151515] border-b border-[#1F1F1F] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${col.badgeColor}`}>
                        {col.title}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-white bg-[#222] px-2 py-0.5 rounded">
                      {colOrders.length}
                    </span>
                  </div>

                  {/* Cards Container */}
                  <div className="p-3 space-y-3 flex-1 overflow-y-auto min-h-[300px]">
                    {colOrders.length > 0 ? (
                      colOrders.map(order => {
                        const itemsCount = order.products ? order.products.reduce((sum, p) => sum + p.quantity, 0) : 1;
                        const isMoving = movingOrderId === (order.uuid || order.id);

                        return (
                          <div 
                            key={order.id} 
                            className={`p-3.5 bg-[#141414] border border-[#222] hover:border-[#D4AF37]/50 rounded-xs space-y-2.5 transition-all shadow-sm ${
                              isMoving ? 'opacity-50 animate-pulse' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-xs text-white">{order.id}</span>
                              <span className="font-bold text-[#D4AF37] font-mono text-xs">{formatZAR(order.total)}</span>
                            </div>

                            <div className="text-xs">
                              <p className="text-white font-medium truncate">{order.customer?.name || 'Customer'}</p>
                              <p className="text-[10px] text-[#777] font-mono">
                                {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : order.date} • {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                              </p>
                            </div>

                            {/* Badges */}
                            <div className="flex items-center justify-between pt-1">
                              <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                                order.paymentStatus === 'paid' 
                                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40' 
                                  : 'bg-amber-950/60 text-amber-400 border-amber-800/40'
                              }`}>
                                {getPaymentStatusLabel(order.paymentStatus)}
                              </span>

                              <button
                                onClick={() => setSelectedOrder(order)}
                                className="text-[10px] text-[#D4AF37] hover:underline font-mono font-bold cursor-pointer"
                              >
                                View Details ↗
                              </button>
                            </div>

                            {/* Status Quick Transitions */}
                            {canUpdateFulfilment && (
                              <div className="pt-2 border-t border-[#1F1F1F] flex items-center justify-between gap-1 text-[10px] font-mono">
                                {col.id !== 'pending' && (
                                  <button
                                    onClick={() => {
                                      const prevColIdx = KANBAN_COLUMNS.findIndex(c => c.id === col.id) - 1;
                                      if (prevColIdx >= 0) {
                                        void handleMoveStatus(order, KANBAN_COLUMNS[prevColIdx].id);
                                      }
                                    }}
                                    disabled={isMoving}
                                    className="p-1 bg-[#1C1C1C] hover:bg-[#252525] border border-[#333] text-[#AAA] rounded flex items-center gap-0.5 cursor-pointer disabled:opacity-30"
                                    title="Move Left"
                                  >
                                    <ArrowLeft className="w-3 h-3" />
                                    <span>Prev</span>
                                  </button>
                                )}

                                {col.id !== 'delivered' && (
                                  <button
                                    onClick={() => {
                                      const nextColIdx = KANBAN_COLUMNS.findIndex(c => c.id === col.id) + 1;
                                      if (nextColIdx < KANBAN_COLUMNS.length) {
                                        void handleMoveStatus(order, KANBAN_COLUMNS[nextColIdx].id);
                                      }
                                    }}
                                    disabled={isMoving}
                                    className="p-1 bg-[#1C1C1C] hover:bg-[#252525] border border-[#333] text-[#D4AF37] rounded flex items-center gap-0.5 cursor-pointer disabled:opacity-30 ml-auto"
                                    title="Move Right"
                                  >
                                    <span>Next</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-12 text-center text-[10px] font-mono text-[#555]">
                        No orders in this status
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ORDER DETAILS MODAL */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#111] border border-[#262626] w-full max-w-xl shadow-2xl p-6 rounded-xs space-y-4 font-mono">
              <div className="flex items-center justify-between border-b border-[#222] pb-3">
                <h3 className="text-base font-bold text-white uppercase tracking-wider">
                  Order Details: {selectedOrder.id}
                </h3>
                <button onClick={() => setSelectedOrder(null)} className="text-[#888] hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <p className="text-[#AAA]"><strong className="text-white">Customer:</strong> {selectedOrder.customer?.name} ({selectedOrder.customer?.email})</p>
                <p className="text-[#AAA]"><strong className="text-white">Shipping Address:</strong> {selectedOrder.customer?.address || 'N/A'}</p>
                <p className="text-[#AAA]"><strong className="text-white">Total Amount:</strong> <span className="text-[#D4AF37] font-bold">{formatZAR(selectedOrder.total)}</span></p>
                <p className="text-[#AAA]"><strong className="text-white">Payment Status:</strong> {getPaymentStatusLabel(selectedOrder.paymentStatus)}</p>
                <p className="text-[#AAA]"><strong className="text-white">Fulfilment Status:</strong> {getFulfilmentStatusLabel(selectedOrder.fulfilmentStatus)}</p>
              </div>

              <div className="border-t border-[#222] pt-3">
                <p className="text-xs font-bold text-white uppercase mb-2">Ordered Line Items:</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedOrder.products?.map((p, idx) => (
                    <div key={idx} className="p-2 bg-[#161616] border border-[#222] flex items-center justify-between text-xs">
                      <div>
                        <p className="text-white font-bold">{p.name}</p>
                        <p className="text-[10px] text-[#777]">{p.color} • Size {p.size} • Qty {p.quantity}</p>
                      </div>
                      <span className="text-[#D4AF37]">{formatZAR(p.lineTotal || p.unitPrice * p.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#222] pt-3 flex justify-end">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-[#222] hover:bg-[#333] text-white text-xs uppercase font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminAccessGuard>
  );
}
