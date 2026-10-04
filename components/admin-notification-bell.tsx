'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Bell, 
  AlertTriangle, 
  ShoppingBag, 
  Package, 
  Clock, 
  CheckCircle2, 
  X, 
  Sparkles,
  ExternalLink,
  Kanban,
  CheckCheck,
  Check,
  ChevronRight
} from 'lucide-react';
import { useAdminAuth, getAdminAuthHeaders } from '@/lib/auth-context';
import { AdminNotification } from '@/app/api/admin/notifications/route';

export function AdminNotificationBell() {
  const { isAuthenticated, role } = useAdminAuth();

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch notifications from server API
  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
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
    } catch {
      // Non-blocking
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let active = true;
    const fetchOnMount = async () => {
      if (!isAuthenticated) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      try {
        const headers = await getAdminAuthHeaders();
        const res = await fetch(`/api/admin/notifications?t=${Date.now()}`, {
          headers,
          cache: 'no-store',
        });
        if (res.ok && active) {
          const data = await res.json();
          if (data.success && Array.isArray(data.notifications)) {
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount ?? 0);
          }
        }
      } catch {
        // Non-blocking
      }
    };

    void fetchOnMount();
    const interval = setInterval(() => {
      if (active) {
        void refreshNotifications();
      }
    }, 45000); // 45s interval

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, refreshNotifications]);

  // Mark single notification as read
  const handleMarkRead = async (notifId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
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
          action: 'mark_read',
          notificationId: notifId,
        }),
      });

      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch {
      // Non-blocking
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length === 0) return;

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
      }
    } catch {
      // Non-blocking
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative font-mono">
      {/* Bell Icon Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative min-w-[36px] min-h-[36px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center bg-[#151515] hover:bg-[#1C1C1C] border border-[#262626] hover:border-[#D4AF37]/50 rounded-xs text-[#AAA] hover:text-white transition-all cursor-pointer"
        title="Operational Notifications"
        aria-label="Operational Notifications"
      >
        <Bell className="w-4 h-4 text-[#D4AF37]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white font-mono text-[9px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center animate-pulse border border-[#000]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Slide-out Dropdown Panel */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />

          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#0F0F0F] border border-[#262626] shadow-2xl rounded-xs z-50 overflow-hidden font-mono animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-3.5 bg-[#141414] border-b border-[#222] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Attention Queue</span>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3 h-3" />
                    <span>Read All</span>
                  </button>
                )}
                <span className="text-[10px] text-[#888] bg-[#222] px-2 py-0.5 rounded">
                  {unreadCount} New
                </span>
              </div>
            </div>

            {/* Alert Items List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-[#1A1A1A]">
              {notifications.length > 0 ? (
                notifications.slice(0, 8).map(notif => {
                  let targetHref = '/admin/dashboard';
                  if (notif.entityType === 'order') targetHref = '/admin/orders/kanban';
                  else if (notif.entityType === 'inventory') targetHref = '/admin/inventory';
                  else if (notif.entityType === 'product') targetHref = `/admin/products/${notif.entityId || ''}`;

                  return (
                    <div
                      key={notif.id}
                      className={`p-3 flex items-start gap-3 hover:bg-[#161616] transition-colors relative group ${
                        notif.isRead ? 'opacity-60' : 'bg-[#121212]'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {notif.severity === 'high' ? (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        ) : notif.severity === 'medium' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        ) : notif.type === 'paid_order' ? (
                          <ShoppingBag className="w-4 h-4 text-[#D4AF37]" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-cyan-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center justify-between">
                          <Link 
                            href={targetHref}
                            onClick={() => {
                              void handleMarkRead(notif.id);
                              setIsOpen(false);
                            }}
                            className="text-xs font-bold text-white group-hover:text-[#D4AF37] truncate block"
                          >
                            {notif.title}
                          </Link>
                        </div>
                        <p className="text-[11px] text-[#888] mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <span className="text-[9px] text-[#666] mt-1 block uppercase">
                          {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {!notif.isRead && (
                        <button
                          onClick={(e) => handleMarkRead(notif.id, e)}
                          className="absolute top-2.5 right-2.5 text-[#555] hover:text-[#D4AF37] p-1 cursor-pointer"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-[#777]">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold uppercase text-white">All Clear</p>
                  <p className="text-[10px] mt-1 text-[#666]">No operational alerts requiring immediate attention.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 bg-[#121212] border-t border-[#222] flex items-center justify-between text-[10px]">
              <Link 
                href="/admin/notifications" 
                onClick={() => setIsOpen(false)} 
                className="text-[#D4AF37] hover:underline flex items-center gap-1 font-bold"
              >
                <span>View Full Centre</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
              <Link 
                href="/admin/orders/kanban" 
                onClick={() => setIsOpen(false)} 
                className="text-[#888] hover:text-white flex items-center gap-1"
              >
                <span>Order Kanban</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
