'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Mail,
  RefreshCw, 
  Search, 
  AlertTriangle, 
  X, 
  Loader2,
  Lock,
  ArrowRight
} from 'lucide-react';
import { AdminAccessGuard } from '@/components/admin-access-guard';
import { useAdminAuth } from '@/lib/auth-context';
import { CanonicalAdminRole } from '@/lib/auth-types';
import { recordAuditLog } from '@/lib/supabase/audit';

interface PartnerUser {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: CanonicalAdminRole;
  isActive: boolean;
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
  createdAt: string;
  updatedAt?: string;
  lastSignIn: string | null;
  isSelf: boolean;
}

export default function AdminUsersPage() {
  const { user: currentAdmin } = useAdminAuth();
  const [partners, setPartners] = useState<PartnerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const [isChangeRoleOpen, setIsChangeRoleOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<PartnerUser | null>(null);

  // Add Partner Form State
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<CanonicalAdminRole>('operations');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccessMsg, setAddSuccessMsg] = useState<string | null>(null);

  // Change Role Form State
  const [targetRole, setTargetRole] = useState<CanonicalAdminRole>('operations');
  const [roleLoading, setRoleLoading] = useState(false);

  const fetchPartners = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load administrator accounts.');
      }
      setPartners(data.partners || []);
    } catch (err: any) {
      setError(err?.message || 'Network error fetching team.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/users', {
          headers: { 'Cache-Control': 'no-cache' },
        });
        const data = await res.json();
        if (!active) return;
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load administrator accounts.');
        }
        setPartners(data.partners || []);
      } catch (err: any) {
        if (active) setError(err?.message || 'Network error fetching team.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  // Handle Add Partner Submit
  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setAddError('Please provide a valid partner email address.');
      return;
    }

    if (newRole === 'super_admin') {
      setAddError('Creation of Super Admin accounts via partner invitation is prohibited.');
      return;
    }

    setAddLoading(true);
    setAddError(null);
    setAddSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail.trim(),
          name: newName.trim(),
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to provision partner account.');
      }

      setAddSuccessMsg(`Partner invitation initiated for ${newEmail} (${newRole.toUpperCase()}).`);
      
      // Live audit log
      void recordAuditLog({
        action: 'auth.login' as any,
        actionLabel: `Super Admin invited partner: ${newEmail} as ${newRole.toUpperCase()}`,
        targetType: 'auth',
        targetId: data.partner?.userId,
        actorEmail: currentAdmin?.email,
        actorRole: currentAdmin?.role,
      });

      // Reset form
      setTimeout(() => {
        setNewEmail('');
        setNewName('');
        setNewRole('operations');
        setIsAddPartnerOpen(false);
        setAddSuccessMsg(null);
        void fetchPartners();
      }, 1200);
    } catch (err: any) {
      setAddError(err?.message || 'Failed to create partner account.');
    } finally {
      setAddLoading(false);
    }
  };

  // Handle Toggle Active Status
  const handleToggleStatus = async (partner: PartnerUser) => {
    if (partner.isSelf || partner.role === 'super_admin') {
      alert('Self-modification prevented: Founder / Super Admin account cannot be disabled.');
      return;
    }

    const nextStatus = !partner.isActive;
    const confirmMessage = nextStatus
      ? `Enable administrative access for ${partner.email}?`
      : `Disable administrative access for ${partner.email}? They will immediately lose access to all admin tools.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: partner.userId,
          isActive: nextStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update account status.');
      }

      // Record audit log
      void recordAuditLog({
        action: 'auth.logout' as any,
        actionLabel: `Super Admin ${nextStatus ? 'enabled' : 'disabled'} partner account: ${partner.email}`,
        targetType: 'auth',
        targetId: partner.userId,
        actorEmail: currentAdmin?.email,
        actorRole: currentAdmin?.role,
      });

      void fetchPartners();
    } catch (err: any) {
      alert(`Error updating account status: ${err?.message}`);
    }
  };

  // Handle Change Role Submit
  const handleChangeRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartner) return;

    if (selectedPartner.isSelf || selectedPartner.role === 'super_admin') {
      alert('Self-modification prevented: Founder / Super Admin role cannot be modified.');
      return;
    }

    if (targetRole === 'super_admin') {
      alert('Super Admin role assignment via role change is strictly restricted.');
      return;
    }

    setRoleLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedPartner.userId,
          role: targetRole,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update role.');
      }

      // Audit log
      void recordAuditLog({
        action: 'auth.login' as any,
        actionLabel: `Super Admin changed role of ${selectedPartner.email} to ${targetRole.toUpperCase()}`,
        targetType: 'auth',
        targetId: selectedPartner.userId,
        actorEmail: currentAdmin?.email,
        actorRole: currentAdmin?.role,
      });

      setIsChangeRoleOpen(false);
      setSelectedPartner(null);
      void fetchPartners();
    } catch (err: any) {
      alert(`Error updating role: ${err?.message}`);
    } finally {
      setRoleLoading(false);
    }
  };

  const filteredPartners = partners.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.email.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q)
    );
  });

  const getRoleBadge = (roleStr: CanonicalAdminRole) => {
    switch (roleStr) {
      case 'super_admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold uppercase bg-amber-950/60 text-[#D4AF37] border border-[#D4AF37]/40">
            <ShieldCheck className="w-3 h-3" />
            Super Admin
          </span>
        );
      case 'operations':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold uppercase bg-blue-950/60 text-blue-400 border border-blue-500/40">
            Operations
          </span>
        );
      case 'marketing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold uppercase bg-purple-950/60 text-purple-300 border border-purple-500/40">
            Marketing
          </span>
        );
      case 'finance':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold uppercase bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
            Finance
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold uppercase bg-neutral-900 text-neutral-300 border border-neutral-700">
            {roleStr}
          </span>
        );
    }
  };

  return (
    <AdminAccessGuard superAdminOnly={true} featureLabel="Admin Team & Partner RBAC">
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F1F1F] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37] font-bold">
                GOVERNANCE & ACCESS CONTROL
              </span>
              <span className="text-[10px] font-mono bg-amber-950/40 text-[#D4AF37] border border-[#D4AF37]/30 px-1.5 py-0.2 rounded-xs">
                SUPER ADMIN ONLY
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-wider mt-1">
              Admin & Partner Accounts
            </h1>
            <p className="text-xs text-[#888] font-mono mt-1">
              Manage VERITAS partner accounts, assign role permissions, and control dashboard accessibility.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void fetchPartners(true)}
              disabled={loading}
              className="min-h-[40px] px-3 bg-[#161616] hover:bg-[#222] border border-[#2B2B2B] rounded-xs text-xs font-mono text-[#888] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              title="Refresh Roster"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#D4AF37]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAddError(null);
                setAddSuccessMsg(null);
                setIsAddPartnerOpen(true);
              }}
              className="min-h-[40px] px-4 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs font-mono tracking-wider rounded-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-black" />
              <span>Invite Partner</span>
            </button>
          </div>
        </div>

        {/* Roles Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 bg-[#0F0F0F] border border-[#1F1F1F] rounded-xs">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase text-[#D4AF37]">
              <span>Super Admin</span>
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <p className="text-[11px] text-[#888] font-mono mt-1">
              Unrestricted access to all configuration, team management, catalog, and finances.
            </p>
          </div>

          <div className="p-3.5 bg-[#0F0F0F] border border-[#1F1F1F] rounded-xs">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase text-blue-400">
              <span>Operations</span>
              <span className="text-[9px] bg-blue-950/60 px-1 py-0.5 rounded border border-blue-500/30">LOGISTICS</span>
            </div>
            <p className="text-[11px] text-[#888] font-mono mt-1">
              Full inventory management, order fulfilment, product catalog, and media upload.
            </p>
          </div>

          <div className="p-3.5 bg-[#0F0F0F] border border-[#1F1F1F] rounded-xs">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase text-purple-300">
              <span>Marketing</span>
              <span className="text-[9px] bg-purple-950/60 px-1 py-0.5 rounded border border-purple-500/30">CREATIVE</span>
            </div>
            <p className="text-[11px] text-[#888] font-mono mt-1">
              Product content, collections, categories, media, and discount promotions.
            </p>
          </div>

          <div className="p-3.5 bg-[#0F0F0F] border border-[#1F1F1F] rounded-xs">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase text-emerald-300">
              <span>Finance</span>
              <span className="text-[9px] bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-500/30">CAPITAL</span>
            </div>
            <p className="text-[11px] text-[#888] font-mono mt-1">
              Sales revenue, financial analytics, reports, and read-only order/inventory views.
            </p>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex items-center justify-between gap-3 bg-[#0F0F0F] p-3 rounded-xs border border-[#1F1F1F]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#666] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search partner email, name, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#151515] border border-[#262626] text-white pl-9 pr-3 py-1.5 text-xs font-mono placeholder-[#555] rounded-none focus:outline-hidden focus:border-[#D4AF37]"
            />
          </div>
          <span className="text-[11px] font-mono text-[#888]">
            {filteredPartners.length} {filteredPartners.length === 1 ? 'account' : 'accounts'}
          </span>
        </div>

        {/* Partner Roster Table */}
        <div className="bg-[#0F0F0F] border border-[#1F1F1F] rounded-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37] mx-auto mb-2" />
              <p className="text-xs font-mono text-[#888]">Loading administrator team roster...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-400 font-mono text-xs space-y-2">
              <ShieldAlert className="w-6 h-6 mx-auto text-red-400" />
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void fetchPartners(true)}
                className="mt-2 text-[#D4AF37] hover:underline"
              >
                Try Again
              </button>
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="p-12 text-center text-[#777] font-mono text-xs">
              No matching administrator accounts found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[#1F1F1F] bg-[#141414] text-[#888] uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Partner / Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 hidden md:table-cell">Last Login</th>
                    <th className="py-3 px-4 hidden lg:table-cell">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {filteredPartners.map((partner) => (
                    <tr key={partner.userId} className="hover:bg-[#151515] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{partner.name}</span>
                          {partner.isSelf && (
                            <span className="text-[9px] bg-amber-950/60 text-[#D4AF37] border border-[#D4AF37]/30 px-1 py-0.2 rounded-xs">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#888]">{partner.email}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {getRoleBadge(partner.role)}
                      </td>

                      <td className="py-3.5 px-4">
                        {partner.status === 'ACTIVE' && (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            ACTIVE
                          </span>
                        )}
                        {partner.status === 'INVITED' && (
                          <span className="inline-flex items-center gap-1 text-amber-400 text-[11px] font-bold bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-xs">
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            INVITED
                          </span>
                        )}
                        {partner.status === 'DISABLED' && (
                          <span className="inline-flex items-center gap-1 text-red-400 text-[11px] font-bold bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded-xs">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            DISABLED
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 hidden md:table-cell text-[#777] text-[11px]">
                        {partner.lastSignIn 
                          ? new Date(partner.lastSignIn).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'Never logged in'}
                      </td>

                      <td className="py-3.5 px-4 hidden lg:table-cell text-[#777] text-[11px]">
                        {new Date(partner.createdAt).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {partner.isSelf || partner.role === 'super_admin' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold text-[#D4AF37] bg-amber-950/40 border border-[#D4AF37]/30 rounded-xs uppercase">
                            FOUNDER ACCOUNT
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPartner(partner);
                                setTargetRole(partner.role === 'super_admin' ? 'operations' : partner.role);
                                setIsChangeRoleOpen(true);
                              }}
                              className="px-2.5 py-1 bg-[#1A1A1A] hover:bg-[#262626] border border-[#333] text-white hover:text-[#D4AF37] rounded-xs text-[11px] transition-colors cursor-pointer"
                            >
                              Change Role
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleToggleStatus(partner)}
                              className={`px-2.5 py-1 border rounded-xs text-[11px] transition-colors cursor-pointer ${
                                partner.isActive
                                  ? 'bg-red-950/30 hover:bg-red-950/60 border-red-900/50 text-red-300'
                                  : 'bg-emerald-950/30 hover:bg-emerald-950/60 border-emerald-900/50 text-emerald-300'
                              }`}
                            >
                              {partner.isActive ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* ADD PARTNER MODAL                                                         */}
        {/* ========================================================================= */}
        {isAddPartnerOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog" 
            aria-modal="true"
          >
            <div className="fixed inset-0" onClick={() => !addLoading && setIsAddPartnerOpen(false)} />
            
            <div className="relative w-full max-w-lg bg-[#0E0E0E] border border-[#2B2B2B] rounded-xs shadow-2xl p-6 text-[#E0E0E0] z-10 space-y-5">
              <div className="flex items-start justify-between border-b border-[#1F1F1F] pb-4">
                <div>
                  <span className="text-[9px] font-mono tracking-[0.2em] text-[#D4AF37] uppercase block font-bold">
                    TEAM GOVERNANCE
                  </span>
                  <h2 className="text-base font-bold text-white uppercase tracking-wider mt-0.5">
                    Invite Business Partner
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddPartnerOpen(false)}
                  disabled={addLoading}
                  className="text-[#777] hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {addError && (
                <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xs text-xs text-red-300 font-mono flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{addError}</span>
                </div>
              )}

              {addSuccessMsg && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xs text-xs text-emerald-300 font-mono flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{addSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleAddPartner} className="space-y-4">
                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-[#A0A0A0] block mb-1">
                    Partner Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="partner@veritas.internal"
                    className="w-full bg-[#161616] border border-[#2B2B2B] text-white px-3 py-2 text-xs font-mono rounded-none focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-[#A0A0A0] block mb-1">
                    Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Marcus Vance"
                    className="w-full bg-[#161616] border border-[#2B2B2B] text-white px-3 py-2 text-xs font-mono rounded-none focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-[#A0A0A0] block mb-1">
                    Partner Role *
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as CanonicalAdminRole)}
                    className="w-full bg-[#161616] border border-[#2B2B2B] text-white px-3 py-2 text-xs font-mono rounded-none focus:outline-hidden focus:border-[#D4AF37]"
                  >
                    <option value="operations">Operations & Production (Inventory, Orders, Fulfilment, Media)</option>
                    <option value="marketing">Creative & Marketing (Content, Collections, Categories, Discounts)</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddPartnerOpen(false)}
                    disabled={addLoading}
                    className="px-4 py-2 bg-[#161616] hover:bg-[#222] border border-[#2B2B2B] text-white text-xs font-mono uppercase tracking-wider rounded-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="px-5 py-2 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold text-xs font-mono uppercase tracking-wider rounded-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {addLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Invite...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5 text-black" />
                        <span>Send Partner Invitation</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CHANGE ROLE MODAL                                                         */}
        {/* ========================================================================= */}
        {isChangeRoleOpen && selectedPartner && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog" 
            aria-modal="true"
          >
            <div className="fixed inset-0" onClick={() => !roleLoading && setIsChangeRoleOpen(false)} />
            
            <div className="relative w-full max-w-md bg-[#0E0E0E] border border-[#2B2B2B] rounded-xs shadow-2xl p-6 text-[#E0E0E0] z-10 space-y-5">
              <div className="flex items-start justify-between border-b border-[#1F1F1F] pb-4">
                <div>
                  <span className="text-[9px] font-mono tracking-[0.2em] text-[#D4AF37] uppercase block font-bold">
                    MODIFY PERMISSIONS
                  </span>
                  <h2 className="text-base font-bold text-white uppercase tracking-wider mt-0.5">
                    Change Partner Role
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChangeRoleOpen(false)}
                  disabled={roleLoading}
                  className="text-[#777] hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-[#141414] border border-[#222] rounded-xs space-y-1 text-xs font-mono">
                <div className="text-[#888]">Account:</div>
                <div className="text-white font-bold">{selectedPartner.email}</div>
                <div className="text-[11px] text-[#777]">Current Role: <span className="text-[#D4AF37] uppercase">{selectedPartner.role}</span></div>
              </div>

              <form onSubmit={handleChangeRoleSubmit} className="space-y-4">
                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-[#A0A0A0] block mb-1">
                    Select New Role
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as CanonicalAdminRole)}
                    className="w-full bg-[#161616] border border-[#2B2B2B] text-white px-3 py-2 text-xs font-mono rounded-none focus:outline-hidden focus:border-[#D4AF37]"
                  >
                    <option value="operations">Operations & Production (Inventory, Orders, Fulfilment, Media)</option>
                    <option value="marketing">Creative & Marketing (Content, Collections, Categories, Discounts)</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsChangeRoleOpen(false)}
                    disabled={roleLoading}
                    className="px-4 py-2 bg-[#161616] hover:bg-[#222] border border-[#2B2B2B] text-white text-xs font-mono uppercase tracking-wider rounded-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={roleLoading}
                    className="px-5 py-2 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold text-xs font-mono uppercase tracking-wider rounded-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {roleLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Role...</span>
                      </>
                    ) : (
                      <span>Save Role</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminAccessGuard>
  );
}
