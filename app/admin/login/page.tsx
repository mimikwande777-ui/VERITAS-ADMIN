'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, ArrowRight, ShieldAlert, CheckCircle2, AlertTriangle, Key } from 'lucide-react';
import { useAdminAuth } from '@/lib/auth-context';
import { isSupabaseConfigured } from '@/lib/supabase/config';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams?.get('redirect') || '/admin/dashboard';
  
  const { signIn } = useAdminAuth();

  const [configured] = useState(() => isSupabaseConfigured());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!configured) {
      setErrorMessage('Supabase Authentication is not configured. Please define NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables.');
      return;
    }

    if (!email.trim() || !password) {
      setErrorMessage('Please provide both administrative email and password.');
      return;
    }

    setLoading(true);
    const result = await signIn(email, password);

    if (result.success) {
      router.push(redirectUrl);
    } else {
      setErrorMessage(result.error || 'Invalid credentials or unauthorized account.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070707] text-[#E0E0E0] flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans pt-safe pb-safe">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* LOGO & BRAND */}
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-white flex items-center justify-center rounded-xs shadow-xl">
            <div className="w-6 h-6 bg-black rotate-45"></div>
          </div>
        </div>
        <h2 className="mt-4 text-center text-xl font-bold tracking-[0.25em] text-white uppercase font-sans">
          VERITAS
        </h2>
        <p className="mt-1 text-center text-[10px] tracking-[0.3em] font-mono text-[#D4AF37] uppercase">
          ADMINISTRATIVE CONTROL SYSTEM
        </p>
      </div>

      <div className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 w-full">
        <div className="bg-[#0E0E0E] border border-[#1F1F1F] py-6 sm:py-8 px-4 sm:px-10 shadow-2xl rounded-xs space-y-5 sm:space-y-6">
          
          {/* NOTICE BANNER */}
          <div className="border-b border-[#1A1A1A] pb-4">
            <div className="flex items-center gap-2 text-xs text-[#888] font-mono">
              <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="uppercase tracking-wider">Restricted Corporate Gateway</span>
            </div>
            <p className="text-[11px] text-[#666] mt-1">
              Authorized personnel only. Access strictly restricted to verified records in <code className="text-[#D4AF37]">public.admin_users</code>.
            </p>
          </div>

          {/* MISSING CONFIGURATION NOTICE */}
          {!configured && (
            <div className="p-3.5 bg-amber-950/30 border border-amber-500/40 rounded-xs space-y-2 text-xs font-mono">
              <div className="flex items-center gap-2 text-amber-300 font-bold uppercase text-[11px]">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Supabase Configuration Notice</span>
              </div>
              <p className="text-zinc-300 text-[11px] leading-relaxed">
                Live Supabase authentication requires the public API key in environment variables:
              </p>
              <div className="bg-[#0A0A0A] border border-amber-900/40 p-2 rounded text-[10px] text-amber-200 space-y-0.5">
                <div>URL: <span className="text-zinc-300">https://cdzvmnixlhjjrpyoaemg.supabase.co</span></div>
                <div>Required Key: <code className="text-amber-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</code></div>
              </div>
            </div>
          )}

          {/* ERROR ALERT */}
          {errorMessage && (
            <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xs text-xs font-mono text-red-300 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold uppercase block mb-0.5">Authentication Failure</span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* SIGN IN FORM */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label 
                htmlFor="admin-email" 
                className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#AAA] mb-1.5"
              >
                Admin Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#555]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@veritas.internal"
                  className="block w-full min-h-[44px] pl-10 pr-3 py-2.5 bg-[#141414] border border-[#262626] rounded-xs text-white placeholder-[#555] text-base sm:text-xs font-mono focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
                />
              </div>
            </div>

            <div>
              <label 
                htmlFor="admin-password" 
                className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#AAA] mb-1.5"
              >
                Admin Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#555]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full min-h-[44px] pl-10 pr-12 py-2.5 bg-[#141414] border border-[#262626] rounded-xs text-white placeholder-[#555] text-base sm:text-xs font-mono focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-[#555] hover:text-[#AAA] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 py-3 px-4 bg-white hover:bg-[#D4AF37] text-black font-mono font-bold text-xs uppercase tracking-[0.15em] rounded-xs transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-98 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Sign In to Admin</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* FOOTER METADATA */}
          <div className="pt-4 border-t border-[#181818] flex items-center justify-between text-[10px] font-mono text-[#555]">
            <span>SUPABASE AUTH ENGINE</span>
            <span>VERITAS v2.4-SECURE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070707] flex items-center justify-center text-[#888] font-mono text-xs">INITIALIZING PORTAL...</div>}>
      <AdminLoginForm />
    </Suspense>
  );
}
