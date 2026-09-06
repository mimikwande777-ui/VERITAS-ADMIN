'use client';

import React, { useState } from 'react';
import { Download, Smartphone, Check, HelpCircle } from 'lucide-react';
import { usePWA } from '@/hooks/use-pwa';
import { PWAIOSModal } from '@/components/pwa-ios-modal';
import Link from 'next/link';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'settings' | 'banner';
  className?: string;
}

export function PWAInstallButton({ variant = 'header', className = '' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isStandalone, isIOS, install } = usePWA();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already running as an installed standalone app, suppress the button or display installed status
  if (isStandalone || isInstalled) {
    if (variant === 'settings') {
      return (
        <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs bg-emerald-950/40 border border-emerald-800/40 px-3 py-2 rounded-xs">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>VERITAS Admin is installed and running in Standalone PWA mode.</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      try {
        await install();
      } finally {
        setInstalling(false);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  if (variant === 'header') {
    if (!isInstallable && !isIOS) {
      return (
        <Link
          href="/admin/install"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-[#141414] hover:bg-[#1E1E1E] border border-[#2B2B2B] hover:border-[#D4AF37]/50 text-[#CCC] hover:text-[#D4AF37] text-xs font-mono uppercase tracking-wider rounded-xs transition-colors ${className}`}
          title="Install VERITAS Admin App"
        >
          <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span className="hidden sm:inline text-[11px]">Install App</span>
        </Link>
      );
    }

    return (
      <>
        <button
          onClick={handleInstallClick}
          disabled={installing}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-[#141414] hover:bg-[#1E1E1E] border border-[#D4AF37]/40 hover:border-[#D4AF37] text-[#D4AF37] hover:text-white text-xs font-mono uppercase tracking-wider rounded-xs transition-all shadow-sm cursor-pointer ${className}`}
          title="Install VERITAS Admin App to device"
        >
          <Download className="w-3.5 h-3.5 animate-bounce" />
          <span className="hidden sm:inline text-[11px]">
            {isIOS ? 'Install (iOS)' : 'Install App'}
          </span>
        </button>
        <PWAIOSModal isOpen={showIOSModal} onClose={() => setShowIOSModal(false)} />
      </>
    );
  }

  if (variant === 'sidebar') {
    return (
      <>
        <div className={`px-4 py-2 border-b border-[#1A1A1A] ${className}`}>
          {isInstallable || isIOS ? (
            <button
              onClick={handleInstallClick}
              className="w-full flex items-center justify-between px-3 py-2 bg-[#161616] hover:bg-[#202020] border border-[#D4AF37]/40 hover:border-[#D4AF37] rounded-xs text-xs font-mono text-[#D4AF37] hover:text-white transition-all group cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Download className="w-3.5 h-3.5 text-[#D4AF37] group-hover:scale-110 transition-transform" />
                <span className="font-bold uppercase tracking-wider text-[11px]">Install Admin PWA</span>
              </span>
              <Smartphone className="w-3.5 h-3.5 text-[#888] group-hover:text-white" />
            </button>
          ) : (
            <Link
              href="/admin/install"
              className="flex items-center justify-between px-3 py-2 bg-[#141414] hover:bg-[#1C1C1C] border border-[#262626] hover:border-[#D4AF37]/40 rounded-xs text-xs font-mono text-[#AAA] hover:text-white transition-all"
            >
              <span className="flex items-center gap-2">
                <HelpCircle className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="text-[11px]">Install / Help</span>
              </span>
              <span className="text-[10px] text-[#666]">PWA</span>
            </Link>
          )}
        </div>
        <PWAIOSModal isOpen={showIOSModal} onClose={() => setShowIOSModal(false)} />
      </>
    );
  }

  if (variant === 'settings') {
    return (
      <>
        <div className={`p-4 bg-[#141414] border border-[#222] rounded-xs space-y-3 ${className}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xs bg-[#222] border border-[#333] flex items-center justify-center text-xs font-bold text-[#D4AF37]">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Progressive Web App (PWA)</h4>
                <p className="text-[10px] text-[#888] font-mono">Install VERITAS Admin as a dedicated desktop or mobile app</p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
              BROWSER MODE
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-[#1F1F1F]">
            {isInstallable ? (
              <button
                onClick={handleInstallClick}
                disabled={installing}
                className="w-full sm:w-auto px-4 py-2 bg-[#D4AF37] hover:bg-[#B3932F] text-black text-xs font-bold font-mono uppercase tracking-wider rounded-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{installing ? 'Installing...' : 'Install VERITAS Admin App'}</span>
              </button>
            ) : isIOS ? (
              <button
                onClick={() => setShowIOSModal(true)}
                className="w-full sm:w-auto px-4 py-2 bg-[#1A1A1A] hover:bg-[#252525] border border-[#D4AF37]/50 text-[#D4AF37] text-xs font-bold font-mono uppercase tracking-wider rounded-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Add to iOS Home Screen</span>
              </button>
            ) : null}

            <Link
              href="/admin/install"
              className="w-full sm:w-auto px-4 py-2 bg-[#1A1A1A] hover:bg-[#222] border border-[#333] text-[#CCC] hover:text-white text-xs font-mono uppercase tracking-wider rounded-xs flex items-center justify-center gap-2 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Installation Guide & System Diagnostics</span>
            </Link>
          </div>
        </div>
        <PWAIOSModal isOpen={showIOSModal} onClose={() => setShowIOSModal(false)} />
      </>
    );
  }

  return null;
}
