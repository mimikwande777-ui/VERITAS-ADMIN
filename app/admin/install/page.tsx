'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Download, 
  Smartphone, 
  Monitor, 
  Apple, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Share, 
  PlusSquare, 
  HelpCircle, 
  Wifi, 
  Bell, 
  Layers, 
  Lock, 
  RefreshCw 
} from 'lucide-react';
import { usePWA } from '@/hooks/use-pwa';
import { PWAIOSModal } from '@/components/pwa-ios-modal';

export default function AdminInstallPage() {
  const { isInstallable, isInstalled, isStandalone, isIOS, isOnline, install } = usePWA();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'windows' | 'mac' | 'other'>('other');
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = setTimeout(() => {
      const ua = window.navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(ua)) {
        setPlatform('ios');
      } else if (/android/.test(ua)) {
        setPlatform('android');
      } else if (/windows/.test(ua)) {
        setPlatform('windows');
      } else if (/macintosh|mac os x/.test(ua)) {
        setPlatform('mac');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      try {
        await install();
      } finally {
        setInstalling(false);
      }
    } else if (isIOS || platform === 'ios') {
      setShowIOSModal(true);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16 font-sans">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F1F1F] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#888] mb-1">
            <span>VERITAS ADMIN</span>
            <span>/</span>
            <span className="text-[#D4AF37] font-bold">INSTALLATION & PWA GUIDE</span>
          </div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-white">
            Install VERITAS Admin App
          </h1>
          <p className="text-xs text-[#888] font-mono mt-1">
            DEDICATED PROGRESSIVE WEB APPLICATION (PWA) FOR IOS, ANDROID, WINDOWS & MAC
          </p>
        </div>

        {/* Action Button */}
        <div className="w-full sm:w-auto">
          {isStandalone || isInstalled ? (
            <div className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 text-xs font-mono font-bold uppercase tracking-wider rounded-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Installed (Standalone)</span>
            </div>
          ) : isInstallable ? (
            <button
              type="button"
              onClick={handleInstallClick}
              disabled={installing}
              className="w-full sm:w-auto flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 bg-[#D4AF37] hover:bg-[#B3932F] text-black text-xs font-mono font-bold uppercase tracking-wider rounded-xs transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{installing ? 'Installing...' : 'Install VERITAS Admin'}</span>
            </button>
          ) : isIOS || platform === 'ios' ? (
            <button
              type="button"
              onClick={() => setShowIOSModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 bg-[#181818] hover:bg-[#222] border border-[#D4AF37] text-[#D4AF37] text-xs font-mono font-bold uppercase tracking-wider rounded-xs transition-colors active:scale-95 cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>iOS Install Instructions</span>
            </button>
          ) : (
            <div className="text-[11px] font-mono text-[#888] bg-[#141414] border border-[#222] px-3 py-2.5 min-h-[44px] flex items-center justify-center rounded-xs">
              Install via browser menu (Chrome / Edge / Safari)
            </div>
          )}
        </div>
      </div>

      {/* OVERVIEW INTRO */}
      <div className="bg-[#0E0E0E] border border-[#1F1F1F] p-6 rounded-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white flex items-center justify-center rounded-xs shadow shrink-0">
            <div className="w-5 h-5 bg-black rotate-45"></div>
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-widest text-white uppercase font-mono">
              Enterprise Business Control Center
            </h2>
            <p className="text-[11px] text-[#D4AF37] font-mono">
              Progressive Web App Architecture • Direct Deployment Updates
            </p>
          </div>
        </div>
        <p className="text-xs text-[#AAA] leading-relaxed">
          The VERITAS Admin application is built as an installable Progressive Web App (PWA). 
          When installed, it runs in a clean, dedicated window with no browser URL bars or distracting tab clutter, 
          launching directly into <code className="text-[#D4AF37] bg-black/40 px-1 py-0.5 rounded font-mono">/admin/dashboard</code>.
          Redeployments to the web application automatically update your installed app without requiring app store downloads.
        </p>
      </div>

      {/* DEVICE-SPECIFIC INSTRUCTION CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* IPHONE / IPAD (IOS) */}
        <div className={`p-6 bg-[#111] border rounded-xs flex flex-col justify-between ${platform === 'ios' ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/30' : 'border-[#1F1F1F]'}`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Apple className="w-5 h-5 text-white" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">iPhone / iPad</h3>
              </div>
              {platform === 'ios' && (
                <span className="text-[9px] font-mono uppercase bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-1.5 py-0.5 rounded">
                  Your Device
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#888] font-mono">Safari WebKit Installation</p>

            <ol className="space-y-3 font-mono text-[11px] text-[#CCC]">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#222] text-[#D4AF37] flex items-center justify-center font-bold shrink-0 mt-0.5">1</span>
                <span>Open this admin URL in <strong className="text-white">Apple Safari</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#222] text-[#D4AF37] flex items-center justify-center font-bold shrink-0 mt-0.5">2</span>
                <span>Tap the <strong className="text-white">Share</strong> icon <Share className="w-3 h-3 inline text-[#D4AF37]" /> in the bottom bar.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#222] text-[#D4AF37] flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
                <span>Select <strong className="text-white">Add to Home Screen</strong> <PlusSquare className="w-3 h-3 inline text-[#D4AF37]" />.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#222] text-[#D4AF37] flex items-center justify-center font-bold shrink-0 mt-0.5">4</span>
                <span>Tap <strong className="text-white">Add</strong> in top right.</span>
              </li>
            </ol>
          </div>

          <button
            type="button"
            onClick={() => setShowIOSModal(true)}
            className="mt-6 w-full min-h-[44px] py-2.5 px-4 bg-[#1A1A1A] hover:bg-[#222] border border-[#333] text-xs font-mono uppercase font-bold text-[#DDD] transition-colors rounded-xs active:scale-98 flex items-center justify-center"
          >
            Show Visual Guide
          </button>
        </div>

        {/* ANDROID */}
        <div className={`p-6 bg-[#111] border rounded-xs flex flex-col justify-between ${platform === 'android' ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/30' : 'border-[#1F1F1F]'}`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#3DDC84]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">Android</h3>
              </div>
              {platform === 'android' && (
                <span className="text-[9px] font-mono uppercase bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-1.5 py-0.5 rounded">
                  Your Device
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#888] font-mono">Google Chrome Installation</p>

            <ol className="space-y-3 font-mono text-[11px] text-[#CCC]">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#222] text-[#D4AF37] flex items-center justify-center font-bold shrink-0 mt-0.5">1</span>
                <span>Open in <strong className="text-white">Chrome on Android</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#222] text-[#D4AF37] flex items-center justify-center font-bold shrink-0 mt-0.5">2</span>
                <span>Tap the <strong className="text-white">Install App</strong> button or the 3-dot menu.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#222] text-[#D4AF37] flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
                <span>Select <strong className="text-white">Install app</strong> or <strong className="text-white">Add to Home Screen</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#222] text-[#D4AF37] flex items-center justify-center font-bold shrink-0 mt-0.5">4</span>
                <span>Confirm installation prompt.</span>
              </li>
            </ol>
          </div>

          {isInstallable ? (
            <button
              type="button"
              onClick={handleInstallClick}
              className="mt-6 w-full min-h-[44px] py-2.5 px-4 bg-[#D4AF37] hover:bg-[#B3932F] text-black text-xs font-mono uppercase font-bold transition-colors rounded-xs active:scale-98 flex items-center justify-center"
            >
              Install on Android
            </button>
          ) : (
            <div className="mt-6 text-center text-[10px] font-mono text-[#666] min-h-[44px] flex items-center justify-center">
              Available via Chrome Menu
            </div>
          )}
        </div>

        {/* WINDOWS & MAC */}
        <div className={`p-6 bg-[#111] border rounded-xs flex flex-col justify-between ${platform === 'windows' || platform === 'mac' ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/30' : 'border-[#1F1F1F]'}`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-[#0078D7]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">Windows / Mac</h3>
              </div>
              {(platform === 'windows' || platform === 'mac') && (
                <span className="text-[9px] font-mono uppercase bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-1.5 py-0.5 rounded">
                  Your Device
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#888] font-mono">Chrome or Microsoft Edge</p>

            <ol className="space-y-3 font-mono text-[11px] text-[#CCC]">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#222] text-[#D4AF37] flex items-center justify-center font-bold shrink-0 mt-0.5">1</span>
                <span>Open in <strong className="text-white">Edge or Chrome</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#222] text-[#D4AF37] flex items-center justify-center font-bold shrink-0 mt-0.5">2</span>
                <span>Click the <strong className="text-white">App Install icon</strong> in the address bar (right side).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#222] text-[#D4AF37] flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
                <span>Click <strong className="text-white">Install</strong> in the popup dialog.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#222] text-[#D4AF37] flex items-center justify-center font-bold shrink-0 mt-0.5">4</span>
                <span>VERITAS Admin launches in its own standalone window.</span>
              </li>
            </ol>
          </div>

          {isInstallable ? (
            <button
              type="button"
              onClick={handleInstallClick}
              className="mt-6 w-full min-h-[44px] py-2.5 px-4 bg-[#D4AF37] hover:bg-[#B3932F] text-black text-xs font-mono uppercase font-bold transition-colors rounded-xs active:scale-98 flex items-center justify-center"
            >
              Install on Desktop
            </button>
          ) : (
            <div className="mt-6 text-center text-[10px] font-mono text-[#666] min-h-[44px] flex items-center justify-center">
              Available via Address Bar / Menu
            </div>
          )}
        </div>
      </div>

      {/* TECHNICAL DIAGNOSTICS TABLE */}
      <div className="bg-[#111] border border-[#1F1F1F] p-6 rounded-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white font-mono border-b border-[#1F1F1F] pb-3">
          PWA Architecture & Telemetry
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-3 bg-[#0A0A0A] border border-[#222] rounded-xs space-y-1">
            <span className="text-[10px] text-[#666] uppercase block">Manifest Status</span>
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Valid & Active</span>
            </div>
            <p className="text-[10px] text-[#555]">/app/manifest.ts (/manifest.webmanifest)</p>
          </div>

          <div className="p-3 bg-[#0A0A0A] border border-[#222] rounded-xs space-y-1">
            <span className="text-[10px] text-[#666] uppercase block">PWA Scope</span>
            <div className="text-white font-bold">/admin/</div>
            <p className="text-[10px] text-[#555]">Storefront strictly isolated</p>
          </div>

          <div className="p-3 bg-[#0A0A0A] border border-[#222] rounded-xs space-y-1">
            <span className="text-[10px] text-[#666] uppercase block">Start URL</span>
            <div className="text-[#D4AF37] font-bold">/admin/dashboard</div>
            <p className="text-[10px] text-[#555]">Direct dashboard entry point</p>
          </div>

          <div className="p-3 bg-[#0A0A0A] border border-[#222] rounded-xs space-y-1">
            <span className="text-[10px] text-[#666] uppercase block">Display Mode</span>
            <div className={`font-bold ${isStandalone ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isStandalone ? 'Standalone Window' : 'Browser Viewport'}
            </div>
            <p className="text-[10px] text-[#555]">display: standalone</p>
          </div>

          <div className="p-3 bg-[#0A0A0A] border border-[#222] rounded-xs space-y-1">
            <span className="text-[10px] text-[#666] uppercase block">Service Worker</span>
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Registered (/sw.js)</span>
            </div>
            <p className="text-[10px] text-[#555]">Static cache / Secure API pass-through</p>
          </div>

          <div className="p-3 bg-[#0A0A0A] border border-[#222] rounded-xs space-y-1">
            <span className="text-[10px] text-[#666] uppercase block">Push Notifications</span>
            <div className="text-zinc-400 font-bold">PREPARED / NOT YET ENABLED</div>
            <p className="text-[10px] text-[#555]">Ready for future backend bridge</p>
          </div>
        </div>
      </div>

      <PWAIOSModal isOpen={showIOSModal} onClose={() => setShowIOSModal(false)} />
    </div>
  );
}
