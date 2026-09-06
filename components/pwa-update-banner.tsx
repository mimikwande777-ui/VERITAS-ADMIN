'use client';

import React from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { usePWA } from '@/hooks/use-pwa';

export function PWAUpdateBanner() {
  const { isUpdateAvailable, updateServiceWorker } = usePWA();
  const [dismissed, setDismissed] = React.useState(false);

  if (!isUpdateAvailable || dismissed) return null;

  return (
    <div className="bg-[#141414] border-b border-[#D4AF37]/50 text-white px-4 py-2 flex items-center justify-between text-xs font-mono shrink-0 shadow-xl animate-in slide-in-from-top duration-200">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
        <span className="text-[11px] text-[#DDD]">
          A new VERITAS Admin version is available.
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={updateServiceWorker}
          className="px-2.5 py-1 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase tracking-wider text-[10px] rounded-xs flex items-center gap-1 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Refresh to Update</span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-[#888] hover:text-white p-0.5"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
