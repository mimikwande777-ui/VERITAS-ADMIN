'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAdminAuth } from '@/lib/auth-context';
import { ShieldCheck, Lock, Mail, KeyRound, X, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

export function AdminUnlockModal() {
  const { isUnlockModalOpen, closeUnlockModal, signIn, isAuthenticated } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Forgot Password state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);

  // Focus email input when modal opens
  useEffect(() => {
    if (isUnlockModalOpen) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
        setRecoveryMessage(null);
        setIsForgotPassword(false);
        emailInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isUnlockModalOpen]);

  // Close with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isUnlockModalOpen) {
        closeUnlockModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUnlockModalOpen, closeUnlockModal]);

  if (!isUnlockModalOpen || isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both admin email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await signIn(email.trim(), password);
      if (!result.success) {
        setErrorMessage(result.error || 'Invalid administrator credentials.');
      } else {
        // Success - modal will close automatically as isAuthenticated becomes true
        setPassword('');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Authentication failed. Please check network connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) {
      setRecoveryMessage({ type: 'error', text: 'Please enter your admin email.' });
      return;
    }

    setRecoveryLoading(true);
    setRecoveryMessage(null);

    try {
      const res = await fetch('/api/admin/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail.trim() }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send recovery email.');
      }
      
      setRecoveryMessage({ type: 'success', text: 'If an eligible administrator account exists, a recovery email has been sent.' });
      setRecoveryEmail('');
    } catch (err: any) {
      setRecoveryMessage({ type: 'error', text: err?.message || 'Failed to process recovery request.' });
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlock-modal-title"
    >
      {/* Backdrop Click Dismiss */}
      <div 
        className="fixed inset-0" 
        onClick={closeUnlockModal}
        aria-hidden="true" 
      />

      {/* Compact Modal Card - Optimized for mobile & iPhone 8 (375x667) */}
      <div className="relative w-full max-w-[390px] max-h-[calc(100dvh-24px)] overflow-y-auto bg-[#0E0E0E] border border-[#2B2B2B] rounded-xs shadow-2xl p-5 sm:p-6 text-[#E0E0E0] z-10 animate-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#1F1F1F] pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xs bg-amber-950/40 border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-mono tracking-[0.25em] text-[#D4AF37] uppercase block font-bold">
                SECURITY GATEWAY
              </span>
              <h2 id="unlock-modal-title" className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                {isForgotPassword ? 'Password Recovery' : 'VERITAS Admin'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={closeUnlockModal}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#777] hover:text-white hover:bg-white/10 rounded-xs transition-colors cursor-pointer shrink-0 -mr-2 -mt-2"
            aria-label="Close authorization dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isForgotPassword ? (
          <>
            <p className="text-xs text-[#888] font-mono mb-4 leading-relaxed">
              Provide your verified Supabase administrator credentials to unlock protected pipeline operations, customer data, and stock mutations.
            </p>

            {/* Error Alert */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-800/60 rounded-xs flex items-start gap-2.5 text-xs text-red-300 font-mono animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            {/* Authorization Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label 
                  htmlFor="admin-unlock-email" 
                  className="text-[11px] font-mono uppercase tracking-wider text-[#A0A0A0] block font-medium"
                >
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#666] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={emailInputRef}
                    id="admin-unlock-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@veritas.internal"
                    className="w-full min-h-[44px] bg-[#161616] border border-[#2B2B2B] text-white pl-9 pr-3 py-2 text-sm rounded-none font-mono placeholder-[#555] focus:outline-hidden focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="admin-unlock-password" 
                    className="text-[11px] font-mono uppercase tracking-wider text-[#A0A0A0] block font-medium"
                  >
                    Admin Password
                  </label>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setRecoveryEmail(email);
                    }}
                    className="text-[11px] font-mono text-[#D4AF37] hover:text-white transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#666] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="admin-unlock-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full min-h-[44px] bg-[#161616] border border-[#2B2B2B] text-white pl-9 pr-3 py-2 text-sm rounded-none font-mono placeholder-[#555] focus:outline-hidden focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40 transition-all"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[44px] bg-[#D4AF37] hover:bg-[#B3932F] active:scale-[0.99] text-black font-bold uppercase text-xs tracking-wider rounded-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-black" />
                      <span>Unlock Admin</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="mb-4">
              <button 
                type="button"
                onClick={() => setIsForgotPassword(false)}
                className="flex items-center gap-1.5 text-xs font-mono text-[#A0A0A0] hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Login</span>
              </button>
            </div>
            
            <p className="text-xs text-[#888] font-mono mb-4 leading-relaxed">
              Enter your administrator email to receive a password recovery link.
            </p>

            {recoveryMessage && (
              <div className={`mb-4 p-3 rounded-xs flex items-start gap-2.5 text-xs font-mono animate-in fade-in ${
                recoveryMessage.type === 'error' 
                  ? 'bg-red-950/40 border border-red-800/60 text-red-300' 
                  : 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300'
              }`}>
                {recoveryMessage.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <span className="leading-snug">{recoveryMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label 
                  htmlFor="admin-recovery-email" 
                  className="text-[11px] font-mono uppercase tracking-wider text-[#A0A0A0] block font-medium"
                >
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#666] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="admin-recovery-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="admin@veritas.internal"
                    className="w-full min-h-[44px] bg-[#161616] border border-[#2B2B2B] text-white pl-9 pr-3 py-2 text-sm rounded-none font-mono placeholder-[#555] focus:outline-hidden focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="w-full min-h-[44px] bg-[#2B2B2B] hover:bg-[#3B3B3B] active:scale-[0.99] text-white font-bold uppercase text-xs tracking-wider rounded-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-[#3B3B3B]"
                >
                  {recoveryLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send Recovery Email</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}

        {/* Security Footer Notice */}
        <div className="mt-4 pt-3 border-t border-[#1C1C1C] flex items-center justify-between text-[10px] font-mono text-[#666]">
          <span>SUPABASE RBAC GATEWAY</span>
          <span className="text-[#D4AF37]">AES-256 ENCRYPTED</span>
        </div>
      </div>
    </div>
  );
}
