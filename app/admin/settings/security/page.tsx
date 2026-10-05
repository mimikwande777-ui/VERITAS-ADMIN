'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  KeyRound, 
  ShieldCheck, 
  Fingerprint, 
  Smartphone, 
  Monitor, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  RefreshCw, 
  Sparkles, 
  ArrowLeft, 
  Info, 
  Lock, 
  ShieldAlert,
  CloudCheck
} from 'lucide-react';
import { useAdminAuth, getAdminAuthHeaders } from '@/lib/auth-context';
import { AdminAccessGuard } from '@/components/admin-access-guard';
import { checkPasskeySupport, registerPasskey, PasskeySupportInfo } from '@/lib/passkey/client-passkey';

interface PasskeyRecord {
  id: string;
  device_name: string;
  device_type?: string;
  backed_up?: boolean;
  created_at: string;
  last_used_at?: string | null;
}

export default function SecuritySettingsPage() {
  const { role, user, isAuthenticated } = useAdminAuth();

  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([]);
  const [support, setSupport] = useState<PasskeySupportInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Enrollment modal state
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [deviceName, setDeviceName] = useState('');

  // Edit device name state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadPasskeys = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      // 1. Check client browser support
      const sup = await checkPasskeySupport();
      setSupport(sup);

      // 2. Fetch registered passkeys
      const headers = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/passkeys', { headers, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.passkeys)) {
          setPasskeys(data.passkeys);
        }
      }
    } catch (err: any) {
      console.error('[SECURITY SETTINGS] Error loading passkeys:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const sup = await checkPasskeySupport();
        if (active) setSupport(sup);

        const headers = await getAdminAuthHeaders();
        const res = await fetch('/api/admin/passkeys', { headers, cache: 'no-store' });
        if (res.ok && active) {
          const data = await res.json();
          if (data.success && Array.isArray(data.passkeys)) {
            setPasskeys(data.passkeys);
          }
        }
      } catch (err: any) {
        console.error('[SECURITY SETTINGS] Init error:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void init();
    return () => {
      active = false;
    };
  }, []);

  // Handle Passkey Enrollment
  const handleEnrollPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const defaultName = deviceName.trim() || (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')
        ? 'Apple Device (Face ID / Touch ID)'
        : navigator.userAgent.includes('Macintosh')
        ? 'MacBook (Touch ID)'
        : navigator.userAgent.includes('Windows')
        ? 'Windows PC (Hello)'
        : 'Hardware Passkey');

      const result = await registerPasskey(defaultName);
      if (!result.success) {
        showToast(result.error || 'Passkey enrollment failed', 'error');
      } else {
        showToast('Passkey registered successfully!');
        setIsEnrollModalOpen(false);
        setDeviceName('');
        void loadPasskeys();
      }
    } catch (err: any) {
      showToast(err?.message || 'Unexpected enrollment error', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Rename
  const handleSaveRename = async (passkeyId: string) => {
    if (!editName.trim()) return;
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/passkeys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ passkeyId, deviceName: editName.trim() }),
      });
      if (res.ok) {
        setPasskeys(prev => prev.map(p => p.id === passkeyId ? { ...p, device_name: editName.trim() } : p));
        setEditingId(null);
        showToast('Passkey renamed.');
      } else {
        showToast('Failed to rename passkey.', 'error');
      }
    } catch {
      showToast('Network error renaming passkey.', 'error');
    }
  };

  // Handle Revoke
  const handleRevoke = async (passkeyId: string) => {
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/passkeys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ passkeyId }),
      });
      if (res.ok) {
        setPasskeys(prev => prev.filter(p => p.id !== passkeyId));
        showToast('Passkey revoked.');
      } else {
        showToast('Failed to revoke passkey.', 'error');
      }
    } catch {
      showToast('Network error revoking passkey.', 'error');
    }
  };

  return (
    <AdminAccessGuard featureLabel="Security & Passkeys">
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
                Admin Security & Passkeys
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-[#888] mt-1">
              FIDO2 / WEBAUTHN BIOMETRIC CREDENTIALS & ACCOUNT RECOVERY
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadPasskeys(true)}
              disabled={loading}
              className="px-3 py-2 bg-[#161616] border border-[#333] hover:border-[#D4AF37] text-xs text-[#AAA] hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEnrollModalOpen(true)}
              className="px-4 py-2 bg-[#D4AF37] hover:bg-[#B3932F] text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-black" />
              <span>Add Passkey</span>
            </button>
          </div>
        </div>

        {/* BIOMETRIC PRIVACY GUARANTEE BANNER */}
        <div className="p-4 bg-[#111] border border-[#222] rounded-xs space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase text-white tracking-wider">
              Cryptographic Biometric Privacy Guarantee
            </span>
          </div>
          <p className="text-[11px] text-[#888] leading-relaxed">
            VERITAS never receives, transmits, or stores your fingerprints, facial scans, or biometric templates. When using Touch ID, Face ID, Windows Hello, or Android Biometrics, verification occurs entirely inside your device’s secure hardware enclave. Only standard public key signatures are verified on the server.
          </p>
        </div>

        {/* PASSKEYS SECTION */}
        <div className="p-6 bg-[#111] border border-[#222] space-y-4">
          <div className="flex items-center justify-between border-b border-[#222] pb-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-[#D4AF37]" />
                Registered Passkeys ({passkeys.length})
              </h2>
              <p className="text-xs text-[#888] mt-0.5">
                Sign in instantly using your device security without typing your master password.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsEnrollModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#181818] hover:bg-[#222] border border-[#333] hover:border-[#D4AF37] text-white text-xs font-bold uppercase cursor-pointer"
            >
              <Plus className="w-3 h-3 text-[#D4AF37]" />
              <span>Enroll Device</span>
            </button>
          </div>

          {passkeys.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#666] border border-[#1A1A1A] bg-[#0A0A0A] space-y-3">
              <Fingerprint className="w-8 h-8 text-[#444] mx-auto" />
              <div>
                <p className="font-bold text-[#888]">No Passkeys Enrolled Yet</p>
                <p className="text-[11px] text-[#666] mt-1">
                  Add a passkey to enable 1-tap sign-in with Face ID, Touch ID, Windows Hello, or device security.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEnrollModalOpen(true)}
                className="px-4 py-2 bg-[#D4AF37] hover:bg-[#B3932F] text-black text-xs font-bold uppercase cursor-pointer"
              >
                Add Your First Passkey
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {passkeys.map((pk) => (
                <div key={pk.id} className="p-4 bg-[#0C0C0C] border border-[#222] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Fingerprint className="w-4 h-4 text-[#D4AF37]" />
                      {editingId === pk.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-[#161616] border border-[#333] px-2 py-1 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(pk.id)}
                            className="p-1 bg-emerald-950/60 border border-emerald-800 text-emerald-300 hover:text-white"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 bg-[#222] text-[#888] hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs font-bold text-white">{pk.device_name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(pk.id);
                              setEditName(pk.device_name);
                            }}
                            className="text-[#666] hover:text-[#D4AF37] p-0.5"
                            title="Rename device"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </>
                      )}

                      {pk.backed_up && (
                        <span className="text-[9px] text-blue-400 bg-blue-950/40 border border-blue-800/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                          Synced
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#666] flex flex-wrap gap-x-4 gap-y-1">
                      <span>Enrolled: {new Date(pk.created_at).toLocaleDateString()}</span>
                      <span>Last Used: {pk.last_used_at ? new Date(pk.last_used_at).toLocaleDateString() : 'Never'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRevoke(pk.id)}
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

        {/* PRIMARY AUTHENTICATION FALLBACK CARD */}
        <div className="p-6 bg-[#111] border border-[#222] space-y-3">
          <div className="flex items-center justify-between border-b border-[#222] pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#D4AF37]" />
              Email & Password Authentication (Primary Fallback)
            </h2>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
              ALWAYS ACTIVE
            </span>
          </div>
          <p className="text-xs text-[#888] leading-relaxed">
            Your master password remains fully operational and secure. If you lose access to a registered passkey device or clear your browser storage, you can sign in with your email and password or use official account recovery at any time.
          </p>
        </div>

        {/* ENROLL MODAL */}
        {isEnrollModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#111] border border-[#262626] w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#222] pb-3">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">Enroll New Passkey</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="text-[#888] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#888] leading-relaxed">
                Your device will prompt you to authorize this browser using Face ID, Touch ID, Windows Hello, or device PIN.
              </p>

              <form onSubmit={handleEnrollPasskey} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase text-[#888] font-bold mb-1">
                    Device / Passkey Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MacBook Pro Touch ID, iPhone Face ID"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    className="w-full bg-[#161616] border border-[#333] p-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEnrollModalOpen(false)}
                    className="px-4 py-2 bg-[#222] text-[#AAA] hover:text-white text-xs uppercase font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-[#D4AF37] hover:bg-[#B3932F] text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Authorizing...</span>
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-3.5 h-3.5" />
                        <span>Register Passkey</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminAccessGuard>
  );
}
