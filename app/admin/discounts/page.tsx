'use client';

import { TicketPercent, Lock } from 'lucide-react';
import { AdminAccessGuard } from '@/components/admin-access-guard';
import { useAdminAuth } from '@/lib/auth-context';
import { ViewOnlyBadge } from '@/components/view-only-badge';

export default function DiscountsPage() {
  const { hasAccess } = useAdminAuth();
  const canEdit = hasAccess('canEditDiscounts');

  return (
    <AdminAccessGuard requiredPermission="canViewDiscounts" featureLabel="Promotional Codes & Discounts">
      <div className="space-y-6 pb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold uppercase tracking-widest text-white">Discounts</h1>
              {!canEdit && <ViewOnlyBadge reason="Super Admin role required to edit" />}
            </div>
            <p className="text-xs text-[#888] font-mono mt-1">
              Create and manage promotional codes for VERITAS.
            </p>
          </div>
          <button 
            disabled
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 bg-[#1A1A1A] text-[#777] border border-[#2B2B2B] text-xs font-bold uppercase tracking-wider cursor-not-allowed opacity-75"
          >
            <Lock className="w-3.5 h-3.5 mr-2 text-[#888]" />
            Create Discount (Coming Soon)
          </button>
        </div>

        <div className="bg-[#111] border border-[#1F1F1F] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left font-mono">
              <thead className="text-xs text-[#888] uppercase bg-[#151515] tracking-wider border-b border-[#1F1F1F]">
                <tr>
                  <th className="px-6 py-4 font-bold">Code</th>
                  <th className="px-6 py-4 font-bold">Type</th>
                  <th className="px-6 py-4 font-bold text-right">Value</th>
                  <th className="px-6 py-4 font-bold text-right">Redemptions</th>
                  <th className="px-6 py-4 font-bold">Expiration</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F1F1F]">
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded bg-[#1A1A1A] border border-[#262626] flex items-center justify-center mx-auto text-[#666]">
                        <TicketPercent className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">NO DISCOUNT CODES ACTIVE</h3>
                      <p className="text-xs text-[#777] font-mono">
                        Discount functionality is not enabled yet.
                      </p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminAccessGuard>
  );
}
