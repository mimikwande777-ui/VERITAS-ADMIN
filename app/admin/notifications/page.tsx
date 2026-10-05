'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Bell, 
  CheckCheck, 
  AlertTriangle, 
  ShoppingBag, 
  Package, 
  CreditCard, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  ExternalLink,
  Filter,
  Check,
  Calendar,
  X
} from 'lucide-react';
import { useAdminAuth, getAdminAuthHeaders } from '@/lib/auth-context';
import { AdminAccessGuard } from '@/components/admin-access-guard';
import { AdminNotification } from '@/app/api/admin/notifications/route';

export default function NotificationsPage() {
  const { isAuthenticated, role } = useAdminAuth();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3500);
  };

  const loadNotifications = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/notifications?t=${Date.now()}`, {
        headers,
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount ?? 0);
        }
      }
    } catch (err: any) {
      console.error('[NOTIFICATIONS PAGE] Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const headers = await getAdminAuthHeaders();
        const res = await fetch(`/api/admin/notifications?t=${Date.now()}`, {
          headers,
          cache: 'no-store',
        });
        if (res.ok && mounted) {
          const data = await res.json();
          if (data.success && Array.isArray(data.notifications)) {
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount ?? 0);
          }
        }
      } catch (err: any) {
        console.error('[NOTIFICATIONS PAGE] Error fetching notifications:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void init();
    return () => {
      mounted = false;
    };
  }, []);

  // Mark single notification as read
  const handleMarkRead = async (notifId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          action: 'mark_read',
          notificationId: notifId,
        }),
      });

      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
        showToast('Notification marked as read');
      }
    } catch (err: any) {
      console.error('Failed to mark read:', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length === 0) {
      showToast('All notifications are already read');
      return;
    }

    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          action: 'mark_all_read',
          notificationIds: unreadIds,
        }),
      });

      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
        showToast(`Marked ${unreadIds.length} notifications as read`);
      }
    } catch (err: any) {
      console.error('Failed to mark all read:', err);
    }
  };

  const filteredNotifs = notifications.filter(n => {
    if (filterType !== 'all' && n.type !== filterType) return false;
    if (filterSeverity !== 'all' && n.severity !== filterSeverity) return false;
    return true;
  });

  return (
    <AdminAccessGuard featureLabel="Internal Admin Notification Centre">
      <div className="space-y-6 pb-20 font-mono">
        {statusMsg && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#161616] border border-[#D4AF37] text-white px-4 py-3 rounded-xs shadow-2xl flex items-center gap-3 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span className="text-xs">{statusMsg}</span>
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111] p-4 sm:p-5 border border-[#1F1F1F]">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#888] mb-1">
              <span>VERITAS</span>
              <span>/</span>
              <span className="text-[#D4AF37] font-bold">NOTIFICATION CENTRE</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-white">Operations Attention Queue</h1>
            <p className="text-[11px] text-[#888] mt-0.5">INTERNAL SYSTEM AUDIT ALERTS & BUSINESS EVENT DISPATCH</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/admin/settings/notifications"
              className="min-h-[36px] px-3 py-1.5 bg-[#161616] hover:bg-[#222] text-[#AAA] hover:text-white border border-[#333] hover:border-[#D4AF37] flex items-center gap-1.5 font-bold uppercase cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Push Settings</span>
            </Link>

            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0 || loading}
              className="min-h-[36px] px-3 py-1.5 bg-[#161616] hover:bg-[#222] text-[#D4AF37] border border-[#333] flex items-center gap-1.5 font-bold uppercase cursor-pointer disabled:opacity-40"
            >
              <CheckCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Mark All Read</span>
            </button>

            <button
              onClick={() => void loadNotifications()}
              disabled={loading}
              className="min-h-[36px] px-3 py-1.5 bg-[#141414] hover:bg-[#1A1A1A] text-white border border-[#333] flex items-center gap-1.5 font-bold uppercase cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* FILTER TOOLBAR */}
        <div className="bg-[#0F0F0F] p-3 sm:p-4 border border-[#1F1F1F] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-[#161616] text-white border border-[#333] px-3 py-2 text-xs focus:outline-none focus:border-[#D4AF37]"
            >
              <option value="all">All Alert Types</option>
              <option value="paid_order">Paid Orders</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="upcoming_release">Upcoming Releases</option>
              <option value="payment_attention">Payment Attention</option>
            </select>

            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-[#161616] text-white border border-[#333] px-3 py-2 text-xs focus:outline-none focus:border-[#D4AF37]"
            >
              <option value="all">All Severities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="info">Informational</option>
            </select>
          </div>

          <div className="text-xs text-[#888]">
            <span>{unreadCount} Unread • {notifications.length} Total Alerts</span>
          </div>
        </div>

        {/* NOTIFICATIONS LIST */}
        <div className="bg-[#111] border border-[#1F1F1F] divide-y divide-[#1A1A1A]">
          {loading ? (
            <div className="py-16 text-center text-xs text-[#888]">
              <RefreshCw className="w-5 h-5 animate-spin text-[#D4AF37] mx-auto mb-2" />
              Loading notifications...
            </div>
          ) : filteredNotifs.length > 0 ? (
            filteredNotifs.map((item) => {
              let targetHref = '/admin/dashboard';
              if (item.entityType === 'order') targetHref = '/admin/orders/kanban';
              else if (item.entityType === 'inventory') targetHref = '/admin/inventory';
              else if (item.entityType === 'product') targetHref = `/admin/products/${item.entityId || ''}`;

              return (
                <div 
                  key={item.id}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    item.isRead ? 'bg-[#0F0F0F] opacity-75' : 'bg-[#141414] border-l-2 border-l-[#D4AF37]'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="p-2 rounded bg-[#181818] border border-[#262626] shrink-0 mt-0.5">
                      {item.severity === 'high' ? (
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                      ) : item.severity === 'medium' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      ) : item.type === 'paid_order' ? (
                        <ShoppingBag className="w-4 h-4 text-[#D4AF37]" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white tracking-wide">
                          {item.title}
                        </span>
                        <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-bold ${
                          item.severity === 'high' ? 'bg-red-950/60 text-red-400 border border-red-800/40' :
                          item.severity === 'medium' ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40' :
                          'bg-blue-950/60 text-blue-300 border border-blue-800/40'
                        }`}>
                          {item.severity}
                        </span>
                        {!item.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
                        )}
                      </div>

                      <p className="text-xs text-[#AAA] mt-1">
                        {item.message}
                      </p>

                      <div className="flex items-center gap-3 text-[10px] text-[#666] mt-2">
                        <span>{new Date(item.createdAt).toLocaleString()}</span>
                        <span>•</span>
                        <span className="uppercase">{item.type.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <Link
                      href={targetHref}
                      className="px-3 py-1.5 bg-[#1C1C1C] hover:bg-[#262626] text-white text-xs font-bold uppercase rounded border border-[#333] flex items-center gap-1"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3 text-[#D4AF37]" />
                    </Link>

                    {!item.isRead && (
                      <button
                        onClick={(e) => handleMarkRead(item.id, e)}
                        className="px-3 py-1.5 bg-[#141414] hover:bg-[#1C1C1C] text-[#888] hover:text-white text-xs font-bold uppercase rounded border border-[#333] flex items-center gap-1 cursor-pointer"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Mark Read</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-16 text-center text-xs text-[#777]">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-white uppercase text-sm">No Notifications Found</p>
              <p className="text-[11px] text-[#666] mt-1">All business operations alerts and notifications are clear.</p>
            </div>
          )}
        </div>
      </div>
    </AdminAccessGuard>
  );
}
