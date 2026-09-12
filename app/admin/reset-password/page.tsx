'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Loader2, ArrowRight } from 'lucide-react';

export default function AdminResetPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect any user landing on legacy /admin/reset-password to /auth/setup-password
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    router.replace(`/auth/setup-password${search}${hash}`);
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans select-none">
      <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden text-center space-y-6">
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-[#D4AF37] to-amber-600" />

        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-[#D4AF37] mb-2 shadow-inner">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            Redirecting to Password Setup...
          </h1>
          <p className="text-xs text-zinc-400 mt-2">
            Forwarding you to the VERITAS partner password configuration portal.
          </p>
        </div>

        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
        </div>

        <div className="pt-2">
          <Link
            href="/auth/setup-password"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2f] text-black font-semibold text-xs tracking-wider uppercase transition-all duration-150 shadow-lg shadow-amber-500/10 active:scale-[0.99]"
          >
            <span>Continue to Password Setup</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
