'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { 
  KeyRound, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ArrowRight
} from 'lucide-react';
import { getBrowserClient, getBrowserDiagnostic } from '@/lib/supabase/browser';

export default function SetupPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<{ hasPublicUrl: boolean; hasPublicAnonKey: boolean; browserClientCreated: boolean } | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [, startTransition] = useTransition();

  // 1. Authenticated session detection on mount
  useEffect(() => {
    let isMounted = true;

    async function checkAuthSession() {
      try {
        const diag = getBrowserDiagnostic();
        if (isMounted) {
          setDiagnostic(diag);
        }

        const supabase = getBrowserClient();
        
        // If Supabase client configuration is missing in the browser
        if (!supabase) {
          if (isMounted) {
            setHasValidSession(false);
            setError('Authentication configuration is unavailable.');
            setIsVerifyingSession(false);
          }
          return;
        }

        // Parse URL params for any initial error flags
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('error') === 'invalid') {
            if (isMounted) {
              setError('Your password setup session is invalid or expired.');
              setIsVerifyingSession(false);
            }
            return;
          }

          // Handle hash fragments (e.g., #access_token=...&refresh_token=...)
          const hash = window.location.hash;
          if (hash && hash.includes('access_token=')) {
            const hashParams = new URLSearchParams(hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');

            if (accessToken) {
              const { data, error: setSessionErr } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              });

              if (!setSessionErr && data.session) {
                // Sync session cookies server-side
                await fetch('/api/admin/setup-password/sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    accessToken: data.session.access_token,
                    refreshToken: data.session.refresh_token,
                  }),
                }).catch(() => null);

                if (isMounted) {
                  setHasValidSession(true);
                  setUserEmail(data.session.user.email || null);
                  setIsVerifyingSession(false);
                }
                return;
              }
            }
          }
        }

        // Check active client session & verify user with getUser()
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (user && !userErr) {
          if (isMounted) {
            setHasValidSession(true);
            setUserEmail(user.email || null);
            setIsVerifyingSession(false);
          }
          return;
        }

        // Fallback: check server HttpOnly cookies & restore session to browser client
        const serverCheck = await fetch('/api/admin/setup-password/sync', {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (serverCheck.ok) {
          const serverData = await serverCheck.json();
          if (serverData.authenticated && serverData.user) {
            if (serverData.session?.access_token) {
              await supabase.auth.setSession({
                access_token: serverData.session.access_token,
                refresh_token: serverData.session.refresh_token || '',
              }).catch(() => null);
            }

            if (isMounted) {
              setHasValidSession(true);
              setUserEmail(serverData.user.email || null);
              setIsVerifyingSession(false);
            }
            return;
          }
        }

        // No valid session found
        if (isMounted) {
          setHasValidSession(false);
          setError('Your password setup session is invalid or expired.');
          setIsVerifyingSession(false);
        }
      } catch {
        if (isMounted) {
          setHasValidSession(false);
          setError('Your password setup session is invalid or expired.');
          setIsVerifyingSession(false);
        }
      }
    }

    void checkAuthSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const supabase = getBrowserClient();
      if (!supabase) {
        setError('Authentication configuration is unavailable.');
        setLoading(false);
        return;
      }

      // Confirm authenticated session/user exists using getUser()
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setError('Your password setup session is invalid or expired.');
        setLoading(false);
        return;
      }

      // Step 3: Update password via authenticated Supabase client
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        if (updateError.message.toLowerCase().includes('same password') || 
            updateError.message.toLowerCase().includes('different')) {
          setError('Please choose a new password distinct from any previous one.');
        } else if (updateError.message.toLowerCase().includes('session') || 
                   updateError.message.toLowerCase().includes('auth') ||
                   updateError.message.toLowerCase().includes('jwt')) {
          setError('Your password setup session is invalid or expired.');
        } else {
          setError(updateError.message || 'Password does not meet requirements.');
        }
        setLoading(false);
        return;
      }

      // Step 5: Synchronize session cookies
      const updatedSession = data?.user ? (await supabase.auth.getSession()).data.session : null;
      if (updatedSession) {
        await fetch('/api/admin/setup-password/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: updatedSession.access_token,
            refreshToken: updatedSession.refresh_token,
          }),
        }).catch(() => null);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('veritas_admin_auth_changed'));
      }

      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');

      // Redirect after 2 seconds
      setTimeout(() => {
        startTransition(() => {
          router.push('/admin/dashboard');
        });
      }, 1800);

    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while updating your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070708] text-zinc-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans select-none relative overflow-hidden">
      {/* Subtle Background Glow Accent */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0e0e11] border border-[#26262a] rounded-xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Top Gold Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

        {/* Branding & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#18181d] border border-[#D4AF37]/30 text-[#D4AF37] mb-4 shadow-inner">
            <ShieldCheck className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <h1 className="text-2xl font-bold tracking-widest text-zinc-100 uppercase font-serif">
            VERITAS
          </h1>
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#D4AF37] mt-1 font-mono font-semibold">
            PARTNER ACCOUNT SETUP
          </p>
          <p className="text-xs text-zinc-400 mt-2 max-w-xs mx-auto leading-relaxed">
            Create your password to finish setting up your VERITAS Admin account.
          </p>
          {userEmail && (
            <div className="mt-3 inline-block px-3 py-1 bg-[#141418] border border-[#27272e] rounded-xs text-[11px] font-mono text-zinc-300">
              {userEmail}
            </div>
          )}
        </div>

        {isVerifyingSession ? (
          /* Loading State */
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37] mx-auto" />
            <p className="text-xs text-zinc-400 font-mono">Verifying password setup session...</p>
          </div>
        ) : success ? (
          /* Success State */
          <div className="space-y-6 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white tracking-wide uppercase font-serif">
                ACCOUNT SETUP COMPLETE
              </h2>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                Your password has been saved. Redirecting to your VERITAS Admin dashboard...
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => router.push('/admin/dashboard')}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-semibold text-xs uppercase tracking-wider rounded-xs transition-colors cursor-pointer"
              >
                <span>ENTER DASHBOARD</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Password Setup Form */
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3.5 bg-red-950/40 border border-red-800/60 rounded-xs flex items-start gap-2.5 text-red-300 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <div className="flex-1 leading-relaxed">{error}</div>
              </div>
            )}

            {!hasValidSession && !error && (
              <div className="p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-xs flex items-start gap-2.5 text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div className="flex-1 leading-relaxed">Your password setup session is invalid or expired.</div>
              </div>
            )}

            <div className="space-y-4">
              {/* New Password Field */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-300">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 8 chars)"
                    disabled={loading || !hasValidSession}
                    required
                    minLength={8}
                    className="w-full px-3.5 py-2.5 bg-[#141418] border border-[#27272e] focus:border-[#D4AF37] focus:outline-none text-xs text-white rounded-xs placeholder:text-zinc-600 font-mono pr-10 disabled:opacity-50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-300">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    disabled={loading || !hasValidSession}
                    required
                    minLength={8}
                    className="w-full px-3.5 py-2.5 bg-[#141418] border border-[#27272e] focus:border-[#D4AF37] focus:outline-none text-xs text-white rounded-xs placeholder:text-zinc-600 font-mono pr-10 disabled:opacity-50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Helper Text */}
            <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Password must contain at least 8 characters.</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !hasValidSession || !newPassword || !confirmPassword}
              className="w-full py-3 px-4 bg-[#D4AF37] hover:bg-[#c49f2c] disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-semibold text-xs uppercase tracking-wider rounded-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-md shadow-[#D4AF37]/10"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>SAVING PASSWORD...</span>
                </>
              ) : (
                <>
                  <span>SET PASSWORD & CONTINUE</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-[#1e1e24] text-center space-y-2">
          {diagnostic && (
            <div className="text-[10px] font-mono text-zinc-600 flex flex-wrap justify-center items-center gap-x-3 gap-y-1">
              <span>hasPublicUrl: <span className={diagnostic.hasPublicUrl ? "text-emerald-500/80" : "text-red-500/80"}>{diagnostic.hasPublicUrl ? 'true' : 'false'}</span></span>
              <span>&bull;</span>
              <span>hasPublicAnonKey: <span className={diagnostic.hasPublicAnonKey ? "text-emerald-500/80" : "text-red-500/80"}>{diagnostic.hasPublicAnonKey ? 'true' : 'false'}</span></span>
              <span>&bull;</span>
              <span>browserClientCreated: <span className={diagnostic.browserClientCreated ? "text-emerald-500/80" : "text-red-500/80"}>{diagnostic.browserClientCreated ? 'true' : 'false'}</span></span>
            </div>
          )}
          <p className="text-[10px] text-zinc-600 font-mono tracking-wider">
            VERITAS LUXURY E-COMMERCE &copy; {new Date().getFullYear()} &bull; ALL RIGHTS RESERVED
          </p>
        </div>
      </div>
    </div>
  );
}

