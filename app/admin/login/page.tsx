'use client';

/**
 * TEMPORARILY DISABLED ADMIN AUTH
 * RESTORE BEFORE PUBLIC PRODUCTION USE
 * 
 * The /admin/login route no longer renders an authentication form.
 * It immediately redirects to /admin/dashboard.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#070707] flex flex-col items-center justify-center text-[#888] font-mono text-xs space-y-3">
      <div className="w-5 h-5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
      <span className="text-[11px] tracking-widest uppercase text-[#AAA]">
        Redirecting to Admin Dashboard...
      </span>
    </div>
  );
}
