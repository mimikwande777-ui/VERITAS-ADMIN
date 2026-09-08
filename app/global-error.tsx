'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global critical error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-[#0A0A0A] text-[#E0E0E0] min-h-screen flex flex-col items-center justify-center p-6 text-center font-sans antialiased">
        <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center rounded-xs mb-6 text-[#D4AF37]">
          <span className="font-bold text-xl font-mono">!</span>
        </div>
        <h1 className="text-2xl font-light tracking-widest text-white mb-2 uppercase">Application Error</h1>
        <p className="text-xs font-mono text-[#888] tracking-wider uppercase mb-8 max-w-md">
          A critical system error occurred. Please try reloading the application.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#B3932F] text-black text-xs font-mono tracking-wider uppercase font-bold transition-colors cursor-pointer"
        >
          Reload Application
        </button>
      </body>
    </html>
  );
}
