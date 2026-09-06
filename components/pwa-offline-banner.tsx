'use client';

import React from 'react';
import { WifiOff, AlertTriangle } from 'lucide-react';
import { usePWA } from '@/hooks/use-pwa';

export function PWAOfflineBanner() {
  const { isOnline } = usePWA();

  if (isOnline) return null;

  return (
    <div className="bg-amber-950/80 border-b border-amber-600/60 text-amber-200 px-4 py-2 flex items-center justify-between text-xs font-mono shrink-0 shadow-lg animate-in slide-in-from-top duration-200">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
        <div>
          <span className="font-bold uppercase tracking-wider text-amber-300">Offline State: </span>
          <span className="text-[11px] text-amber-200/90">
            You are offline. Live VERITAS Admin data is temporarily unavailable.
          </span>
        </div>
      </div>
      <span className="text-[10px] uppercase font-bold text-amber-400/80 bg-black/40 px-2 py-0.5 rounded border border-amber-800/60 hidden sm:inline">
        Mutations Disabled
      </span>
    </div>
  );
}
