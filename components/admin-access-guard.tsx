'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Lock, LogOut } from 'lucide-react';
import { useAdminAuth } from '@/lib/auth-context';
import { CanonicalAdminRole, PermissionString, hasPermission } from '@/lib/auth-types';

interface AdminAccessGuardProps {
  children: React.ReactNode;
  requiredPermission?: PermissionString | PermissionString[];
  requiredRole?: CanonicalAdminRole | CanonicalAdminRole[];
  superAdminOnly?: boolean;
  featureLabel?: string;
}

export function AdminAccessGuard({
  children,
  requiredPermission,
  requiredRole,
  superAdminOnly = false,
  featureLabel,
}: AdminAccessGuardProps) {
  const { user, role, isAuthenticated, isLoading, openUnlockModal, signOut } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 1. If not authenticated, require unlock for sensitive/restricted sections
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-[#0F0F0F] border border-[#2B2B2B] rounded-xs shadow-2xl text-center space-y-5">
        <div className="w-12 h-12 rounded-xs bg-amber-950/40 border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <div>
          <span className="text-[10px] font-mono tracking-[0.2em] text-[#D4AF37] uppercase block font-bold">
            RESTRICTED PIPELINE
          </span>
          <h2 className="text-lg font-bold text-white uppercase tracking-wider mt-1">
            {featureLabel ? `${featureLabel} Requires Authorization` : 'Authentication Required'}
          </h2>
          <p className="text-xs text-[#888] font-mono mt-2 leading-relaxed">
            Please unlock with your verified administrator credentials to access this protected control view.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={openUnlockModal}
            className="min-h-[44px] px-6 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs font-mono tracking-wider rounded-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Lock className="w-4 h-4 text-black" />
            <span>Unlock Admin</span>
          </button>
          <Link
            href="/admin/dashboard"
            className="min-h-[44px] px-4 bg-[#161616] hover:bg-[#222] border border-[#2B2B2B] text-white font-mono text-xs uppercase tracking-wider rounded-xs flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  // 2. Super Admin Only check
  if (superAdminOnly && role !== 'super_admin') {
    return (
      <div className="max-w-lg mx-auto my-12 p-6 sm:p-8 bg-[#0E0E0E] border border-red-950/60 rounded-xs shadow-2xl text-center space-y-5">
        <div className="w-14 h-14 rounded-xs bg-red-950/50 border border-red-800/60 text-red-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div>
          <span className="text-[10px] font-mono tracking-[0.25em] text-red-400 uppercase block font-bold">
            HTTP 403 — FORBIDDEN
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-white uppercase tracking-wider mt-1">
            Super Admin Access Only
          </h2>
          <p className="text-xs text-[#A0A0A0] font-mono mt-2 leading-relaxed">
            This administrative area is strictly reserved for the <span className="text-[#D4AF37] font-semibold">Super Admin</span> role.
            Your current account role is <span className="text-white font-bold uppercase font-mono bg-[#1C1C1C] px-1.5 py-0.5 rounded border border-[#333]">{role ? role.replace('_', ' ') : 'UNKNOWN'}</span>.
          </p>
        </div>

        <div className="p-3 bg-[#141414] border border-[#222] rounded-xs text-left text-[11px] font-mono text-[#777] space-y-1">
          <div className="flex justify-between">
            <span>Actor:</span>
            <span className="text-white">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span>Required Role:</span>
            <span className="text-[#D4AF37]">super_admin</span>
          </div>
          <div className="flex justify-between">
            <span>Enforcement:</span>
            <span className="text-emerald-400">Server-Side RBAC Guard</span>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/admin/dashboard"
            className="min-h-[44px] px-5 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs font-mono tracking-wider rounded-xs flex items-center justify-center gap-2 transition-all shadow-md"
          >
            <ArrowLeft className="w-4 h-4 text-black" />
            <span>Return to Dashboard</span>
          </Link>
          <button
            type="button"
            onClick={() => { void signOut(); }}
            className="min-h-[44px] px-4 bg-[#161616] hover:bg-red-950/30 hover:border-red-900/40 border border-[#262626] text-[#888] hover:text-red-400 font-mono text-xs uppercase tracking-wider rounded-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Role Check
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (role && !roles.includes(role) && role !== 'super_admin') {
      return (
        <div className="max-w-lg mx-auto my-12 p-6 sm:p-8 bg-[#0E0E0E] border border-red-950/60 rounded-xs shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-xs bg-red-950/50 border border-red-800/60 text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[10px] font-mono tracking-[0.25em] text-red-400 uppercase block font-bold">
              HTTP 403 — ACCESS DENIED
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-white uppercase tracking-wider mt-1">
              Insufficient Role Permissions
            </h2>
            <p className="text-xs text-[#A0A0A0] font-mono mt-2 leading-relaxed">
              Access to {featureLabel || 'this section'} requires one of: <span className="text-[#D4AF37] font-semibold font-mono uppercase">{roles.join(', ')}</span>.
              Your current role is <span className="text-white font-bold uppercase font-mono bg-[#1C1C1C] px-1.5 py-0.5 rounded border border-[#333]">{role ? role.replace('_', ' ') : 'UNKNOWN'}</span>.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/admin/dashboard"
              className="min-h-[44px] px-5 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs font-mono tracking-wider rounded-xs flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <ArrowLeft className="w-4 h-4 text-black" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      );
    }
  }

  // 4. Permission Check
  if (requiredPermission) {
    const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasAny = permissions.some((p) => hasPermission(user, p));
    if (!hasAny && role !== 'super_admin') {
      return (
        <div className="max-w-lg mx-auto my-12 p-6 sm:p-8 bg-[#0E0E0E] border border-red-950/60 rounded-xs shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-xs bg-red-950/50 border border-red-800/60 text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[10px] font-mono tracking-[0.25em] text-red-400 uppercase block font-bold">
              HTTP 403 — ACCESS DENIED
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-white uppercase tracking-wider mt-1">
              Permission Required
            </h2>
            <p className="text-xs text-[#A0A0A0] font-mono mt-2 leading-relaxed">
              Your partner account does not have permission for {featureLabel || 'this action'}.
              Missing permission: <span className="text-red-300 font-mono font-semibold">{permissions.join(' or ')}</span>.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/admin/dashboard"
              className="min-h-[44px] px-5 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs font-mono tracking-wider rounded-xs flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <ArrowLeft className="w-4 h-4 text-black" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
