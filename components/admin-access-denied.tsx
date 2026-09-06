'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, LogOut, Lock } from 'lucide-react';
import { useAdminAuth } from '@/lib/auth-context';

interface AdminAccessDeniedProps {
  sectionName?: string;
  requiredRole?: string;
}

export function AdminAccessDenied({ 
  sectionName = 'This Section', 
  requiredRole = 'super_admin' 
}: AdminAccessDeniedProps) {
  const { user, role, signOut } = useAdminAuth();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0F0F0F] border border-red-900/50 rounded-xs p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
        {/* Subtle accent border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-red-600"></div>

        {/* Shield & Lock Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-red-950/40 border border-red-800/60 flex items-center justify-center text-red-500 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-red-400 font-bold block">
            SECURITY PROTOCOL 403
          </span>
          <h1 className="text-2xl font-black uppercase tracking-wider text-white">
            ACCESS DENIED
          </h1>
          <p className="text-xs text-[#888] font-mono max-w-md mx-auto leading-relaxed">
            Your current administrative account does not possess the clearance required to view or modify <strong className="text-white">{sectionName}</strong>.
          </p>
        </div>

        {/* Security Credential Breakdown */}
        <div className="bg-[#141414] border border-[#222] rounded-xs p-4 text-left font-mono text-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#222] pb-2">
            <span className="text-[#666] uppercase text-[10px]">Current Session:</span>
            <span className="text-white truncate max-w-[200px]">{user?.email || 'Authenticated User'}</span>
          </div>
          <div className="flex items-center justify-between border-b border-[#222] pb-2">
            <span className="text-[#666] uppercase text-[10px]">Your Role:</span>
            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
              {role.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#666] uppercase text-[10px]">Required Clearance:</span>
            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-950/60 text-amber-300 border border-amber-700/60">
              {requiredRole.toUpperCase()} ONLY
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/admin/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-[#D4AF37] text-xs font-bold uppercase tracking-wider rounded-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
          <button
            onClick={() => { void signOut(); }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#181818] hover:bg-[#222] border border-[#333] text-[#AAA] hover:text-white text-xs font-bold uppercase tracking-wider rounded-xs transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Switch Account</span>
          </button>
        </div>

        <div className="text-[10px] font-mono text-[#555] tracking-tight">
          VERITAS ENTERPRISE RBAC • INCIDENT LOGGED
        </div>
      </div>
    </div>
  );
}
