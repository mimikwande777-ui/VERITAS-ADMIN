'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  Smartphone, 
  Monitor, 
  Send, 
  Trash2, 
  RefreshCw, 
  ShieldCheck, 
  Lock, 
  Sparkles, 
  ArrowLeft,
  Info,
  Server,
  Cpu,
  XCircle
} from 'lucide-react';
import { useAdminAuth, getAdminAuthHeaders } from '@/lib/auth-context';
import { AdminAccessGuard } from '@/components/admin-access-guard';
import { 
  checkPushSupport, 
  subscribeToPush, 
  unsubscribeFromPush, 
  getExistingSubscription,
  PushSupportStatus 
} from '@/lib/push/client-push';

interface PushSubscriptionData {
  id: string;
  endpoint: string;
  device_name?: string | null;
  user_agent_summary?: string | null;
  preferences?: Record<string, boolean>;
  created_at: string;
  last_used_at?: string | null;
}

interface EnvDiagnosticsData {
  hasPublicKey: boolean;
  hasPrivateKey: boolean;
  hasContact: boolean;
}

export default function NotificationSettingsPage() {
  const { role, isAuthenticated, user } = useAdminAuth();

  const [supportStatus, setSupportStatus] = useState<PushSupportStatus | null>(null);
  const [isSubscribedOnDevice, setIsSubscribedOnDevice] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);
  const [subscriptions, setSubscriptions] = useState<PushSubscriptionData[]>([]);
  const [vapidConfigured, setVapidConfigured] = useState<boolean>(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  const [envDiagnostics, setEnvDiagnostics] = useState<EnvDiagnosticsData | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Preference state
  const [preferences, setPreferences] = useState({
    paid_order: true,
    low_stock: true,
    out_of_stock: true,
    upcoming_release: true,
    payment_attention: true,
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      // 1. Check client browser support safely without prompting
      const support = checkPushSupport();
      setSupportStatus(support);

      // 2. Check service worker status
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        setSwRegistered(Boolean(reg));
      }

      // 3. Check local push subscription
      const existing = await getExistingSubscription();
      setIsSubscribedOnDevice(Boolean(existing));

      // 4. Fetch VAPID key diagnostics and server subscriptions
      const headers = await getAdminAuthHeaders();

      const [keyRes, subRes] = await Promise.all([
        fetch('/api/admin/push/vapid-public-key', { headers, cache: 'no-store' }),
        fetch('/api/admin/push/subscriptions', { headers, cache: 'no-store' }),
      ]);

      if (keyRes.ok) {
        const keyData = await keyRes.json();
        setVapidConfigured(Boolean(keyData.configured));
        setVapidPublicKey(keyData.publicKey || null);
        if (keyData.envDiagnostics) {
          setEnvDiagnostics(keyData.envDiagnostics);
        }
      }

      if (subRes.ok) {
        const subData = await subRes.json();
        if (subData.success && Array.isArray(subData.subscriptions)) {
          setSubscriptions(subData.subscriptions);

          // Find current device subscription preferences if exists
          if (existing) {
            const currentSub = subData.subscriptions.find((s: any) => s.endpoint === existing.endpoint);
            if (currentSub?.preferences) {
              setPreferences(prev => ({ ...prev, ...currentSub.preferences }));
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[PUSH SETTINGS] Error loading push status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(async () => {
      if (mounted) {
        await loadData();
      }
    });
    return () => {
      mounted = false;
    };
  }, [loadData]);

  // Enable Web Push on current device - ONLY triggered when user explicitly clicks button
  const handleEnablePush = async () => {
    if (!vapidPublicKey) {
      showToast('VAPID public key not configured on server.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const { subscription, error } = await subscribeToPush(vapidPublicKey);
      if (error || !subscription) {
        showToast(error || 'Failed to subscribe device', 'error');
        setActionLoading(false);
        return;
      }

      const p256dh = subscription.getKey ? subscription.getKey('p256dh') : null;
      const auth = subscription.getKey ? subscription.getKey('auth') : null;

      if (!p256dh || !auth) {
        showToast('Invalid subscription cryptographic keys', 'error');
        setActionLoading(false);
        return;
      }

      const p256dhBase64 = btoa(String.fromCharCode(...new Uint8Array(p256dh)));
      const authBase64 = btoa(String.fromCharCode(...new Uint8Array(auth)));

      const headers = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/push/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: p256dhBase64,
            auth: authBase64,
          },
          deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Browser',
          userAgentSummary: navigator.userAgent.slice(0, 100),
          preferences,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsSubscribedOnDevice(true);
        showToast('Push notifications successfully enabled on this device!');
        void loadData();
      } else {
        showToast(data.error || 'Failed to register subscription on server', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error subscribing to Web Push', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Disable Web Push on current device
  const handleDisablePush = async () => {
    setActionLoading(true);
    try {
      const existing = await getExistingSubscription();
      if (existing) {
        const headers = await getAdminAuthHeaders();
        await fetch('/api/admin/push/subscriptions', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        await unsubscribeFromPush();
      }
      setIsSubscribedOnDevice(false);
      showToast('Push notifications disabled for this device.');
      void loadData();
    } catch (err: any) {
      showToast(err?.message || 'Error disabling push notifications', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Revoke specific registered device
  const handleRevokeDevice = async (subscriptionId: string) => {
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/push/subscriptions', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ subscriptionId }),
      });
      if (res.ok) {
        showToast('Device subscription revoked.');
        void loadData();
      } else {
        showToast('Failed to revoke device.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Network error revoking device', 'error');
    }
  };

  // Dispatch Test Push
  const handleSendTestPush = async () => {
    setActionLoading(true);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/push/test', {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Test push sent successfully to ${data.devicesDispatched} device(s)!`);
      } else {
        showToast(data.error || 'Failed to dispatch test push', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Network error sending test push', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Update preferences
  const handleTogglePreference = async (key: keyof typeof preferences) => {
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated);

    const existing = await getExistingSubscription();
    if (existing) {
      try {
        const headers = await getAdminAuthHeaders();
        const p256dh = existing.getKey ? existing.getKey('p256dh') : null;
        const auth = existing.getKey ? existing.getKey('auth') : null;
        if (p256dh && auth) {
          const p256dhBase64 = btoa(String.fromCharCode(...new Uint8Array(p256dh)));
          const authBase64 = btoa(String.fromCharCode(...new Uint8Array(auth)));
          await fetch('/api/admin/push/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({
              endpoint: existing.endpoint,
              keys: { p256dh: p256dhBase64, auth: authBase64 },
              preferences: updated,
            }),
          });
        }
      } catch {
        // Non-blocking
      }
    }
  };

  // Role based permission helpers
  const canReceivePaidOrders = role === 'super_admin' || role === 'operations' || role === 'finance';
  const canReceiveInventory = role === 'super_admin' || role === 'operations' || role === 'marketing';
  const canReceiveReleases = role === 'super_admin' || role === 'operations' || role === 'marketing';
  const canReceivePaymentAttention = role === 'super_admin' || role === 'finance';
  const canSendTestNotification = role === 'super_admin' || role === 'operations' || role === 'finance';

  const getPermissionLabel = () => {
    if (typeof window === 'undefined') return 'Default';
    if (!('Notification' in window)) return 'Unsupported';
    if (Notification.permission === 'granted') return 'Granted';
    if (Notification.permission === 'denied') return 'Denied';
    return 'Default';
  };

  return (
    <AdminAccessGuard featureLabel="Push Notification Settings">
      <div className="space-y-6 pb-20 font-mono">
        {toast && (
          <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded shadow-2xl flex items-center gap-3 animate-in fade-in ${
            toast.type === 'error' ? 'bg-red-950 border border-red-800 text-red-200' : 'bg-[#161616] border border-[#D4AF37] text-white'
          }`}>
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-xs font-medium">{toast.message}</span>
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F1F1F] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/admin/settings" className="text-[#888] hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-white">
                Push Notifications
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-[#888] mt-1">
              BACKGROUND OPERATING-SYSTEM ALERTS, ALERT CATEGORIES & SUBSCRIBER MANAGEMENT
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={loading}
              className="px-3 py-2 bg-[#161616] border border-[#333] hover:border-[#D4AF37] text-xs text-[#AAA] hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {canSendTestNotification && (
              <button
                type="button"
                onClick={handleSendTestPush}
                disabled={actionLoading || subscriptions.length === 0}
                className="px-4 py-2 bg-[#D4AF37] hover:bg-[#B3932F] text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-black" />
                <span>Send Test Notification</span>
              </button>
            )}
          </div>
        </div>

        {/* STATUS TILES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-[#111] border border-[#222] rounded-xs">
            <span className="text-[10px] text-[#888] uppercase tracking-wider block mb-1">Device Status</span>
            <div className="flex items-center gap-2">
              {isSubscribedOnDevice ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">ENABLED & ACTIVE</span>
                </>
              ) : supportStatus?.needsPwaInstallForIos ? (
                <>
                  <Info className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-amber-400">HOME SCREEN REQUIRED</span>
                </>
              ) : supportStatus?.permission === 'denied' ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-bold text-red-400">PERMISSION BLOCKED</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4 text-[#888]" />
                  <span className="text-sm font-bold text-white">NOT SUBSCRIBED</span>
                </>
              )}
            </div>
          </div>

          <div className="p-4 bg-[#111] border border-[#222] rounded-xs">
            <span className="text-[10px] text-[#888] uppercase tracking-wider block mb-1">Permission Status</span>
            <div className="flex items-center gap-2">
              {getPermissionLabel() === 'Granted' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">GRANTED</span>
                </>
              ) : getPermissionLabel() === 'Denied' ? (
                <>
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-bold text-red-400">DENIED</span>
                </>
              ) : (
                <>
                  <Info className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-white">DEFAULT (PROMPT PENDING)</span>
                </>
              )}
            </div>
          </div>

          <div className="p-4 bg-[#111] border border-[#222] rounded-xs">
            <span className="text-[10px] text-[#888] uppercase tracking-wider block mb-1">Registered Endpoints</span>
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-[#888]" />
              <span className="text-sm font-bold text-white">{subscriptions.length} Active Device(s)</span>
            </div>
          </div>
        </div>

        {/* DEVICE ACTIVATION CARD */}
        <div className="p-6 bg-[#111] border border-[#222] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#D4AF37]" />
                Push Notifications Control (This Device)
              </h2>
              <p className="text-xs text-[#888] mt-1 max-w-2xl leading-relaxed">
                Receive background OS notifications for new orders, stock events, and critical alerts even when your browser or admin tab is closed.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isSubscribedOnDevice ? (
                <button
                  type="button"
                  onClick={handleDisablePush}
                  disabled={actionLoading}
                  className="w-full sm:w-auto px-4 py-2.5 bg-red-950/60 hover:bg-red-900/80 border border-red-800 text-red-200 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  {actionLoading ? 'Processing...' : 'Disable Notifications'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={actionLoading || !vapidConfigured}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#D4AF37] hover:bg-[#B3932F] text-black text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Bell className="w-3.5 h-3.5" />
                  )}
                  <span>Enable Notifications</span>
                </button>
              )}
            </div>
          </div>

          {/* iOS Guidance */}
          {supportStatus?.needsPwaInstallForIos && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded text-amber-200 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Apple iOS PWA Requirement:</p>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  On Safari for iOS 16.4+, Apple requires you to install the VERITAS Admin app to your Home Screen to receive background Web Push alerts. Tap the <strong>Share</strong> icon in Safari, select <strong>&quot;Add to Home Screen&quot;</strong>, and open the installed app.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* SERVER ENV & SERVICE WORKER DIAGNOSTICS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Server Config Diagnostic */}
          <div className="p-6 bg-[#111] border border-[#222] space-y-4">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-[#D4AF37]" />
                Web Push Server Diagnostics
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                vapidConfigured 
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50' 
                  : 'bg-amber-950/60 text-amber-400 border-amber-800/50'
              }`}>
                {vapidConfigured ? 'Configured' : 'Not Configured'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 bg-[#0A0A0A] border border-[#222]">
                <span className="text-[#888]">WEB_PUSH_VAPID_PUBLIC_KEY:</span>
                <span className={`font-bold ${envDiagnostics?.hasPublicKey ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {envDiagnostics?.hasPublicKey ? 'Present' : 'Missing'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-[#0A0A0A] border border-[#222]">
                <span className="text-[#888]">WEB_PUSH_VAPID_PRIVATE_KEY:</span>
                <span className={`font-bold ${envDiagnostics?.hasPrivateKey ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {envDiagnostics?.hasPrivateKey ? 'Present (Server Secret)' : 'Missing'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-[#0A0A0A] border border-[#222]">
                <span className="text-[#888]">WEB_PUSH_CONTACT:</span>
                <span className={`font-bold ${envDiagnostics?.hasContact ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {envDiagnostics?.hasContact ? 'Present' : 'Missing'}
                </span>
              </div>
              <p className="text-[10px] text-[#666] pt-1">
                * Secret values and cryptographic private keys are never exposed in browser runtime.
              </p>
            </div>
          </div>

          {/* Client & Service Worker Diagnostic */}
          <div className="p-6 bg-[#111] border border-[#222] space-y-4">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#D4AF37]" />
                Client & Service Worker Telemetry
              </h2>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                LIVE
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 bg-[#0A0A0A] border border-[#222]">
                <span className="text-[#888]">Service Worker:</span>
                <span className={`font-bold ${swRegistered ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {swRegistered ? 'Registered' : 'Not Registered'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-[#0A0A0A] border border-[#222]">
                <span className="text-[#888]">Notification Permission:</span>
                <span className={`font-bold ${
                  getPermissionLabel() === 'Granted' ? 'text-emerald-400' : getPermissionLabel() === 'Denied' ? 'text-red-400' : 'text-amber-400'
                }`}>
                  {getPermissionLabel()}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-[#0A0A0A] border border-[#222]">
                <span className="text-[#888]">Push Subscription:</span>
                <span className={`font-bold ${isSubscribedOnDevice ? 'text-emerald-400' : 'text-[#888]'}`}>
                  {isSubscribedOnDevice ? 'Active' : 'Not Active'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-[#0A0A0A] border border-[#222]">
                <span className="text-[#888]">PWA Mode:</span>
                <span className={`font-bold ${supportStatus?.isStandalone ? 'text-emerald-400' : 'text-white'}`}>
                  {supportStatus?.isStandalone ? 'Installed (Standalone)' : 'Browser Mode'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* NOTIFICATION PREFERENCES */}
        <div className="p-6 bg-[#111] border border-[#222] space-y-4">
          <div className="flex items-center justify-between border-b border-[#222] pb-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Notification Category Preferences
              </h2>
              <p className="text-xs text-[#888] mt-0.5">
                Configure which background push categories trigger for your user account ({role ? role.replace('_', ' ') : 'Admin'}).
              </p>
            </div>
            <span className="text-[10px] text-[#D4AF37] bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
              ROLE PROTECTED
            </span>
          </div>

          <div className="space-y-3">
            {/* 1. New Paid Orders */}
            <div className={`p-3.5 bg-[#0C0C0C] border ${canReceivePaidOrders ? 'border-[#222]' : 'border-[#1C1C1C] opacity-50'} flex items-center justify-between`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase">New Paid Orders</span>
                  {!canReceivePaidOrders && (
                    <span className="text-[9px] text-amber-400 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Restricted for {role}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#888] mt-0.5">Immediate push notification when a customer completes PayFast checkout.</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.paid_order && canReceivePaidOrders}
                onChange={() => handleTogglePreference('paid_order')}
                disabled={!canReceivePaidOrders}
                className="w-4 h-4 accent-[#D4AF37] cursor-pointer disabled:opacity-30"
              />
            </div>

            {/* 2. Low Stock */}
            <div className={`p-3.5 bg-[#0C0C0C] border ${canReceiveInventory ? 'border-[#222]' : 'border-[#1C1C1C] opacity-50'} flex items-center justify-between`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase">Low Stock</span>
                  {!canReceiveInventory && (
                    <span className="text-[9px] text-amber-400 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Restricted for {role}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#888] mt-0.5">Alerts when garment variants drop below their minimum inventory threshold.</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.low_stock && canReceiveInventory}
                onChange={() => handleTogglePreference('low_stock')}
                disabled={!canReceiveInventory}
                className="w-4 h-4 accent-[#D4AF37] cursor-pointer disabled:opacity-30"
              />
            </div>

            {/* 3. Out of Stock */}
            <div className={`p-3.5 bg-[#0C0C0C] border ${canReceiveInventory ? 'border-[#222]' : 'border-[#1C1C1C] opacity-50'} flex items-center justify-between`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase">Out of Stock</span>
                  {!canReceiveInventory && (
                    <span className="text-[9px] text-amber-400 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Restricted for {role}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#888] mt-0.5">Urgent notifications when any SKU reaches 0 stock in warehouse.</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.out_of_stock && canReceiveInventory}
                onChange={() => handleTogglePreference('out_of_stock')}
                disabled={!canReceiveInventory}
                className="w-4 h-4 accent-[#D4AF37] cursor-pointer disabled:opacity-30"
              />
            </div>

            {/* 4. Upcoming Releases */}
            <div className={`p-3.5 bg-[#0C0C0C] border ${canReceiveReleases ? 'border-[#222]' : 'border-[#1C1C1C] opacity-50'} flex items-center justify-between`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase">Upcoming Releases</span>
                  {!canReceiveReleases && (
                    <span className="text-[9px] text-amber-400 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Restricted for {role}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#888] mt-0.5">Pre-drop announcements and scheduled release milestones.</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.upcoming_release && canReceiveReleases}
                onChange={() => handleTogglePreference('upcoming_release')}
                disabled={!canReceiveReleases}
                className="w-4 h-4 accent-[#D4AF37] cursor-pointer disabled:opacity-30"
              />
            </div>

            {/* 5. Payment Attention */}
            <div className={`p-3.5 bg-[#0C0C0C] border ${canReceivePaymentAttention ? 'border-[#222]' : 'border-[#1C1C1C] opacity-50'} flex items-center justify-between`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase">Payment Attention</span>
                  {!canReceivePaymentAttention && (
                    <span className="text-[9px] text-amber-400 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Restricted for {role}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#888] mt-0.5">Critical notifications for payment cancellations, refunds, or gateway discrepancies.</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.payment_attention && canReceivePaymentAttention}
                onChange={() => handleTogglePreference('payment_attention')}
                disabled={!canReceivePaymentAttention}
                className="w-4 h-4 accent-[#D4AF37] cursor-pointer disabled:opacity-30"
              />
            </div>
          </div>
        </div>

        {/* REGISTERED DEVICES LIST */}
        <div className="p-6 bg-[#111] border border-[#222] space-y-4">
          <div className="border-b border-[#222] pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Registered Push Subscriptions ({subscriptions.length})
            </h2>
            <p className="text-xs text-[#888] mt-0.5">
              Active device endpoints authenticated for your user ID ({user?.email || 'Current Admin'}).
            </p>
          </div>

          {subscriptions.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#666] border border-[#1A1A1A] bg-[#0A0A0A]">
              No active devices registered. Click &quot;Enable Notifications&quot; on this device to register it.
            </div>
          ) : (
            <div className="space-y-3">
              {subscriptions.map((sub, idx) => (
                <div key={sub.id || idx} className="p-3 bg-[#0C0C0C] border border-[#222] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span className="text-xs font-bold text-white">{sub.device_name || 'Web Push Device'}</span>
                      <span className="text-[9px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-[10px] text-[#666] truncate max-w-md">{sub.user_agent_summary || sub.endpoint}</p>
                    <p className="text-[9px] text-[#555]">Registered: {new Date(sub.created_at).toLocaleDateString()}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRevokeDevice(sub.id)}
                    className="self-end sm:self-auto px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 text-[10px] uppercase font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Revoke</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminAccessGuard>
  );
}
