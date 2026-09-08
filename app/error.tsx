'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center rounded-xs mb-6 text-[#D4AF37]">
        <span className="font-bold text-lg font-mono">!</span>
      </div>
      <h1 className="text-2xl font-light tracking-widest text-white mb-2 uppercase">Something went wrong</h1>
      <p className="text-xs font-mono text-[#888] tracking-wider uppercase mb-8 max-w-md">
        An unexpected error occurred while processing your request.
      </p>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => reset()}
          className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#B3932F] text-black text-xs font-mono tracking-wider uppercase font-bold transition-colors cursor-pointer"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="px-6 py-2.5 bg-[#161616] text-[#CCC] border border-[#333] text-xs font-mono tracking-wider uppercase hover:border-[#D4AF37] hover:text-white transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
