'use client';

import React from 'react';
import { Eye } from 'lucide-react';

interface ViewOnlyBadgeProps {
  reason?: string;
  className?: string;
}

export function ViewOnlyBadge({ reason, className = '' }: ViewOnlyBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/50 border border-amber-800/60 rounded-xs text-[#D4AF37] text-[10px] font-mono font-bold uppercase tracking-wider shadow-xs ${className}`}>
      <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
      <span>VIEW ONLY</span>
      {reason && (
        <span className="text-[#888] normal-case border-l border-[#333] pl-1.5 ml-0.5">
          ({reason})
        </span>
      )}
    </div>
  );
}
