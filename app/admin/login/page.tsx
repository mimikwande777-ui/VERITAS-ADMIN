'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  KeyRound, 
  Fingerprint, 
  Loader2, 
  AlertCircle, 
  Sparkles,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { useAdminAuth } from '@/lib/auth-context';
import { authenticatePasskey, checkPasskeySupport, PasskeySupportInfo } from '@/lib/passkey/client-passkey';

export default function AdminLoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, signIn } = useAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [passkeySupport, setPasskeySupport] = useState<PasskeySupportInfo | null>(null);

  // Forgot password state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/admin/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    void checkPasskeySupport().then(setPasskeySupport);
  }, []);

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await signIn(email.trim(), password);
      if (!result.success) {
        setErrorMessage(result.error || 'Invalid administrator credentials.');
      } else {
        router.replace('/admin/dashboard');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setPasskeyLoading(true);
    setErrorMessage(null);
    try {
      const result = await authenticatePasskey();
      if (!result.success) {
        setErrorMessage(result.error || 'Passkey verification failed.');
      } else {
        window.location.href = '/admin/dashboard';
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Passkey authentication failed.');
    } finally {
      setPasskeyLoading(false);
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

      setRecoveryMessage({
        type: 'success',
        text: 'If an eligible administrator account exists, password recovery instructions have been dispatched.',
      });
      setRecoveryEmail('');
    } catch (err: any) {
      setRecoveryMessage({ type: 'error', text: err?.message || 'Failed to process recovery request.' });
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070707] flex flex-col items-center justify-center p-4 font-mono text-[#E0E0E0]">
      <div className="w-full max-w-md bg-[#0E0E0E] border border-[#222] p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 border-b border-[#1F1F1F] pb-5">
          <div className="w-10 h-10 bg-white mx-auto flex items-center justify-center rounded-xs shadow">
            <div className="w-5 h-5 bg-black rotate-45"></div>
          </div>
          <div>
            <span className="text-[9px] tracking-[0.25em] text-[#D4AF37] uppercase font-bold block">
              VERITAS ATELIER
            </span>
            <h1 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider mt-0.5">
              Admin Gateway
            </h1>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xs text-red-200 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {!isForgotPassword ? (
          <div className="space-y-5">
            {/* PASSKEY 1-TAP LOGIN BUTTON */}
            <div>
              <button
                type="button"
                onClick={handlePasskeySignIn}
                disabled={loading || passkeyLoading}
                className="w-full min-h-[48px] bg-[#161616] hover:bg-[#202020] active:scale-[0.99] border border-[#333] hover:border-[#D4AF37] text-white font-bold uppercase text-xs tracking-wider rounded-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {passkeyLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                    <span>Verifying Device Biometrics...</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4 text-[#D4AF37]" />
                    <span>Sign in with Passkey</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-[#666] mt-1.5 leading-tight">
                Use fingerprint, Face ID, Windows Hello or device security
              </p>
            </div>

            {/* DIVIDER */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-[#222]"></div>
              <span className="flex-shrink mx-3 text-[10px] text-[#666] uppercase tracking-wider">
                OR SIGN IN WITH EMAIL
              </span>
              <div className="flex-grow border-t border-[#222]"></div>
            </div>

            {/* EMAIL / PASSWORD FORM */}
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-[#888] block font-medium">
                  Administrator Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#666] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@veritas.co.za"
                    className="w-full min-h-[44px] bg-[#141414] border border-[#2B2B2B] text-white pl-9 pr-3 py-2 text-xs rounded-none placeholder-[#555] focus:outline-hidden focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-wider text-[#888] block font-medium">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setRecoveryEmail(email);
                    }}
                    className="text-[10px] text-[#D4AF37] hover:text-white transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#666] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full min-h-[44px] bg-[#141414] border border-[#2B2B2B] text-white pl-9 pr-3 py-2 text-xs rounded-none placeholder-[#555] focus:outline-hidden focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || passkeyLoading}
                className="w-full min-h-[44px] bg-[#D4AF37] hover:bg-[#B3932F] active:scale-[0.99] text-black font-bold uppercase text-xs tracking-wider rounded-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-md mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-black" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setIsForgotPassword(false)}
              className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </button>

            <p className="text-xs text-[#888] leading-relaxed">
              Enter your administrator email to receive a secure password recovery link.
            </p>

            {recoveryMessage && (
              <div className={`p-3 rounded-xs flex items-start gap-2 text-xs ${
                recoveryMessage.type === 'error' ? 'bg-red-950/40 border border-red-800 text-red-200' : 'bg-emerald-950/40 border border-emerald-800 text-emerald-200'
              }`}>
                {recoveryMessage.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <span>{recoveryMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-[#888] block font-medium">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#666] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="admin@veritas.co.za"
                    className="w-full min-h-[44px] bg-[#141414] border border-[#2B2B2B] text-white pl-9 pr-3 py-2 text-xs rounded-none placeholder-[#555] focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={recoveryLoading}
                className="w-full min-h-[44px] bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-wider rounded-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {recoveryLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Sending Recovery Link...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5 text-black" />
                    <span>Send Recovery Email</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center border-t border-[#1F1F1F] pt-4">
          <p className="text-[10px] text-[#555]">
            Protected by FIDO2 WebAuthn & TLS 1.3 Cryptographic Standards
          </p>
        </div>
      </div>
    </div>
  );
}
