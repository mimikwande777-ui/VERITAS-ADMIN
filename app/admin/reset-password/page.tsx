'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Lock, ShieldCheck, KeyRound, AlertCircle, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

export default function AdminResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initRecoveryCheck = async () => {
      // 1. Check if URL contains error=invalid
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('error') === 'invalid') {
          if (isMounted) {
            setHasRecoverySession(false);
            setError('Password recovery link is invalid or expired. Request a new recovery email.');
            setCheckingSession(false);
          }
          return;
        }
      }

      const client = getSupabaseClient();

      try {
        // 2. Handle PKCE code exchange if present in search params
        if (typeof window !== 'undefined' && client) {
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get('code');

          if (code) {
            const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              console.error('[Recovery] Session exchange error');
            }
          }
        }

        // 3. Check client-side Supabase session
        if (client) {
          const { data: { session } } = await client.auth.getSession();
          if (session && isMounted) {
            setHasRecoverySession(true);
            setError(null);
            setCheckingSession(false);
            return;
          }
        }

        // 4. Check server-persisted cookie session (from /auth/confirm)
        const serverCheck = await fetch('/api/admin/reset-password', {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        }).catch(() => null);

        if (serverCheck?.ok) {
          const checkData = await serverCheck.json().catch(() => ({}));
          if (checkData.hasSession && isMounted) {
            setHasRecoverySession(true);
            setError(null);
            setCheckingSession(false);
            return;
          }
        }

        // 5. Short delay in case browser hash token is processing
        setTimeout(async () => {
          if (!isMounted) return;
          if (client) {
            const { data: { session: delayedSession } } = await client.auth.getSession();
            if (delayedSession && isMounted) {
              setHasRecoverySession(true);
              setError(null);
              setCheckingSession(false);
              return;
            }
          }

          if (isMounted) {
            setHasRecoverySession(false);
            setError('Password recovery link is invalid or expired. Request a new recovery email.');
            setCheckingSession(false);
          }
        }, 500);

      } catch {
        if (isMounted) {
          setHasRecoverySession(false);
          setError('Password recovery link is invalid or expired. Request a new recovery email.');
          setCheckingSession(false);
        }
      }
    };

    void initRecoveryCheck();

    const client = getSupabaseClient();
    let subscription: { unsubscribe: () => void } | null = null;

    if (client) {
      const authSub = client.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
          if (isMounted) {
            setHasRecoverySession(true);
            setError(null);
            setCheckingSession(false);
          }
        }
      });
      subscription = authSub.data.subscription;
    }

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || !confirmPassword) {
      setError('Please enter and confirm your new password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify and try again.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const client = getSupabaseClient();
      let updated = false;

      // Try browser Supabase client first if it has an active session
      if (client) {
        const { data: { session } } = await client.auth.getSession();
        if (session) {
          const { error: updateError } = await client.auth.updateUser({
            password,
          });

          if (!updateError) {
            updated = true;
          } else {
            console.error('[Recovery] Client password update failed');
          }
        }
      }

      // If not updated via browser client, update via server endpoint using HttpOnly cookie session
      if (!updated) {
        const res = await fetch('/api/admin/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to update password. Recovery session may have expired.');
        }
        updated = true;
      }

      if (updated) {
        setSuccess(true);
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while updating your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans select-none">
      <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-emerald-500 to-amber-600" />

        {/* Branding & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-amber-400 mb-4 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center justify-center gap-2">
            <span className="bg-gradient-to-r from-amber-200 via-zinc-100 to-amber-400 bg-clip-text text-transparent">
              VERITAS
            </span>
          </h1>
          <p className="text-xs uppercase tracking-widest text-zinc-400 mt-1 font-medium">
            Reset Administrator Password
          </p>
        </div>

        {/* Loading Session Checking State */}
        {checkingSession ? (
          <div className="py-12 text-center flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <p className="text-sm text-zinc-400">Verifying secure recovery session...</p>
          </div>
        ) : success ? (
          /* Success State */
          <div className="space-y-6 text-center py-2 animate-fade-in">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 mb-1">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-emerald-300">Password updated successfully.</h2>
              <p className="text-sm text-zinc-400 mt-2">
                Your administrator password has been securely updated. You may now return to the portal to log in.
              </p>
            </div>

            <div className="pt-4">
              <Link
                href="/admin"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm transition-all duration-150 shadow-lg shadow-amber-500/10 active:scale-[0.99]"
              >
                <span>Return to VERITAS Admin</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* Reset Form or Error State */
          <div className="space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-200 text-xs flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{error}</div>
              </div>
            )}

            {hasRecoverySession ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      disabled={loading}
                      required
                      minLength={8}
                      className="w-full pl-10 pr-4 py-3 bg-zinc-950/80 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80 transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1.5">Minimum 8 characters.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      disabled={loading}
                      required
                      minLength={8}
                      className="w-full pl-10 pr-4 py-3 bg-zinc-950/80 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-semibold text-sm rounded-xl shadow-lg shadow-amber-500/10 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </form>
            ) : (
              <div className="pt-2 text-center">
                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                >
                  <span>Return to Admin Login</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-8 pt-6 border-t border-zinc-800/60 text-center">
          <p className="text-[11px] text-zinc-500">
            VERITAS Security Protocol &bull; Authoritative Role Verification Enforced
          </p>
        </div>
      </div>
    </div>
  );
}
