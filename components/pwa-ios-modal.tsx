'use client';

import React from 'react';
import { X, Share, PlusSquare, ArrowDown } from 'lucide-react';

interface PWAIOSModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PWAIOSModal({ isOpen, onClose }: PWAIOSModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div 
        className="w-full max-w-sm bg-[#0E0E0E] border border-[#262626] rounded-xs p-6 shadow-2xl space-y-5 text-white font-sans relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#888] hover:text-white p-1 rounded hover:bg-[#1A1A1A] transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* HEADER */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white flex items-center justify-center rounded-xs shadow shrink-0">
            <div className="w-5 h-5 bg-black rotate-45"></div>
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-widest text-white uppercase">Install VERITAS Admin</h3>
            <p className="text-[10px] text-[#D4AF37] font-mono uppercase">Apple iOS / Safari Setup</p>
          </div>
        </div>

        <p className="text-xs text-[#AAA] leading-relaxed">
          Install the VERITAS Admin Business Control Center to your iPhone or iPad home screen for standalone, full-screen administrative access:
        </p>

        {/* STEP-BY-STEP INSTRUCTIONS */}
        <div className="space-y-3 font-mono text-xs">
          <div className="flex items-start gap-3 p-2.5 bg-[#141414] border border-[#1F1F1F] rounded-xs">
            <div className="w-6 h-6 rounded bg-[#222] border border-[#333] flex items-center justify-center text-[11px] font-bold text-[#D4AF37] shrink-0">
              1
            </div>
            <div className="text-[#CCC] text-[11px] leading-tight pt-0.5">
              Tap the <span className="text-white font-bold inline-flex items-center gap-1 mx-1"><Share className="w-3.5 h-3.5 text-[#D4AF37]" /> Share</span> button in the Safari bottom toolbar.
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 bg-[#141414] border border-[#1F1F1F] rounded-xs">
            <div className="w-6 h-6 rounded bg-[#222] border border-[#333] flex items-center justify-center text-[11px] font-bold text-[#D4AF37] shrink-0">
              2
            </div>
            <div className="text-[#CCC] text-[11px] leading-tight pt-0.5">
              Scroll down the menu and select <span className="text-white font-bold inline-flex items-center gap-1 mx-1"><PlusSquare className="w-3.5 h-3.5 text-[#D4AF37]" /> Add to Home Screen</span>.
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 bg-[#141414] border border-[#1F1F1F] rounded-xs">
            <div className="w-6 h-6 rounded bg-[#222] border border-[#333] flex items-center justify-center text-[11px] font-bold text-[#D4AF37] shrink-0">
              3
            </div>
            <div className="text-[#CCC] text-[11px] leading-tight pt-0.5">
              Tap <span className="text-white font-bold">Add</span> in the top-right corner to place <span className="text-[#D4AF37]">VERITAS Admin</span> on your home screen.
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-[#181818] hover:bg-[#222] border border-[#333] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xs transition-colors"
        >
          Got It
        </button>
      </div>
    </div>
  );
}
